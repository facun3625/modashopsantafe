import { prisma } from "@/lib/prisma";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";

// "Vendido/facturado" = pedidos con el pago ya confirmado (confirmed) o ya
// entregados (delivered). Los pending (sin confirmar) y cancelled no cuentan
// como ingreso.
const PAID: OrderStatus[] = ["confirmed", "delivered"];

export type SalesStats = {
  revenue: number;
  paidOrders: number;
  avgTicket: number;
  pendingOrders: number;
  totalOrders: number;
  byStatus: { status: OrderStatus; count: number }[];
  byPayment: { method: PaymentMethod; count: number; revenue: number }[];
  monthly: { month: string; label: string; revenue: number; orders: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
};

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export async function getSalesStats(): Promise<SalesStats> {
  const [paidAgg, statusGroups, paymentGroups, monthlyRows, topRows] = await Promise.all([
    prisma.order.aggregate({ where: { status: { in: PAID } }, _sum: { total: true }, _count: true }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: { status: { in: PAID } },
      _count: true,
      _sum: { total: true },
    }),
    prisma.$queryRaw<{ month: string; revenue: number; orders: number }[]>`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
             COALESCE(SUM(total), 0)::float8 AS revenue,
             COUNT(*)::int AS orders
      FROM "Order"
      WHERE status IN ('confirmed', 'delivered')
        AND "createdAt" >= date_trunc('month', now()) - interval '11 months'
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<{ name: string; quantity: number; revenue: number }[]>`
      SELECT oi.name AS name,
             SUM(oi.quantity)::int AS quantity,
             COALESCE(SUM(oi.price * oi.quantity), 0)::float8 AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o.status IN ('confirmed', 'delivered')
      GROUP BY oi.name
      ORDER BY quantity DESC
      LIMIT 8
    `,
  ]);

  const revenue = paidAgg._sum.total ?? 0;
  const paidOrders = paidAgg._count;
  const totalOrders = statusGroups.reduce((sum, g) => sum + g._count, 0);
  const pendingOrders = statusGroups.find((g) => g.status === "pending")?._count ?? 0;

  // Últimos 12 meses, rellenando los que no tienen ventas con 0.
  const revByMonth = new Map(monthlyRows.map((r) => [r.month, r]));
  const monthly: SalesStats["monthly"] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const row = revByMonth.get(key);
    monthly.push({
      month: key,
      label: MONTH_LABELS[d.getMonth()],
      revenue: row?.revenue ?? 0,
      orders: row?.orders ?? 0,
    });
  }

  return {
    revenue,
    paidOrders,
    avgTicket: paidOrders > 0 ? revenue / paidOrders : 0,
    pendingOrders,
    totalOrders,
    byStatus: statusGroups
      .map((g) => ({ status: g.status, count: g._count }))
      .sort((a, b) => b.count - a.count),
    byPayment: paymentGroups
      .map((g) => ({ method: g.paymentMethod, count: g._count, revenue: g._sum.total ?? 0 }))
      .sort((a, b) => b.revenue - a.revenue),
    monthly,
    topProducts: topRows,
  };
}
