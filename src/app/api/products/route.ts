import { NextRequest, NextResponse } from "next/server";
import { getProductsPage } from "@/lib/products";

export async function GET(req: NextRequest) {
  const categoryIdParam = req.nextUrl.searchParams.get("categoryId");
  const query = req.nextUrl.searchParams.get("q") ?? undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 24);
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);

  try {
    const { products, total } = await getProductsPage({
      categoryId: categoryIdParam ? Number(categoryIdParam) : undefined,
      query,
      limit,
      offset,
    });

    return NextResponse.json({ products, total, limit, offset });
  } catch (err) {
    console.error("GET /api/products failed", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 502 });
  }
}
