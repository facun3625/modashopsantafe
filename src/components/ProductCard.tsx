"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import type { OdooProductListItem } from "@/types/odoo";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { useAuthModal } from "@/lib/authModal";
import { CartIcon, BellIcon, HeartIcon } from "@/components/icons";
import { ProductImage } from "@/components/ProductImage";
import { WaitlistModal } from "@/components/WaitlistModal";

export function ProductCard({ product }: { product: OdooProductListItem }) {
  const { addItem } = useCart();
  const { status } = useSession();
  const { isFavorite, toggle } = useFavorites();
  const { openLogin } = useAuthModal();
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const outOfStock = product.qty_available <= 0;
  const image = product.image_512 || product.image_128;
  const categoryName = product.categ_id ? product.categ_id[1].split(" / ").pop() : undefined;
  const favorite = isFavorite(product.id);

  function handleToggleFavorite() {
    if (status !== "authenticated") {
      openLogin();
      return;
    }
    toggle(product.id);
  }

  return (
    <div className="min-w-0 rounded-xl border border-brand-pink/15 bg-white p-3 transition-all hover:border-brand-pink/50 hover:shadow-md sm:p-4">
      <div className="relative">
        <ProductImage productId={product.id} thumbnail={image} alt={product.name} />
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-label={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
          aria-pressed={favorite}
          className={`absolute right-2 top-2 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/95 shadow transition-colors hover:bg-brand-pink hover:text-white ${
            favorite ? "text-brand-pink-dark" : "text-brand-ink"
          }`}
        >
          <HeartIcon className={`h-4 w-4 ${favorite ? "fill-current" : "fill-none"}`} />
        </button>
      </div>

      {product.categ_id && (
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-brand-pink-dark">
          <span className="h-px w-3 bg-brand-pink" />
          {product.categ_id[1].split(" / ").pop()}
        </p>
      )}
      <p className="break-words text-sm font-medium text-brand-ink">{product.name}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className={`text-sm font-bold ${outOfStock ? "text-brand-ink" : "text-brand-pink-dark"}`}>
          ${product.list_price.toFixed(2)}
        </p>
        {outOfStock && (
          <span className="flex items-center gap-1 text-xs font-semibold text-brand-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-muted" />
            Sin stock
          </span>
        )}
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
              categoryId: product.categ_id ? product.categ_id[0] : undefined,
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
