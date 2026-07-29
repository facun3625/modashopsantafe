import nodemailer from "nodemailer";
import { getStoreSettingsRow } from "@/lib/settings";

// null = todavía no se cargó (o falta completar) la configuración SMTP en
// /admin/configuracion — quien llama decide qué hacer (bloquear el envío,
// avisar en la UI, etc.), acá no se asume nada.
export async function getMailTransport() {
  const settings = await getStoreSettingsRow();
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword || !settings.mailFromEmail) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort ?? 587,
    secure: settings.smtpSecure,
    auth: { user: settings.smtpUser, pass: settings.smtpPassword },
  });

  const fromName = settings.mailFromName || settings.franchiseName || "ModaShop";

  return { transporter, from: `"${fromName}" <${settings.mailFromEmail}>` };
}
