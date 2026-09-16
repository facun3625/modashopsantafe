import { executeKw } from "@/lib/odoo";
import type { OdooCategory } from "@/types/odoo";

// Funciones puras que solo filtran un array ya obtenido (sin tocar Odoo)
// viven en lib/categoryHelpers.ts — ese es el único archivo del que puede
// importar un client component, este de acá (executeKw depende de Prisma
// desde que las credenciales de Odoo se leen de la base) rompe el bundle
// del browser si se importa desde uno.
export async function getAllCategories(): Promise<OdooCategory[]> {
  return executeKw<OdooCategory[]>(
    "product.category",
    "search_read",
    [[]],
    { fields: ["name", "parent_id"], order: "complete_name asc" }
  );
}

// Para cada producto, su categoría propia seguida de todas sus categorías
// ancestro hasta la raíz (en ese orden — de más específica a más general).
// Usado tanto para el alcance por categoría de los cupones (lib/coupons.ts)
// como para las excepciones de descuento por categoría de un medio de pago
// (lib/paymentMethodDiscount.ts).
export async function resolveItemCategoryChains(
  items: { productId: number }[]
): Promise<Map<number, number[]>> {
  const products = await executeKw<{ id: number; categ_id: [number, string] | false }[]>(
    "product.template",
    "read",
    [items.map((i) => i.productId)],
    { fields: ["categ_id"] }
  );
  const categories = await getAllCategories();
  const byId = new Map(categories.map((c) => [c.id, c]));

  function chainFrom(startId: number): number[] {
    const chain: number[] = [];
    let current = byId.get(startId);
    while (current) {
      chain.push(current.id);
      current = current.parent_id ? byId.get(current.parent_id[0]) : undefined;
    }
    return chain;
  }

  const result = new Map<number, number[]>();
  for (const p of products) {
    result.set(p.id, p.categ_id ? chainFrom(p.categ_id[0]) : []);
  }
  return result;
}
