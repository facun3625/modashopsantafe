import { executeKw } from "@/lib/odoo";
import { prisma } from "@/lib/prisma";
import { findOrCreatePartner } from "@/lib/orders";

// IDs de la instancia de Odoo (Inventario). Verificados también en la instancia nueva (devoo-saas): se migró con los
// mismos números.
const OUTGOING_PICKING_TYPE_ID = 2; // "Santa Fe: Órdenes de entrega"
const SOURCE_LOCATION_ID = 8; // WH/SF/Existencias
const CUSTOMER_LOCATION_ID = 5; // Partners/Customers

// Mismo texto que se le pone a la orden en Odoo al crearla: sirve para encontrar órdenes de este pedido que quedaron
// sin vincular (una falla a mitad de camino).
const pickingOrigin = (orderId: string) => `Web #${orderId.slice(0, 8)}`;

type PickingState = "draft" | "waiting" | "confirmed" | "assigned" | "done" | "cancel";

async function resolveVariantId(templateId: number): Promise<number> {
  const templates = await executeKw<{ id: number; product_variant_id: [number, string] }[]>(
    "product.template",
    "read",
    [[templateId]],
    { fields: ["product_variant_id"] }
  );
  if (templates.length === 0) throw new Error(`El producto ${templateId} no existe en Odoo`);
  return templates[0].product_variant_id[0];
}

async function pickingState(pickingId: number): Promise<PickingState | null> {
  const rows = await executeKw<{ state: PickingState }[]>("stock.picking", "read", [[pickingId]], { fields: ["state"] });
  return rows[0]?.state ?? null;
}

// Cancela en Odoo las órdenes abiertas de este pedido que no estén vinculadas (restos de un intento que falló).
async function cancelOrphanPickings(orderId: string, keepId?: number | null) {
  const ids = await executeKw<number[]>("stock.picking", "search", [
    [
      ["origin", "=", pickingOrigin(orderId)],
      ["state", "not in", ["done", "cancel"]],
    ],
  ]);
  const orphans = ids.filter((id) => id !== keepId);
  if (orphans.length > 0) await executeKw("stock.picking", "action_cancel", [orphans]);
}

// Crea el stock.picking (salida) reservado en Odoo para un pedido ya guardado, lo confirma y lo reserva
// (action_assign), y le guarda el odooPickingId. Es idempotente: si el pedido ya tiene un picking vigente, no crea
// otro (si el que tenía está cancelado, crea uno nuevo).
//
// Se llama al confirmar el pago (transferencia/contra-entrega desde el admin, o el pago instantáneo de MP/Payway), no
// al momento de la compra, y desde el botón "Reintentar" de Ventas. Si algo falla a mitad de camino, cancela lo que
// alcanzó a crear, así un reintento nunca deja dos órdenes reservando el mismo stock.
export async function createPickingForOrder(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      odooPartnerId: true,
      odooPickingId: true,
      items: { select: { productId: true, name: true, quantity: true } },
    },
  });
  if (!order) throw new Error("El pedido no existe");

  if (order.odooPickingId) {
    const state = await pickingState(order.odooPickingId);
    if (state && state !== "cancel") return order.odooPickingId;
  }

  await cancelOrphanPickings(order.id);

  const partnerId =
    order.odooPartnerId ?? (await findOrCreatePartner({ name: order.customerName, email: order.customerEmail, phone: order.customerPhone ?? undefined }));
  if (!order.odooPartnerId) await prisma.order.update({ where: { id: order.id }, data: { odooPartnerId: partnerId } });

  const resolvedItems = await Promise.all(
    order.items.map(async (item) => ({ variantId: await resolveVariantId(item.productId), name: item.name, quantity: item.quantity }))
  );

  const pickingId = await executeKw<number>("stock.picking", "create", [
    {
      picking_type_id: OUTGOING_PICKING_TYPE_ID,
      location_id: SOURCE_LOCATION_ID,
      location_dest_id: CUSTOMER_LOCATION_ID,
      partner_id: partnerId,
      origin: pickingOrigin(order.id),
    },
  ]);

  try {
    // Las líneas (stock.move) se crean en una llamada aparte, ya con el picking existente: pasar
    // move_ids_without_package en el mismo create del picking tiraba NotNullViolation en location_id.
    await Promise.all(
      resolvedItems.map((item) =>
        executeKw("stock.move", "create", [
          {
            picking_id: pickingId,
            name: item.name,
            product_id: item.variantId,
            product_uom_qty: item.quantity,
            location_id: SOURCE_LOCATION_ID,
            location_dest_id: CUSTOMER_LOCATION_ID,
          },
        ])
      )
    );
    await executeKw("stock.picking", "action_confirm", [[pickingId]]);
    await executeKw("stock.picking", "action_assign", [[pickingId]]);
  } catch (err) {
    await executeKw("stock.picking", "action_cancel", [[pickingId]]).catch((cleanupErr) =>
      console.error("createPickingForOrder: no se pudo cancelar el picking incompleto", pickingId, cleanupErr)
    );
    throw err;
  }

  await prisma.order.update({ where: { id: order.id }, data: { odooPickingId: pickingId } });
  return pickingId;
}

// Cancela en Odoo la orden de un pedido (al cancelarlo o eliminarlo desde la web), para que no quede stock reservado
// allá. Si ya se despachó ("done") no se puede: el stock real ya bajó.
export async function cancelPickingForOrder(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, odooPickingId: true } });
  if (!order) return { ok: true };

  if (order.odooPickingId) {
    const state = await pickingState(order.odooPickingId);
    if (state === "done") {
      return { ok: false, error: "Este pedido ya se despachó en Odoo, así que no se puede cancelar desde acá." };
    }
    if (state && state !== "cancel") await executeKw("stock.picking", "action_cancel", [[order.odooPickingId]]);
  }
  await cancelOrphanPickings(order.id, order.odooPickingId);
  return { ok: true };
}
