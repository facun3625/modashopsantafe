import { NextResponse } from "next/server";
import { imageField, loadProductImage } from "@/lib/productImageCache";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const url = new URL(req.url);
  const size = url.searchParams.get("s") ?? "512";
  const version = url.searchParams.get("v") ?? "";
  if (!Number.isInteger(id) || id <= 0 || !imageField(size)) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  let entry;
  try {
    entry = await loadProductImage(id, size, version);
  } catch (err) {
    console.error("GET /api/product-image failed", id, err);
    return NextResponse.json({ error: "No se pudo traer la imagen" }, { status: 502 });
  }
  if (!entry) return NextResponse.json({ error: "Sin imagen" }, { status: 404 });

  return new Response(new Uint8Array(entry.body), {
    headers: {
      "Content-Type": entry.type,
      // Con versión, la URL cambia cuando cambia la foto: se puede guardar por mucho tiempo
      "Cache-Control": version ? "public, max-age=31536000, immutable" : "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
