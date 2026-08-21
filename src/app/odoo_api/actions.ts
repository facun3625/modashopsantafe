"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resetOdooCache } from "@/lib/odoo";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("No autorizado");
}

export async function updateOdooSettings(formData: FormData) {
  await requireAdmin();

  const apiKey = formData.get("odooApiKey") as string;

  const data: Record<string, unknown> = {
    odooUrl: (formData.get("odooUrl") as string)?.trim().replace(/\/$/, "") || null,
    odooDb: (formData.get("odooDb") as string)?.trim() || null,
    odooUser: (formData.get("odooUser") as string)?.trim() || null,
  };
  // Igual que la contraseña del SMTP: si la dejaron en blanco porque ya
  // estaba cargada, no la pisamos.
  if (apiKey) data.odooApiKey = apiKey;

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  resetOdooCache();
  revalidatePath("/odoo_api");
}
