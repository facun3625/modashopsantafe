import { prisma } from "@/lib/prisma";
import { executeKw } from "@/lib/odoo";
import type { OrderStatus } from "@/generated/prisma/enums";

// Cliente de Prisma o de una transacción interactiva — así el cálculo de
// reservado se puede correr adentro del candado (ver createOrderWithStockGuard).
type ReservationDb = Pick<typeof prisma, "orderItem">;
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Estados de pedido que "retienen" stock: el pedido está vivo pero todavía no
// se despachó (no salió del stock físico de Odoo). Al pasar a `delivered` o
// `cancelled` la reserva se libera sola, porque este número es derivado —
// no hay tabla de reservas que mantener sincronizada.
const RESERVING_STATUSES: OrderStatus[] = ["pending", "confirmed"];

// Cuánto stock hay reservado por pedidos web todavía sin despachar, por
// producto (id del product.template en Odoo). Es lo que hay que restarle al
// qty_available de Odoo para saber el disponible real de cara al cliente y
// evitar la sobreventa cuando nadie entra a Odoo (típico fin de semana).
export async function getReservedQuantities(
  productIds: number[],
  db: ReservationDb = prisma
): Promise<Map<number, number>> {
  const reserved = new Map<number, number>();
  if (productIds.length === 0) return reserved;

  const groups = await db.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: productIds },
      order: { status: { in: RESERVING_STATUSES } },
    },
    _sum: { quantity: true },
  });

  for (const g of groups) {
    reserved.set(g.productId, g._sum.quantity ?? 0);
  }
  return reserved;
}

// Suelta la reserva de stock de los pedidos cuyo picking en Odoo ya pasó a
// "done" (el equipo lo despachó): los pasa a `delivered`, con lo cual dejan de
// descontar stock en la web y todo queda reconciliado con Odoo. Esto REEMPLAZA
// el paso manual "Marcar entregado": corre automáticamente cada 15 min (ver
// instrumentation.ts). El botón manual queda solo como respaldo (ej. si un
// pedido nunca llegó a tener picking en Odoo).
export async function releaseDeliveredReservations(): Promise<{ checked: number; released: number }> {
  const active = await prisma.order.findMany({
    where: { status: { in: RESERVING_STATUSES }, odooPickingId: { not: null } },
    select: { id: true, odooPickingId: true },
  });
  if (active.length === 0) return { checked: 0, released: 0 };

  const pickings = await executeKw<{ id: number; state: string }[]>(
    "stock.picking",
    "read",
    [active.map((o) => o.odooPickingId!)],
    { fields: ["state"] }
  );
  const stateById = new Map(pickings.map((p) => [p.id, p.state]));

  let released = 0;
  for (const order of active) {
    if (stateById.get(order.odooPickingId!) !== "done") continue;
    await prisma.order.update({ where: { id: order.id }, data: { status: "delivered" } });
    released += 1;
  }
  return { checked: active.length, released };
}

export type StockShortage = { productId: number; name: string; available: number; requested: number };

// Se lanza cuando, al momento de confirmar el pedido (ya con el candado
// tomado), no alcanza el disponible real para algún item.
export class InsufficientStockError extends Error {
  constructor(public shortages: StockShortage[]) {
    super("Insufficient stock");
    this.name = "InsufficientStockError";
  }
}

// Crea el pedido bajo un lock por producto para que dos checkouts simultáneos
// de la última unidad no pasen los dos. El reservado se recalcula DENTRO de la
// transacción, después de tomar el lock, así el segundo pedido ve al primero
// y falla. El qty_available físico de Odoo se consulta una sola vez afuera
// (no cambia en esos milisegundos: nadie está validando en Odoo).
export async function createOrderWithStockGuard<T>(
  items: { productId: number; quantity: number; name: string }[],
  build: (tx: Tx) => Promise<T>
): Promise<T> {
  const ids = [...new Set(items.map((i) => i.productId))];
  const odooProducts = await executeKw<{ id: number; name: string; qty_available: number }[]>(
    "product.template",
    "read",
    [ids],
    { fields: ["name", "qty_available"] }
  );
  const physical = new Map(odooProducts.map((p) => [p.id, p]));

  return prisma.$transaction(async (tx) => {
    // Locks en orden ascendente de id para no generar deadlocks entre dos
    // pedidos que comparten productos. Namespace "order_stock" para no chocar
    // con otros advisory locks. Se sueltan solos al cerrar la transacción.
    for (const id of [...ids].sort((a, b) => a - b)) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('order_stock'), ${id}::int4)`;
    }

    const reserved = await getReservedQuantities(ids, tx);
    const shortages: StockShortage[] = [];
    for (const item of items) {
      const p = physical.get(item.productId);
      const available = Math.max(0, (p?.qty_available ?? 0) - (reserved.get(item.productId) ?? 0));
      if (available < item.quantity) {
        shortages.push({ productId: item.productId, name: p?.name ?? item.name, available, requested: item.quantity });
      }
    }
    if (shortages.length > 0) throw new InsufficientStockError(shortages);

    return build(tx);
  });
}
