import { executeKw } from "@/lib/odoo";

// Caché en memoria de las fotos de productos (solo servidor). La usan la ruta /api/product-image y el precalentado
// que se dispara al armar un listado, así las fotos ya están listas cuando el navegador las pide.
const FIELDS: Record<string, string> = { "128": "image_128", "512": "image_512", "1024": "image_1024", "1920": "image_1920" };

const MAX_BYTES = 80 * 1024 * 1024;
const cache = new Map<string, ImageEntry>();
const inflight = new Map<string, Promise<ImageEntry | null>>();
let cachedBytes = 0;

export type ImageEntry = { body: Buffer; type: string };

export function imageField(size: string): string | null {
  return FIELDS[size] ?? null;
}

function remember(key: string, entry: ImageEntry) {
  cache.set(key, entry);
  cachedBytes += entry.body.length;
  for (const [k, v] of cache) {
    if (cachedBytes <= MAX_BYTES) break;
    cache.delete(k);
    cachedBytes -= v.body.length;
  }
}

function detectType(b: Buffer): string {
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (b.subarray(0, 3).toString() === "GIF") return "image/gif";
  if (b.subarray(0, 5).toString().startsWith("<svg") || b.subarray(0, 5).toString() === "<?xml") return "image/svg+xml";
  return "image/png";
}

export async function loadProductImage(id: number, size: string, version: string): Promise<ImageEntry | null> {
  const field = imageField(size);
  if (!field) return null;
  const key = `${id}:${field}:${version}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const running = inflight.get(key);
  if (running) return running;

  const p = (async () => {
    const rows = await executeKw<Record<string, string | false>[]>("product.template", "read", [[id]], { fields: [field] });
    const b64 = rows[0]?.[field];
    if (!b64) return null;
    const body = Buffer.from(b64, "base64");
    const entry = { body, type: detectType(body) };
    remember(key, entry);
    return entry;
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

// Trae en segundo plano las fotos de un listado (con pocas consultas a la vez), sin frenar la respuesta de la página.
export function warmProductImages(items: { id: number; version: string | null }[], size = "512") {
  const queue = [...items];
  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await loadProductImage(item.id, size, item.version ?? "").catch(() => {});
    }
  };
  void Promise.all([worker(), worker(), worker(), worker()]);
}
