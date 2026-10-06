import { prisma } from "@/lib/prisma";

// Caché en memoria del catálogo que viene de Odoo (cada consulta a Odoo tarda ~0,7 s). Funciona como "stale while
// revalidate": mientras el dato está fresco se devuelve directo; vencido, se devuelve igual lo guardado y se renueva en
// segundo plano, así casi ningún visitante espera a Odoo. Solo la primera visita después de arrancar el server (o de
// "Actualizar ahora") consulta en vivo.
//
// No se cachea nada que decida una venta: el stock se vuelve a chequear en Odoo al agregar al carrito y al comprar
// (ver checkStock). Las reservas web tampoco: se aplican siempre en vivo encima de lo guardado.

type Entry = { value: unknown; freshUntil: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 2000;

let ttlCache: { seconds: number; readAt: number } | null = null;

async function ttlSeconds(): Promise<number> {
  // El ajuste se relee como mucho cada 30 s (no hace falta ir a la base en cada consulta)
  if (ttlCache && Date.now() - ttlCache.readAt < 30_000) return ttlCache.seconds;
  const row = await prisma.storeSettings.findUnique({ where: { id: "global" }, select: { catalogCacheSeconds: true } });
  const seconds = Math.max(0, row?.catalogCacheSeconds ?? 120);
  ttlCache = { seconds, readAt: Date.now() };
  return seconds;
}

function save(key: string, value: unknown, ttlMs: number) {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, freshUntil: Date.now() + ttlMs });
}

function load<T>(key: string, fn: () => Promise<T>, ttlMs: number): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = fn()
    .then((value) => {
      save(key, value, ttlMs);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export async function cachedCatalog<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const ttlMs = (await ttlSeconds()) * 1000;
  if (ttlMs === 0) return fn();

  const entry = store.get(key);
  if (entry) {
    if (Date.now() >= entry.freshUntil) {
      // Vencido: se devuelve lo guardado y se renueva detrás. Si Odoo falla, queda lo anterior.
      load(key, fn, ttlMs).catch((err) => console.error("catalogCache: no se pudo renovar", key, err));
    }
    return entry.value as T;
  }
  return load(key, fn, ttlMs);
}

// "Actualizar ahora" desde el panel (y al cambiar ajustes que afectan la vidriera)
export function clearCatalogCache() {
  store.clear();
  ttlCache = null;
}
