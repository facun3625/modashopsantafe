"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("No autorizado");
}

export async function createShippingMethod(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.shippingMethod.create({
    data: {
      name,
      description: (formData.get("description") as string) || undefined,
      cost: Math.max(0, Number(formData.get("cost")) || 0),
      requiresAddress: formData.get("requiresAddress") === "on",
      enabled: formData.get("enabled") === "on",
    },
  });

  revalidatePath("/admin/envios");
}

export async function updateShippingMethod(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  await prisma.shippingMethod.update({
    where: { id },
    data: {
      name,
      description: (formData.get("description") as string) || null,
      cost: Math.max(0, Number(formData.get("cost")) || 0),
      requiresAddress: formData.get("requiresAddress") === "on",
      enabled: formData.get("enabled") === "on",
    },
  });

  revalidatePath("/admin/envios");
}

export async function deleteShippingMethod(id: string) {
  await requireAdmin();
  await prisma.shippingMethod.delete({ where: { id } });
  revalidatePath("/admin/envios");
}
