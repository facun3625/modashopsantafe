import { NextResponse } from "next/server";
import { executeKw } from "@/lib/odoo";
import { getReservedQuantities } from "@/lib/reservations";

type OdooProduct = {
  id: number;
  name: string;
  description_sale: string | false;
  list_price: number;
  qty_available: number;
  image_1920: string | false;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);

  if (!Number.isInteger(productId)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  try {
    const products = await executeKw<OdooProduct[]>(
      "product.template",
      "search_read",
      [[["id", "=", productId], ["sale_ok", "=", true]]],
      { fields: ["name", "description_sale", "list_price", "qty_available", "image_1920"], limit: 1 }
    );

    if (products.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Disponible real = físico de Odoo menos lo reservado por pedidos web sin
    // despachar, igual que en el listado (ver lib/reservations.ts).
    const reserved = await getReservedQuantities([productId]);
    const product = {
      ...products[0],
      qty_available: Math.max(0, products[0].qty_available - (reserved.get(productId) ?? 0)),
    };

    return NextResponse.json(product);
  } catch (err) {
    console.error(`GET /api/products/${id} failed`, err);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 502 });
  }
}
