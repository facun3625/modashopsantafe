import nodemailer from "nodemailer";
import { getStoreSettingsRow } from "@/lib/settings";

export type MailSendResult = { ok: boolean; error?: string };

// Sender reusable: resuelve el proveedor configurado (SMTP o Resend) una sola
// vez y devuelve una función `send`. Sirve tanto para envíos sueltos (mail de
// confirmación) como para loops (mailing masivo), sin re-resolver por mensaje.
export type MailSender = {
  from: string;
  send: (to: string, subject: string, html: string) => Promise<MailSendResult>;
};

// null = todavía no se puede enviar (falta completar la config del proveedor
// elegido en /admin/configuracion). Quien llama decide qué hacer.
export async function getMailSender(): Promise<MailSender | null> {
  const settings = await getStoreSettingsRow();
  if (!settings.mailFromEmail) return null;

  const fromName = settings.mailFromName || settings.franchiseName || "ModaShop";
  const from = `"${fromName}" <${settings.mailFromEmail}>`;

  if (settings.mailProvider === "resend") {
    const apiKey = settings.resendApiKey?.trim();
    if (!apiKey) return null;
    return {
      from,
      send: async (to, subject, html) => {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to, subject, html }),
          });
          if (res.ok) return { ok: true };
          const detail = (await res.text().catch(() => "")).slice(0, 300);
          return { ok: false, error: `Resend ${res.status}: ${detail}` };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
        }
      },
    };
  }

  // SMTP (default)
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) return null;
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort ?? 587,
    secure: settings.smtpSecure,
    auth: { user: settings.smtpUser, pass: settings.smtpPassword },
  });
  return {
    from,
    send: async (to, subject, html) => {
      try {
        await transporter.sendMail({ from, to, subject, html });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Error SMTP" };
      }
    },
  };
}
