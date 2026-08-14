import { getStoreSettingsRow } from "@/lib/settings";
import { getMailSender } from "@/lib/mailer";
import { buildMailHtml } from "@/lib/mailTemplate";

// Mail "Recibimos tu pedido" que se le manda al cliente al confirmar la compra.
// Fire and forget desde la ruta de pedidos: nunca tira ni frena la venta.

const PAYMENT_NOTE: Record<string, string> = {
  transferencia:
    "Recibimos tu pedido y tu comprobante. Estamos verificando el pago; si surge algún inconveniente nos comunicamos con vos. Si está todo bien, coordinamos la entrega.",
  contra_entrega: "Vas a abonar al momento de recibir el pedido.",
  mercadopago: "Tu pago con Mercado Pago fue registrado.",
};

function money(value: number): string {
  return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export type OrderConfirmationEmail = {
  orderId: string;
  to: string;
  customerName: string;
  items: { name: string; quantity: number }[];
  subtotal: number;
  discountTotal: number;
  shippingName: string;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  shippingAddress?: string | null;
};

export async function sendOrderConfirmation(order: OrderConfirmationEmail): Promise<void> {
  const sender = await getMailSender();
  if (!sender) return; // sin proveedor de mail configurado → no se manda

  const settings = await getStoreSettingsRow();
  const shortId = order.orderId.slice(0, 8);
  const firstName = order.customerName.split(" ")[0] || order.customerName;

  // El cuerpo va como texto (la plantilla parte por líneas/párrafos). Armamos
  // el resumen del pedido línea por línea.
  const detail = order.items.map((i) => `${i.quantity}x ${i.name}`).join("\n");
  const totals: string[] = [`Subtotal: ${money(order.subtotal)}`];
  if (order.discountTotal > 0) totals.push(`Descuento: -${money(order.discountTotal)}`);
  totals.push(`Envío (${order.shippingName}): ${order.shippingCost > 0 ? money(order.shippingCost) : "sin cargo"}`);
  totals.push(`Total: ${money(order.total)}`);

  const paragraphs = [
    `¡Gracias por tu compra, ${firstName}! Recibimos tu pedido #${shortId} y ya lo estamos preparando.`,
    `Detalle del pedido:\n${detail}`,
    totals.join("\n"),
  ];
  if (order.shippingAddress) paragraphs.push(`Envío a: ${order.shippingAddress}`);
  const note = PAYMENT_NOTE[order.paymentMethod];
  if (note) paragraphs.push(note);
  paragraphs.push("Cualquier duda, respondé este mail o escribinos. ¡Gracias por elegirnos!");

  const html = buildMailHtml({
    logoUrl: `${process.env.NEXTAUTH_URL ?? ""}/logo.png`,
    franchiseName: settings.franchiseName || "ModaShop",
    franchiseLocation: settings.franchiseLocation,
    subject: `Recibimos tu pedido #${shortId}`,
    title: `¡Gracias por tu compra, ${firstName}!`,
    body: paragraphs.join("\n\n"),
    footer: {
      address: settings.address,
      whatsappNumber: settings.whatsappPhone,
      instagramHandle: settings.instagramHandle,
      contactEmail: settings.mailFromEmail,
    },
  });

  const result = await sender.send(order.to, `Recibimos tu pedido #${shortId}`, html);
  if (!result.ok) console.error("sendOrderConfirmation: no se pudo enviar —", result.error);
}
