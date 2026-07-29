"use client";

import { useState } from "react";
import { useFormDirty } from "@/lib/useFormDirty";

export function CardAccordion({
  titleArea,
  headerRight,
  defaultOpen = false,
  trackDirty = true,
  children,
}: {
  titleArea: React.ReactNode;
  headerRight?: React.ReactNode;
  defaultOpen?: boolean;
  trackDirty?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { ref, dirty, pending, justSaved } = useFormDirty<HTMLButtonElement>();
  const highlight = !trackDirty || dirty;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        {titleArea}
        <div className="flex items-center gap-2">
          {headerRight}
          {justSaved && <span className="text-xs font-semibold text-green-700">Guardado ✓</span>}
          <button
            ref={ref}
            type="submit"
            disabled={pending}
            title={pending ? "Guardando..." : "Guardar"}
            className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-wait ${
              justSaved
                ? "bg-green-50 text-green-600"
                : highlight
                  ? "bg-brand-pink/10 text-brand-pink-dark hover:bg-brand-pink/20"
                  : "text-brand-muted/40 hover:bg-brand-soft hover:text-brand-pink-dark"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Ocultar detalles" : "Ver detalles"}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-muted transition-colors hover:bg-brand-soft hover:text-brand-pink-dark"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>
      {open && <div className="mt-5">{children}</div>}
    </>
  );
}
