"use client";

import { useRouter, useSearchParams } from "next/navigation";

export const PERIODS = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  "12m": "Últimos 12 meses",
  all: "Todo el historial",
} as const;

export type PeriodKey = keyof typeof PERIODS;

export function VisitFilters({ period }: { period: PeriodKey }) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(next: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("period", next);
    router.push(`/admin/visitas?${sp.toString()}`);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <select
        value={period}
        onChange={(e) => apply(e.target.value)}
        className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none"
      >
        {Object.entries(PERIODS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
