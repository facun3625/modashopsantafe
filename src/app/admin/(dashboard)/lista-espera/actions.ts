"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export async function deleteWaitlistEntry(id: string) {
  await requireAdmin();
  await prisma.waitlistEntry.delete({ where: { id } });
  revalidatePath("/admin/lista-espera");
}

// Queda anotado cada click en "WhatsApp" de la lista, para saber a quién ya se le escribió
export async function markWaitlistWhatsApp(id: string) {
  await requireAdmin();
  await prisma.waitlistEntry.update({
    where: { id },
    data: { whatsappSentAt: new Date(), whatsappCount: { increment: 1 } },
  });
  revalidatePath("/admin/lista-espera");
}
