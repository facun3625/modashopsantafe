"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Status = "pending" | "confirmed" | "delivered" | "cancelled";

const MAX_ATTEMPTS = 10;
const POLL_MS = 3000;

// El pago de Mercado Pago se confirma por webhook, no en la misma request que
// armó el link de pago — cuando el cliente vuelve del checkout de Mercado
// Pago puede llegar antes que el aviso. Esta pantalla va preguntando el
// estado real del pedido hasta que el webhook lo actualiza (o se cansa).
export function GraciasMercadoPagoStatus({ orderId, initialStatus }: { orderId: string; initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const shortId = orderId.slice(0, 8);

  useEffect(() => {
    if (status !== "pending") return;
    let cancelled = false;
    let attempts = 0;
    const poll = () => {
      attempts += 1;
      fetch(`/api/orders/${orderId}/status`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data: { status?: Status }) => {
          if (cancelled) return;
          if (data.status && data.status !== "pending") {
            setStatus(data.status);
            return;
          }
          if (attempts < MAX_ATTEMPTS) setTimeout(poll, POLL_MS);
        })
        .catch(() => {
          if (!cancelled && attempts < MAX_ATTEMPTS) setTimeout(poll, POLL_MS);
        });
    };
    const handle = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [status, orderId]);

  if (status === "cancelled") {
    return (
      <>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-brand-ink">El pago no se pudo completar</h1>
        <p className="mt-2 text-brand-muted">
          No te cobramos nada por el pedido #{shortId}. Podés volver a intentarlo cuando quieras.
        </p>
        <Link
          href="/carrito"
          className="mt-8 rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
        >
          Volver al carrito
        </Link>
      </>
    );
  }

  if (status === "confirmed" || status === "delivered") {
    return (
      <>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-brand-ink">¡Pago aprobado!</h1>
        <p className="mt-2 text-brand-muted">Gracias por tu compra (n.º {shortId}). Ya estamos preparando tu pedido.</p>
        <Link
          href="/tienda"
          className="mt-8 rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
        >
          Seguir comprando
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-bold text-brand-ink">Confirmando tu pago…</h1>
      <p className="mt-2 text-brand-muted">
        Estamos esperando la confirmación de Mercado Pago para el pedido #{shortId}. Suele tardar unos segundos — no
        hace falta que hagas nada más.
      </p>
    </>
  );
}
