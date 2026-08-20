import { executeKw } from "@/lib/odoo";
import { getReservedQuantities } from "@/lib/reservations";
import type { OdooCategory, OdooProductListItem } from "@/types/odoo";

const PRODUCT_LIST_FIELDS = ["name", "list_price", "qty_available", "image_128", "image_512", "categ_id"];

// Chequeo de stock antes de crear un pedido. El disponible real de cara al
// cliente es el qty_available de Odoo MENOS lo ya reservado por otros pedidos
// web todavía sin despachar (ver lib/reservations.ts) — así no se sobrevende
// aunque nadie entre a Odoo a validar (típico fin de semana).
export async function checkStock(
  items: { productId: number; quantity: number }[]
): Promise<{ ok: boolean; shortages: { productId: number; name: string; available: number; requested: number }[] }> {
  const ids = items.map((i) => i.productId);
  const [products, reserved] = await Promise.all([
    executeKw<{ id: number; name: string; qty_available: number }[]>(
      "product.template",
      "read",
      [ids],
      { fields: ["name", "qty_available"] }
    ),
    getReservedQuantities(ids),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const shortages = items
    .map((item) => {
      const product = byId.get(item.productId);
      if (!product) return { productId: item.productId, name: "Producto no encontrado", available: 0, requested: item.quantity };
      const available = Math.max(0, product.qty_available - (reserved.get(item.productId) ?? 0));
      return { productId: item.productId, name: product.name, available, requested: item.quantity };
    })
    .filter((s) => s.available < s.requested);

  return { ok: shortages.length === 0, shortages };
}

// Solo mostramos productos con foto — sin imagen no hay nada que mostrar en el grid.
const HAS_IMAGE_DOMAIN = ["image_128", "!=", false];

export async function getProductsPage(opts: {
  categoryId?: number;
  query?: string;
  limit: number;
  offset: number;
}): Promise<{ products: OdooProductListItem[]; total: number }> {
  const domain: unknown[] = [["sale_ok", "=", true], HAS_IMAGE_DOMAIN];
  if (opts.categoryId) {
    domain.push(["categ_id", "child_of", opts.categoryId]);
  }
  if (opts.query) {
    domain.push(["name", "ilike", opts.query]);
  }

  const [products, total] = await Promise.all([
    executeKw<OdooProductListItem[]>("product.template", "search_read", [domain], {
      fields: PRODUCT_LIST_FIELDS,
      limit: opts.limit,
      offset: opts.offset,
      order: "name asc",
    }),
    executeKw<number>("product.template", "search_count", [domain]),
  ]);

  return { products: await applyReservations(products), total };
}

// Descuenta del qty_available que ve el cliente el stock ya reservado por
// pedidos web sin despachar. Se aplica solo a lo que muestra la tienda (no al
// catálogo del admin, que ve el stock físico real de Odoo).
async function applyReservations(products: OdooProductListItem[]): Promise<OdooProductListItem[]> {
  const reserved = await getReservedQuantities(products.map((p) => p.id));
  if (reserved.size === 0) return products;
  return products.map((p) => ({
    ...p,
    qty_available: Math.max(0, p.qty_available - (reserved.get(p.id) ?? 0)),
  }));
}

// Para el panel de administración: sin filtrar por imagen ni por sale_ok,
// el admin necesita ver todo el catálogo tal cual está en Odoo.
const ADMIN_SORT_FIELDS = { name: "name", price: "list_price", stock: "qty_available" } as const;

export type AdminProductListItem = OdooProductListItem & { reserved: number };

export async function getAdminProductsPage(opts: {
  query?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  maxStock?: number;
  sort?: keyof typeof ADMIN_SORT_FIELDS;
  dir?: "asc" | "desc";
  limit: number;
  offset: number;
}): Promise<{ products: AdminProductListItem[]; total: number }> {
  const domain: unknown[] = [];
  if (opts.query) {
    domain.push(["name", "ilike", opts.query]);
  }
  if (opts.categoryId) {
    domain.push(["categ_id", "child_of", opts.categoryId]);
  }
  if (opts.minPrice !== undefined) {
    domain.push(["list_price", ">=", opts.minPrice]);
  }
  if (opts.maxPrice !== undefined) {
    domain.push(["list_price", "<=", opts.maxPrice]);
  }
  if (opts.minStock !== undefined) {
    domain.push(["qty_available", ">=", opts.minStock]);
  }
  if (opts.maxStock !== undefined) {
    domain.push(["qty_available", "<=", opts.maxStock]);
  }

  const dir = opts.dir === "desc" ? "desc" : "asc";

  // qty_available es un campo computado (no "store") en Odoo, así que no se
  // puede ordenar a nivel SQL — Odoo lo ignora en silencio. Para ese caso
  // traemos todo el conjunto ya filtrado y ordenamos en memoria antes de
  // paginar; para name/list_price (campos "store") se ordena en el server.
  if (opts.sort === "stock") {
    const all = await executeKw<OdooProductListItem[]>("product.template", "search_read", [domain], {
      fields: PRODUCT_LIST_FIELDS,
      order: "name asc",
    });
    all.sort((a, b) => (dir === "asc" ? a.qty_available - b.qty_available : b.qty_available - a.qty_available));
    const page = all.slice(opts.offset, opts.offset + opts.limit);
    return { products: await withReserved(page), total: all.length };
  }

  const sortField = ADMIN_SORT_FIELDS[opts.sort ?? "name"];
  const order = `${sortField} ${dir}`;

  const [products, total] = await Promise.all([
    executeKw<OdooProductListItem[]>("product.template", "search_read", [domain], {
      fields: PRODUCT_LIST_FIELDS,
      limit: opts.limit,
      offset: opts.offset,
      order,
    }),
    executeKw<number>("product.template", "search_count", [domain]),
  ]);

  return { products: await withReserved(products), total };
}

// El admin ve el stock físico real de Odoo (source of truth para reponer),
// pero eso solo confundía cuando un pedido web todavía sin despachar deja la
// tienda pública en "Sin stock" mientras acá se seguía viendo el número
// físico intacto, sin ninguna pista de por qué. Se suma cuánto de ese stock
// ya está reservado, para mostrarlo al lado sin cambiar qué número es "la
// verdad" del inventario.
async function withReserved(products: OdooProductListItem[]): Promise<AdminProductListItem[]> {
  const reserved = await getReservedQuantities(products.map((p) => p.id));
  return products.map((p) => ({ ...p, reserved: reserved.get(p.id) ?? 0 }));
}

// Cuenta productos por categoría con solo 2 llamadas a Odoo: trae el conteo
// directo por categoría hoja (read_group) y lo suma hacia arriba en el árbol,
// en vez de hacer un search_count por cada categoría.
export async function getProductCountsByCategory(
  categories: OdooCategory[]
): Promise<Map<number, number>> {
  const groups = await executeKw<{ categ_id: [number, string] | false; categ_id_count: number }[]>(
    "product.template",
    "read_group",
    [[["sale_ok", "=", true], HAS_IMAGE_DOMAIN], ["categ_id"], ["categ_id"]]
  );

  const direct = new Map<number, number>();
  for (const g of groups) {
    if (g.categ_id) direct.set(g.categ_id[0], g.categ_id_count);
  }

  const childrenOf = new Map<number, number[]>();
  for (const c of categories) {
    if (c.parent_id) {
      const pid = c.parent_id[0];
      childrenOf.set(pid, [...(childrenOf.get(pid) ?? []), c.id]);
    }
  }

  const total = new Map<number, number>();
  function totalFor(id: number): number {
    if (total.has(id)) return total.get(id)!;
    let sum = direct.get(id) ?? 0;
    for (const childId of childrenOf.get(id) ?? []) {
      sum += totalFor(childId);
    }
    total.set(id, sum);
    return sum;
  }
  for (const c of categories) totalFor(c.id);

  return total;
}

// Productos con foto tipo "collage" promocional (varios items en una sola imagen)
// en vez de una foto de producto real — no sirven como imagen representativa.
const SHOWCASE_EXCLUDE_IDS = [514, 515];

export async function getCategoryShowcaseImage(
  categoryId: number,
  field: "image_128" | "image_1024" = "image_1024"
): Promise<string | false> {
  const domain = [
    ["sale_ok", "=", true],
    ["categ_id", "child_of", categoryId],
    ["id", "not in", SHOWCASE_EXCLUDE_IDS],
    [field, "!=", false],
  ];
  const products = await executeKw<Record<string, string | false>[]>(
    "product.template",
    "search_read",
    [domain],
    { fields: [field], limit: 1, order: "name asc" }
  );
  return products[0]?.[field] ?? false;
}
