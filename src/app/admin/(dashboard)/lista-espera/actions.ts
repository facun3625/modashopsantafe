"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("No autorizado");
}

export async function deleteWaitlistEntry(id: string) {
  await requireAdmin();
  await prisma.waitlistEntry.delete({ where: { id } });
  revalidatePath("/admin/lista-espera");
}
