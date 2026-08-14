import { getSalesPage } from "@/lib/sales";
import { Pagination } from "@/components/Pagination";
import { SalesTable } from "./SalesTable";

const PAGE_SIZE = 25;

export default async function AdminVentasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const { orders, total } = await getSalesPage({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Ventas</h1>
        <p className="mt-1 text-sm text-brand-muted">{total} pedidos hechos desde la tienda online.</p>
      </div>

      <SalesTable orders={orders} />

      <div className="shrink-0">
        <Pagination basePath="/admin/ventas" currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  );
}
