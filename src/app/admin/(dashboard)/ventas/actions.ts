"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import { createPickingForOrder } from "@/lib/odooPicking";
import type { OrderStatus } from "@/generated/prisma/enums";

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

const STATUS_ACTION: Record<OrderStatus, string> = {
  pending: "order.reopen",
  confirmed: "order.confirm",
  delivered: "order.deliver",
  cancelled: "order.cancel",
};

// Cambia el estado del pedido (desde el select del admin, sin botón aceptar).
// Efectos por estado:
//  - confirmed: además genera la orden reservada en Odoo (createPickingForOrder).
//  - delivered: libera la reserva de stock (ya lo hace el estado en sí).
//  - cancelled: libera la reserva y "devuelve" el stock a la web.
export async function changeOrderStatus(orderId: string, status: OrderStatus) {
  await requireAdmin();
  const detail = await orderLabel(orderId);
  await prisma.order.update({ where: { id: orderId }, data: { status } });
  await logAdminAction(STATUS_ACTION[status], { targetType: "order", targetId: orderId, detail });

  if (status === "confirmed") {
    // Si Odoo falla, no se cae el cambio de estado: queda confirmado sin
    // picking y se puede reintentar. La reserva de la web sigue firme.
    try {
      await createPickingForOrder(orderId);
    } catch (err) {
      console.error("createPickingForOrder failed for", orderId, err);
    }
  }

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
