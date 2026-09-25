import { prisma } from "@/lib/prisma";
import { WHATSAPP_NUMBER, INSTAGRAM_HANDLE, DEFAULT_ADDRESS, DEFAULT_FRANCHISE_LOCATION, DEFAULT_CONTACT_EMAIL } from "@/lib/contact";
import { getHumanSellerAvailability } from "@/lib/ai/availability";

export async function getStoreSettingsRow() {
  return prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });
}

const DEFAULT_MARQUEE = ["Nueva colección", "Promociones", "ModaShop"];

// Selección original hardcodeada en page.tsx — se usa mientras el admin no
// eligió categorías propias en /admin/configuracion.
const DEFAULT_FEATURED_CATEGORY_IDS = [43, 40, 44, 45, 238, 62];

// Datos de contacto + marquee del sitio público, con los valores por
// defecto de lib/contact.ts como fallback mientras el admin no cargó nada.
export async function getSiteSettings() {
  const row = await getStoreSettingsRow();
  const assistantConfigured = Boolean(row.aiProvider && row.aiApiKey);
  // Ya no hay un toggle separado de "ofrecer atención humana": el horario
  // solo define CUÁNDO está disponible el WhatsApp (ya sea el botón dentro
  // del chat de la IA, o el botón flotante que lo reemplaza cuando la IA
  // está apagada) — ver WhatsAppFloatingButton y SiteChrome.
  const humanSeller = getHumanSellerAvailability({
    aiHumanHandoffEnabled: true,
    aiHumanDays: row.aiHumanDays,
    aiHumanStartTime: row.aiHumanStartTime,
    aiHumanEndTime: row.aiHumanEndTime,
    whatsappPhone: row.whatsappPhone || WHATSAPP_NUMBER,
  });

  return {
    whatsappNumber: row.whatsappPhone || WHATSAPP_NUMBER,
    instagramHandle: row.instagramHandle || INSTAGRAM_HANDLE,
    address: row.address || DEFAULT_ADDRESS,
    contactEmail: row.contactEmail || DEFAULT_CONTACT_EMAIL,
    franchiseLocation: row.franchiseLocation || DEFAULT_FRANCHISE_LOCATION,
    marqueeItems: row.marqueeText
      ? row.marqueeText.split("\n").map((s) => s.trim()).filter(Boolean)
      : DEFAULT_MARQUEE,
    featuredCategoryIds: row.featuredCategoryIds.length > 0 ? row.featuredCategoryIds : DEFAULT_FEATURED_CATEGORY_IDS,
    assistant: {
      enabled: row.aiAssistantEnabled && assistantConfigured,
      name: row.aiAssistantName?.trim() || "Vendedora virtual",
      welcomeMessage:
        row.aiWelcomeMessage?.trim() ||
        "¡Hola! Contame qué estás buscando y te ayudo a encontrar opciones de la tienda.",
      humanSeller,
    },
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
