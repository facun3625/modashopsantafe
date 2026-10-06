import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { getMailSender } from "@/lib/mailer";
import { buildMailHtml } from "@/lib/mailTemplate";
import { logAdminAction } from "@/lib/adminLog";
import { cancelPickingForOrder } from "@/lib/odooPicking";
import type { ExpiryDaysByMethod } from "@/lib/orderExpiryRules";
import type { PaymentMethod } from "@/generated/prisma/enums";

const DAY = 24 * 3600_000;

// Días de vencimiento por medio de pago (solo los que tienen un valor mayor a 0)
export async function getPendingExpiryDays(): Promise<ExpiryDaysByMethod> {
  const configs = await prisma.paymentMethodConfig.findMany({ where: { pendingExpiryDays: { gt: 0 } }, select: { method: true, pendingExpiryDays: true } });
  return Object.fromEntries(configs.map((c) => [c.method, c.pendingExpiryDays!]));
}

// Cancela solos los pedidos pendientes cuyo medio de pago tiene días de vencimiento (contra entrega), libera su
// stock (también en Odoo, si un pedido reabierto todavía tenía orden) y le avisa al cliente por mail. Lo dispara
// instrumentation.ts cada 15 minutos.
export async function expirePendingOrders(now = new Date()): Promise<{ expired: number }> {
  const days = await getPendingExpiryDays();
  const methods = Object.keys(days) as PaymentMethod[];
  if (methods.length === 0) return { expired: 0 };
  const orders = await prisma.order.findMany({
    where: {
      status: "pending",
      OR: methods.map((method) => ({ paymentMethod: method, createdAt: { lt: new Date(now.getTime() - days[method] * DAY) } })),
    },
    select: { id: true, customerName: true, customerEmail: true, total: true, paymentMethod: true },
    take: 50,
  });

  let expired = 0;
  for (const order of orders) {
    // Si Odoo no responde, se deja para el próximo pase en vez de cancelar dejando stock reservado allá
    const cancelled = await cancelPickingForOrder(order.id).catch((err) => {
      console.error("expirePendingOrders: no se pudo cancelar en Odoo", order.id, err);
      return null;
    });
    if (!cancelled?.ok) continue;

    // Solo si sigue pendiente: si el admin lo confirmó justo ahora, no se toca
    const updated = await prisma.order.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "cancelled", expiredAt: now } });
    if (updated.count === 0) continue;
    expired++;

    await logAdminAction("order.expire", {
      targetType: "order",
      targetId: order.id,
      detail: `${order.customerName} — $${order.total.toFixed(2)}`,
      adminEmail: "sistema",
    });
    await sendExpiryMail(order, days[order.paymentMethod]).catch((err) => console.error("expirePendingOrders: no se pudo mandar el mail", order.id, err));
  }
  return { expired };
}

async function sendExpiryMail(order: { id: string; customerName: string; customerEmail: string }, expiryDays: number) {
  const sender = await getMailSender();
  if (!sender) return;
  const settings = await getStoreSettingsRow();
  const shortId = order.id.slice(0, 8);
  const firstName = order.customerName.split(" ")[0] || order.customerName;
  const site = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const subject = `Tu pedido #${shortId} se canceló`;
  const html = buildMailHtml({
    logoUrl: `${site}/logo2.png`,
    franchiseName: settings.franchiseName || "ModaShop",
    franchiseLocation: settings.franchiseLocation,
    subject,
    title: `Hola, ${firstName}`,
    body: `Tu pedido #${shortId} se canceló automáticamente porque pasaron ${expiryDays} días sin que se confirme.\n\nLiberamos los productos que tenías reservados. Si todavía los querés, podés volver a comprarlos cuando quieras, o escribinos y te ayudamos.`,
    cta: { label: "Ir a la tienda", url: `${site}/tienda` },
    footer: {
      address: settings.address,
      whatsappNumber: settings.whatsappPhone,
      instagramHandle: settings.instagramHandle,
      contactEmail: settings.mailFromEmail,
      siteUrl: site,
    },
  });
  const result = await sender.send(order.customerEmail, subject, html);
  if (!result.ok) console.error("sendExpiryMail: no se pudo enviar —", result.error);
}
