// Runtime validation shared by every checkout and stock guard.
export class InvalidCheckoutError extends Error {}

export type CheckoutQuantity = { productId: number; quantity: number };
export type CheckoutItem = CheckoutQuantity & { name: string; price: number };

export function normalizeCheckoutItems(input: unknown): CheckoutQuantity[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 500) {
    throw new InvalidCheckoutError("El carrito es inválido o está vacío");
  }
  const quantities = new Map<number, number>();
  for (const item of input) {
    if (!item || !Number.isInteger(item.productId) || item.productId <= 0 || item.productId > 2147483647 ||
        !Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 2147483647) {
      throw new InvalidCheckoutError("Los productos y cantidades deben ser enteros positivos");
    }
    const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
    if (quantity > 2147483647) throw new InvalidCheckoutError("Cantidad inválida");
    quantities.set(item.productId, quantity);
  }
  return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
}

export function priceCheckoutItems(
  input: unknown,
  products: { id: number; name: string; list_price: number }[],
): CheckoutItem[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  return normalizeCheckoutItems(input).map((item) => {
    const product = byId.get(item.productId);
    if (!product || !Number.isFinite(product.list_price) || product.list_price < 0) {
      throw new InvalidCheckoutError("Un producto del carrito ya no está disponible");
    }
    return { ...item, name: product.name, price: product.list_price };
  });
}
