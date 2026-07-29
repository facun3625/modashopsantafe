import { prisma } from "@/lib/prisma";
import { WHATSAPP_NUMBER, INSTAGRAM_HANDLE, DEFAULT_ADDRESS } from "@/lib/contact";

export async function getStoreSettingsRow() {
  return prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });
}

const DEFAULT_MARQUEE = ["Nueva colección", "Promociones", "ModaShop"];

// Datos de contacto + marquee del sitio público, con los valores por
// defecto de lib/contact.ts como fallback mientras el admin no cargó nada.
export async function getSiteSettings() {
  const row = await getStoreSettingsRow();

  return {
    whatsappNumber: row.whatsappPhone || WHATSAPP_NUMBER,
    instagramHandle: row.instagramHandle || INSTAGRAM_HANDLE,
    address: row.address || DEFAULT_ADDRESS,
    marqueeItems: row.marqueeText
      ? row.marqueeText.split("\n").map((s) => s.trim()).filter(Boolean)
      : DEFAULT_MARQUEE,
  };
}

export type SiteSettings = Awaited<ReturnType<typeof getSiteSettings>>;

export async function getHeroSlides() {
  return prisma.heroSlide.findMany({
    where: { enabled: true },
    orderBy: { position: "asc" },
    take: 3,
  });
}
