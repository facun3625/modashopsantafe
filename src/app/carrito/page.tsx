"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { CheckoutForm } from "@/components/CheckoutForm";

export default function CarritoPage() {
  const { items, removeItem, setQuantity, total } = useCart();
  const [showCheckout, setShowCheckout] = useState(false);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-brand-ink">Tu carrito está vacío</h1>
        <p className="mt-2 text-brand-muted">Todavía no agregaste productos.</p>
        <Link
          href="/tienda"
          className="mt-6 rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark"
        >
          Ir a la tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:max-w-5xl">
      <h1 className="text-2xl font-bold text-brand-ink">Tu carrito</h1>

      <div className="mt-8 flex flex-col gap-4">
        {items.map((item) => (
          <div
            key={item.productId}
            className="flex items-center gap-4 rounded-2xl border border-black/10 bg-white p-4"
          >
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${item.image}`}
                alt={item.name}
                className="h-20 w-20 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="h-20 w-20 shrink-0 rounded-xl bg-brand-soft" />
            )}

            <div className="flex-1">
              <p className="text-sm font-medium text-brand-ink">{item.name}</p>
              <p className="text-sm font-semibold text-brand-pink-dark">${item.price.toFixed(2)}</p>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                  className="h-8 w-8 cursor-pointer rounded-full border border-black/15 text-brand-ink hover:bg-brand-soft"
                  aria-label="Restar"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm">{item.quantity}</span>
                <button
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                  disabled={item.quantity >= item.maxStock}
                  title={item.quantity >= item.maxStock ? "No hay más stock disponible" : undefined}
                  className="h-8 w-8 cursor-pointer rounded-full border border-black/15 text-brand-ink hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Sumar"
                >
                  +
                </button>
              </div>
              {item.quantity >= item.maxStock && (
                <span className="text-[10px] text-brand-muted">Stock máx.</span>
              )}
            </div>

            <button
              onClick={() => removeItem(item.productId)}
              aria-label="Quitar"
              className="ml-2 cursor-pointer text-brand-muted hover:text-red-600"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-6">
        <p className="text-lg font-semibold text-brand-ink">Total</p>
        <p className="text-lg font-bold text-brand-pink-dark">${total.toFixed(2)}</p>
      </div>

      {showCheckout ? (
        <CheckoutForm />
      ) : (
        <button
          onClick={() => setShowCheckout(true)}
          className="mt-6 w-full cursor-pointer rounded-full bg-brand-pink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
        >
          Finalizar compra
        </button>
      )}
    </div>
  );
}
