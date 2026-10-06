"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { sendTelegram } from "@/lib/telegram";
import { normalizeTime } from "@/lib/ai/availability";
import { clearCatalogCache } from "@/lib/catalogCache";

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

// Cupón de bienvenida para cuentas nuevas (ver lib/welcomeCoupon.ts)
export async function updateWelcomeCouponSettings(formData: FormData) {
  await requireAdmin();
  const type = formData.get("welcomeCouponType") === "fixed" ? "fixed" : "percentage";
  const rawValue = Math.max(0, Number(formData.get("welcomeCouponValue")) || 0);
  const value = type === "percentage" ? Math.min(rawValue, 100) : rawValue;
  const minPurchase = Number(formData.get("welcomeCouponMinPurchase")) || 0;
  const data = {
    welcomeCouponEnabled: formData.get("welcomeCouponEnabled") === "on",
    welcomeCouponType: type as "fixed" | "percentage",
    welcomeCouponValue: value,
    welcomeCouponDays: Math.min(365, Math.max(0, Math.floor(Number(formData.get("welcomeCouponDays")) || 0))),
    welcomeCouponMinPurchase: minPurchase > 0 ? minPurchase : null,
  };
  await prisma.storeSettings.upsert({ where: { id: "global" }, create: { id: "global", ...data }, update: data });
  revalidatePath("/admin/configuracion");
}

// Cada cuánto se vuelve a consultar el catálogo a Odoo (ver lib/catalogCache.ts). 0 = siempre en vivo.
export async function updateCatalogCacheSettings(formData: FormData) {
  await requireAdmin();
  const seconds = Math.min(3600, Math.max(0, Math.floor(Number(formData.get("catalogCacheSeconds")) || 0)));
  await prisma.storeSettings.upsert({ where: { id: "global" }, create: { id: "global", catalogCacheSeconds: seconds }, update: { catalogCacheSeconds: seconds } });
  clearCatalogCache();
  revalidatePath("/admin/configuracion");
}

// "Actualizar catálogo ahora": descarta lo guardado y la próxima visita consulta a Odoo en vivo (ej. después de
// cambiar precios o cargar productos nuevos en Odoo).
export async function refreshCatalogNow() {
  await requireAdmin();
  clearCatalogCache();
  revalidatePath("/tienda");
  revalidatePath("/");
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

function optionalText(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

// Configuración comercial que maneja el dueño: contenido de la vendedora,
// on/off y horario de WhatsApp. Solo proveedor, modelo y API key permanecen
// en /odoo_api porque son datos técnicos y secretos.
export async function updateAiAssistantSettings(formData: FormData) {
  await requireAdmin();

  const humanDays = [...new Set(
    formData
      .getAll("aiHumanDays")
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )].sort((a, b) => a - b);

  const data = {
    aiAssistantEnabled: formData.get("aiAssistantEnabled") === "on",
    aiAssistantName: optionalText(formData, "aiAssistantName", 60),
    aiWelcomeMessage: optionalText(formData, "aiWelcomeMessage", 500),
    aiInstructions: optionalText(formData, "aiInstructions", 6000),
    aiHumanDays: humanDays,
    aiHumanStartTime: normalizeTime(formData.get("aiHumanStartTime"), "09:00"),
    aiHumanEndTime: normalizeTime(formData.get("aiHumanEndTime"), "18:00"),
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/", "layout");
}

const POPUP_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "popup");
const POPUP_ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const MAX_POPUP_IMAGE_BYTES = 4 * 1024 * 1024;

// Insertada desde el botón de imagen del RichTextEditor del pop-up — mismo
// patrón que uploadMailImage, carpeta/ruta propia (public/uploads/popup +
// /api/uploads/popup/[filename]) para no mezclarla con las del mailing.
export async function uploadPopupImage(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí una imagen." };
  if (!POPUP_ALLOWED_TYPES.has(file.type)) return { ok: false, error: "Formato no soportado (usá PNG, JPG, WEBP, GIF o AVIF)." };
  if (file.size > MAX_POPUP_IMAGE_BYTES) return { ok: false, error: "La imagen pesa más de 4 MB." };

  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  await mkdir(POPUP_UPLOAD_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(POPUP_UPLOAD_DIR, filename), bytes);

  return { ok: true, url: `/api/uploads/popup/${filename}` };
}

const POPUP_SCOPES = new Set(["home", "tienda", "all"]);
const POPUP_FREQUENCIES = new Set(["once", "daily", "always"]);

// Pop-up promocional del sitio público — ver components/SitePopupModal.tsx.
export async function updatePopupSettings(formData: FormData) {
  await requireAdmin();

  const scope = formData.get("popupScope");
  const frequency = formData.get("popupFrequency");

  const data = {
    popupEnabled: formData.get("popupEnabled") === "on",
    popupTitle: optionalText(formData, "popupTitle", 100),
    popupBodyHtml: (formData.get("popupBodyHtml") as string)?.trim() || null,
    popupScope: (typeof scope === "string" && POPUP_SCOPES.has(scope) ? scope : "all") as "home" | "tienda" | "all",
    popupFrequency: (typeof frequency === "string" && POPUP_FREQUENCIES.has(frequency) ? frequency : "once") as
      | "once"
      | "daily"
      | "always",
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/", "layout");
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
    contactEmail: (formData.get("contactEmail") as string) || null,
    marqueeText: (formData.get("marqueeText") as string) || null,
    featuredCategoryIds: formData.getAll("featuredCategoryIds").map(Number),
    shopPriorityCategoryIds: formData.getAll("shopPriorityCategoryIds").map(Number).filter((n) => Number.isInteger(n) && n > 0),
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/");
  revalidatePath("/tienda");
}

// Franja de 3 beneficios del home (ver BenefitsStrip) — cada campo vacío
// vuelve a null, que en getSiteSettings() cae al valor calculado por defecto
// en vez de mostrar un texto vacío.
export async function updateBenefitsSettings(formData: FormData) {
  await requireAdmin();

  const data = {
    benefit1Icon: (formData.get("benefit1Icon") as string) || null,
    benefit1Title: optionalText(formData, "benefit1Title", 80),
    benefit1Subtitle: optionalText(formData, "benefit1Subtitle", 120),
    benefit2Icon: (formData.get("benefit2Icon") as string) || null,
    benefit2Title: optionalText(formData, "benefit2Title", 80),
    benefit2Subtitle: optionalText(formData, "benefit2Subtitle", 120),
    benefit3Icon: (formData.get("benefit3Icon") as string) || null,
    benefit3Title: optionalText(formData, "benefit3Title", 80),
    benefit3Subtitle: optionalText(formData, "benefit3Subtitle", 120),
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/");
}

// El proveedor de envío (SMTP/Resend), sus credenciales y el remitente son
// configuración técnica y se cargan en /odoo_api junto con Odoo y la IA —
// ver updateMailProviderSettings ahí. Acá solo queda la identidad de la
// franquicia (nombre/sucursal), que sí es algo que cualquiera que administre
// la tienda puede querer tocar.
export async function updateMailSettings(formData: FormData) {
  await requireAdmin();

  const data = {
    franchiseName: (formData.get("franchiseName") as string) || null,
    franchiseLocation: (formData.get("franchiseLocation") as string) || null,
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
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

