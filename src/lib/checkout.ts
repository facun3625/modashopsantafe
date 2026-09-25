import { executeKw } from "@/lib/odoo";
import { normalizeCheckoutItems, priceCheckoutItems } from "@/lib/checkoutItems";

// Never trust prices or names supplied by the browser.
export async function getCheckoutItems(input: unknown) {
  const items = normalizeCheckoutItems(input);
  const products = await executeKw<{ id: number; name: string; list_price: number }[]>(
    "product.template", "read", [items.map((item) => item.productId)],
    { fields: ["name", "list_price"] },
  );
  return priceCheckoutItems(items, products);
}
