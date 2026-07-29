"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { topLevelCategories, childrenOf } from "@/lib/categoryHelpers";
import type { OdooCategory } from "@/types/odoo";

export function CategorySidebar({
  categories,
  counts,
  grandTotal,
  activeCategoryId,
}: {
  categories: OdooCategory[];
  counts: Map<number, number>;
  grandTotal: number;
  activeCategoryId?: number;
}) {
  const topLevel = topLevelCategories(categories).filter((c) => (counts.get(c.id) ?? 0) > 0);

  const [openIds, setOpenIds] = useState<Set<number>>(() => new Set());
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    setPanelOpen(window.innerWidth > 800);
  }, []);

  function toggle(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <nav className="shrink-0 sm:w-56">
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        className="mb-3 flex w-full cursor-pointer items-center justify-between gap-2 text-xs font-bold uppercase tracking-widest text-brand-pink-dark"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
            <path strokeLinecap="round" d="M4 6h16M8 12h12M11 18h9" />
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="8" cy="18" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          Categorías
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${panelOpen ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {panelOpen && (
          <motion.ul
            key="category-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="space-y-1 overflow-hidden text-sm"
          >
        <li>
          <Link
            href="/tienda"
            className={`flex items-center justify-between rounded-lg border-l-2 px-3 py-2 transition-colors ${
              !activeCategoryId
                ? "border-brand-pink bg-brand-pink/10 font-semibold text-brand-pink-dark"
                : "border-transparent text-brand-ink hover:bg-brand-pink/5"
            }`}
          >
            Todas
            <span className="text-xs text-brand-muted">{grandTotal}</span>
          </Link>
        </li>

        {topLevel.map((cat) => {
          const active = cat.id === activeCategoryId;
          const subcategories = childrenOf(categories, cat.id).filter((c) => (counts.get(c.id) ?? 0) > 0);
          const hasChildren = subcategories.length > 0;
          const isOpen = openIds.has(cat.id);

          return (
            <li key={cat.id}>
              <div
                className={`flex items-center rounded-lg border-l-2 transition-colors ${
                  active
                    ? "border-brand-pink bg-brand-pink/10"
                    : "border-transparent hover:bg-brand-pink/5"
                }`}
              >
                <Link
                  href={`/categoria/${cat.id}`}
                  className={`flex flex-1 items-center justify-between px-3 py-2 ${
                    active ? "font-semibold text-brand-pink-dark" : "text-brand-ink"
                  }`}
                >
                  {cat.name}
                  <span className="ml-2 text-xs text-brand-muted">{counts.get(cat.id) ?? 0}</span>
                </Link>

                {hasChildren && (
                  <button
                    type="button"
                    onClick={() => toggle(cat.id)}
                    aria-label={isOpen ? `Contraer ${cat.name}` : `Expandir ${cat.name}`}
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-brand-muted transition-colors hover:text-brand-pink-dark"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {hasChildren && isOpen && (
                  <motion.ul
                    key={`sub-${cat.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="ml-3 mt-1 space-y-1 overflow-hidden border-l border-brand-pink/20 pl-3"
                  >
                    {subcategories.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          href={`/categoria/${sub.id}`}
                          className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                            sub.id === activeCategoryId
                              ? "font-semibold text-brand-pink-dark"
                              : "text-brand-muted hover:text-brand-pink-dark"
                          }`}
                        >
                          {sub.name}
                          <span className="text-xs text-brand-muted/70">{counts.get(sub.id) ?? 0}</span>
                        </Link>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </li>
          );
        })}
          </motion.ul>
        )}
      </AnimatePresence>
    </nav>
  );
}
