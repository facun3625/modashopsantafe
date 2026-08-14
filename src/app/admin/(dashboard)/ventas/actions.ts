"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import { createPickingForOrder } from "@/lib/odooPicking";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("No autorizado");
}

// Texto legible del pedido para el log ("Juan Pérez — $1200").
async function orderLabel(orderId: string): Promise<string> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { customerName: true, total: true },
  });
  return o ? `${o.customerName} — $${o.total.toFixed(2)}` : orderId;
}

export async function confirmOrderPayment(orderId: string) {
  await requireAdmin();
  const detail = await orderLabel(orderId);
  await prisma.order.update({ where: { id: orderId }, data: { status: "confirmed" } });
  await logAdminAction("order.confirm", { targetType: "order", targetId: orderId, detail });

  // Al confirmar el pago recién ahí se genera la orden reservada en Odoo
  // (stock.picking). Si Odoo falla, la confirmación NO se cae: el pedido queda
  // confirmado y sin picking, y se puede reintentar. La reserva de la web
  // sigue firme igual.
  try {
    await createPickingForOrder(orderId);
  } catch (err) {
    console.error("createPickingForOrder failed for", orderId, err);
  }

  revalidatePath("/admin/ventas");
}

export async function cancelOrder(orderId: string) {
  await requireAdmin();
  const detail = await orderLabel(orderId);
  await prisma.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
  await logAdminAction("order.cancel", { targetType: "order", targetId: orderId, detail });
  revalidatePath("/admin/ventas");
}

// Marca el pedido como entregado/despachado: libera la reserva de stock que
// mantenía (el disponible en la web deja de descontarlo). Hacelo cuando ya
// sacaste el producto del stock físico de Odoo — ahí queda todo consistente.
export async function markOrderDelivered(orderId: string) {
  await requireAdmin();
  const detail = await orderLabel(orderId);
  await prisma.order.update({ where: { id: orderId }, data: { status: "delivered" } });
  await logAdminAction("order.deliver", { targetType: "order", targetId: orderId, detail });
  revalidatePath("/admin/ventas");
}

// Elimina el pedido por completo. Los items se borran en cascada (schema), así
// que si el pedido tenía stock reservado, esa reserva se libera sola.
export async function deleteOrder(orderId: string) {
  await requireAdmin();
  const detail = await orderLabel(orderId);
  await prisma.order.delete({ where: { id: orderId } });
  await logAdminAction("order.delete", { targetType: "order", targetId: orderId, detail });
  revalidatePath("/admin/ventas");
}
