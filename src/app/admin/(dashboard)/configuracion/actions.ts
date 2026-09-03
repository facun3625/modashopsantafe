"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { sendTelegram } from "@/lib/telegram";
import { buildMailSender } from "@/lib/mailer";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("No autorizado");
}

export async function updateMaintenanceMode(formData: FormData) {
  await requireAdmin();

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", maintenanceMode: formData.get("maintenanceMode") === "on" },
    update: { maintenanceMode: formData.get("maintenanceMode") === "on" },
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/inicio");
}

export async function updateHideOutOfStock(formData: FormData) {
  await requireAdmin();

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", hideOutOfStock: formData.get("hideOutOfStock") === "on" },
    update: { hideOutOfStock: formData.get("hideOutOfStock") === "on" },
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/tienda");
  revalidatePath("/");
}

const MAX_HERO_SLIDES = 3;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "hero");

async function saveHeroImage(file: File): Promise<string> {
  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);
  return `/uploads/hero/${filename}`;
}

// Acepta "modashopsantafe", "@modashopsantafe" o el link completo
// (instagram.com/modashopsantafe/) y siempre guarda solo el usuario — así
// no importa qué formato pegue el admin, el link del sitio nunca se rompe.
function normalizeInstagramHandle(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const afterDomain = trimmed.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  return afterDomain.replace(/^@/, "").replace(/\/.*$/, "").trim() || null;
}

export async function updateSiteSettings(formData: FormData) {
  await requireAdmin();

  const data = {
    instagramHandle: normalizeInstagramHandle((formData.get("instagramHandle") as string) ?? ""),
    whatsappPhone: (formData.get("whatsappPhone") as string) || null,
    address: (formData.get("address") as string) || null,
    marqueeText: (formData.get("marqueeText") as string) || null,
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/");
}

export async function updateMailSettings(formData: FormData) {
  await requireAdmin();

  const port = formData.get("smtpPort");
  const password = formData.get("smtpPassword") as string;
  const resendKey = formData.get("resendApiKey") as string;
  const provider = formData.get("mailProvider") === "resend" ? "resend" : "smtp";

  const data: Record<string, unknown> = {
    franchiseName: (formData.get("franchiseName") as string) || null,
    franchiseLocation: (formData.get("franchiseLocation") as string) || null,
    mailProvider: provider,
    smtpHost: (formData.get("smtpHost") as string) || null,
    smtpPort: port ? Number(port) : null,
    smtpSecure: formData.get("smtpSecure") === "on",
    smtpUser: (formData.get("smtpUser") as string) || null,
    mailFromName: (formData.get("mailFromName") as string) || null,
    mailFromEmail: (formData.get("mailFromEmail") as string) || null,
  };
  // Igual que con las credenciales de Mercado Pago: si dejaron el campo de
  // contraseña/API key vacío (porque ya estaba cargado y no lo tocaron), no lo pisamos.
  if (password) data.smtpPassword = password;
  if (resendKey) data.resendApiKey = resendKey.trim();

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
}

export type MailTestState = { ok: boolean; error?: string };

// Botón "Probar mail" de la card de Mailing. Igual que Telegram: prueba con
// lo que hay tipeado en el form (sin guardar nada), y si un campo vino vacío
// porque está enmascarado (contraseña/API key ya guardadas), cae a lo que ya
// hay en la base — así se puede probar sin tener que reescribir credenciales.
export async function testMailSending(to: string, form: Record<string, string>): Promise<MailTestState> {
  await requireAdmin();

  const email = to.trim();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Ingresá un email válido para la prueba." };
  }

  const saved = await getStoreSettingsRow();
  const provider = form.mailProvider === "resend" ? "resend" : "smtp";

  const sender = buildMailSender({
    mailFromEmail: form.mailFromEmail?.trim() || saved.mailFromEmail,
    mailFromName: form.mailFromName?.trim() || saved.mailFromName,
    franchiseName: saved.franchiseName,
    mailProvider: provider,
    smtpHost: form.smtpHost?.trim() || saved.smtpHost,
    smtpPort: Number(form.smtpPort) || saved.smtpPort,
    smtpSecure: form.smtpSecure === "on",
    smtpUser: form.smtpUser?.trim() || saved.smtpUser,
    smtpPassword: form.smtpPassword || saved.smtpPassword,
    resendApiKey: form.resendApiKey?.trim() || saved.resendApiKey,
  });

  if (!sender) {
    return {
      ok: false,
      error:
        provider === "resend"
          ? "Faltan datos de Resend (email remitente y/o API key)."
          : "Faltan datos del SMTP (remitente, host, usuario y/o contraseña).",
    };
  }

  const result = await sender.send(
    email,
    "Prueba de ModaShop",
    "<p>✅ Si ves este mail, el envío está funcionando bien.</p>"
  );
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function updateTelegramSettings(formData: FormData) {
  await requireAdmin();

  const token = formData.get("telegramBotToken") as string;

  const data: Record<string, unknown> = {
    telegramChatId: (formData.get("telegramChatId") as string)?.trim() || null,
  };
  // El token es secreto: si lo dejaron en blanco porque ya estaba cargado, no
  // lo pisamos (mismo patrón que la API key de Odoo y la pass del SMTP).
  if (token) data.telegramBotToken = token.trim();

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
}

// Textos editables del mail "Recibimos tu pedido" (ver lib/orderEmails.ts).
// Vacío = se usa el texto por defecto (no forzamos a nadie a escribir nada).
export async function updateOrderEmailSettings(formData: FormData) {
  await requireAdmin();

  const data = {
    orderEmailIntro: (formData.get("orderEmailIntro") as string)?.trim() || null,
    orderEmailNoteTransfer: (formData.get("orderEmailNoteTransfer") as string)?.trim() || null,
    orderEmailNoteCash: (formData.get("orderEmailNoteCash") as string)?.trim() || null,
    orderEmailNoteMercadopago: (formData.get("orderEmailNoteMercadopago") as string)?.trim() || null,
    orderEmailNotePayway: (formData.get("orderEmailNotePayway") as string)?.trim() || null,
    orderEmailClosing: (formData.get("orderEmailClosing") as string)?.trim() || null,
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
}

export type TelegramTestState = { ok: boolean; error?: string };

// Botón "Probar" de la card de Telegram. Recibe el token/chat que el cliente
// leyó de los campos (o vacíos si el token quedó enmascarado por estar ya
// guardado, en cuyo caso caemos al guardado). No guarda nada: solo manda un
// mensaje de prueba y devuelve el resultado para mostrarlo inline.
export async function testTelegram(token: string, chatId: string): Promise<TelegramTestState> {
  await requireAdmin();

  const saved = await getStoreSettingsRow();
  const useToken = token.trim() || saved.telegramBotToken || "";
  const useChatId = chatId.trim() || saved.telegramChatId || "";

  if (!useToken || !useChatId) {
    return { ok: false, error: "Faltan el token o el ID del chat." };
  }

  const result = await sendTelegram(
    useToken,
    useChatId,
    "✅ <b>Prueba de ModaShop</b>\nSi ves este mensaje, los avisos de ventas están funcionando."
  );
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

function readSlideFields(formData: FormData) {
  return {
    eyebrow: String(formData.get("eyebrow") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    subtitle: (formData.get("subtitle") as string)?.trim() || null,
    promoText: (formData.get("promoText") as string)?.trim() || null,
    button1Label: (formData.get("button1Label") as string)?.trim() || null,
    button1Href: (formData.get("button1Href") as string)?.trim() || null,
    button2Label: (formData.get("button2Label") as string)?.trim() || null,
    button2Href: (formData.get("button2Href") as string)?.trim() || null,
    button3Label: (formData.get("button3Label") as string)?.trim() || null,
    button3Href: (formData.get("button3Href") as string)?.trim() || null,
    enabled: formData.get("enabled") === "on",
    position: Math.max(0, Number(formData.get("position")) || 0),
  };
}

export async function createHeroSlide(formData: FormData) {
  await requireAdmin();

  const count = await prisma.heroSlide.count();
  if (count >= MAX_HERO_SLIDES) return;

  const fields = readSlideFields(formData);
  if (!fields.eyebrow || !fields.title) return;

  const image = formData.get("image");
  const imageUrl = image instanceof File && image.size > 0 ? await saveHeroImage(image) : null;

  await prisma.heroSlide.create({ data: { ...fields, imageUrl, position: count } });
  revalidatePath("/admin/configuracion");
  revalidatePath("/");
}

export async function updateHeroSlide(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id"));
  const fields = readSlideFields(formData);
  if (!id || !fields.eyebrow || !fields.title) return;

  const image = formData.get("image");
  const imageUrl = image instanceof File && image.size > 0 ? await saveHeroImage(image) : undefined;

  await prisma.heroSlide.update({
    where: { id },
    data: { ...fields, ...(imageUrl ? { imageUrl } : {}) },
  });
  revalidatePath("/admin/configuracion");
  revalidatePath("/");
}

export async function deleteHeroSlide(id: string) {
  await requireAdmin();
  await prisma.heroSlide.delete({ where: { id } });
  revalidatePath("/admin/configuracion");
  revalidatePath("/");
}
