import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { getAudienceCounts, AUDIENCE_LABELS } from "@/lib/audiences";
import { Badge } from "@/components/admin/Badge";
import { MailComposer } from "./MailComposer";
import { MailHistoryPoller } from "./MailHistoryPoller";
import { deleteCampaign } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  sending: "Enviando...",
  done: "Enviado",
  failed: "Falló (revisá el SMTP)",
};

const STATUS_TONES: Record<string, "amber" | "green" | "red"> = {
  sending: "amber",
  done: "green",
  failed: "red",
};

export default async function AdminMailingPage() {
  const [settings, audienceCounts, campaigns] = await Promise.all([
    getStoreSettingsRow(),
    getAudienceCounts(),
    prisma.mailCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const smtpReady = Boolean(settings.smtpHost && settings.smtpUser && settings.smtpPassword && settings.mailFromEmail);
  const hasSending = campaigns.some((c) => c.status === "sending");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <MailHistoryPoller active={hasSending} />

      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Mailing</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Armá un mail y mandalo a una o varias listas. Se envía en segundo plano, no hace falta esperar en esta
          pantalla.
        </p>
      </div>

      {!smtpReady && (
        <div className="mt-4 shrink-0 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Todavía falta completar el SMTP en <span className="font-semibold">Configuración → Franquicia y mailing</span>.
          Podés armar el mail igual, pero el envío va a fallar hasta que lo cargues.
        </div>
      )}

      <MailComposer
        audienceCounts={audienceCounts}
        franchiseName={settings.franchiseName || "ModaShop"}
        franchiseLocation={settings.franchiseLocation}
        footer={{
          address: settings.address,
          whatsappNumber: settings.whatsappPhone,
          instagramHandle: settings.instagramHandle,
          contactEmail: settings.mailFromEmail,
        }}
      />

      <h2 className="mt-8 shrink-0 text-sm font-semibold uppercase tracking-wide text-brand-muted">
        Historial de envíos
      </h2>

      <div className="mt-3 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Asunto</th>
              <th className="px-4 py-3 font-semibold">Listas</th>
              <th className="px-4 py-3 font-semibold">Destinatarios</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
                <td className="px-4 py-3 font-medium text-brand-ink">
                  {c.subject}
                  <p className="text-xs font-normal text-brand-muted">{c.title}</p>
                </td>
                <td className="px-4 py-3 text-brand-muted">
                  {c.audiences.map((a) => AUDIENCE_LABELS[a]).join(", ")}
                </td>
                <td className="px-4 py-3 text-brand-muted">
                  {c.sentCount} / {c.recipientCount}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONES[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-brand-muted">{c.createdAt.toLocaleString("es-AR")}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteCampaign.bind(null, c.id)}>
                    <button
                      type="submit"
                      className="cursor-pointer text-xs font-semibold text-brand-muted hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-muted">
                  Todavía no mandaste ningún mailing.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
