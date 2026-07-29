import { prisma } from "@/lib/prisma";
import type { MailAudience } from "@/generated/prisma/enums";

export const AUDIENCE_LABELS: Record<MailAudience, string> = {
  abandoned_carts: "Carritos abandonados",
  waitlist: "Lista de espera",
  users: "Usuarios registrados",
  subscribers: "Suscriptores al newsletter",
};

export const ALL_AUDIENCES = Object.keys(AUDIENCE_LABELS) as MailAudience[];

async function emailsFor(audience: MailAudience): Promise<string[]> {
  if (audience === "abandoned_carts") {
    const carts = await prisma.abandonedCart.findMany({ include: { user: { select: { email: true } } } });
    return carts.map((c) => c.user?.email ?? c.email).filter((e): e is string => Boolean(e));
  }
  if (audience === "waitlist") {
    const entries = await prisma.waitlistEntry.findMany({ select: { email: true } });
    return entries.map((e) => e.email);
  }
  if (audience === "users") {
    const users = await prisma.user.findMany({ select: { email: true } });
    return users.map((u) => u.email);
  }
  if (audience === "subscribers") {
    const subs = await prisma.newsletterSubscriber.findMany({ select: { email: true } });
    return subs.map((s) => s.email);
  }
  return [];
}

// Une los emails de todas las audiencias elegidas, sin duplicados (alguien
// puede estar, por ej., como usuario registrado Y suscripto al newsletter).
export async function getAudienceEmails(audiences: MailAudience[]): Promise<string[]> {
  const lists = await Promise.all(audiences.map(emailsFor));
  return [...new Set(lists.flat())];
}

export async function getAudienceCounts(): Promise<Record<MailAudience, number>> {
  const [carts, waitlist, users, subs] = await Promise.all([
    prisma.abandonedCart.count(),
    prisma.waitlistEntry.count(),
    prisma.user.count(),
    prisma.newsletterSubscriber.count(),
  ]);
  return { abandoned_carts: carts, waitlist, users, subscribers: subs };
}
