"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

export type HeroSlide = {
  image: string;
  eyebrow: string;
  title: string; // hasta 2 líneas separadas por \n
  subtitle?: string | null;
  promoText?: string | null; // hasta 2 líneas separadas por \n
  buttons: { label: string; href: string }[];
};

const GRADIENT = "from-black/90 via-black/45 to-transparent";

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
      ? { circle: "h-28 w-28 sm:h-32 sm:w-32", text: "text-[9px] sm:text-xs" }
      : promoTotalLength > 14
        ? { circle: "h-24 w-24 sm:h-28 sm:w-28", text: "text-[9px] sm:text-[11px]" }
        : { circle: "h-20 w-20 sm:h-24 sm:w-24", text: "text-[10px] sm:text-xs" };

  return (
    <div className="relative flex min-h-[280px] max-h-[350px] flex-col items-center justify-center overflow-hidden rounded-3xl px-6 py-10 text-center sm:min-h-[320px] sm:py-14">
      <AnimatePresence>
        <motion.div
          key={`bg-${index}`}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${slide.image})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        />
      </AnimatePresence>
      <div className={`absolute inset-0 bg-gradient-to-t ${GRADIENT}`} />

      {/* Fijo a la esquina del banner entero (no del bloque de texto, que se
          centra verticalmente y puede tener distinta altura según el
          slide) — así siempre queda en el mismo lugar. */}
      {promoLines.length > 0 && (
        <div
          className={`absolute right-4 top-4 z-10 flex shrink-0 rotate-6 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full bg-white p-2 text-center font-bold uppercase leading-tight text-wrap break-words text-brand-pink-dark shadow-lg ${promoSize.circle} ${promoSize.text}`}
        >
          {promoLines.map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
      )}

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white drop-shadow-md sm:text-sm">
              {slide.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-extrabold uppercase leading-[0.95] text-white drop-shadow-lg sm:text-6xl">
              {titleLines.map((line, i) => (
                <span key={i}>
                  {line}
                  {i < titleLines.length - 1 && <br />}
                </span>
              ))}
            </h1>
            {slide.subtitle && (
              <p className="mx-auto mt-3 max-w-md text-sm text-white drop-shadow-md sm:text-base">{slide.subtitle}</p>
            )}
          </motion.div>
        </AnimatePresence>

        {slide.buttons.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {slide.buttons.map((btn, i) => (
              <Link
                key={i}
                href={btn.href}
                className="rounded-full border-2 border-white px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-brand-pink-dark sm:text-sm"
              >
                {btn.label}
              </Link>
            ))}
          </div>
        )}

        {slides.length > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Ir al slide ${i + 1}`}
                className={`h-2 rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-white ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            aria-label="Slide anterior"
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white outline-none backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white sm:flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            aria-label="Slide siguiente"
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white outline-none backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white sm:flex"
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
