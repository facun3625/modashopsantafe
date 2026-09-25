import { createHash } from "node:crypto";
import { getCheckoutItems } from "@/lib/checkout";
import { InvalidCheckoutError } from "@/lib/checkoutItems";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkStock } from "@/lib/products";
import { createOrderWithStockGuard, InsufficientStockError } from "@/lib/reservations";
import { getShippingMethodsForPayment } from "@/lib/shipping";
import { validateCoupon, registerCouponUse } from "@/lib/coupons";
import { calculatePaymentMethodDiscount } from "@/lib/paymentMethodDiscount";
import { notifyNewOrder } from "@/lib/telegram";
import { sendOrderConfirmation } from "@/lib/orderEmails";
import { resolvePartnerId, type OrderCustomer } from "@/lib/orders";
import {
  createMercadoPagoPayment,
  refundMercadoPagoPayment,
  type MercadoPagoIdentification,
} from "@/lib/mercadopago";
import { createPickingForOrder } from "@/lib/odooPicking";
import { auth } from "@/lib/auth";

// El pedido y su reserva se guardan antes de cobrar. Solo una aprobación
// confirma la compra y dispara el picking de Odoo y los avisos. Un resultado
// incierto conserva el pedido pendiente para que el equipo concilie el pago.

type MercadoPagoOrderBody = {
  checkoutId?: string;
  items: unknown;
  customer: OrderCustomer;
  shippingMethodId?: string;
  shippingAddress?: string;
  couponCode?: string;
  mpToken: string;
  mpPaymentMethodId: string;
  mpIssuerId?: string;
  mpInstallments?: number;
  mpIdentification: MercadoPagoIdentification;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as MercadoPagoOrderBody | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const {
    items: rawItems,
    customer,
    shippingMethodId,
    shippingAddress,
    couponCode,
    mpToken,
    mpPaymentMethodId,
    mpIssuerId,
    mpInstallments,
    mpIdentification,
  } = body;

  if (!Array.isArray(rawItems) || !rawItems.length) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  if (!customer?.email || !customer?.name || !customer?.phone) {
    return NextResponse.json({ error: "Nombre, email y teléfono son requeridos" }, { status: 400 });
  }
  if (!mpToken || !mpPaymentMethodId) {
    return NextResponse.json({ error: "Faltan datos de la tarjeta" }, { status: 400 });
  }
  if (!mpIdentification?.number) {
    return NextResponse.json({ error: "Falta el DNI del titular" }, { status: 400 });
  }

  if (body.checkoutId !== undefined &&
      (typeof body.checkoutId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.checkoutId))) {
    return NextResponse.json({ error: "Identificador de compra inválido" }, { status: 400 });
  }
  const orderId = createHash("sha256").update("checkout:" + (body.checkoutId ?? "mercadopago:" + mpToken)).digest("hex").slice(0, 36);
  const reviewResponse = () => NextResponse.json({
    orderId,
    requiresReview: true,
    error: `El pago del pedido #${orderId.slice(0, 8)} está pendiente de verificación. Contactá a la tienda antes de volver a pagar.`,
  }, { status: 409 });

  try {
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (existing) {
      if (existing.status === "confirmed" || existing.status === "delivered") {
        return NextResponse.json({ orderId }, { status: 201 });
      }
      if (existing.status === "cancelled") {
        return NextResponse.json({ resetAttempt: true, error: "Este intento fue cancelado. Podés iniciar otra compra." }, { status: 400 });
      }
      return reviewResponse();
    }
    const items = await getCheckoutItems(rawItems);
    const config = await prisma.paymentMethodConfig.findUnique({
      where: { method: "mercadopago" },
      include: { categoryDiscounts: true },
    });
    if (!config?.enabled) {
      return NextResponse.json({ error: "Ese método de pago no está disponible" }, { status: 400 });
    }
    if (!config.mpAccessToken) {
      console.error("Mercado Pago habilitado sin access token configurado");
      return NextResponse.json({ error: "Ese método de pago no está disponible" }, { status: 400 });
    }

    const validShipping = await getShippingMethodsForPayment(config.id);
    const shipping = validShipping.find((s) => s.id === shippingMethodId);
    if (!shipping) {
      return NextResponse.json({ error: "Método de envío inválido para este medio de pago" }, { status: 400 });
    }
    if (shipping.requiresAddress && !shippingAddress) {
      return NextResponse.json({ error: "Falta la dirección de envío" }, { status: 400 });
    }

    // Chequeo rápido antes de cobrar: si ya sabemos que no hay stock, ni
    // intentamos el cobro (evita cobrarle a alguien por algo que no hay).
    const stock = await checkStock(items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
    if (!stock.ok) {
      return NextResponse.json(
        { error: "No hay stock suficiente para algunos productos", shortages: stock.shortages },
        { status: 409 }
      );
    }

    const session = await auth();

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    let couponId: string | undefined;
    let couponDiscount = 0;
    if (couponCode) {
      const couponResult = await validateCoupon(couponCode, {
        subtotal,
        paymentMethod: "mercadopago",
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        userId: session?.user?.id,
      });
      if (couponResult.ok) {
        couponId = couponResult.couponId;
        couponDiscount = couponResult.discountAmount;
      }
    }

    const paymentMethodDiscount = await calculatePaymentMethodDiscount(items, config);
    const total = Math.max(0, subtotal - paymentMethodDiscount - couponDiscount) + shipping.cost;

    const partnerId = await resolvePartnerId(session?.user?.id, customer);

    // Persist the order and reserve stock before making any charge. Its ID
    // is also the provider reference, so an uncertain payment can be reconciled.
    let order;
    try {
      order = await createOrderWithStockGuard(
        items.map((i) => ({ productId: i.productId, quantity: i.quantity, name: i.name })),
        (tx) =>
          tx.order.create({
            data: {
              id: orderId,
              userId: session?.user?.id,
              customerName: customer.name,
              customerEmail: customer.email,
              customerPhone: customer.phone,
              subtotal,
              total,
              status: "pending",
              paymentMethod: "mercadopago",
              shippingMethodId: shipping.id,
              shippingCost: shipping.cost,
              shippingAddress: shipping.requiresAddress ? String(shippingAddress) : undefined,
              couponId,
              couponDiscount,
              odooPartnerId: partnerId,
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  name: item.name,
                  price: item.price,
                  quantity: item.quantity,
                })),
              },
            },
          })
      );
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json({ error: "No hay stock suficiente para algunos productos", shortages: err.shortages }, { status: 409 });
      }
      // Concurrent retries may race on the unique order ID. Only the request
      // that created the order is allowed to call the payment provider.
      if (await prisma.order.findUnique({ where: { id: orderId } })) return reviewResponse();
      throw err;
    }

    const charge = await createMercadoPagoPayment({
      accessToken: config.mpAccessToken,
      token: mpToken,
      paymentMethodId: mpPaymentMethodId,
      issuerId: mpIssuerId,
      installments: mpInstallments && mpInstallments > 0 ? mpInstallments : 1,
      amount: total,
      description: `Pedido ModaShop — ${customer.email}`,
      customerEmail: customer.email,
      identification: mpIdentification,
      externalReference: orderId,
    });

    if (!charge.ok) {
      console.error("Payment was not approved for order", orderId, charge.detail);
      if (!charge.rejected) return reviewResponse();
      await prisma.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
      return NextResponse.json({ error: charge.error }, { status: 402 });
    }

    try {
      order = await prisma.order.update({
        where: { id: orderId, status: "pending" },
        data: { status: "confirmed", mercadopagoPaymentId: charge.id },
      });
    } catch (err) {
      const refund = await refundMercadoPagoPayment({
        accessToken: config.mpAccessToken,
        paymentId: charge.id,
      });
      console.error("Could not confirm paid order", orderId, charge.id, err);
      if (!refund.ok) {
        console.error("Refund pending for order", orderId, charge.id, refund.error);
        return reviewResponse();
      }
      await prisma.order.update({ where: { id: orderId }, data: { status: "cancelled", mercadopagoPaymentId: charge.id } });
      return NextResponse.json({ resetAttempt: true, error: "No se pudo confirmar el pedido. El cobro se reembolsó." }, { status: 409 });
    }

    if (couponId) {
      try { await registerCouponUse(couponId); }
      catch (err) { console.error("Could not register coupon for order", order.id, couponId, err); }
    }

    void notifyNewOrder({
      orderId: order.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      paymentMethod: "mercadopago",
      total,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
      shippingName: shipping.name,
      shippingAddress: shipping.requiresAddress ? String(shippingAddress) : null,
    }).catch((err) => console.error("Order notification failed", order.id, err));

    void sendOrderConfirmation({
      orderId: order.id,
      to: customer.email,
      customerName: customer.name,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
      subtotal,
      discountTotal: couponDiscount + paymentMethodDiscount,
      shippingName: shipping.name,
      shippingCost: shipping.cost,
      total,
      paymentMethod: "mercadopago",
      shippingAddress: shipping.requiresAddress ? String(shippingAddress) : null,
    }).catch((err) => console.error("Order notification failed", order.id, err));

    // El pago ya está confirmado → genera la orden en Odoo al toque (no hace
    // falta que nadie la confirme a mano). Si Odoo falla, no se cae la venta.
    try {
      await createPickingForOrder(order.id);
    } catch (err) {
      console.error("createPickingForOrder failed for", order.id, err);
    }

    return NextResponse.json({ orderId: order.id, partnerId, mercadopagoPaymentId: charge.id }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidCheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST /api/orders/mercadopago failed", err);
    try {
      const persisted = await prisma.order.findUnique({ where: { id: orderId } });
      if (persisted?.status === "pending") return reviewResponse();
    } catch { return reviewResponse(); }
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 502 });
  }
}
