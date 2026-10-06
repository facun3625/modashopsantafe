import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { getMailSender } from "@/lib/mailer";
import { buildMailHtml } from "@/lib/mailTemplate";

// Cupón de bienvenida: al crear una cuenta (registro con contraseña o primer ingreso con Google) se le genera un
// cupón personal, de un solo uso, atado a esa cuenta (validateCoupon rechaza a cualquier otro usuario) y con
// vencimiento. Se prende/apaga y se configura en /admin/configuracion.
//
// Para que no se abuse creando cuentas: uno solo por cuenta, y no se genera si ese email ya tiene pedidos.

export const WELCOME_PREFIX = "BIENVENIDA-";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para que no se confundan al dictarlo

export type WelcomeCoupon = { code: string; label: string; expiresAt: Date | null; minPurchaseAmount: number | null };

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `${WELCOME_PREFIX}${code}`;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

export function welcomeLabel(c: { discountType: string; discountValue: number }): string {
  return c.discountType === "percentage" ? `${c.discountValue}% OFF` : `${money(c.discountValue)} de descuento`;
}

function toWelcome(c: { code: string; discountType: string; discountValue: number; expiresAt: Date | null; minPurchaseAmount: number | null }): WelcomeCoupon {
  return { code: c.code, label: welcomeLabel(c), expiresAt: c.expiresAt, minPurchaseAmount: c.minPurchaseAmount };
}

// Genera el cupón para una cuenta recién creada. Devuelve null si está apagado o no corresponde. Nunca tira: un
// problema acá no puede impedir que alguien se registre.
export async function issueWelcomeCoupon(user: { id: string; email: string; name?: string | null }): Promise<WelcomeCoupon | null> {
  try {
    const settings = await getStoreSettingsRow();
    if (!settings.welcomeCouponEnabled || settings.welcomeCouponValue <= 0) return null;

    const already = await prisma.coupon.findFirst({ where: { userId: user.id, code: { startsWith: WELCOME_PREFIX } }, select: { id: true } });
    if (already) return null;
    const boughtBefore = await prisma.order.findFirst({ where: { customerEmail: { equals: user.email, mode: "insensitive" } }, select: { id: true } });
    if (boughtBefore) return null;

    const days = Math.max(0, settings.welcomeCouponDays);
    const expiresAt = days > 0 ? new Date(Date.now() + days * 24 * 3600_000) : null;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const coupon = await prisma.coupon.create({
          data: {
            code: randomCode(),
            discountType: settings.welcomeCouponType,
            discountValue: settings.welcomeCouponValue,
            minPurchaseAmount: settings.welcomeCouponMinPurchase,
            expiresAt,
            maxUses: 1,
            userId: user.id,
          },
        });
        const welcome = toWelcome(coupon);
        sendWelcomeMail(user, welcome).catch((err) => console.error("issueWelcomeCoupon: no se pudo mandar el mail", err));
        return welcome;
      } catch (err) {
        // Código repetido (muy raro): se prueba otro
        if ((err as { code?: string } | null)?.code !== "P2002") throw err;
      }
    }
    return null;
  } catch (err) {
    console.error("issueWelcomeCoupon failed", user.id, err);
    return null;
  }
}

// El cupón de bienvenida que el usuario todavía puede usar (vigente y sin usar), para mostrarlo en Mi cuenta.
export async function getActiveWelcomeCoupon(userId: string): Promise<WelcomeCoupon | null> {
  const coupon = await prisma.coupon.findFirst({
    where: { userId, code: { startsWith: WELCOME_PREFIX }, enabled: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
  });
  if (!coupon || (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)) return null;
  return toWelcome(coupon);
}

async function sendWelcomeMail(user: { email: string; name?: string | null }, coupon: WelcomeCoupon) {
  const sender = await getMailSender();
  if (!sender) return;
  const settings = await getStoreSettingsRow();
  const site = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const firstName = user.name?.trim().split(/\s+/)[0] ?? "";
  const conditions = [
    coupon.expiresAt ? `Vence el ${coupon.expiresAt.toLocaleDateString("es-AR")}.` : null,
    coupon.minPurchaseAmount ? `Compra mínima: ${money(coupon.minPurchaseAmount)}.` : null,
    "Es de un solo uso y vale solo con tu cuenta.",
  ].filter(Boolean);
  const subject = `Tu regalo de bienvenida: ${coupon.label}`;
  const html = buildMailHtml({
    logoUrl: `${site}/logo2.png`,
    franchiseName: settings.franchiseName || "ModaShop",
    franchiseLocation: settings.franchiseLocation,
    subject,
    title: firstName ? `¡Bienvenida, ${firstName}!` : "¡Bienvenida!",
    body: `Gracias por crear tu cuenta. Te regalamos ${coupon.label} en tu primera compra con este código:\n\n${coupon.code}\n\nIngresalo en el checkout, en el campo de cupón. ${conditions.join(" ")}`,
    cta: { label: "Ir a la tienda", url: `${site}/tienda` },
    footer: {
      address: settings.address,
      whatsappNumber: settings.whatsappPhone,
      instagramHandle: settings.instagramHandle,
      contactEmail: settings.mailFromEmail,
      siteUrl: site,
    },
  });
  const result = await sender.send(user.email, subject, html);
  if (!result.ok) console.error("sendWelcomeMail: no se pudo enviar —", result.error);
}
