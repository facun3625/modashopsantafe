"use client";

import { useState } from "react";

export type WelcomeCouponInfo = { code: string; label: string; expiresAt: string | null; minPurchaseAmount: number | null };

// Pantalla que ve quien acaba de crear su cuenta cuando hay cupón de bienvenida (modal de ingreso y /registro).
export function WelcomeCouponNotice({ coupon, onContinue }: { coupon: WelcomeCouponInfo; onContinue: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(coupon.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="mt-6 flex flex-col items-center text-center">
      <p className="text-lg font-bold text-brand-ink">¡Bienvenida! Tenés un regalo 🎁</p>
      <p className="mt-1 text-sm text-brand-muted">{coupon.label} en tu primera compra, con este código:</p>
      <button
        type="button"
        onClick={copy}
        title="Copiar código"
        className="mt-4 cursor-pointer rounded-xl border-2 border-dashed border-brand-pink bg-brand-soft px-6 py-3 font-mono text-xl font-bold tracking-wider text-brand-pink-dark"
      >
        {coupon.code}
      </button>
      <p className="mt-1.5 text-xs text-brand-muted">{copied ? "¡Copiado!" : "Tocá el código para copiarlo"}</p>
      <p className="mt-3 text-xs text-brand-muted">
        {coupon.expiresAt ? `Vence el ${new Date(coupon.expiresAt).toLocaleDateString("es-AR")}. ` : ""}
        {coupon.minPurchaseAmount ? `Compra mínima $${Math.round(coupon.minPurchaseAmount).toLocaleString("es-AR")}. ` : ""}
        Te lo mandamos también por mail y lo ves en Mi cuenta.
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-5 w-full cursor-pointer rounded-full bg-brand-pink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
      >
        Empezar a comprar
      </button>
    </div>
  );
}
