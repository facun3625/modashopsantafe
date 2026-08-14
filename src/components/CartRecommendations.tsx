"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import type { OdooProductListItem } from "@/types/odoo";

// "También te puede gustar" dentro del carrito: trae productos con stock de la
// misma categoría que lo último que agregó el cliente, sacando lo que ya está
// en el carrito. Cross-sell justo cuando está por comprar.
export function CartRecommendations() {
  const { items, addItem } = useCart();
  const [recs, setRecs] = useState<OdooProductListItem[]>([]);

  // Categoría de referencia: la del último item que tenga una.
  const categoryId = [...items].reverse().find((i) => i.categoryId)?.categoryId;

  useEffect(() => {
    if (!categoryId) {
      setRecs([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/products?categoryId=${categoryId}&limit=12`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setRecs((data.products as OdooProductListItem[]) ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  // Filtramos en cada render lo que ya está en el carrito (así al agregar uno
  // desde acá, desaparece al toque) y lo sin stock; mostramos hasta 3.
  const inCart = new Set(items.map((i) => i.productId));
  const shown = recs.filter((p) => !inCart.has(p.id) && p.qty_available > 0).slice(0, 3);

  if (shown.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl bg-brand-soft/60 p-3.5">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-brand-muted">
        También te puede gustar
      </p>
      <div className="flex flex-col gap-2.5">
        {shown.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5">
            {p.image_128 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${p.image_128}`}
                alt={p.name}
                className="h-10 w-10 shrink-0 rounded-md object-cover opacity-95"
              />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-md bg-white" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-brand-ink/80">{p.name}</p>
              <p className="text-xs text-brand-muted">${p.list_price.toFixed(2)}</p>
            </div>
            <button
              onClick={() =>
                addItem({
                  productId: p.id,
                  name: p.name,
                  price: p.list_price,
                  image: p.image_128,
                  maxStock: p.qty_available,
                  categoryId: p.categ_id ? p.categ_id[0] : undefined,
                })
              }
              className="shrink-0 cursor-pointer rounded-full border border-brand-pink/50 px-2.5 py-1 text-[11px] font-semibold text-brand-pink-dark transition-colors hover:bg-brand-pink hover:text-white"
            >
              Agregar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
