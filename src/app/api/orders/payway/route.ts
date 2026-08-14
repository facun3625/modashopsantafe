import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkStock } from "@/lib/products";
import { createOrderWithStockGuard, InsufficientStockError } from "@/lib/reservations";
import { getShippingMethodsForPayment } from "@/lib/shipping";
import { validateCoupon, registerCouponUse } from "@/lib/coupons";
import { notifyNewOrder } from "@/lib/telegram";
import { sendOrderConfirmation } from "@/lib/orderEmails";
import { resolvePartnerId, type OrderCustomer } from "@/lib/orders";
import { createPaywayPayment, refundPaywayPayment } from "@/lib/payway";
import { createPickingForOrder } from "@/lib/odooPicking";
import { auth } from "@/lib/auth";

// Pago con tarjeta vía Payway (gateway Decidir). A diferencia de
// transferencia/contra-entrega, el cobro es SÍNCRONO: el cliente ya tokenizó
// la tarjeta con decidir.js (nunca vemos el número real) y acá cobramos
// contra la API con la private key ANTES de crear el pedido. Solo si Payway
// aprueba, el pedido se crea directo en estado "confirmed" (el pago ya está
// hecho) y se genera la orden en Odoo al toque — no hace falta que nadie
// confirme nada a mano.
type CartItem = { productId: number; quantity: number; price: number; name: string };

type PaywayOrderBody = {
  items: CartItem[];
  customer: OrderCustomer;
  shippingMethodId?: string;
  shippingAddress?: string;
  couponCode?: string;
  paywayToken: string;
  paywayBin: string;
  paywayPaymentMethodId: number;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as PaywayOrderBody | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const { items, customer, shippingMethodId, shippingAddress, couponCode, paywayToken, paywayBin, paywayPaymentMethodId } =
    body;

  if (!items?.length) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  if (!customer?.email || !customer?.name || !customer?.phone) {
    return NextResponse.json({ error: "Nombre, email y teléfono son requeridos" }, { status: 400 });
  }
  if (!paywayToken || !paywayBin || !paywayPaymentMethodId) {
    return NextResponse.json({ error: "Faltan datos de la tarjeta" }, { status: 400 });
  }

  try {
    const config = await prisma.paymentMethodConfig.findUnique({ where: { method: "payway" } });
    if (!config?.enabled) {
      return NextResponse.json({ error: "Ese método de pago no está disponible" }, { status: 400 });
    }
    if (!config.paywayPrivateKey) {
      console.error("Payway habilitado sin private key configurada");
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
        paymentMethod: "payway",
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        userId: session?.user?.id,
      });
      if (couponResult.ok) {
        couponId = couponResult.couponId;
        couponDiscount = couponResult.discountAmount;
      }
    }

    const total = Math.max(0, subtotal * (1 - config.discountPct / 100) - couponDiscount) + shipping.cost;

    // Cobro síncrono contra Payway ANTES de crear el pedido.
    const charge = await createPaywayPayment({
      privateKey: config.paywayPrivateKey,
      sandbox: config.paywaySandbox,
      token: paywayToken,
      bin: paywayBin,
      paymentMethodId: paywayPaymentMethodId,
      amount: total,
      siteTransactionId: randomUUID(),
      description: `Pedido ModaShop — ${customer.email}`,
      customerEmail: customer.email,
    });

    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: 402 });
    }

    const partnerId = await resolvePartnerId(session?.user?.id, customer);

    // Pago ya aprobado → el pedido nace "confirmed" directo (candado de
    // reserva igual que las demás rutas, para no sobrevender).
    let order;
    try {
      order = await createOrderWithStockGuard(
        items.map((i) => ({ productId: i.productId, quantity: i.quantity, name: i.name })),
        (tx) =>
          tx.order.create({
            data: {
              userId: session?.user?.id,
              customerName: customer.name,
              customerEmail: customer.email,
              customerPhone: customer.phone,
              subtotal,
              total,
              status: "confirmed",
              paymentMethod: "payway",
              paywayPaymentId: charge.id,
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
      // Rarísimo (carrera de milisegundos con otra compra), pero si pasa ya
      // le cobramos al cliente — hay que devolverle la plata.
      const refund = await refundPaywayPayment({
        privateKey: config.paywayPrivateKey,
        sandbox: config.paywaySandbox,
        paymentId: charge.id,
      });
      if (!refund.ok) console.error("No se pudo reembolsar pago Payway", charge.id, refund.error);

      if (err instanceof InsufficientStockError) {
        return NextResponse.json(
          { error: "No hay stock suficiente para algunos productos — el cobro se reembolsó.", shortages: err.shortages },
          { status: 409 }
        );
      }
      throw err;
    }

    if (couponId) await registerCouponUse(couponId);

    void notifyNewOrder({
      orderId: order.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      paymentMethod: "payway",
      total,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
      shippingName: shipping.name,
      shippingAddress: shipping.requiresAddress ? String(shippingAddress) : null,
    });

    void sendOrderConfirmation({
      orderId: order.id,
      to: customer.email,
      customerName: customer.name,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
      subtotal,
      discountTotal: couponDiscount + (subtotal * config.discountPct) / 100,
      shippingName: shipping.name,
      shippingCost: shipping.cost,
      total,
      paymentMethod: "payway",
      shippingAddress: shipping.requiresAddress ? String(shippingAddress) : null,
    });

    // El pago ya está confirmado → genera la orden en Odoo al toque (no hace
    // falta que nadie la confirme a mano). Si Odoo falla, no se cae la venta.
    try {
      await createPickingForOrder(order.id);
    } catch (err) {
      console.error("createPickingForOrder failed for", order.id, err);
    }

    return NextResponse.json({ orderId: order.id, partnerId, paywayPaymentId: charge.id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/orders/payway failed", err);
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 502 });
  }
}
