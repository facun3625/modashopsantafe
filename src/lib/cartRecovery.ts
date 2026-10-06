import { prisma } from "@/lib/prisma";
import { getProductsByIds } from "@/lib/products";
import type { CartItem } from "@/lib/cart";

type SavedLine = { productId?: number; quantity?: number };

// Reconstruye un carrito abandonado con datos de hoy (precio, stock, foto) desde Odoo, no con los que quedaron
// guardados: así el link de recuperación funciona aunque haya cambiado un precio, y nunca ofrece algo sin stock.
export async function recoverCartItems(cartId: string): Promise<CartItem[]> {
  const cart = await prisma.abandonedCart.findUnique({ where: { id: cartId }, select: { items: true } });
  const lines = (Array.isArray(cart?.items) ? cart.items : []) as SavedLine[];
  const ids = [...new Set(lines.map((l) => l.productId).filter((x): x is number => typeof x === "number"))];
  if (ids.length === 0) return [];

  const products = await getProductsByIds(ids);
  const byId = new Map(products.map((p) => [p.id, p]));

  const out: CartItem[] = [];
  for (const line of lines) {
    const product = typeof line.productId === "number" ? byId.get(line.productId) : undefined;
    if (!product) continue;
    const stock = Math.floor(product.qty_available);
    if (stock <= 0) continue;
    const wanted = Math.max(1, Math.floor(Number(line.quantity) || 1));
    out.push({
      productId: product.id,
      name: product.name,
      price: product.list_price,
      image: product.image_128,
      quantity: Math.min(wanted, stock),
      maxStock: stock,
      categoryId: product.categ_id ? product.categ_id[0] : undefined,
    });
  }
  return out;
}
