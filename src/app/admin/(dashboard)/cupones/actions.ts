"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DiscountType, PaymentMethod } from "@/generated/prisma/enums";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("No autorizado");
}

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
