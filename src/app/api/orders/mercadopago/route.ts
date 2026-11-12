import { createHash } from "node:crypto";
import { getCheckoutItems } from "@/lib/checkout";
import { InvalidCheckoutError } from "@/lib/checkoutItems";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkStock } from "@/lib/products";
import { createOrderWithStockGuard, InsufficientStockError, saveUserPhone } from "@/lib/reservations";
import { getShippingMethodsForPayment } from "@/lib/shipping";
import { validateCoupon } from "@/lib/coupons";
import { calculatePaymentMethodDiscount } from "@/lib/paymentMethodDiscount";
import { resolvePartnerId, type OrderCustomer } from "@/lib/orders";
import { createMercadoPagoPreference } from "@/lib/mercadopago";
import { auth } from "@/lib/auth";

// El pedido y su reserva de stock se guardan antes de mandar al cliente a
// pagar — es lo único que pasa en esta request. Checkout Pro es asíncrono:
// la confirmación (puntos, mail, picking en Odoo) llega después, por el
// webhook (ver ./webhook/route.ts) cuando Mercado Pago avisa que se aprobó.

type MercadoPagoOrderBody = {
  checkoutId?: string;
  items: unknown;
  customer: OrderCustomer;
  shippingMethodId?: string;
  shippingAddress?: string;
  couponCode?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as MercadoPagoOrderBody | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const { items: rawItems, customer, shippingMethodId, shippingAddress, couponCode } = body;

  if (!Array.isArray(rawItems) || !rawItems.length) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  if (!customer?.email || !customer?.name || !customer?.phone) {
    return NextResponse.json({ error: "Nombre, email y teléfono son requeridos" }, { status: 400 });
  }
  if (typeof body.checkoutId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.checkoutId)) {
    return NextResponse.json({ error: "Identificador de compra inválido" }, { status: 400 });
  }
  const orderId = createHash("sha256").update("checkout:" + body.checkoutId).digest("hex").slice(0, 36);
  const reviewResponse = () => NextResponse.json({
    orderId,
    requiresReview: true,
    error: `El pedido #${orderId.slice(0, 8)} ya está en curso. Contactá a la tienda antes de volver a intentar.`,
  }, { status: 409 });
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const notificationUrl = `${base}/api/orders/mercadopago/webhook`;
  const backUrl = (orderIdForUrl: string) => `${base}/carrito/gracias?id=${orderIdForUrl}`;

  try {
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (existing) {
      if (existing.status === "cancelled") {
        return NextResponse.json({ resetAttempt: true, error: "Este intento fue cancelado. Podés iniciar otra compra." }, { status: 400 });
      }
      if (existing.status === "confirmed" || existing.status === "delivered") {
        return NextResponse.json({ orderId: existing.id, alreadyPaid: true }, { status: 201 });
      }
      if (existing.paymentMethod !== "mercadopago") return reviewResponse();
      // Sigue pendiente: el cliente puede haber cerrado la pestaña de Mercado
      // Pago sin pagar, o la preferencia anterior falló al crearse. En vez de
      // mandarlo a "contactá a la tienda" por eso, se le arma una preferencia
      // nueva para el MISMO pedido ya reservado (no se duplica el stock).
      const config = await prisma.paymentMethodConfig.findUnique({ where: { method: "mercadopago" } });
      if (!config?.mpAccessToken) return reviewResponse();
      const retry = await createMercadoPagoPreference({
        accessToken: config.mpAccessToken,
        orderId: existing.id,
        title: `Pedido ModaShop #${existing.id.slice(0, 8)}`,
        amount: existing.total,
        customerName: existing.customerName,
        customerEmail: existing.customerEmail,
        customerPhone: existing.customerPhone ?? undefined,
        successUrl: backUrl(existing.id),
        failureUrl: backUrl(existing.id),
        pendingUrl: backUrl(existing.id),
        notificationUrl,
      });
      if (!retry.ok) return NextResponse.json({ error: retry.error }, { status: 502 });
      return NextResponse.json({ orderId: existing.id, initPoint: retry.initPoint }, { status: 201 });
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

    // Chequeo rápido antes de reservar: si ya sabemos que no hay stock, ni
    // mandamos al cliente a pagar algo que no vamos a poder entregar.
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

    let order;
    try {
      order = await createOrderWithStockGuard(
        items.map((i) => ({ productId: i.productId, quantity: i.quantity, name: i.name })),
        async (tx) => {
          await saveUserPhone(tx, session?.user?.id, customer.phone);
          return tx.order.create({
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
              paymentMethodDiscount,
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
          });
        }
      );
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json({ error: "No hay stock suficiente para algunos productos", shortages: err.shortages }, { status: 409 });
      }
      // Reintentos concurrentes pueden chocar en el id único del pedido. Solo
      // la request que lo creó puede pedirle la preferencia a Mercado Pago.
      if (await prisma.order.findUnique({ where: { id: orderId } })) return reviewResponse();
      throw err;
    }

    const preference = await createMercadoPagoPreference({
      accessToken: config.mpAccessToken,
      orderId: order.id,
      title: `Pedido ModaShop #${order.id.slice(0, 8)}`,
      amount: total,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      successUrl: backUrl(order.id),
      failureUrl: backUrl(order.id),
      pendingUrl: backUrl(order.id),
      notificationUrl,
    });

    if (!preference.ok) {
      console.error("createMercadoPagoPreference failed for", order.id, preference.detail);
      // El pedido queda pendiente con su stock reservado — el cliente puede
      // reintentar (mismo checkoutId) en vez de perder el lugar en la cola.
      return NextResponse.json({ error: preference.error }, { status: 502 });
    }

    return NextResponse.json({ orderId: order.id, initPoint: preference.initPoint }, { status: 201 });
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
