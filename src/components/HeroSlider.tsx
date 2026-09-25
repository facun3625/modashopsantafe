"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { HeartIcon } from "@/components/icons";

export type HeroSlide = {
  image: string;
  eyebrow: string;
  title: string; // hasta 2 líneas separadas por \n
  subtitle?: string | null;
  promoText?: string | null; // hasta 2 líneas separadas por \n
  buttons: { label: string; href: string }[];
};

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  const slide = slides[index];
  if (!slide) return null;

  const titleLines = slide.title.split("\n");
  const promoLines = slide.promoText?.split("\n") ?? [];
  // El círculo crece (círculo + tipografía) según cuánto texto se cargue,
  // hasta un tope — así una frase larga (ej. "Descuento 10% en
  // transferencias") entra cómoda sin desbordar ni quedar ilegible.
  const promoTotalLength = promoLines.reduce((sum, l) => sum + l.length, 0);
  const promoSize =
    promoTotalLength > 26
      ? { circle: "h-24 w-24 sm:h-28 sm:w-28", text: "text-[9px] sm:text-xs" }
      : promoTotalLength > 14
        ? { circle: "h-20 w-20 sm:h-24 sm:w-24", text: "text-[9px] sm:text-[11px]" }
        : { circle: "h-16 w-16 sm:h-20 sm:w-20", text: "text-[10px] sm:text-xs" };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-black/5 bg-gradient-to-br from-brand-pink/10 via-white to-white px-6 py-8 sm:px-10 sm:py-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="grid grid-cols-1 items-stretch gap-8 sm:min-h-[300px] sm:grid-cols-2 sm:gap-10"
        >
          {/* Texto */}
          <div className="order-2 flex flex-col justify-center text-center sm:order-1 sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-muted sm:text-sm">
              {slide.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
              {titleLines.map((line, i) => (
                <span key={i} className={`block ${i % 2 === 1 ? "text-brand-pink-dark" : "text-brand-ink"}`}>
                  {line}
                </span>
              ))}
            </h1>
            {slide.subtitle && (
              <p className="mx-auto mt-4 max-w-md text-sm text-brand-muted sm:mx-0 sm:text-base">
                {slide.subtitle}
              </p>
            )}

            {slide.buttons.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                {slide.buttons.map((btn, i) => (
                  <Link
                    key={i}
                    href={btn.href}
                    className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${
                      i === 0
                        ? "bg-brand-pink text-white hover:bg-brand-pink-dark"
                        : "border border-black/10 text-brand-ink hover:border-brand-pink hover:text-brand-pink-dark"
                    }`}
                  >
                    {btn.label}
                    {i === 0 && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Imagen */}
          <div className="relative order-1 sm:order-2">
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-full bg-brand-pink/10 blur-2xl" />
            <HeartIcon className="pointer-events-none absolute -left-2 -top-2 h-8 w-8 -rotate-12 text-brand-pink/50 sm:h-10 sm:w-10" />

            <div
              className="aspect-[4/3] w-full rounded-2xl bg-cover bg-center shadow-sm sm:aspect-auto sm:h-full"
              style={{ backgroundImage: `url(${slide.image})` }}
            />

            {promoLines.length > 0 && (
              <div
                className={`absolute -right-2 -top-4 flex shrink-0 rotate-6 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full bg-brand-pink p-2 text-center font-bold uppercase leading-tight text-wrap break-words text-white shadow-lg sm:-right-4 ${promoSize.circle} ${promoSize.text}`}
              >
                {promoLines.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Ir al slide ${i + 1}`}
              className={`h-2 rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-pink ${
                i === index ? "w-6 bg-brand-pink" : "w-2 bg-black/15 hover:bg-black/25"
              }`}
            />
          ))}
        </div>
      )}

      {slides.length > 1 && (
        <>
          <button
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            aria-label="Slide anterior"
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-brand-ink outline-none transition-colors hover:border-brand-pink hover:text-brand-pink-dark focus-visible:ring-2 focus-visible:ring-brand-pink sm:flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            aria-label="Slide siguiente"
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-brand-ink outline-none transition-colors hover:border-brand-pink hover:text-brand-pink-dark focus-visible:ring-2 focus-visible:ring-brand-pink sm:flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
