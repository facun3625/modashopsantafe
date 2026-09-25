"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import type { DiscountType, PaymentMethod } from "@/generated/prisma/enums";

function readCouponData(formData: FormData) {
  const categoryId = formData.get("categoryId");
  const productId = formData.get("productId");
  const paymentMethod = formData.get("paymentMethod");
  const minPurchaseAmount = formData.get("minPurchaseAmount");
  const expiresAt = formData.get("expiresAt");
  const maxUses = formData.get("maxUses");

  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    enabled: formData.get("enabled") === "on",
    discountType: formData.get("discountType") as DiscountType,
    discountValue: Math.max(0, Number(formData.get("discountValue")) || 0),
    categoryId: categoryId ? Number(categoryId) : null,
    productId: productId ? Number(productId) : null,
    paymentMethod: paymentMethod ? (paymentMethod as PaymentMethod) : null,
    minPurchaseAmount: minPurchaseAmount ? Number(minPurchaseAmount) : null,
    expiresAt: expiresAt ? new Date(String(expiresAt)) : null,
    maxUses: maxUses ? Number(maxUses) : null,
  };
}

export async function createCoupon(formData: FormData) {
  await requireAdmin();
  const data = readCouponData(formData);
  if (!data.code) return;

  await prisma.coupon.create({ data });
  revalidatePath("/admin/cupones");
}

export async function updateCoupon(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const data = readCouponData(formData);
  if (!id || !data.code) return;

  await prisma.coupon.update({ where: { id }, data });
  revalidatePath("/admin/cupones");
}

export async function deleteCoupon(id: string) {
  await requireAdmin();
  await prisma.coupon.delete({ where: { id } });
  revalidatePath("/admin/cupones");
}

// Sin caracteres ambiguos (0/O, 1/I/L) — se va a leer en voz alta o escrito
// a mano en el local, no tipeado desde un mail.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateQuickCouponCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `TIENDA-${code}`;
}

export type QuickCouponResult =
  | { ok: true; code: string; discountValue: number; expiresAt: string | null }
  | { ok: false; error: string };

// "Cupón rápido": para cuando alguien compra en el local físico y se lo
// quiere invitar a probar la tienda online — un solo uso, sin condiciones
// de categoría/producto/medio de pago, con vencimiento corto para generar
// urgencia. Se manda por WhatsApp desde el mismo panel (QuickCouponGenerator).
export async function generateQuickCoupon(formData: FormData): Promise<QuickCouponResult> {
  await requireAdmin();

  const rawPct = Number(formData.get("discountValue"));
  if (!Number.isFinite(rawPct) || rawPct <= 0) {
    return { ok: false, error: "Cargá un descuento válido." };
  }
  const discountValue = Math.min(100, Math.round(rawPct));

  const rawDays = formData.get("expiresInDays");
  const days = rawDays ? Number(rawDays) : null;
  const expiresAt = days && days > 0 ? new Date(Date.now() + days * 86_400_000) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateQuickCouponCode();
    try {
      await prisma.coupon.create({
        data: { code, discountType: "percentage", discountValue, maxUses: 1, expiresAt },
      });
      revalidatePath("/admin/cupones");
      return { ok: true, code, discountValue, expiresAt: expiresAt?.toISOString() ?? null };
    } catch (err) {
      // P2002 = choque de unique constraint en `code` (altamente
      // improbable con 6 caracteres al azar, pero el campo es único) —
      // reintenta con un código nuevo. Cualquier otro error, lo dejamos
      // volar.
      const code2002 = (err as { code?: string } | null)?.code === "P2002";
      if (!code2002) throw err;
    }
  }
  return { ok: false, error: "No se pudo generar un código único — probá de nuevo." };
}
