import { executeKw } from "@/lib/odoo";
import { prisma } from "@/lib/prisma";

// IDs de la instancia de Odoo (Inventario). Mismos valores que venían andando
// en producción — acá no se cambia nada del flujo de Odoo, solo se mueve a una
// función reutilizable que se dispara al CONFIRMAR el pago (no al comprar).
const OUTGOING_PICKING_TYPE_ID = 2; // "Santa Fe: Órdenes de entrega"
const SOURCE_LOCATION_ID = 8; // WH/SF/Existencias
const CUSTOMER_LOCATION_ID = 5; // Partners/Customers

async function resolveVariantId(templateId: number): Promise<number> {
  const templates = await executeKw<{ id: number; product_variant_id: [number, string] }[]>(
    "product.template",
    "read",
    [[templateId]],
    { fields: ["product_variant_id"] }
  );
  if (templates.length === 0) throw new Error(`Product ${templateId} not found`);
  return templates[0].product_variant_id[0];
}

// Crea el stock.picking (salida) reservado en Odoo para un pedido ya guardado,
// lo confirma y lo reserva (action_assign), y le guarda el odooPickingId. Es
// idempotente: si el pedido ya tiene picking, no crea otro.
//
// Se llama al confirmar el pago (transferencia/contra-entrega desde el admin,
// o el pago instantáneo de MP/Payway), no al momento de la compra. El equipo
// lo valida al despachar en Odoo — ese paso baja el stock real y dispara la
// liberación de la reserva en la web (ver releaseDeliveredReservations).
export async function createPickingForOrder(orderId: string): Promise<number | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      odooPartnerId: true,
      odooPickingId: true,
      items: { select: { productId: true, name: true, quantity: true } },
    },
  });

  if (!order || !order.odooPartnerId) return null;
  if (order.odooPickingId) return order.odooPickingId; // ya tiene picking

  const resolvedItems = await Promise.all(
    order.items.map(async (item) => ({
      variantId: await resolveVariantId(item.productId),
      name: item.name,
      quantity: item.quantity,
    }))
  );

  const pickingId = await executeKw<number>("stock.picking", "create", [
    {
      picking_type_id: OUTGOING_PICKING_TYPE_ID,
      location_id: SOURCE_LOCATION_ID,
      location_dest_id: CUSTOMER_LOCATION_ID,
      partner_id: order.odooPartnerId,
      origin: `Web #${order.id.slice(0, 8)}`,
    },
  ]);

  // Las líneas (stock.move) se crean en una llamada aparte, ya con el
  // picking existente: pasar move_ids_without_package en el mismo create
  // del picking (probado antes) tiraba NotNullViolation en location_id —
  // el valor explícito que le pasábamos a cada línea se perdía, se ve que
  // Odoo lo recalcula después a partir de picking_id y en ese momento
  // todavía no estaba resuelto. Creándolas por separado, contra un
  // picking_id ya persistido, location_id/location_dest_id se completan
  // bien solos (related a picking_id) — igual los pasamos explícitos.
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

  await prisma.order.update({ where: { id: order.id }, data: { odooPickingId: pickingId } });
  return pickingId;
}
