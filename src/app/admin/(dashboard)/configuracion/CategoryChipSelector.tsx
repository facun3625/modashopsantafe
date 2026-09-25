"use client";

import { useEffect, useId, useRef, useState } from "react";

// Selector de categorías destacadas: arriba las elegidas (en el orden en que
// se muestran en el home, con flechas para reordenar y × para sacar), abajo
// un buscador que sugiere el resto. El valor viaja al server action como
// inputs hidden `featuredCategoryIds` — antes eran checkboxes `sr-only`
// dentro de un contenedor con scroll, y al tocarlos el navegador scrolleaba
// hacia el input posicionado fuera de la caja (el "espacio abajo").
export function CategoryChipSelector({
  categories,
  selectedIds,
}: {
  categories: { id: number; name: string }[];
  selectedIds: number[];
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const [selected, setSelected] = useState<number[]>(() => selectedIds.filter((id) => byId.has(id)));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const listboxId = useId();

  // Los inputs hidden cambian por estado de React, no por el usuario, así que
  // no disparan eventos solos — avisamos al form para que useFormDirty
  // prenda el botón de Guardar.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    containerRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = categories
    .filter((c) => !selected.includes(c.id) && c.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 50);

  function add(id: number) {
    setSelected((prev) => [...prev, id]);
    setQuery("");
    setActive(0);
  }

  function remove(id: number) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  function move(index: number, delta: number) {
    setSelected((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      // Enter nunca manda el form desde el buscador — agrega la sugerencia.
      e.preventDefault();
      const pick = suggestions[active];
      if (open && pick) add(pick.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      remove(selected[selected.length - 1]);
    }
  }

  return (
    <div ref={containerRef}>
      {selected.map((id) => (
        <input key={id} type="hidden" name="featuredCategoryIds" value={id} />
      ))}

      {selected.length > 0 ? (
        <ol className="mb-3 flex flex-wrap gap-2">
          {selected.map((id, i) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-pink py-1 pl-1 pr-1.5 text-sm font-medium text-white"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-[11px] font-bold">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Mover ${byId.get(id)?.name} antes`}
                className="cursor-pointer rounded px-0.5 text-white/80 hover:text-white disabled:cursor-default disabled:opacity-30"
              >
                ‹
              </button>
              <span className="px-0.5">{byId.get(id)?.name}</span>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === selected.length - 1}
                aria-label={`Mover ${byId.get(id)?.name} después`}
                className="cursor-pointer rounded px-0.5 text-white/80 hover:text-white disabled:cursor-default disabled:opacity-30"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => remove(id)}
                aria-label={`Quitar ${byId.get(id)?.name}`}
                className="ml-0.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-white/25"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-3 text-sm italic text-brand-muted">Ninguna elegida — se usa la selección por defecto.</p>
      )}

      <div className="relative w-full max-w-sm">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="+ Agregar categoría..."
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none"
        />

        {open && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-black/10 bg-white py-1 shadow-lg"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-brand-muted">Sin resultados</li>
            ) : (
              suggestions.map((c, i) => (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={i === active}
                  // mousedown (no click) para que el input no pierda el foco
                  // y la lista siga abierta para agregar varias seguidas.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(c.id);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`cursor-pointer px-3 py-2 text-sm text-brand-ink ${
                    i === active ? "bg-brand-pink/10 text-brand-pink-dark" : ""
                  }`}
                >
                  {c.name}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
