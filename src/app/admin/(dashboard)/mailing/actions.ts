"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMailSender } from "@/lib/mailer";
import { buildMailHtml } from "@/lib/mailTemplate";
import { getAudienceEmails } from "@/lib/audiences";
import type { MailAudience } from "@/generated/prisma/enums";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("No autorizado");
}

// Corre después de que createCampaign ya respondió — no se espera (no
// `await` en el caller). Como el server corre como proceso persistente
// (self-hosted, no serverless) esto sigue ejecutando en segundo plano sin
// problema; si algún día esto corriera en algo tipo Vercel dejaría de
// funcionar así y haría falta una cola de verdad.
async function runCampaign(campaignId: string, emails: string[], subject: string, html: string) {
  const mail = await getMailSender();
  if (!mail) {
    await prisma.mailCampaign.update({
      where: { id: campaignId },
      data: { status: "failed", finishedAt: new Date() },
    });
    return;
  }

  let sent = 0;
  for (const email of emails) {
    const result = await mail.send(email, subject, html);
    if (!result.ok) console.error("mailing: no se pudo enviar a", email, "—", result.error);
    sent += 1;
    if (sent % 5 === 0 || sent === emails.length) {
      await prisma.mailCampaign.update({ where: { id: campaignId }, data: { sentCount: sent } });
    }
    // no saturar el servidor SMTP (ni parecer spam)
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  await prisma.mailCampaign.update({
    where: { id: campaignId },
    data: { status: "done", finishedAt: new Date() },
  });
}

export async function createCampaign(formData: FormData) {
  await requireAdmin();

  const subject = String(formData.get("subject") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audiences = formData.getAll("audiences") as MailAudience[];

  if (!subject || !title || !body || audiences.length === 0) return;

  const [settings, emails] = await Promise.all([
    prisma.storeSettings.findUnique({ where: { id: "global" } }),
    getAudienceEmails(audiences),
  ]);

  const campaign = await prisma.mailCampaign.create({
    data: {
      subject,
      title,
      body,
      audiences,
      recipientCount: emails.length,
      status: emails.length > 0 ? "sending" : "done",
      finishedAt: emails.length > 0 ? null : new Date(),
    },
  });

  if (emails.length > 0) {
    const html = buildMailHtml({
      logoUrl: `${process.env.NEXTAUTH_URL}/logo.png`,
      franchiseName: settings?.franchiseName || "ModaShop",
      franchiseLocation: settings?.franchiseLocation,
      subject,
      title,
      body,
      footer: {
        address: settings?.address,
        whatsappNumber: settings?.whatsappPhone,
        instagramHandle: settings?.instagramHandle,
        contactEmail: settings?.mailFromEmail,
      },
    });

    runCampaign(campaign.id, emails, subject, html).catch((err) =>
      console.error("mailing: la campaña falló", err)
    );
  }

  revalidatePath("/admin/mailing");
}

export async function deleteCampaign(id: string) {
  await requireAdmin();
  await prisma.mailCampaign.delete({ where: { id } });
  revalidatePath("/admin/mailing");
}
