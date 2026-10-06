import { NextResponse } from "next/server";
import { executeKw } from "@/lib/odoo";

export const runtime = "nodejs";

const FIELDS: Record<string, string> = { "128": "image_128", "512": "image_512", "1024": "image_1024", "1920": "image_1920" };

// Caché en memoria del proceso (el server corre como proceso persistente con pm2): una foto se le pide a Odoo una
// sola vez y después sale de acá. Tope de ~80 MB; al pasarse se descartan las más viejas.
const MAX_BYTES = 80 * 1024 * 1024;
const cache = new Map<string, { body: Buffer; type: string }>();
let cachedBytes = 0;

function remember(key: string, entry: { body: Buffer; type: string }) {
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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const url = new URL(req.url);
  const field = FIELDS[url.searchParams.get("s") ?? "512"];
  const version = url.searchParams.get("v") ?? "";
  if (!Number.isInteger(id) || id <= 0 || !field) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  const key = `${id}:${field}:${version}`;
  let entry = cache.get(key);
  if (!entry) {
    try {
      const rows = await executeKw<Record<string, string | false>[]>("product.template", "read", [[id]], { fields: [field] });
      const b64 = rows[0]?.[field];
      if (!b64) return NextResponse.json({ error: "Sin imagen" }, { status: 404 });
      const body = Buffer.from(b64, "base64");
      entry = { body, type: detectType(body) };
      remember(key, entry);
    } catch (err) {
      console.error("GET /api/product-image failed", id, err);
      return NextResponse.json({ error: "No se pudo traer la imagen" }, { status: 502 });
    }
  }

  return new Response(new Uint8Array(entry.body), {
    headers: {
      "Content-Type": entry.type,
      // Con versión, la URL cambia cuando cambia la foto: se puede guardar por mucho tiempo
      "Cache-Control": version ? "public, max-age=31536000, immutable" : "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
