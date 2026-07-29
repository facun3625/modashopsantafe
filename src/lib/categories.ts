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
