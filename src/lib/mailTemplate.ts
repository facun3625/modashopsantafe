// Sin dependencias de servidor a propósito: este mismo builder se usa tanto
// al mandar el mail de verdad (lib/mailer.ts) como en la vista previa en
// vivo del admin (un client component), para que lo que se ve en pantalla
// sea exactamente lo que se manda.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#383e45;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
}

export type MailTemplateData = {
  logoUrl: string;
  franchiseName: string;
  franchiseLocation?: string | null;
  subject: string;
  title: string;
  body: string;
  footer: {
    address?: string | null;
    whatsappNumber?: string | null;
    instagramHandle?: string | null;
    contactEmail?: string | null;
  };
};

export function buildMailHtml(data: MailTemplateData): string {
  const { logoUrl, franchiseName, franchiseLocation, title, body, footer } = data;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(data.subject)}</title>
  </head>
  <body style="margin:0;padding:24px 12px;background:#f6f6f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;">
      <div style="text-align:center;padding:16px 0 24px;">
        <img src="${logoUrl}" alt="${escapeHtml(franchiseName)}" style="height:44px;" />
        <p style="margin:10px 0 0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#685563;">
          ${escapeHtml(franchiseName)}${franchiseLocation ? ` — ${escapeHtml(franchiseLocation)}` : ""}
        </p>
      </div>

      <div style="background:#ffffff;border-radius:20px;padding:32px;border:1px solid #eee;">
        <h1 style="margin:0 0 18px;font-size:22px;color:#383e45;">${escapeHtml(title)}</h1>
        ${paragraphs(body)}
      </div>

      <div style="text-align:center;padding:24px 12px;font-size:12px;line-height:1.8;color:#8a8a8a;">
        ${footer.address ? `<p style="margin:0;">${escapeHtml(footer.address)}</p>` : ""}
        <p style="margin:0;">
          ${footer.whatsappNumber ? `WhatsApp: ${escapeHtml(footer.whatsappNumber)}` : ""}
          ${footer.instagramHandle ? ` · @${escapeHtml(footer.instagramHandle)}` : ""}
          ${footer.contactEmail ? ` · ${escapeHtml(footer.contactEmail)}` : ""}
        </p>
      </div>
    </div>
  </body>
</html>`;
}
