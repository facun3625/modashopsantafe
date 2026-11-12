import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMercadoPagoPayment } from "@/lib/mercadopago";
import { registerCouponUse } from "@/lib/coupons";
import { notifyNewOrder } from "@/lib/telegram";
import { sendOrderConfirmation } from "@/lib/orderEmails";
import { createPickingForOrder } from "@/lib/odooPicking";

// Mercado Pago avisa acá cuando un pago de Checkout Pro cambia de estado.
// Nunca se confía en lo que manda el aviso en sí (ni el estado, ni a quién
// pertenece) — solo sirve para saber QUÉ pago mirar. El pago real se vuelve
// a pedir con nuestro access token: si no es nuestro, Mercado Pago devuelve
// 404 solo. Esa es la verificación, no hace falta validar firma aparte.
export async function POST(req: NextRequest) {
  const paymentId = req.nextUrl.searchParams.get("data.id")
    ?? req.nextUrl.searchParams.get("id")
    ?? (await readBodyPaymentId(req));
  const type = req.nextUrl.searchParams.get("type") ?? req.nextUrl.searchParams.get("topic");

  // merchant_order, chargebacks, etc. — por ahora solo nos importan pagos.
  if (type && type !== "payment") return NextResponse.json({ ok: true });
  if (!paymentId) return NextResponse.json({ ok: true });

  const config = await prisma.paymentMethodConfig.findUnique({ where: { method: "mercadopago" } });
  if (!config?.mpAccessToken) return NextResponse.json({ ok: true });

  const payment = await getMercadoPagoPayment(config.mpAccessToken, paymentId);
  if (!payment?.externalReference) return NextResponse.json({ ok: true });

  const orderId = payment.externalReference;

  try {
    if (payment.status === "approved") {
      await confirmOrder(orderId, payment.id);
    } else if (payment.status === "rejected" || payment.status === "cancelled") {
      await cancelOrder(orderId, payment.id);
    }
    // pending / in_process / authorized: todavía no hay nada que resolver, se espera el próximo aviso.
  } catch (err) {
    console.error("mercadopago webhook: fallo procesando pago", payment.id, "pedido", orderId, err);
    return NextResponse.json({ error: "No se pudo procesar el aviso" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function readBodyPaymentId(req: NextRequest): Promise<string | null> {
  try {
    const body = await req.clone().json();
    const id = body?.data?.id;
    return typeof id === "string" || typeof id === "number" ? String(id) : null;
  } catch {
    return null;
  }
}

// Confirma el pedido y dispara todo lo que antes pasaba en la misma request
// síncrona del checkout (puntos vía cupón, aviso por Telegram, mail de
// confirmación, picking en Odoo). El `where: { status: "pending" }` es la
// guarda de idempotencia: si Mercado Pago reenvía el mismo aviso (lo hace
// seguido), la segunda vuelta no encuentra el pedido en "pending" y no repite nada.
async function confirmOrder(orderId: string, paymentId: number): Promise<void> {
  let order;
  try {
    order = await prisma.order.update({
      where: { id: orderId, status: "pending" },
      data: { status: "confirmed", mercadopagoPaymentId: paymentId },
      include: { items: true, shippingMethod: true },
    });
  } catch {
    return; // ya estaba confirmado (o cancelado) — aviso duplicado o tardío
  }

  if (order.couponId) {
    try { await registerCouponUse(order.couponId); }
    catch (err) { console.error("mercadopago webhook: no se pudo registrar el cupón", order.id, err); }
  }

  void notifyNewOrder({
    orderId: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    paymentMethod: "mercadopago",
    total: order.total,
    items: order.items.map((i) => ({ name: i.name, quantity: i.quantity })),
    shippingName: order.shippingMethod?.name ?? null,
    shippingAddress: order.shippingAddress,
  }).catch((err) => console.error("mercadopago webhook: aviso por Telegram falló", order.id, err));

  void sendOrderConfirmation({
    orderId: order.id,
    to: order.customerEmail,
    customerName: order.customerName,
    items: order.items.map((i) => ({ name: i.name, quantity: i.quantity })),
    subtotal: order.subtotal,
    discountTotal: order.couponDiscount + order.paymentMethodDiscount,
    shippingName: order.shippingMethod?.name ?? "",
    shippingCost: order.shippingCost,
    total: order.total,
    paymentMethod: "mercadopago",
    shippingAddress: order.shippingAddress,
    userId: order.userId,
  }).catch((err) => console.error("mercadopago webhook: mail de confirmación falló", order.id, err));

  // El pago ya está confirmado → genera la orden en Odoo al toque. Si Odoo
  // falla, el pedido queda confirmado igual (no se cae la venta por eso).
  try {
    await createPickingForOrder(order.id);
  } catch (err) {
    console.error("mercadopago webhook: createPickingForOrder falló", order.id, err);
  }
}

// Pago rechazado o cancelado del lado de Mercado Pago: libera la reserva de
// stock (vía el cambio de status, no hay tabla de reservas que tocar aparte).
async function cancelOrder(orderId: string, paymentId: number): Promise<void> {
  try {
    await prisma.order.update({
      where: { id: orderId, status: "pending" },
      data: { status: "cancelled", mercadopagoPaymentId: paymentId },
    });
  } catch {
    // ya no estaba pendiente — nada que hacer
  }
}
