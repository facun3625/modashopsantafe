import { prisma } from "@/lib/prisma";

// Re-exportados desde el módulo puro para no romper imports existentes.
export { orderStatusLabel, paymentMethodLabel } from "@/lib/orderLabels";

export async function getSalesPage(opts: { limit: number; offset: number }) {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      skip: opts.offset,
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        subtotal: true,
        total: true,
        status: true,
        paymentMethod: true,
        transferProofUrl: true,
        shippingCost: true,
        shippingAddress: true,
        couponDiscount: true,
        createdAt: true,
        shippingMethod: { select: { name: true } },
        items: { select: { id: true, name: true, price: true, quantity: true } },
      },
    }),
    prisma.order.count(),
  ]);

  return { orders, total };
}

export type SalesOrder = Awaited<ReturnType<typeof getSalesPage>>["orders"][number];
