"use client";

import { useState } from "react";
import type { OdooProductListItem } from "@/types/odoo";
import { useCart } from "@/lib/cart";
import { CartIcon, BellIcon } from "@/components/icons";
import { ProductImage } from "@/components/ProductImage";
import { WaitlistModal } from "@/components/WaitlistModal";

export function ProductCard({ product }: { product: OdooProductListItem }) {
  const { addItem } = useCart();
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const outOfStock = product.qty_available <= 0;
  const image = product.image_512 || product.image_128;
  const categoryName = product.categ_id ? product.categ_id[1].split(" / ").pop() : undefined;

  return (
    <div className="rounded-xl border border-brand-pink/15 bg-white p-4 transition-all hover:border-brand-pink/50 hover:shadow-md">
      <ProductImage productId={product.id} thumbnail={image} alt={product.name} />

      {product.categ_id && (
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-brand-pink-dark">
          <span className="h-px w-3 bg-brand-pink" />
          {product.categ_id[1].split(" / ").pop()}
        </p>
      )}
      <p className="text-sm font-medium text-brand-ink">{product.name}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className={`text-sm font-bold ${outOfStock ? "text-brand-ink" : "text-brand-pink-dark"}`}>
          ${product.list_price.toFixed(2)}
        </p>
        {outOfStock && <span className="text-xs font-semibold text-brand-pink-dark">Sin stock</span>}
      </div>

      {outOfStock ? (
        <button
          onClick={() => setWaitlistOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-brand-pink px-3 py-[6px] text-center text-xs font-semibold uppercase tracking-wide text-brand-pink-dark transition-colors hover:bg-brand-pink hover:text-white"
        >
          <BellIcon className="h-3.5 w-3.5 shrink-0" />
          Avisarme
        </button>
      ) : (
        <button
          onClick={() =>
            addItem({
              productId: product.id,
              name: product.name,
              price: product.list_price,
              image: product.image_128,
              maxStock: product.qty_available,
            })
          }
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand-pink py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-pink-dark"
        >
          <CartIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="min-[750px]:hidden">Agregar</span>
          <span className="hidden min-[750px]:inline">Agregar al carrito</span>
        </button>
      )}

      {waitlistOpen && (
        <WaitlistModal
          productId={product.id}
          productName={product.name}
          categoryName={categoryName}
          onClose={() => setWaitlistOpen(false)}
        />
      )}
    </div>
  );
}
