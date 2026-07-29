import { prisma } from "@/lib/prisma";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pago pendiente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
};

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status];
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
  contra_entrega: "Contra entrega",
};

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}

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
        total: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
        items: { select: { id: true } },
      },
    }),
    prisma.order.count(),
  ]);

  return { orders, total };
}
