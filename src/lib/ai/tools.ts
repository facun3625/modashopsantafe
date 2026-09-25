import { prisma } from "@/lib/prisma";
import { getAllCategories } from "@/lib/categories";
import { searchProductsForAssistant } from "@/lib/products";
import { getAllShippingMethods } from "@/lib/shipping";
import { optionalNumber, optionalText, safeToolArgs } from "@/lib/ai/validation";
import type { AssistantProduct } from "@/lib/ai/types";
import { getHumanSellerAvailability } from "@/lib/ai/availability";
import { WHATSAPP_NUMBER } from "@/lib/contact";

export type AssistantToolName = "search_products" | "list_categories" | "get_store_options";

export type AssistantToolDefinition = {
  name: AssistantToolName;
  description: string;
  parameters: Record<string, unknown>;
};

export const ASSISTANT_TOOLS: AssistantToolDefinition[] = [
  {
    name: "search_products",
    description:
      "Busca productos vendibles en el catálogo real de Odoo. Usala antes de recomendar o afirmar precio y stock.",
    parameters: {
      type: "object",
      properties: {
        query: { type: ["string", "null"], description: "Palabras presentes en el nombre del producto." },
        category_id: { type: ["integer", "null"], description: "ID de categoría obtenido con list_categories." },
        min_price: { type: ["number", "null"], description: "Precio mínimo en pesos argentinos." },
        max_price: { type: ["number", "null"], description: "Precio máximo en pesos argentinos." },
        in_stock_only: { type: "boolean", description: "Usar true salvo que el cliente pregunte por productos agotados." },
      },
      required: ["query", "category_id", "min_price", "max_price", "in_stock_only"],
      additionalProperties: false,
    },
  },
  {
    name: "list_categories",
    description: "Lista categorías reales de Odoo para orientar una búsqueda de productos.",
    parameters: {
      type: "object",
      properties: {
        query: { type: ["string", "null"], description: "Texto opcional para filtrar categorías por nombre." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_store_options",
    description: "Consulta medios de pago habilitados, descuentos generales y métodos de envío vigentes.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];

const PAYMENT_LABELS: Record<string, string> = {
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia bancaria",
  contra_entrega: "Contra entrega",
  payway: "Tarjeta de crédito o débito",
};

function productDto(product: Awaited<ReturnType<typeof searchProductsForAssistant>>[number]): AssistantProduct {
  const categoryId = product.categ_id ? product.categ_id[0] : undefined;
  const categoryName = product.categ_id ? product.categ_id[1].split(" / ").pop() : undefined;
  return {
    id: product.id,
    name: product.name,
    price: product.list_price,
    available: product.qty_available,
    categoryId,
    categoryName,
    image: product.image_128,
    href: `/tienda?q=${encodeURIComponent(product.name)}`,
  };
}

export async function executeAssistantTool(
  name: string,
  rawArgs: unknown,
): Promise<{ output: string; products?: AssistantProduct[] }> {
  const args = safeToolArgs(rawArgs);

  if (name === "search_products") {
    const products = (
      await searchProductsForAssistant({
        query: optionalText(args.query, 80),
        categoryId: optionalNumber(args.category_id, 1),
        minPrice: optionalNumber(args.min_price),
        maxPrice: optionalNumber(args.max_price),
        inStockOnly: args.in_stock_only !== false,
        limit: 6,
      })
    ).map(productDto);
    return {
      products,
      output: JSON.stringify({
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          available: product.available,
          categoryId: product.categoryId,
          categoryName: product.categoryName,
        })),
        count: products.length,
      }),
    };
  }

  if (name === "list_categories") {
    const query = optionalText(args.query, 80)?.toLocaleLowerCase("es") ?? "";
    const categories = (await getAllCategories())
      .filter((category) => !query || category.name.toLocaleLowerCase("es").includes(query))
      .slice(0, 40)
      .map((category) => ({ id: category.id, name: category.name }));
    return { output: JSON.stringify({ categories }) };
  }

  if (name === "get_store_options") {
    const [payments, shipping, settings] = await Promise.all([
      prisma.paymentMethodConfig.findMany({
        where: { enabled: true },
        select: { method: true, discountPct: true },
      }),
      getAllShippingMethods(),
      prisma.storeSettings.findUnique({ where: { id: "global" } }),
    ]);
    const humanSupport = getHumanSellerAvailability({
      aiHumanHandoffEnabled: settings?.aiHumanHandoffEnabled ?? true,
      aiHumanDays: settings?.aiHumanDays ?? [1, 2, 3, 4, 5, 6],
      aiHumanStartTime: settings?.aiHumanStartTime ?? "09:00",
      aiHumanEndTime: settings?.aiHumanEndTime ?? "18:00",
      whatsappPhone: settings?.whatsappPhone || WHATSAPP_NUMBER,
    });
    return {
      output: JSON.stringify({
        paymentMethods: payments.map((payment) => ({
          name: PAYMENT_LABELS[payment.method] ?? payment.method,
          generalDiscountPct: payment.discountPct,
        })),
        shippingMethods: shipping
          .filter((method) => method.enabled)
          .map((method) => ({ name: method.name, cost: method.cost, description: method.description })),
        humanSupport: {
          available: humanSupport.available,
          schedule: humanSupport.scheduleText,
        },
      }),
    };
  }

  return { output: JSON.stringify({ error: "Herramienta desconocida" }) };
}
