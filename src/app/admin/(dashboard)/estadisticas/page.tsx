import { getSalesStats, type Granularity } from "@/lib/stats";
import { orderStatusLabel, paymentMethodLabel, ORDER_STATUS_STYLES } from "@/lib/orderLabels";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { StatsFilters, PERIODS, type PeriodKey } from "./StatsFilters";

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const VALID_PAYMENTS: PaymentMethod[] = ["mercadopago", "transferencia", "contra_entrega"];

function periodToRange(period: PeriodKey): { from?: Date; granularity: Granularity } {
  const now = new Date();
  switch (period) {
    case "7d":
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), granularity: "day" };
    case "30d":
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29), granularity: "day" };
    case "12m":
      return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1), granularity: "month" };
    case "all":
      return { granularity: "month" };
  }
}

export default async function AdminEstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; payment?: string }>;
}) {
  const params = await searchParams;
  const period: PeriodKey = params.period && params.period in PERIODS ? (params.period as PeriodKey) : "30d";
  const paymentMethod = VALID_PAYMENTS.includes(params.payment as PaymentMethod)
    ? (params.payment as PaymentMethod)
    : undefined;

  const { from, granularity } = periodToRange(period);
  const stats = await getSalesStats({ from, granularity, paymentMethod });

  const maxSeries = Math.max(1, ...stats.series.map((m) => m.revenue));
  const maxProduct = Math.max(1, ...stats.topProducts.map((p) => p.quantity));
  // Con muchas barras (30 días) no entran todas las etiquetas: mostramos una
  // de cada tantas para que no se amontonen.
  const labelStep = Math.max(1, Math.ceil(stats.series.length / 10));

  const kpis: { label: string; value: string; hint: string; accent?: boolean }[] = [
    {
      label: "Ingresos (confirmados)",
      value: money(stats.revenue),
      hint:
        stats.revenueDelta === null
          ? `${stats.paidOrders} pedidos pagados`
          : `${stats.revenueDelta >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(stats.revenueDelta))}% vs. período anterior`,
    },
    { label: "Ticket promedio", value: money(stats.avgTicket), hint: "por pedido pagado" },
    { label: "Unidades vendidas", value: String(stats.units), hint: "ítems en pedidos pagados" },
    { label: "Clientes", value: String(stats.customers), hint: "compradores distintos" },
    { label: "Pedidos totales", value: String(stats.totalOrders), hint: "en el período" },
    { label: "Pago pendiente", value: String(stats.pendingOrders), hint: "esperando confirmación", accent: true },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Estadísticas</h1>
        <p className="mt-1 text-sm text-brand-muted">Resumen de ventas de la tienda online.</p>
        <StatsFilters period={period} payment={paymentMethod} />
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`rounded-xl border bg-white p-4 ${k.accent && stats.pendingOrders > 0 ? "border-amber-300" : "border-black/10"}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{k.label}</p>
            <p className="mt-1.5 text-2xl font-bold text-brand-ink">{k.value}</p>
            <p
              className={`mt-0.5 text-xs ${
                k.label === "Ingresos (confirmados)" && stats.revenueDelta !== null
                  ? stats.revenueDelta >= 0
                    ? "font-semibold text-green-700"
                    : "font-semibold text-red-600"
                  : "text-brand-muted"
              }`}
            >
              {k.hint}
            </p>
          </div>
        ))}
      </div>

      {/* Secundarias: descuentos, envío, cancelados */}
      <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-black/10 bg-white p-4 text-sm">
        <span className="text-brand-muted">
          Descuentos otorgados: <span className="font-semibold text-brand-ink">{money(stats.discounts)}</span>
        </span>
        <span className="text-brand-muted">
          Envío cobrado: <span className="font-semibold text-brand-ink">{money(stats.shipping)}</span>
        </span>
        <span className="text-brand-muted">
          Pedidos cancelados: <span className="font-semibold text-brand-ink">{stats.cancelledOrders}</span>
        </span>
      </div>

      {/* Ventas en el tiempo */}
      <div className="mt-4 rounded-xl border border-black/10 bg-white p-5">
        <p className="text-sm font-semibold text-brand-ink">Ingresos — {PERIODS[period]}</p>
        {stats.series.length === 0 || stats.revenue === 0 ? (
          <p className="mt-8 text-center text-sm text-brand-muted">Sin ventas confirmadas en este período.</p>
        ) : (
          <div className="mt-4 flex h-48 items-end gap-1">
            {stats.series.map((m, i) => (
              <div key={`${m.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-brand-pink/80 transition-all hover:bg-brand-pink"
                    style={{ height: `${Math.max(m.revenue > 0 ? 2 : 0, (m.revenue / maxSeries) * 100)}%` }}
                    title={`${m.label}: ${money(m.revenue)} · ${m.orders} pedidos`}
                  />
                </div>
                <span className="text-[10px] text-brand-muted">{i % labelStep === 0 ? m.label : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top productos */}
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Productos más vendidos</p>
          {stats.topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-brand-muted">Sin ventas confirmadas en este período.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {stats.topProducts.map((p) => (
                <div key={p.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-brand-ink">{p.name}</span>
                    <span className="shrink-0 font-semibold text-brand-ink">
                      {p.quantity} u. <span className="font-normal text-brand-muted">· {money(p.revenue)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-brand-soft">
                    <div
                      className="h-1.5 rounded-full bg-brand-pink"
                      style={{ width: `${(p.quantity / maxProduct) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desgloses */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-sm font-semibold text-brand-ink">Por medio de pago</p>
            {stats.byPayment.length === 0 ? (
              <p className="mt-4 text-sm text-brand-muted">Sin ventas confirmadas.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {stats.byPayment.map((p) => (
                  <div key={p.method} className="flex items-center justify-between text-sm">
                    <span className="text-brand-ink">{paymentMethodLabel(p.method)}</span>
                    <span className="text-brand-muted">
                      {p.count} · <span className="font-semibold text-brand-ink">{money(p.revenue)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-sm font-semibold text-brand-ink">Por envío</p>
            {stats.byShipping.length === 0 ? (
              <p className="mt-4 text-sm text-brand-muted">Sin ventas confirmadas.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {stats.byShipping.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="text-brand-ink">{s.name}</span>
                    <span className="text-brand-muted">
                      {s.count} · <span className="font-semibold text-brand-ink">{money(s.revenue)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-sm font-semibold text-brand-ink">Por estado</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.byStatus.map((s) => (
                <span
                  key={s.status}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${ORDER_STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {orderStatusLabel(s.status)}: {s.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
