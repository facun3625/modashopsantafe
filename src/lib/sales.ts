import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";

// Re-exportados desde el módulo puro para no romper imports existentes.
export { orderStatusLabel, paymentMethodLabel } from "@/lib/orderLabels";

export async function getSalesPage(opts: {
  limit: number;
  offset: number;
  q?: string;
  paymentMethod?: PaymentMethod;
  status?: OrderStatus;
  productId?: number;
}) {
  const where: Prisma.OrderWhereInput = {
    ...(opts.paymentMethod ? { paymentMethod: opts.paymentMethod } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.productId ? { items: { some: { productId: opts.productId } } } : {}),
    ...(opts.q
      ? {
          OR: [
            { customerName: { contains: opts.q, mode: "insensitive" } },
            { customerEmail: { contains: opts.q, mode: "insensitive" } },
            { customerPhone: { contains: opts.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
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
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

export type SalesOrder = Awaited<ReturnType<typeof getSalesPage>>["orders"][number];
