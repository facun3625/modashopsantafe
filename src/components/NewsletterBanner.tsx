"use client";

import { useState } from "react";

export function NewsletterBanner() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus("ok");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="px-3 py-10 sm:px-6 sm:py-16">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand-pink">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-10 -top-10 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <span className="absolute left-[8%] top-[20%] text-2xl text-white/25">✦</span>
          <span className="absolute right-[12%] top-[15%] text-lg text-white/20">✦</span>
          <span className="absolute bottom-[18%] left-[15%] text-lg text-white/20">✦</span>
          <span className="absolute bottom-[22%] right-[9%] text-3xl text-white/25">✦</span>
        </div>

        <div className="relative flex flex-col items-center gap-4 px-6 py-14 text-center sm:py-20">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Sumate a nuestro newsletter</h2>
          <p className="max-w-xl text-sm text-white/85 sm:whitespace-nowrap sm:text-base">
            Enterate primero de los nuevos ingresos y novedades de ModaShop.
          </p>

          {status === "ok" ? (
            <p className="mt-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-brand-pink-dark">
              ¡Listo! Ya estás suscripto.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mx-auto mt-2 flex w-full max-w-sm flex-col gap-2 sm:flex-row">
              <input
                type="email"
                required
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full flex-1 rounded-full border-0 bg-white px-5 py-2.5 text-sm text-brand-ink outline-none placeholder:text-brand-muted"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="shrink-0 cursor-pointer rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-brand-pink-dark shadow-sm transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "loading" ? "Enviando..." : "Suscribirme"}
              </button>
            </form>
          )}
          {status === "error" && (
            <p className="text-xs text-white/85">No se pudo suscribir. Probá de nuevo.</p>
          )}
        </div>
      </div>
    </section>
  );
}
