"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export const PERIODS = {
  today: "Hoy",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  "12m": "Últimos 12 meses",
  all: "Todo el historial",
} as const;

export type PeriodKey = keyof typeof PERIODS;

const fieldClasses =
  "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

// Atajos rápidos + un rango libre (Desde/Hasta) que manda a cualquier
// período, incluyendo un solo día — antes solo había 4 presets fijos y no
// se podía elegir, por ejemplo, "hoy" solo.
export function VisitFilters({
  period,
  from,
  to,
  isCustom,
}: {
  period: PeriodKey;
  from: string;
  to: string;
  isCustom: boolean;
}) {
  const router = useRouter();
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);

  function applyPreset(next: string) {
    setFromInput("");
    setToInput("");
    router.push(`/admin/visitas?period=${next}`);
  }

  function applyRange(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) return;
    const sp = new URLSearchParams();
    sp.set("from", nextFrom);
    sp.set("to", nextTo);
    router.push(`/admin/visitas?${sp.toString()}`);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <select value={isCustom ? "" : period} onChange={(e) => applyPreset(e.target.value)} className={fieldClasses}>
        {isCustom && (
          <option value="" disabled>
            Rango elegido
          </option>
        )}
        {Object.entries(PERIODS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      <span className="text-sm text-brand-muted">o elegí un rango:</span>

      <input
        type="date"
        value={fromInput}
        max={toInput || undefined}
        onChange={(e) => {
          setFromInput(e.target.value);
          applyRange(e.target.value, toInput);
        }}
        aria-label="Desde"
        className={fieldClasses}
      />
      <span className="text-brand-muted">–</span>
      <input
        type="date"
        value={toInput}
        min={fromInput || undefined}
        onChange={(e) => {
          setToInput(e.target.value);
          applyRange(fromInput, e.target.value);
        }}
        aria-label="Hasta"
        className={fieldClasses}
      />
    </div>
  );
}
