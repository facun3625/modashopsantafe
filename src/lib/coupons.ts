import { prisma } from "@/lib/prisma";
import { executeKw } from "@/lib/odoo";
import { getAllCategories } from "@/lib/categories";

type ValidateOpts = {
  subtotal: number;
  paymentMethod?: string;
  items: { productId: number; quantity: number }[];
  userId?: string;
};

type ValidateResult =
  | { ok: true; couponId: string; discountAmount: number }
  | { ok: false; error: string };

async function anyItemInCategory(items: { productId: number }[], categoryId: number): Promise<boolean> {
  const products = await executeKw<{ id: number; categ_id: [number, string] | false }[]>(
    "product.template",
    "read",
    [items.map((i) => i.productId)],
    { fields: ["categ_id"] }
  );
  const categories = await getAllCategories();
  const byId = new Map(categories.map((c) => [c.id, c]));

  function chainIncludesTarget(startId: number): boolean {
    let current = byId.get(startId);
    while (current) {
      if (current.id === categoryId) return true;
      current = current.parent_id ? byId.get(current.parent_id[0]) : undefined;
    }
    return false;
  }

  return products.some((p) => p.categ_id && chainIncludesTarget(p.categ_id[0]));
}

// Valida un código de cupón contra el carrito/medio de pago actual. No
// registra el uso (eso pasa en /api/orders recién cuando el pedido se crea
// de verdad) — esto es lo que usa tanto el preview del checkout como la
// revalidación server-side final.
export async function validateCoupon(code: string, opts: ValidateOpts): Promise<ValidateResult> {
  const coupon = await prisma.coupon.findFirst({
    where: { code: { equals: code.trim(), mode: "insensitive" } },
  });

  if (!coupon || !coupon.enabled) {
    return { ok: false, error: "Cupón inválido" };
  }
  // Cupones generados por un canje de puntos quedan atados a ese usuario.
  if (coupon.userId && coupon.userId !== opts.userId) {
    return { ok: false, error: "Este cupón no te pertenece" };
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return { ok: false, error: "Este cupón venció" };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: "Este cupón ya alcanzó el límite de usos" };
  }
  if (coupon.paymentMethod && coupon.paymentMethod !== opts.paymentMethod) {
    return { ok: false, error: "Este cupón no aplica con el medio de pago elegido" };
  }
  if (coupon.minPurchaseAmount && opts.subtotal < coupon.minPurchaseAmount) {
    return { ok: false, error: `Este cupón requiere una compra mínima de $${coupon.minPurchaseAmount.toFixed(2)}` };
  }
  if (coupon.productId && !opts.items.some((i) => i.productId === coupon.productId)) {
    return { ok: false, error: "Este cupón no aplica a los productos del carrito" };
  }
  if (coupon.categoryId && !(await anyItemInCategory(opts.items, coupon.categoryId))) {
    return { ok: false, error: "Este cupón no aplica a los productos del carrito" };
  }

  const discountAmount =
    coupon.discountType === "percentage"
      ? opts.subtotal * (coupon.discountValue / 100)
      : Math.min(coupon.discountValue, opts.subtotal);

  return { ok: true, couponId: coupon.id, discountAmount };
}

export async function registerCouponUse(couponId: string) {
  const coupon = await prisma.coupon.update({
    where: { id: couponId },
    data: { usedCount: { increment: 1 } },
  });

  // Los cupones de canje de puntos (código "CANJE-...") son de un solo uso:
  // se autodesactivan apenas se usan una vez, en vez de depender de un
  // usageLimit que nunca se les carga.
  if (coupon.code.startsWith("CANJE-")) {
    await prisma.coupon.update({ where: { id: couponId }, data: { enabled: false } });
  }
}
