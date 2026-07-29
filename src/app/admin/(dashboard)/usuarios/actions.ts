"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("No autorizado");
  return session;
}

export async function setUserRole(id: string, role: "admin" | "customer") {
  const session = await requireAdmin();
  // Un admin no puede sacarse el rol a sí mismo desde acá — evita quedarse
  // afuera del panel por error si es el único admin.
  if (session.user.id === id && role !== "admin") {
    throw new Error("No podés quitarte el rol de administrador a vos mismo.");
  }
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/admin/usuarios");
}
