import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkStock } from "@/lib/products";
import { createOrderWithStockGuard, InsufficientStockError } from "@/lib/reservations";
import { getShippingMethodsForPayment } from "@/lib/shipping";
import { validateCoupon, registerCouponUse } from "@/lib/coupons";
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

// Pago con tarjeta vía Mercado Pago. Mismo patrón que Payway: el cliente ya
// tokenizó la tarjeta en el navegador (mp.createCardToken, nunca vemos el
// número real) y acá cobramos SÍNCRONO contra la API con el access token
// ANTES de crear el pedido. Solo tarjeta — nunca efectivo: esta ruta nunca
// usa el Checkout Pro/Bricks alojado de Mercado Pago (ahí es donde vivirían
// Rapipago/Pago Fácil), así que la opción de pagar en efectivo no existe
// estructuralmente, no hace falta excluirla a mano.
type CartItem = { productId: number; quantity: number; price: number; name: string };

type MercadoPagoOrderBody = {
  items: CartItem[];
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
    items,
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

  if (!items?.length) {
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

  try {
    const config = await prisma.paymentMethodConfig.findUnique({ where: { method: "mercadopago" } });
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

    const total = Math.max(0, subtotal * (1 - config.discountPct / 100) - couponDiscount) + shipping.cost;

    // Cobro síncrono contra Mercado Pago ANTES de crear el pedido.
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
      externalReference: `${Date.now()}-${customer.email}`,
    });

    if (!charge.ok) {
      // charge.error es siempre un mensaje genérico y seguro para el cliente.
      // El motivo técnico real (charge.detail) solo va al log.
      console.error("Mercado Pago payment declined/error:", charge.detail);
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
              paymentMethod: "mercadopago",
              mercadopagoPaymentId: charge.id,
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
      const refund = await refundMercadoPagoPayment({
        accessToken: config.mpAccessToken,
        paymentId: charge.id,
      });
      if (!refund.ok) console.error("No se pudo reembolsar pago Mercado Pago", charge.id, refund.error);

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
      paymentMethod: "mercadopago",
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
      paymentMethod: "mercadopago",
      shippingAddress: shipping.requiresAddress ? String(shippingAddress) : null,
    });

    // El pago ya está confirmado → genera la orden en Odoo al toque (no hace
    // falta que nadie la confirme a mano). Si Odoo falla, no se cae la venta.
    try {
      await createPickingForOrder(order.id);
    } catch (err) {
      console.error("createPickingForOrder failed for", order.id, err);
    }

    return NextResponse.json({ orderId: order.id, partnerId, mercadopagoPaymentId: charge.id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/orders/mercadopago failed", err);
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 502 });
  }
}
