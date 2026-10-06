"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminLog";
import { prisma } from "@/lib/prisma";
import { createBaseTheme, ensureBaseTheme } from "@/lib/baseTheme";
import { configFromTemplate, DEFAULT_THEME_CONFIG, sanitizeThemeConfig, THEME_TEMPLATES, type ThemeConfig } from "@/lib/themes";

export type ThemeInput = { id?: string; name: string; description: string; startsAt: string; endsAt: string; config: ThemeConfig };

const toDate = (v: string): Date | null => {
  if (!v?.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function refresh() {
  revalidatePath("/admin/temas");
  revalidatePath("/", "layout");
}

// activate = "Guardar y activar": además de guardar, deja el tema encendido. Sin fechas queda vigente desde ya (y pasa
// por encima de los demás); con fechas entra y sale solo según ellas.
// Abre (y crea la primera vez) el aspecto base: el que se ve cuando no hay ninguna campaña vigente.
export async function openBaseTheme(): Promise<{ id: string }> {
  await requireAdmin();
  const existing = (await ensureBaseTheme()) ?? (await createBaseTheme());
  refresh();
  return { id: existing.id };
}

// Vuelve el aspecto base a como venía de fábrica
export async function resetBaseTheme(id: string) {
  await requireAdmin();
  await prisma.theme.updateMany({ where: { id, isBase: true }, data: { config: DEFAULT_THEME_CONFIG as object } });
  await logAdminAction("theme.save", { targetType: "theme", targetId: id, detail: "Aspecto base restablecido" });
  refresh();
}

export async function saveTheme(input: ThemeInput, activate = false): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireAdmin();
  const isBase = input.id ? Boolean((await prisma.theme.findUnique({ where: { id: input.id }, select: { isBase: true } }))?.isBase) : false;
  if (isBase) {
    // El aspecto base vale siempre: no tiene fechas ni se activa/apaga
    const base = await prisma.theme.update({ where: { id: input.id! }, data: { config: sanitizeThemeConfig(input.config) as object, startsAt: null, endsAt: null, enabled: true } });
    await logAdminAction("theme.save", { targetType: "theme", targetId: base.id, detail: "Aspecto base" });
    refresh();
    return { ok: true, id: base.id };
  }
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Poné un nombre al tema" };
  const startsAt = toDate(input.startsAt);
  const endsAt = toDate(input.endsAt);
  if (input.startsAt?.trim() && !startsAt) return { ok: false, error: "La fecha de inicio no es válida" };
  if (input.endsAt?.trim() && !endsAt) return { ok: false, error: "La fecha de fin no es válida" };
  if (startsAt && endsAt && endsAt <= startsAt) return { ok: false, error: "El fin tiene que ser posterior al inicio" };

  if (activate && endsAt && endsAt <= new Date()) return { ok: false, error: "La fecha de fin ya pasó: corregila para poder activarlo" };

  const data = { name, description: input.description.trim().slice(0, 300) || null, startsAt, endsAt, config: sanitizeThemeConfig(input.config) as object, ...(activate ? { enabled: true, startsAt: startsAt ?? new Date() } : {}) };
  const theme = input.id ? await prisma.theme.update({ where: { id: input.id }, data }) : await prisma.theme.create({ data });
  await logAdminAction(activate ? "theme.activate" : "theme.save", { targetType: "theme", targetId: theme.id, detail: name });
  refresh();
  return { ok: true, id: theme.id };
}

export async function createThemeFromTemplate(key: string): Promise<{ id: string }> {
  await requireAdmin();
  const template = THEME_TEMPLATES.find((t) => t.key === key);
  const theme = await prisma.theme.create({
    data: {
      name: template ? template.name : "Tema nuevo",
      description: template?.description ?? null,
      config: (template ? configFromTemplate(key) : DEFAULT_THEME_CONFIG) as object,
    },
  });
  await logAdminAction("theme.save", { targetType: "theme", targetId: theme.id, detail: `Creado ${template ? `desde la plantilla ${template.name}` : "en blanco"}` });
  refresh();
  return { id: theme.id };
}

// "Activar ahora": queda vigente desde este momento (y pasa por encima de otros temas que hayan empezado antes).
// Si tenía una fecha de fin ya vencida, se la saca para que no se apague al instante.
export async function activateTheme(id: string) {
  await requireAdmin();
  const theme = await prisma.theme.findFirst({ where: { id, isBase: false }, select: { name: true, endsAt: true } });
  if (!theme) return;
  await prisma.theme.update({ where: { id }, data: { enabled: true, startsAt: new Date(), endsAt: theme.endsAt && theme.endsAt > new Date() ? theme.endsAt : null } });
  await logAdminAction("theme.activate", { targetType: "theme", targetId: id, detail: theme.name });
  refresh();
}

export async function deactivateTheme(id: string) {
  await requireAdmin();
  const theme = await prisma.theme.findFirst({ where: { id, isBase: false }, select: { name: true } });
  if (!theme) return;
  await prisma.theme.update({ where: { id }, data: { enabled: false } });
  await logAdminAction("theme.deactivate", { targetType: "theme", targetId: id, detail: theme.name });
  refresh();
}

// Deja el tema "armado" para que entre y salga solo según sus fechas (necesita inicio o fin cargado en el editor)
export async function scheduleTheme(id: string) {
  await requireAdmin();
  await prisma.theme.updateMany({ where: { id, isBase: false }, data: { enabled: true } });
  refresh();
}

export async function duplicateTheme(id: string): Promise<{ id: string } | null> {
  await requireAdmin();
  const t = await prisma.theme.findUnique({ where: { id } });
  if (!t) return null;
  const copy = await prisma.theme.create({ data: { name: `Copia de ${t.name}`.slice(0, 80), description: t.description, config: t.config as object, enabled: false } });
  refresh();
  return { id: copy.id };
}

export async function deleteTheme(id: string) {
  await requireAdmin();
  const t = await prisma.theme.findFirst({ where: { id, isBase: false }, select: { name: true } });
  if (!t) return;
  await prisma.theme.delete({ where: { id } });
  await logAdminAction("theme.delete", { targetType: "theme", targetId: id, detail: t.name });
  refresh();
}

// Imagen de un slide o de una tarjeta: se guarda en public/uploads/themes y se sirve con su propia ruta (ver
// api/uploads/themes/[filename]) — igual que las imágenes del mailing y del pop-up.
const THEME_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "themes");
const THEME_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const MAX_THEME_IMAGE_BYTES = 4 * 1024 * 1024;

export async function uploadThemeImage(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí una imagen." };
  if (!THEME_IMAGE_TYPES.has(file.type)) return { ok: false, error: "Formato no soportado (usá PNG, JPG, WEBP, GIF o AVIF)." };
  if (file.size > MAX_THEME_IMAGE_BYTES) return { ok: false, error: "La imagen pesa más de 4 MB." };

  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  await mkdir(THEME_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(THEME_UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
  return { ok: true, url: `/api/uploads/themes/${filename}` };
}
