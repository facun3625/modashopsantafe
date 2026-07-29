import { NextResponse } from "next/server";
import { executeKw } from "@/lib/odoo";

type OdooCategory = {
  id: number;
  name: string;
  parent_id: [number, string] | false;
};

export async function GET() {
  try {
    const categories = await executeKw<OdooCategory[]>(
      "product.category",
      "search_read",
      [[]],
      { fields: ["name", "parent_id"], order: "complete_name asc" }
    );
    return NextResponse.json(categories);
  } catch (err) {
    console.error("GET /api/categories failed", err);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 502 });
  }
}
