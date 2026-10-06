"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import { cancelPickingForOrder, createPickingForOrder } from "@/lib/odooPicking";
import type { OrderStatus } from "@/generated/prisma/enums";

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

export type OrderActionResult = { ok: true } | { ok: false; error: string };

function odooError(err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `No se pudo hablar con Odoo (${detail.slice(0, 160)}). No se cambió nada: probá de nuevo en un rato.`;
}

// Cambia el estado del pedido (desde el select del admin, sin botón aceptar).
// Efectos por estado:
//  - confirmed: además genera la orden reservada en Odoo (createPickingForOrder). Si Odoo falla, el pedido queda
//    confirmado igual y aparece el botón "Reintentar" en la lista.
//  - cancelled: cancela también la orden en Odoo ANTES de cambiar el estado — si Odoo falla no se cambia nada, para
//    que nunca quede stock reservado allá sin que nadie se entere.
//  - delivered: libera la reserva de stock de la web (ya lo hace el estado en sí).
export async function changeOrderStatus(orderId: string, status: OrderStatus): Promise<OrderActionResult> {
  await requireAdmin();

  if (status === "cancelled") {
    try {
      const cancelled = await cancelPickingForOrder(orderId);
      if (!cancelled.ok) return cancelled;
    } catch (err) {
      return { ok: false, error: odooError(err) };
    }
  }

  const detail = await orderLabel(orderId);
  await prisma.order.update({ where: { id: orderId }, data: { status, ...(status !== "cancelled" ? { expiredAt: null } : {}) } });
  await logAdminAction(STATUS_ACTION[status], { targetType: "order", targetId: orderId, detail });

  if (status === "confirmed") {
    try {
      await createPickingForOrder(orderId);
    } catch (err) {
      console.error("createPickingForOrder failed for", orderId, err);
    }
  }

  revalidatePath("/admin/ventas");
  return { ok: true };
}

// Botón "Reintentar" (solo aparece en pedidos confirmados sin orden en Odoo): limpia cualquier orden incompleta que
// haya quedado de un intento anterior y crea la orden de nuevo.
export async function retryOrderPicking(orderId: string): Promise<OrderActionResult> {
  await requireAdmin();
  try {
    await createPickingForOrder(orderId);
  } catch (err) {
    return { ok: false, error: odooError(err) };
  }
  await logAdminAction("order.picking_retry", { targetType: "order", targetId: orderId, detail: await orderLabel(orderId) });
  revalidatePath("/admin/ventas");
  return { ok: true };
}

// Elimina el pedido por completo. Primero cancela su orden en Odoo (si la tiene y no se despachó): si se borrara
// antes, la orden quedaría reservando stock allá y ya no habría forma de encontrarla desde acá. Los items se borran
// en cascada (schema), así que la reserva de la web se libera sola.
export async function deleteOrder(orderId: string): Promise<OrderActionResult> {
  await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) return { ok: true };

  if (order.status !== "delivered") {
    try {
      const cancelled = await cancelPickingForOrder(orderId);
      if (!cancelled.ok) return cancelled;
    } catch (err) {
      return { ok: false, error: odooError(err) };
    }
  }

  const detail = await orderLabel(orderId);
  await prisma.order.delete({ where: { id: orderId } });
  await logAdminAction("order.delete", { targetType: "order", targetId: orderId, detail });
  revalidatePath("/admin/ventas");
  return { ok: true };
}
