"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("No autorizado");
}

export async function confirmOrderPayment(orderId: string) {
  await requireAdmin();
  await prisma.order.update({ where: { id: orderId }, data: { status: "confirmed" } });
  revalidatePath("/admin/ventas");
}

export async function cancelOrder(orderId: string) {
  await requireAdmin();
  await prisma.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
  revalidatePath("/admin/ventas");
}
