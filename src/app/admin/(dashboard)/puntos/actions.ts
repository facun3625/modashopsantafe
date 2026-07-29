"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncDeliveredOrders } from "@/lib/points";
import type { DiscountType } from "@/generated/prisma/enums";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("No autorizado");
}

export async function updatePointsSettings(formData: FormData) {
  await requireAdmin();

  const ratio = Number(formData.get("pointsRatio"));

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      pointsEnabled: formData.get("pointsEnabled") === "on",
      pointsRatio: ratio > 0 ? ratio : 0.01,
    },
    update: {
      pointsEnabled: formData.get("pointsEnabled") === "on",
      pointsRatio: ratio > 0 ? ratio : 0.01,
    },
  });

  revalidatePath("/admin/puntos");
}

function readRewardData(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    pointsRequired: Math.max(1, Number(formData.get("pointsRequired")) || 0),
    discountType: formData.get("discountType") as DiscountType,
    discountValue: Math.max(0, Number(formData.get("discountValue")) || 0),
    enabled: formData.get("enabled") === "on",
  };
}

export async function createReward(formData: FormData) {
  await requireAdmin();
  const data = readRewardData(formData);
  if (!data.title) return;

  await prisma.pointReward.create({ data });
  revalidatePath("/admin/puntos");
}

export async function updateReward(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const data = readRewardData(formData);
  if (!id || !data.title) return;

  await prisma.pointReward.update({ where: { id }, data });
  revalidatePath("/admin/puntos");
}

export async function deleteReward(id: string) {
  await requireAdmin();
  await prisma.pointReward.delete({ where: { id } });
  revalidatePath("/admin/puntos");
}

export async function syncNow() {
  await requireAdmin();
  const result = await syncDeliveredOrders();
  revalidatePath("/admin/puntos");
  redirect(
    `/admin/puntos?synced=1&checked=${result.checked}&awarded=${result.awarded}${result.skipped ? "&skipped=1" : ""}`
  );
}
