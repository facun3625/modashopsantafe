import type { OdooCategory } from "@/types/odoo";

// Funciones puras (sin tocar Odoo/Prisma) separadas de lib/categories.ts a
// propósito: éste es el único archivo del que puede importar un client
// component como CategorySidebar. lib/categories.ts trae `executeKw`, que
// desde hace poco depende de Prisma (lee las credenciales de Odoo de la
// base) — importarlo desde un client component rompe el bundle del browser.
export function topLevelCategories(categories: OdooCategory[]): OdooCategory[] {
  return categories.filter((c) => c.parent_id === false);
}

export function childrenOf(categories: OdooCategory[], parentId: number): OdooCategory[] {
  return categories.filter((c) => c.parent_id !== false && c.parent_id[0] === parentId);
}
