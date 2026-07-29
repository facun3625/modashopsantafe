import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/points";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { Badge } from "@/components/admin/Badge";
import { SaveButton } from "@/components/admin/SaveButton";
import { CardAccordion } from "@/components/admin/CardAccordion";
import { updatePointsSettings, createReward, updateReward, deleteReward, syncNow } from "./actions";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-semibold text-brand-muted";

function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

export default async function AdminPuntosPage({
  searchParams,
}: {
  searchParams: Promise<{ synced?: string; checked?: string; awarded?: string; skipped?: string }>;
}) {
  const params = await searchParams;

  const [settings, rewards, pendingCount, redemptions] = await Promise.all([
    getStoreSettings(),
    prisma.pointReward.findMany({ orderBy: { pointsRequired: "asc" } }),
    prisma.order.count({
      where: { pointsAwardedAt: null, odooPickingId: { not: null }, userId: { not: null }, status: { not: "cancelled" } },
    }),
    prisma.pointTransaction.findMany({
      where: { amount: { lt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Puntos</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Los clientes ganan puntos cuando Odoo marca su pedido como entregado, y los canjean por cupones de descuento
          de un solo uso.
        </p>
      </div>

      {params.synced && (
        <div className="mt-4 shrink-0 rounded-lg border border-brand-pink/20 bg-brand-soft px-4 py-3 text-sm text-brand-ink">
          {params.skipped
            ? "El sistema de puntos está desactivado — no se revisó nada."
            : `Sincronización manual: se revisaron ${params.checked} pedidos pendientes, se acreditaron puntos a ${params.awarded}.`}
        </div>
      )}

      <div className="mt-6 shrink-0 rounded-xl border border-black/10 bg-white p-5">
        <form action={updatePointsSettings} className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 pb-0.5">
              <ToggleSwitch name="pointsEnabled" defaultChecked={settings.pointsEnabled} />
              <span className="text-sm text-brand-ink">Sistema de puntos activo</span>
            </div>
            <div className="w-44">
              <label className={labelClasses}>Puntos por cada $1</label>
              <input
                type="number"
                name="pointsRatio"
                min={0}
                step={0.001}
                defaultValue={settings.pointsRatio}
                className={fieldClasses}
              />
            </div>
          </div>
          <SaveButton trackDirty />
        </form>
        <p className="mt-3 text-xs text-brand-muted">
          Por cada $1.000 de subtotal, un cliente gana {Math.floor(1000 * settings.pointsRatio)} puntos.
        </p>
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-5">
        <div>
          <p className="text-sm font-semibold text-brand-ink">Sincronización con Odoo</p>
          <p className="mt-0.5 text-xs text-brand-muted">
            {pendingCount} pedido{pendingCount === 1 ? "" : "s"} esperando confirmación de entrega
            {settings.pointsLastSync ? ` · última revisión ${timeAgo(settings.pointsLastSync)}` : ""}. Se revisa
            solo cada 15 minutos, o al toque acá.
          </p>
        </div>
        <form action={syncNow}>
          <button
            type="submit"
            className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
          >
            Sincronizar ahora
          </button>
        </form>
      </div>

      <h2 className="mt-8 shrink-0 text-sm font-semibold uppercase tracking-wide text-brand-muted">
        Catálogo de recompensas
      </h2>

      <div className="mt-3 flex flex-col gap-4">
        {rewards.map((r) => (
          <form
            key={r.id}
            action={updateReward}
            className={`rounded-xl border bg-white p-5 transition-colors ${
              r.enabled ? "border-brand-pink/30" : "border-black/10"
            }`}
          >
            <input type="hidden" name="id" value={r.id} />
            <CardAccordion
              titleArea={
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      name="title"
                      defaultValue={r.title}
                      required
                      className="min-w-0 flex-1 border-0 p-0 text-base font-semibold text-brand-ink focus:outline-none"
                    />
                    <Badge tone="pink">{r.pointsRequired} pts</Badge>
                  </div>
                  <p className="mt-1 text-sm text-brand-muted">
                    {r.discountType === "percentage" ? `${r.discountValue}% off` : `$${r.discountValue.toFixed(2)} off`}
                  </p>
                </div>
              }
              headerRight={<ToggleSwitch name="enabled" defaultChecked={r.enabled} />}
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-40">
                  <label className={labelClasses}>Puntos requeridos</label>
                  <input
                    type="number"
                    name="pointsRequired"
                    min={1}
                    defaultValue={r.pointsRequired}
                    className={fieldClasses}
                  />
                </div>
                <div className="w-32">
                  <label className={labelClasses}>Tipo</label>
                  <select name="discountType" defaultValue={r.discountType} className={`${fieldClasses} bg-white`}>
                    <option value="percentage">% off</option>
                    <option value="fixed">$ off</option>
                  </select>
                </div>
                <div className="w-28">
                  <label className={labelClasses}>Valor</label>
                  <input
                    type="number"
                    name="discountValue"
                    min={0}
                    step={0.01}
                    defaultValue={r.discountValue}
                    className={fieldClasses}
                  />
                </div>
              </div>

              <div className="mt-5 flex gap-3 border-t border-black/5 pt-4">
                <SaveButton trackDirty />
                <button
                  type="submit"
                  formAction={deleteReward.bind(null, r.id)}
                  className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-brand-muted transition-colors hover:border-red-300 hover:text-red-700"
                >
                  Eliminar
                </button>
              </div>
            </CardAccordion>
          </form>
        ))}

        {rewards.length === 0 && (
          <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-brand-muted">
            Todavía no creaste ninguna recompensa.
          </p>
        )}
      </div>

      <div className="mt-6 shrink-0">
        <form action={createReward} className="rounded-xl border border-dashed border-black/20 bg-white p-5">
          <p className="mb-3 font-semibold text-brand-ink">Nueva recompensa</p>

          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <label className={labelClasses}>Título</label>
              <input type="text" name="title" required placeholder="10% de descuento" className={fieldClasses} />
            </div>
            <div className="w-40">
              <label className={labelClasses}>Puntos requeridos</label>
              <input type="number" name="pointsRequired" min={1} required defaultValue={100} className={fieldClasses} />
            </div>
            <div className="w-32">
              <label className={labelClasses}>Tipo</label>
              <select name="discountType" defaultValue="percentage" className={`${fieldClasses} bg-white`}>
                <option value="percentage">% off</option>
                <option value="fixed">$ off</option>
              </select>
            </div>
            <div className="w-28">
              <label className={labelClasses}>Valor</label>
              <input type="number" name="discountValue" min={0} step={0.01} required className={fieldClasses} />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4 border-t border-black/5 pt-4">
            <div className="flex items-center gap-2">
              <ToggleSwitch name="enabled" defaultChecked />
              <span className="text-sm text-brand-ink">Habilitado</span>
            </div>
            <SaveButton label="Crear" />
          </div>
        </form>
      </div>

      <h2 className="mt-8 shrink-0 text-sm font-semibold uppercase tracking-wide text-brand-muted">Últimos canjes</h2>

      <div className="mt-3 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Detalle</th>
              <th className="px-4 py-3 font-semibold">Puntos</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {redemptions.map((tx) => (
              <tr key={tx.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 font-medium text-brand-ink">{tx.user.name ?? tx.user.email}</td>
                <td className="px-4 py-3 text-brand-muted">{tx.description}</td>
                <td className="px-4 py-3 text-red-700">{tx.amount}</td>
                <td className="px-4 py-3 text-brand-muted">{tx.createdAt.toLocaleDateString("es-AR")}</td>
              </tr>
            ))}
            {redemptions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-brand-muted">
                  Todavía no hubo canjes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
