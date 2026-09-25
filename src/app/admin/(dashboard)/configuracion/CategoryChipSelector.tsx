"use client";

import { useState } from "react";
import { ChipCheckbox } from "@/components/admin/ChipCheckbox";

// La lista real de categorías de Odoo puede tener decenas de entradas (rubros
// + promos de temporada tipo "HALLOWEEN"/"DIADELAMADRE"), así que un buscador
// es necesario para poder encontrar algo. Los chips SIEMPRE quedan montados
// (se ocultan con `hidden`, no se sacan del array) para no perder el estado
// del checkbox de uno que ya se tocó si la búsqueda lo tapa un rato.
export function CategoryChipSelector({
  categories,
  selectedIds,
}: {
  categories: { id: number; name: string }[];
  selectedIds: number[];
}) {
  const [query, setQuery] = useState("");
  const selectedSet = new Set(selectedIds);
  const normalizedQuery = query.trim().toLowerCase();

  // Las ya seleccionadas van primero, así se ven de entrada sin buscar nada.
  const sorted = [...categories].sort(
    (a, b) => Number(selectedSet.has(b.id)) - Number(selectedSet.has(a.id))
  );

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar categoría..."
        className="mb-2.5 w-full max-w-xs rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none"
      />
      <div className="max-h-64 overflow-y-auto rounded-lg border border-black/10 p-3">
        <div className="flex flex-wrap gap-2">
          {sorted.map((c) => {
            const matches = c.name.toLowerCase().includes(normalizedQuery);
            return (
              <div key={c.id} hidden={!matches}>
                <ChipCheckbox
                  name="featuredCategoryIds"
                  value={String(c.id)}
                  label={c.name}
                  defaultChecked={selectedSet.has(c.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
