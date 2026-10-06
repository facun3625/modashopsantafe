// Contacto del visitante recordado en su navegador (email, teléfono, nombre), para que sus carritos dejen de quedar
// "Anónimo" aunque nunca inicie sesión. Se guarda cuando lo escribe en el checkout, en el newsletter o en "Guardá tu
// carrito", y lib/cart.tsx lo manda con cada sincronización del carrito. Solo vive en este navegador.
export type VisitorContact = { email?: string; phone?: string; name?: string };

const KEY = "modashop_contact";
export const CONTACT_EVENT = "modashop:contact";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

export function isValidPhone(v: string): boolean {
  return v.replace(/\D/g, "").length >= 8;
}

export function getVisitorContact(): VisitorContact {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as VisitorContact) : {};
  } catch {
    return {};
  }
}

// Suma lo nuevo a lo que ya había. Solo guarda valores válidos, así un email a medio escribir no pisa uno bueno.
export function saveVisitorContact(next: VisitorContact) {
  if (typeof window === "undefined") return;
  const current = getVisitorContact();
  const merged: VisitorContact = { ...current };
  if (next.email && isValidEmail(next.email)) merged.email = next.email.trim().toLowerCase();
  if (next.phone && isValidPhone(next.phone)) merged.phone = next.phone.trim();
  if (next.name?.trim()) merged.name = next.name.trim();
  if (JSON.stringify(merged) === JSON.stringify(current)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event(CONTACT_EVENT));
  } catch {
    // Navegador privado o sin espacio: no se recuerda, sin romper nada.
  }
}
