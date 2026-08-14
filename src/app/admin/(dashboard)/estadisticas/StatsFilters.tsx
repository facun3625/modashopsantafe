"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { paymentMethodLabel } from "@/lib/orderLabels";

export const PERIODS = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  "12m": "Últimos 12 meses",
  all: "Todo el historial",
} as const;

export type PeriodKey = keyof typeof PERIODS;

const PAYMENTS: PaymentMethod[] = ["mercadopago", "transferencia", "contra_entrega"];

export function StatsFilters({ period, payment }: { period: PeriodKey; payment?: PaymentMethod }) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(next: { period?: string; payment?: string }) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    router.push(`/admin/estadisticas?${sp.toString()}`);
  }

  const selectClass =
    "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <select value={period} onChange={(e) => apply({ period: e.target.value })} className={selectClass}>
        {Object.entries(PERIODS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <select value={payment ?? ""} onChange={(e) => apply({ payment: e.target.value })} className={selectClass}>
        <option value="">Todos los medios de pago</option>
        {PAYMENTS.map((p) => (
          <option key={p} value={p}>
            {paymentMethodLabel(p)}
          </option>
        ))}
      </select>
    </div>
  );
}
