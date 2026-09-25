"use client";

import { useRef } from "react";
import Link from "next/link";

export function CategoryCarousel({
  categories,
}: {
  categories: { id: number; name: string; image: string | false }[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scroll(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 16 : el.clientWidth;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  const arrowClasses =
    "flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-white p-3 text-brand-pink-dark shadow-md ring-1 ring-black/10 transition-colors hover:bg-brand-pink hover:text-white";

  return (
    <div>
      <div className="flex items-center gap-4">
        <button onClick={() => scroll(-1)} aria-label="Anterior" className={`hidden sm:flex ${arrowClasses}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div
          ref={scrollerRef}
          className="flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categoria/${cat.id}`}
              className="group w-[calc((100%-1rem)/2)] shrink-0 snap-start rounded-2xl border border-black/10 bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md sm:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]"
            >
              <div className="relative overflow-hidden rounded-xl">
                {cat.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/png;base64,${cat.image}`}
                    alt={cat.name}
                    className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="aspect-square w-full bg-brand-soft" />
                )}

                <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2 rounded-full bg-white py-2 pl-4 pr-2 shadow-md">
                  <p className="truncate text-xs font-bold uppercase tracking-wide text-brand-ink">{cat.name}</p>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-pink/10 text-brand-pink-dark transition-colors group-hover:bg-brand-pink group-hover:text-white">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <button onClick={() => scroll(1)} aria-label="Siguiente" className={`hidden sm:flex ${arrowClasses}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 sm:hidden">
        <button onClick={() => scroll(-1)} aria-label="Anterior" className={arrowClasses}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button onClick={() => scroll(1)} aria-label="Siguiente" className={arrowClasses}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
