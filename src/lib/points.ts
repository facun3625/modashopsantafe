import { prisma } from "@/lib/prisma";
import { executeKw } from "@/lib/odoo";

export async function getStoreSettings() {
  return prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });
}

// Acredita los puntos de un pedido y marca pointsAwardedAt en una sola
// transacción (así queda excluido de la próxima corrida de
// syncDeliveredOrders sin importar si dio puntos > 0 o no).
async function awardPointsForOrder(order: { id: string; userId: string; subtotal: number }, ratio: number) {
  const points = Math.floor(order.subtotal * ratio);

  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { pointsAwardedAt: new Date() } }),
    ...(points > 0
      ? [
          prisma.user.update({ where: { id: order.userId }, data: { points: { increment: points } } }),
          prisma.pointTransaction.create({
            data: {
              userId: order.userId,
              orderId: order.id,
              amount: points,
              description: "Puntos ganados por pedido entregado",
            },
          }),
        ]
      : []),
  ]);

  return points;
}

// Revisa los pedidos que todavía no tienen puntos acreditados y cuyo
// stock.picking en Odoo ya está en estado "done" (entregado/despachado por
// el equipo), y les acredita los puntos correspondientes. Se llama tanto
// automáticamente (ver instrumentation.ts) como a mano desde el admin.
export async function syncDeliveredOrders(): Promise<{ checked: number; awarded: number; skipped?: true }> {
  const settings = await getStoreSettings();
  if (!settings.pointsEnabled) return { checked: 0, awarded: 0, skipped: true };

  const pending = await prisma.order.findMany({
    where: {
      pointsAwardedAt: null,
      odooPickingId: { not: null },
      userId: { not: null },
      status: { not: "cancelled" },
    },
    select: { id: true, userId: true, subtotal: true, odooPickingId: true },
  });

  await prisma.storeSettings.update({ where: { id: "global" }, data: { pointsLastSync: new Date() } });

  if (pending.length === 0) return { checked: 0, awarded: 0 };

  const pickingIds = pending.map((o) => o.odooPickingId!);
  const pickings = await executeKw<{ id: number; state: string }[]>(
    "stock.picking",
    "read",
    [pickingIds],
    { fields: ["state"] }
  );
  const stateById = new Map(pickings.map((p) => [p.id, p.state]));

  let awarded = 0;
  for (const order of pending) {
    if (stateById.get(order.odooPickingId!) !== "done") continue;
    await awardPointsForOrder({ id: order.id, userId: order.userId!, subtotal: order.subtotal }, settings.pointsRatio);
    awarded += 1;
  }

  return { checked: pending.length, awarded };
}

type RedeemResult = { ok: true; code: string } | { ok: false; error: string };

// Canjea una recompensa por puntos: resta el saldo (de forma atómica, para
// que no se pueda canjear dos veces en simultáneo con el mismo saldo) y
// genera un Coupon de un solo uso a nombre de ese usuario. Reintenta si el
// código generado choca con uno existente.
export async function redeemReward(userId: string, rewardId: string): Promise<RedeemResult> {
  const settings = await getStoreSettings();
  if (!settings.pointsEnabled) return { ok: false, error: "El sistema de puntos no está activo" };

  const reward = await prisma.pointReward.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.enabled) return { ok: false, error: "Esa recompensa ya no está disponible" };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `CANJE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    try {
      return await prisma.$transaction(async (tx) => {
        const { count } = await tx.user.updateMany({
          where: { id: userId, points: { gte: reward.pointsRequired } },
          data: { points: { decrement: reward.pointsRequired } },
        });
        if (count === 0) return { ok: false, error: "No tenés puntos suficientes" };

        await tx.pointTransaction.create({
          data: { userId, amount: -reward.pointsRequired, description: `Canje: ${reward.title}` },
        });
        await tx.coupon.create({
          data: {
            code,
            enabled: true,
            discountType: reward.discountType,
            discountValue: reward.discountValue,
            userId,
          },
        });
        return { ok: true, code };
      });
    } catch {
      continue; // probable colisión del código único (Coupon.code) — reintenta con uno nuevo
    }
  }

  return { ok: false, error: "No se pudo generar el cupón, probá de nuevo" };
}
