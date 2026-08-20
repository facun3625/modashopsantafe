import Link from "next/link";
import { getAdminProductsPage, getProductCountsByCategory } from "@/lib/products";
import { getAllCategories } from "@/lib/categories";
import { Pagination } from "@/components/Pagination";
import { LiveSearchInput } from "./LiveSearchInput";

const PAGE_SIZE = 25;

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    categoryId?: string;
    minPrice?: string;
    maxPrice?: string;
    minStock?: string;
    maxStock?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const query = params.q?.trim() ?? "";
  const categoryId = params.categoryId ? Number(params.categoryId) : undefined;
  const minPrice = params.minPrice ? Number(params.minPrice) : undefined;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : undefined;
  const minStock = params.minStock ? Number(params.minStock) : undefined;
  const maxStock = params.maxStock ? Number(params.maxStock) : undefined;
  const sort = params.sort === "price" || params.sort === "stock" ? params.sort : "name";
  const dir = params.dir === "desc" ? "desc" : "asc";

  const categories = await getAllCategories();

  const [counts, { products, total }] = await Promise.all([
    getProductCountsByCategory(categories),
    getAdminProductsPage({
      query: query || undefined,
      categoryId,
      minPrice,
      maxPrice,
      minStock,
      maxStock,
      sort,
      dir,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sortedCategories = categories
    .filter((c) => (counts.get(c.id) ?? 0) > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasFilters = Boolean(
    query || categoryId || minPrice !== undefined || maxPrice !== undefined || minStock !== undefined || maxStock !== undefined
  );

  const extraParams = {
    categoryId: params.categoryId,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    minStock: params.minStock,
    maxStock: params.maxStock,
    sort: params.sort,
    dir: params.dir,
  };

  function sortHref(field: "price" | "stock") {
    const nextDir = sort === field && dir === "asc" ? "desc" : "asc";
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (params.categoryId) p.set("categoryId", params.categoryId);
    if (params.minPrice) p.set("minPrice", params.minPrice);
    if (params.maxPrice) p.set("maxPrice", params.maxPrice);
    if (params.minStock) p.set("minStock", params.minStock);
    if (params.maxStock) p.set("maxStock", params.maxStock);
    p.set("sort", field);
    p.set("dir", nextDir);
    return `/admin/productos?${p.toString()}`;
  }

  function SortArrow({ field }: { field: "price" | "stock" }) {
    if (sort !== field) return null;
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        className={`h-3 w-3 shrink-0 transition-transform ${dir === "desc" ? "rotate-180" : ""}`}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M6 11l6-6 6 6" />
      </svg>
    );
  }

  const fieldClasses =
    "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
  const labelClasses = "mb-1 block text-xs font-semibold text-brand-muted";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Productos</h1>
        <p className="mt-1 text-sm text-brand-muted">{total} productos en el catálogo de Odoo.</p>

        <form className="mt-6 flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className={labelClasses}>Nombre</label>
            <LiveSearchInput defaultValue={query} />
          </div>

          <div className="w-48">
            <label className={labelClasses}>Categoría</label>
            <div className="relative">
              <select
                name="categoryId"
                defaultValue={params.categoryId ?? ""}
                className={`${fieldClasses} appearance-none bg-white pr-8`}
              >
                <option value="">Todas</option>
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-muted"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          <div className="w-24">
            <label className={labelClasses}>Precio min</label>
            <input type="number" name="minPrice" defaultValue={params.minPrice ?? ""} min={0} className={fieldClasses} />
          </div>
          <div className="w-24">
            <label className={labelClasses}>Precio max</label>
            <input type="number" name="maxPrice" defaultValue={params.maxPrice ?? ""} min={0} className={fieldClasses} />
          </div>

          <div className="w-24">
            <label className={labelClasses}>Stock min</label>
            <input type="number" name="minStock" defaultValue={params.minStock ?? ""} min={0} className={fieldClasses} />
          </div>
          <div className="w-24">
            <label className={labelClasses}>Stock max</label>
            <input type="number" name="maxStock" defaultValue={params.maxStock ?? ""} min={0} className={fieldClasses} />
          </div>

          <button
            type="submit"
            className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
          >
            Filtrar
          </button>

          {hasFilters && (
            <a href="/admin/productos" className="cursor-pointer text-sm font-medium text-brand-muted hover:text-brand-pink-dark">
              Limpiar
            </a>
          )}
        </form>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">
                <Link href={sortHref("price")} className="flex cursor-pointer items-center gap-1 hover:text-brand-pink-dark">
                  Precio
                  <SortArrow field="price" />
                </Link>
              </th>
              <th className="px-4 py-3 font-semibold">
                <Link href={sortHref("stock")} className="flex cursor-pointer items-center gap-1 hover:text-brand-pink-dark">
                  Stock
                  <SortArrow field="stock" />
                </Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
                <td className="px-4 py-3 font-medium text-brand-ink">{p.name}</td>
                <td className="px-4 py-3 text-brand-muted">
                  {p.categ_id ? p.categ_id[1].split(" / ").pop() : "—"}
                </td>
                <td className="px-4 py-3 text-brand-pink-dark">${p.list_price.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      p.qty_available > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {p.qty_available}
                  </span>
                  {p.reserved > 0 && (
                    <span
                      className="ml-2 text-xs text-brand-muted"
                      title="Reservado por pedidos web todavía sin despachar — no se puede vender de nuevo hasta que se entreguen o cancelen."
                    >
                      {p.reserved >= p.qty_available
                        ? "· sin disponible (reservado por pedido web)"
                        : `· ${p.reserved} reservado`}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-brand-muted">
                  No encontramos productos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="shrink-0">
        <Pagination
          basePath="/admin/productos"
          query={query || undefined}
          currentPage={page}
          totalPages={totalPages}
          extraParams={extraParams}
        />
      </div>
    </div>
  );
}
