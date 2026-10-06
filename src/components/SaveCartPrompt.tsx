"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getVisitorContact, isValidEmail, isValidPhone, saveVisitorContact } from "@/lib/visitorContact";

// "Guardá tu carrito": le pide email y teléfono a un visitante sin sesión que todavía no los dejó, para poder
// recuperarle el carrito si se va (mail automático o WhatsApp desde el panel). Se oculta solo si hay sesión o si ya
// tenemos sus datos.
export function SaveCartPrompt({ compact = false }: { compact?: boolean }) {
  const { data: session, status } = useSession();
  const [known, setKnown] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const c = getVisitorContact();
      setKnown(Boolean(c.email && c.phone));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (status === "loading" || session?.user || known === null) return null;
  if (known && !saved) return null;

  if (saved) {
    return (
      <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
        ✓ Listo, guardamos tu carrito. Si te vas, te lo recordamos.
      </p>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) return setError("Revisá el email.");
    if (!isValidPhone(phone)) return setError("Revisá el teléfono (con código de área).");
    setError(null);
    saveVisitorContact({ email, phone });
    setSaved(true);
  }

  const field = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

  return (
    <form onSubmit={submit} className="rounded-xl border border-brand-pink/20 bg-brand-soft/60 p-4">
      <p className="text-sm font-semibold text-brand-ink">Guardá tu carrito</p>
      <p className="mt-0.5 text-xs text-brand-muted">Dejanos tu email y teléfono y te lo guardamos por si querés terminar la compra después.</p>
      <div className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-[1fr_1fr_auto]"}`}>
        <input type="email" autoComplete="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        <input type="tel" autoComplete="tel" placeholder="Teléfono (ej. 3425 123456)" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
        <button type="submit" className="cursor-pointer rounded-full bg-brand-pink px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark">
          Guardar
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      <p className="mt-2 text-[11px] text-brand-muted">Solo te escribimos por este carrito. Podés darte de baja desde el mail.</p>
    </form>
  );
}
