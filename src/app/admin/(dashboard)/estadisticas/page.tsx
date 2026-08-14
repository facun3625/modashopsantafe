import { getSalesStats } from "@/lib/stats";
import { orderStatusLabel, paymentMethodLabel, ORDER_STATUS_STYLES } from "@/lib/orderLabels";

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

export default async function AdminEstadisticasPage() {
  const stats = await getSalesStats();
  const maxMonthly = Math.max(1, ...stats.monthly.map((m) => m.revenue));
  const maxProduct = Math.max(1, ...stats.topProducts.map((p) => p.quantity));

  const kpis = [
    { label: "Ingresos (confirmados)", value: money(stats.revenue), hint: `${stats.paidOrders} pedidos pagados` },
    { label: "Ticket promedio", value: money(stats.avgTicket), hint: "por pedido pagado" },
    { label: "Pedidos totales", value: String(stats.totalOrders), hint: "desde la tienda online" },
    { label: "Pago pendiente", value: String(stats.pendingOrders), hint: "esperando confirmación", accent: true },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Estadísticas</h1>
        <p className="mt-1 text-sm text-brand-muted">Resumen de ventas de la tienda online.</p>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`rounded-xl border bg-white p-4 ${k.accent && stats.pendingOrders > 0 ? "border-amber-300" : "border-black/10"}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{k.label}</p>
            <p className="mt-1.5 text-2xl font-bold text-brand-ink">{k.value}</p>
            <p className="mt-0.5 text-xs text-brand-muted">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* Ventas por mes */}
      <div className="mt-4 rounded-xl border border-black/10 bg-white p-5">
        <p className="text-sm font-semibold text-brand-ink">Ingresos por mes (últimos 12)</p>
        <div className="mt-4 flex h-48 items-end gap-1.5">
          {stats.monthly.map((m) => (
            <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-brand-pink/80 transition-all hover:bg-brand-pink"
                  style={{ height: `${Math.max(2, (m.revenue / maxMonthly) * 100)}%` }}
                  title={`${m.label}: ${money(m.revenue)} · ${m.orders} pedidos`}
                />
              </div>
              <span className="text-[10px] text-brand-muted">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top productos */}
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Productos más vendidos</p>
          {stats.topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-brand-muted">Todavía no hay ventas confirmadas.</p>
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
