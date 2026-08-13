import { getSalesPage, orderStatusLabel, paymentMethodLabel } from "@/lib/sales";
import { Pagination } from "@/components/Pagination";
import { confirmOrderPayment, cancelOrder } from "./actions";

const PAGE_SIZE = 25;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  confirmed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
};

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

      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Items</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Pago</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                id={`order-${o.id.slice(0, 8)}`}
                className="scroll-mt-4 border-b border-black/5 target:bg-brand-soft last:border-0 hover:bg-brand-soft/50"
              >
                <td className="px-4 py-3 font-medium text-brand-ink">
                  {o.customerName}
                  <span className="block text-xs font-normal text-brand-muted">{o.customerEmail}</span>
                </td>
                <td className="px-4 py-3 text-brand-muted">{o.items.length}</td>
                <td className="px-4 py-3 text-brand-muted">{o.createdAt.toLocaleDateString("es-AR")}</td>
                <td className="px-4 py-3 text-brand-pink-dark">${o.total.toFixed(2)}</td>
                <td className="px-4 py-3 text-brand-muted">{paymentMethodLabel(o.paymentMethod)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[o.status] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {orderStatusLabel(o.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {o.status === "pending" && (
                    <div className="flex justify-end gap-2">
                      <form action={confirmOrderPayment.bind(null, o.id)}>
                        <button
                          type="submit"
                          className="cursor-pointer rounded-full bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-pink-dark"
                        >
                          Confirmar pago
                        </button>
                      </form>
                      <form action={cancelOrder.bind(null, o.id)}>
                        <button
                          type="submit"
                          className="cursor-pointer rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-muted transition-colors hover:border-red-300 hover:text-red-700"
                        >
                          Cancelar
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-brand-muted">
                  Todavía no hay pedidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="shrink-0">
        <Pagination basePath="/admin/ventas" currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  );
}
