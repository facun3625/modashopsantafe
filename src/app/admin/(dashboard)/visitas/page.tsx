import { getVisitStats, type Granularity } from "@/lib/visits";
import { VisitFilters, PERIODS, type PeriodKey } from "./VisitFilters";

const PAGE_LABELS: Record<string, string> = {
  "/": "Home",
  "/tienda": "Tienda",
  "/carrito": "Carrito",
  "/login": "Login",
  "/registro": "Registro",
};

function pageLabel(path: string): string {
  return PAGE_LABELS[path] ?? path;
}

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

export default async function AdminVisitasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period: PeriodKey = params.period && params.period in PERIODS ? (params.period as PeriodKey) : "30d";

  const { from, granularity } = periodToRange(period);
  const stats = await getVisitStats({ from, granularity });

  const maxSeries = Math.max(1, ...stats.series.map((m) => m.count));
  const maxPage = Math.max(1, ...stats.topPages.map((p) => p.count));
  const maxProduct = Math.max(1, ...stats.topCartProducts.map((p) => p.quantity));
  const labelStep = Math.max(1, Math.ceil(stats.series.length / 10));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Visitas</h1>
        <p className="mt-1 text-sm text-brand-muted">Tráfico del sitio online — no confundir con Estadísticas, que es de ventas.</p>
        <VisitFilters period={period} />
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Visitas</p>
          <p className="mt-1.5 text-2xl font-bold text-brand-ink">{stats.visits}</p>
          <p className="mt-0.5 text-xs text-brand-muted">sesiones distintas en el período</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Vistas de página</p>
          <p className="mt-1.5 text-2xl font-bold text-brand-ink">{stats.pageViews}</p>
          <p className="mt-0.5 text-xs text-brand-muted">incluye recargas y navegación</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Páginas por visita</p>
          <p className="mt-1.5 text-2xl font-bold text-brand-ink">
            {stats.visits > 0 ? (stats.pageViews / stats.visits).toFixed(1) : "0"}
          </p>
          <p className="mt-0.5 text-xs text-brand-muted">promedio</p>
        </div>
      </div>

      {/* Visitas en el tiempo */}
      <div className="mt-4 rounded-xl border border-black/10 bg-white p-5">
        <p className="text-sm font-semibold text-brand-ink">Vistas de página — {PERIODS[period]}</p>
        {stats.series.length === 0 || stats.pageViews === 0 ? (
          <p className="mt-8 text-center text-sm text-brand-muted">Sin visitas registradas en este período.</p>
        ) : (
          <div className="mt-4 flex h-48 items-end gap-1">
            {stats.series.map((m, i) => (
              <div key={`${m.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-brand-pink/80 transition-all hover:bg-brand-pink"
                    style={{ height: `${Math.max(m.count > 0 ? 2 : 0, (m.count / maxSeries) * 100)}%` }}
                    title={`${m.label}: ${m.count} vistas`}
                  />
                </div>
                <span className="text-[10px] text-brand-muted">{i % labelStep === 0 ? m.label : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Páginas más vistas */}
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Páginas más vistas</p>
          {stats.topPages.length === 0 ? (
            <p className="mt-4 text-sm text-brand-muted">Sin visitas registradas en este período.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {stats.topPages.map((p) => (
                <div key={p.path}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-brand-ink">{pageLabel(p.path)}</span>
                    <span className="shrink-0 font-semibold text-brand-ink">{p.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-brand-soft">
                    <div className="h-1.5 rounded-full bg-brand-pink" style={{ width: `${(p.count / maxPage) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Productos más agregados al carrito */}
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Productos más agregados al carrito</p>
          <p className="mt-0.5 text-xs text-brand-muted">Suma carritos en curso + pedidos hechos — no es lo mismo que "más vendidos".</p>
          {stats.topCartProducts.length === 0 ? (
            <p className="mt-4 text-sm text-brand-muted">Sin datos en este período.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {stats.topCartProducts.map((p) => (
                <div key={p.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-brand-ink">{p.name}</span>
                    <span className="shrink-0 font-semibold text-brand-ink">{p.quantity} u.</span>
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
      </div>
    </div>
  );
}
