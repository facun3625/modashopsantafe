import { normalizeCheckoutItems } from "@/lib/checkoutItems";
import { executeKw } from "@/lib/odoo";
import { getReservedQuantities } from "@/lib/reservations";
import { getStoreSettingsRow } from "@/lib/settings";
import { productImageUrl } from "@/lib/productImage";
import { cachedCatalog } from "@/lib/catalogCache";
import type { OdooCategory, OdooProductListItem } from "@/types/odoo";

// Las fotos NO se piden acá (pesan mucho como base64): se arma su URL con productImageUrl y se piden aparte.
// write_date sirve de versión de la foto, para que el navegador la guarde sin mostrar una vieja.
const PRODUCT_LIST_FIELDS = ["name", "list_price", "qty_available", "categ_id", "write_date"];

type RawListItem = Omit<OdooProductListItem, "image_128" | "image_512"> & { write_date: string | false };

// Completa las URLs de las fotos. Si la consulta ya filtraba por "tiene foto" no hace falta preguntar; si no, se
// pregunta a Odoo cuáles tienen foto (una búsqueda liviana, sin bajar las imágenes).
async function withImages(raw: RawListItem[], allHaveImage: boolean): Promise<OdooProductListItem[]> {
  let hasImage: Set<number> | null = null;
  if (!allHaveImage && raw.length > 0) {
    const ids = await executeKw<number[]>("product.template", "search", [[["id", "in", raw.map((r) => r.id)], ["image_128", "!=", false]]]);
    hasImage = new Set(ids);
  }
  return raw.map(({ write_date, ...p }) => {
    const ok = hasImage ? hasImage.has(p.id) : true;
    const v = write_date || null;
    return { ...p, image_128: ok ? productImageUrl(p.id, 128, v) : false, image_512: ok ? productImageUrl(p.id, 512, v) : false };
  });
}

// Chequeo de stock antes de crear un pedido. El disponible real de cara al
// cliente es el qty_available de Odoo MENOS lo ya reservado por otros pedidos
// web todavía sin despachar (ver lib/reservations.ts) — así no se sobrevende
// aunque nadie entre a Odoo a validar (típico fin de semana).
export async function checkStock(
  items: { productId: number; quantity: number }[]
): Promise<{ ok: boolean; shortages: { productId: number; name: string; available: number; requested: number }[] }> {
  items = normalizeCheckoutItems(items);
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
  // Categorías que van primero, en este orden (con sus subcategorías); después el resto. Solo para la vista general.
  priorityCategoryIds?: number[];
}): Promise<{ products: OdooProductListItem[]; total: number }> {
  const domain: unknown[] = [["sale_ok", "=", true], HAS_IMAGE_DOMAIN];
  if (opts.categoryId) {
    domain.push(["categ_id", "child_of", opts.categoryId]);
  }
  if (opts.query) {
    domain.push(["name", "ilike", opts.query]);
  }

  // Filtro opcional del admin (Configuración → General): oculta del todo los
  // productos en 0 en vez de mostrarlos al final con "Sin stock" + aviso de reposición
  // (ver los tramos más abajo).
  // Se filtra por el stock físico de Odoo, no por el neto post-reserva (ver
  // applyReservations) — el caso de "1 físico pero reservado por un pedido
  // web" queda igual visible con "Sin stock", cubierto aparte por el aviso
  // de reserva en /admin/productos.
  const settings = await getStoreSettingsRow();

  // Tramos del listado, en orden: primero las categorías prioritarias (si hay) y después el resto. Cada tramo se parte
  // en "con stock" y "sin stock", y todos los "sin stock" van al final: así un cliente siempre ve primero lo que puede
  // comprar. Si el admin oculta lo sin stock, ese segundo grupo no existe.
  const notIn = (ids: number[]) => ids.flatMap((id) => ["!", ["categ_id", "child_of", id]]);
  const priority = opts.priorityCategoryIds ?? [];
  const byCategory =
    priority.length > 0
      ? [...priority.map((id, i) => [...domain, ["categ_id", "child_of", id], ...notIn(priority.slice(0, i))]), [...domain, ...notIn(priority)]]
      : [domain];
  const segments = [
    ...byCategory.map((d) => [...d, ["qty_available", ">", 0]]),
    ...(settings.hideOutOfStock ? [] : byCategory.map((d) => [...d, ["qty_available", "<=", 0]])),
  ];

  // Lo que viene de Odoo se guarda unos minutos (ver lib/catalogCache.ts); las reservas web se descuentan en vivo
  const page = await cachedCatalog(`page:${JSON.stringify([segments, opts.limit, opts.offset])}`, () =>
    getSegmentedPage(segments, opts.limit, opts.offset)
  );
  return { products: await applyReservations(page.products), total: page.total };
}

// Arma el listado como una sola lista hecha de tramos (cada uno ordenado por nombre). Cuenta cada tramo y trae solo
// las partes que caen dentro de la página pedida, así la paginación sigue siendo continua y sin repetidos.
async function getSegmentedPage(
  segments: unknown[][],
  limit: number,
  offset: number
): Promise<{ products: OdooProductListItem[]; total: number }> {
  const counts = await Promise.all(segments.map((d) => executeKw<number>("product.template", "search_count", [d])));
  const total = counts.reduce((a, b) => a + b, 0);

  const reads: Promise<RawListItem[]>[] = [];
  let start = 0;
  for (let i = 0; i < segments.length; i++) {
    const end = start + counts[i];
    const from = Math.max(offset, start);
    const to = Math.min(offset + limit, end);
    if (from < to) {
      reads.push(
        executeKw<RawListItem[]>("product.template", "search_read", [segments[i]], {
          fields: PRODUCT_LIST_FIELDS,
          limit: to - from,
          offset: from - start,
          // id desempata productos con el mismo nombre: sin eso, al paginar se repiten o se saltean entre páginas
          order: "name asc, id asc",
        })
      );
    }
    start = end;
  }

  const products = await withImages((await Promise.all(reads)).flat(), true);
  return { products, total };
}

// Búsqueda acotada para la vendedora virtual. Solo devuelve productos
// vendibles y con imagen, con el stock neto de reservas igual que la tienda.
export async function searchProductsForAssistant(opts: {
  query?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  limit?: number;
}): Promise<OdooProductListItem[]> {
  const domain: unknown[] = [["sale_ok", "=", true], HAS_IMAGE_DOMAIN];
  if (opts.query) domain.push(["name", "ilike", opts.query]);
  if (opts.categoryId) domain.push(["categ_id", "child_of", opts.categoryId]);
  if (opts.minPrice !== undefined) domain.push(["list_price", ">=", opts.minPrice]);
  if (opts.maxPrice !== undefined) domain.push(["list_price", "<=", opts.maxPrice]);
  if (opts.inStockOnly) domain.push(["qty_available", ">", 0]);

  // Pedimos algunas filas extra porque una reserva web puede llevar el stock
  // neto a cero aunque Odoo todavía informe stock físico.
  const limit = Math.min(Math.max(opts.limit ?? 6, 1), 8);
  const raw = await executeKw<RawListItem[]>("product.template", "search_read", [domain], {
    fields: PRODUCT_LIST_FIELDS,
    limit: opts.inStockOnly ? limit * 3 : limit,
    order: "name asc",
  });
  const available = await applyReservations(await withImages(raw, true));
  return (opts.inStockOnly ? available.filter((product) => product.qty_available > 0) : available).slice(0, limit);
}

// Para la página de favoritos: re-consulta a Odoo el estado actual (precio,
// stock, imagen) de una lista puntual de ids — nunca se cachea un producto
// local, así que un favorito viejo siempre muestra datos frescos.
export async function getProductsByIds(ids: number[]): Promise<OdooProductListItem[]> {
  if (ids.length === 0) return [];
  const raw = await executeKw<RawListItem[]>("product.template", "read", [ids], { fields: PRODUCT_LIST_FIELDS });
  return applyReservations(await withImages(raw, false));
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
// Solo name/list_price son campos "store" en Odoo — se pueden ordenar con
// el `order` de search_read. stock y category se resuelven en memoria (ver
// más abajo): qty_available es computado (Odoo lo ignora en el order), y
// categ_id es un many2one — ordenarlo por SQL ordenaría por el id interno,
// no alfabéticamente por el nombre de la categoría.
const ADMIN_SORT_FIELDS = { name: "name", price: "list_price" } as const;

export type AdminProductSort = "name" | "price" | "stock" | "category";

export type AdminProductListItem = OdooProductListItem & { reserved: number };

export async function getAdminProductsPage(opts: {
  query?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  maxStock?: number;
  sort?: AdminProductSort;
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

  // qty_available/categ_id no se pueden ordenar bien a nivel SQL (ver
  // comentario de ADMIN_SORT_FIELDS) — para esos dos traemos todo el
  // conjunto ya filtrado y ordenamos en memoria antes de paginar.
  if (opts.sort === "stock" || opts.sort === "category") {
    const all = await executeKw<RawListItem[]>("product.template", "search_read", [domain], {
      fields: PRODUCT_LIST_FIELDS,
      order: "name asc",
    });
    if (opts.sort === "stock") {
      all.sort((a, b) => (dir === "asc" ? a.qty_available - b.qty_available : b.qty_available - a.qty_available));
    } else {
      all.sort((a, b) => {
        const an = a.categ_id ? a.categ_id[1] : "";
        const bn = b.categ_id ? b.categ_id[1] : "";
        return dir === "asc" ? an.localeCompare(bn) : bn.localeCompare(an);
      });
    }
    const page = all.slice(opts.offset, opts.offset + opts.limit);
    return { products: await withReserved(await withImages(page, false)), total: all.length };
  }

  const sortField = ADMIN_SORT_FIELDS[opts.sort === "price" ? "price" : "name"];
  const order = `${sortField} ${dir}`;

  const [raw, total] = await Promise.all([
    executeKw<RawListItem[]>("product.template", "search_read", [domain], {
      fields: PRODUCT_LIST_FIELDS,
      limit: opts.limit,
      offset: opts.offset,
      order,
    }),
    executeKw<number>("product.template", "search_count", [domain]),
  ]);

  return { products: await withReserved(await withImages(raw, false)), total };
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
  const groups = await cachedCatalog("counts", () =>
    executeKw<{ categ_id: [number, string] | false; categ_id_count: number }[]>(
      "product.template",
      "read_group",
      [[["sale_ok", "=", true], HAS_IMAGE_DOMAIN], ["categ_id"], ["categ_id"]]
    )
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
  const products = await cachedCatalog(`showcase:${categoryId}`, () =>
    executeKw<{ id: number; write_date: string | false }[]>("product.template", "search_read", [domain], {
      fields: ["write_date"],
      limit: 1,
      order: "name asc",
    })
  );
  const p = products[0];
  return p ? productImageUrl(p.id, field === "image_128" ? 128 : 1024, p.write_date || null) : false;
}
