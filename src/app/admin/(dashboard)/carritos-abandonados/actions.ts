"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import { getStoreSettingsRow } from "@/lib/settings";
import { getMailSender } from "@/lib/mailer";
import { getProductsPage } from "@/lib/products";
import { buildRecoveryMail, clampDelayHours } from "@/lib/cartRecoveryMail";

export async function deleteAbandonedCart(id: string) {
  await requireAdmin();
  await prisma.abandonedCart.delete({ where: { id } });
  revalidatePath("/admin/carritos-abandonados");
}

// Sin cron todavía — botón manual para limpiar lo que quedó viejo (+30 días
// sin actividad, casi seguro que ya no sirve para contactar a nadie).
export async function cleanupOldAbandonedCarts() {
  await requireAdmin();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.abandonedCart.deleteMany({ where: { lastActive: { lt: cutoff } } });
  revalidatePath("/admin/carritos-abandonados");
}

// ---------- Recuperación automática por mail ----------
// El interruptor se guarda al instante (no hay que acordarse de apretar "Guardar").
export async function setCartRecoveryEnabled(enabled: boolean): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  if (enabled && !(await getMailSender())) {
    return { ok: false, message: "Primero configurá el correo (Configuración → Correo): sin eso no se puede enviar." };
  }
  await prisma.storeSettings.upsert({ where: { id: "global" }, create: { id: "global", cartRecoveryEnabled: enabled }, update: { cartRecoveryEnabled: enabled } });
  await logAdminAction(enabled ? "cart_recovery.enable" : "cart_recovery.disable");
  revalidatePath("/admin/carritos-abandonados");
  return { ok: true, message: enabled ? "Recuperación automática activada." : "Recuperación automática suspendida: no se va a mandar ningún mail." };
}

export async function saveCartRecoverySettings(input: { delayHours: number; subject: string; message: string }): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const subject = input.subject.trim().slice(0, 120);
  const message = input.message.trim().slice(0, 600);
  const data = { cartRecoveryDelayHours: clampDelayHours(input.delayHours), cartRecoverySubject: subject || null, cartRecoveryMessage: message || null };
  await prisma.storeSettings.upsert({ where: { id: "global" }, create: { id: "global", ...data }, update: data });
  await logAdminAction("cart_recovery.save");
  revalidatePath("/admin/carritos-abandonados");
  return { ok: true, message: "Guardado." };
}

// Manda el mail a quien está logueado en el panel, con el texto guardado y un producto real de la tienda como ejemplo
export async function sendCartRecoveryTest(): Promise<{ ok: boolean; message: string }> {
  const session = await requireAdmin();
  const to = session.user?.email;
  if (!to) return { ok: false, message: "Tu cuenta no tiene email." };
  const sender = await getMailSender();
  if (!sender) return { ok: false, message: "El correo no está configurado (Configuración → Correo)." };
  const settings = await getStoreSettingsRow();
  const { products } = await getProductsPage({ limit: 1, offset: 0 }).catch(() => ({ products: [] }));
  const sample = products[0];
  const items = [{
    productId: sample?.id ?? 0,
    name: sample?.name ?? "Producto de ejemplo",
    price: sample?.list_price ?? 1000,
    image: sample?.image_128 ?? false,
    quantity: 1,
    maxStock: 1,
  }];
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const { subject, html } = buildRecoveryMail({ settings, name: session.user?.name ?? null, email: to, items, link: `${base}/carrito` });
  const r = await sender.send(to, `[Prueba] ${subject}`, html);
  return r.ok ? { ok: true, message: `Te mandamos un mail de prueba a ${to}.` } : { ok: false, message: r.error ?? "No se pudo enviar." };
}
