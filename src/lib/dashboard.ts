import { prisma } from "@/lib/prisma";
import { executeKw } from "@/lib/odoo";
import { getStoreSettingsRow } from "@/lib/settings";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

const CHART_DAYS = 14;

// Todas las estadísticas del home del admin, en un solo lugar. Se pisa
// bastante con lo que ya calculan las páginas de cada sección, pero acá
// interesa la foto agregada, no el detalle — separado a propósito para no
// mezclar responsabilidades.
export async function getDashboardStats() {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const chartStart = daysAgo(CHART_DAYS - 1);

  const [
    settings,
    userCount,
    newUsersThisWeek,
    revenueThisMonthAgg,
    revenueLastMonthAgg,
    pendingOrdersCount,
    confirmedOrdersCount,
    cancelledOrdersCount,
    chartOrders,
    recentOrders,
    ordersByPaymentMethod,
    abandonedCartCount,
    abandonedCartValueAgg,
    recentAbandonedCarts,
    waitlistCount,
    recentWaitlist,
    activeCouponsCount,
    subscriberCount,
    pointsIssuedAgg,
    pointsRedeemedAgg,
    mailCampaignsSentCount,
    heroSlideCount,
  ] = await Promise.all([
    getStoreSettingsRow(),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: daysAgo(6) } } }),
    prisma.order.aggregate({
      _sum: { total: true },
      _count: true,
      where: { status: "confirmed", createdAt: { gte: startOfThisMonth } },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: "confirmed", createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } },
    }),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.count({ where: { status: "confirmed" } }),
    prisma.order.count({ where: { status: "cancelled" } }),
    prisma.order.findMany({
      where: { status: "confirmed", createdAt: { gte: chartStart } },
      select: { total: true, createdAt: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, customerName: true, total: true, status: true, paymentMethod: true, createdAt: true },
    }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: { status: "confirmed" },
      _sum: { total: true },
      _count: true,
    }),
    prisma.abandonedCart.count(),
    prisma.abandonedCart.aggregate({ _sum: { total: true } }),
    prisma.abandonedCart.findMany({
      orderBy: { lastActive: "desc" },
      take: 5,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.waitlistEntry.count(),
    prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.coupon.count({ where: { enabled: true } }),
    prisma.newsletterSubscriber.count(),
    prisma.pointTransaction.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 } } }),
    prisma.pointTransaction.aggregate({ _sum: { amount: true }, where: { amount: { lt: 0 } } }),
    prisma.mailCampaign.count({ where: { status: "done" } }),
    prisma.heroSlide.count(),
  ]);

  const chartMap = new Map<string, number>();
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    chartMap.set(daysAgo(i).toISOString().slice(0, 10), 0);
  }
  for (const o of chartOrders) {
    const key = startOfDay(o.createdAt).toISOString().slice(0, 10);
    if (chartMap.has(key)) chartMap.set(key, (chartMap.get(key) ?? 0) + o.total);
  }
  const chart = [...chartMap.entries()].map(([date, total]) => ({ date, total }));

  let totalProducts = 0;
  let outOfStockCount = 0;
  let lowStockProducts: { id: number; name: string; qty_available: number }[] = [];
  let odooOk = Boolean(settings.odooUrl);

  if (odooOk) {
    try {
      const [total, outOfStock, low] = await Promise.all([
        executeKw<number>("product.template", "search_count", [[]]),
        executeKw<number>("product.template", "search_count", [[["qty_available", "<=", 0]]]),
        executeKw<{ id: number; name: string; qty_available: number }[]>(
          "product.template",
          "search_read",
          [[["qty_available", ">", 0]]],
          { fields: ["name", "qty_available"], order: "qty_available asc", limit: 5 }
        ),
      ]);
      totalProducts = total;
      outOfStockCount = outOfStock;
      lowStockProducts = low;
    } catch {
      odooOk = false;
    }
  }

  const revenueThisMonth = revenueThisMonthAgg._sum.total ?? 0;
  const revenueLastMonth = revenueLastMonthAgg._sum.total ?? 0;
  const revenueTrendPct = revenueLastMonth > 0 ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 : null;

  const smtpOk = Boolean(settings.smtpHost && settings.smtpUser && settings.smtpPassword && settings.mailFromEmail);

  return {
    userLabel: settings.franchiseName || "ModaShop",
    userCount,
    newUsersThisWeek,
    revenueThisMonth,
    ordersThisMonth: revenueThisMonthAgg._count,
    revenueTrendPct,
    pendingOrdersCount,
    confirmedOrdersCount,
    cancelledOrdersCount,
    chart,
    recentOrders,
    ordersByPaymentMethod,
    abandonedCartCount,
    abandonedCartValue: abandonedCartValueAgg._sum.total ?? 0,
    recentAbandonedCarts,
    waitlistCount,
    recentWaitlist,
    activeCouponsCount,
    subscriberCount,
    pointsIssued: pointsIssuedAgg._sum.amount ?? 0,
    pointsRedeemed: Math.abs(pointsRedeemedAgg._sum.amount ?? 0),
    mailCampaignsSentCount,
    heroSlideCount,
    totalProducts,
    outOfStockCount,
    lowStockProducts,
    health: {
      odooOk,
      smtpOk,
      pointsEnabled: settings.pointsEnabled,
      heroSlideCount,
    },
  };
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
