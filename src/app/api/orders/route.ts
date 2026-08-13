import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeKw } from "@/lib/odoo";
import { checkStock } from "@/lib/products";
import { getShippingMethodsForPayment } from "@/lib/shipping";
import { validateCoupon, registerCouponUse } from "@/lib/coupons";
import { notifyNewOrder } from "@/lib/telegram";
import { sendOrderConfirmation } from "@/lib/orderEmails";

// Esta instancia de Odoo no tiene el módulo de Ventas instalado (sale.order
// no existe), pero sí tiene Inventario. El pedido en sí queda registrado acá
// (Prisma es la única fuente de verdad de las ventas online). El stock NO se
// descuenta acá: se crea un stock.picking reservado (sin validar) para que
// quede en la cola de "Transferencias por hacer" de Odoo — el equipo lo
// valida al empaquetar/despachar, igual que ya hacen con cualquier pedido, y
// recién ahí baja qty_available. Decisión tomada explícitamente así (no
// auto-validar) para no perder ese hábito ni la cola de pendientes.
//
// El tipo de operación de salida y las ubicaciones NO van hardcodeados: cada
// franquicia tiene su propio Odoo con IDs distintos, así que se detectan solos
// (ver getOutgoingPickingConfig).

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "comprobantes");

type CartItem = { productId: number; quantity: number; price: number; name: string };

type Customer = {
  name: string;
  email: string;
  phone?: string;
  street?: string;
  city?: string;
};

// Esta ruta es para los métodos "instantáneos" (transferencia, contra
// entrega): el pedido se crea al toque, en estado "pending" (pago sin
// confirmar), y alguien del equipo lo confirma a mano desde el admin cuando
// llega la plata. Mercado Pago va a usar un flujo aparte (vía webhook) que
// recién crea el pedido cuando el pago ya está aprobado.
const DIRECT_PAYMENT_METHODS = ["transferencia", "contra_entrega"] as const;
type DirectPaymentMethod = (typeof DIRECT_PAYMENT_METHODS)[number];

function isDirectPaymentMethod(value: unknown): value is DirectPaymentMethod {
  return typeof value === "string" && (DIRECT_PAYMENT_METHODS as readonly string[]).includes(value);
}

async function findOrCreatePartner(customer: Customer): Promise<number> {
  const existing = await executeKw<number[]>("res.partner", "search", [
    [["email", "=", customer.email]],
  ], { limit: 1 });

  if (existing.length > 0) return existing[0];

  const partnerId = await executeKw<number>("res.partner", "create", [
    {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      street: customer.street,
      city: customer.city,
    },
  ]);
  return partnerId;
}

async function resolveVariantId(templateId: number): Promise<number> {
  const templates = await executeKw<{ id: number; product_variant_id: [number, string] }[]>(
    "product.template",
    "read",
    [[templateId]],
    { fields: ["product_variant_id"] }
  );
  if (templates.length === 0) throw new Error(`Product ${templateId} not found`);
  return templates[0].product_variant_id[0];
}

// Crea un stock.picking (salida) con un move por línea, lo confirma y lo
// reserva (action_assign). Queda en estado "Listo"/"Confirmado" en la cola de
// Inventario → Transferencias, a la espera de que el equipo lo valide cuando
// empaquete/despache — ese paso (fuera de esta app) es el que baja el stock.
// Busca en el Odoo de esta franquicia el tipo de operación de salida (código
// "outgoing" = entregas a cliente) y sus ubicaciones por defecto, en vez de
// depender de IDs fijos que cambian entre instancias. Con fallback: si el tipo
// no trae ubicaciones cargadas, busca una interna (origen) y una de cliente
// (destino).
async function resolveLocationByUsage(usage: "internal" | "customer"): Promise<number> {
  const locs = await executeKw<{ id: number }[]>(
    "stock.location",
    "search_read",
    [[["usage", "=", usage]]],
    { fields: ["id"], limit: 1 }
  );
  if (locs.length === 0) throw new Error(`No se encontró una ubicación de tipo "${usage}" en Odoo`);
  return locs[0].id;
}

async function getOutgoingPickingConfig(): Promise<{ typeId: number; srcId: number; destId: number }> {
  const types = await executeKw<
    { id: number; default_location_src_id: [number, string] | false; default_location_dest_id: [number, string] | false }[]
  >("stock.picking.type", "search_read", [[["code", "=", "outgoing"]]], {
    fields: ["default_location_src_id", "default_location_dest_id"],
    limit: 1,
  });
  if (types.length === 0) throw new Error("No se encontró un tipo de operación de salida (entregas) en Odoo");

  const t = types[0];
  const srcId = t.default_location_src_id ? t.default_location_src_id[0] : await resolveLocationByUsage("internal");
  const destId = t.default_location_dest_id ? t.default_location_dest_id[0] : await resolveLocationByUsage("customer");
  return { typeId: t.id, srcId, destId };
}

async function createPicking(
  partnerId: number,
  items: { variantId: number; name: string; quantity: number }[],
  origin: string
): Promise<number> {
  const { typeId, srcId, destId } = await getOutgoingPickingConfig();

  const pickingId = await executeKw<number>("stock.picking", "create", [
    {
      picking_type_id: typeId,
      location_id: srcId,
      location_dest_id: destId,
      partner_id: partnerId,
      // "Documento origen" del picking — deja la referencia al pedido de la
      // web para poder cruzarlo con /admin/ventas desde Odoo.
      origin,
      // Las ubicaciones también van explícitas en cada línea: en algunos Odoo
      // no se heredan solas del picking y el movimiento queda sin origen.
      move_ids_without_package: items.map((item) => [
        0,
        0,
        {
          name: item.name,
          product_id: item.variantId,
          product_uom_qty: item.quantity,
          location_id: srcId,
          location_dest_id: destId,
        },
      ]),
    },
  ]);

  await executeKw("stock.picking", "action_confirm", [[pickingId]]);
  await executeKw("stock.picking", "action_assign", [[pickingId]]);

  return pickingId;
}

async function saveComprobante(file: File): Promise<string> {
  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);
  return `/uploads/comprobantes/${filename}`;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const items = JSON.parse(String(form.get("items") ?? "[]")) as CartItem[];
  const customer = JSON.parse(String(form.get("customer") ?? "{}")) as Customer;
  const paymentMethod = form.get("paymentMethod");
  const comprobante = form.get("comprobante");
  const shippingMethodId = form.get("shippingMethodId");
  const shippingAddress = form.get("shippingAddress");
  const couponCode = form.get("couponCode");

  if (!items?.length) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  if (!customer?.email || !customer?.name || !customer?.phone) {
    return NextResponse.json({ error: "Nombre, email y teléfono son requeridos" }, { status: 400 });
  }
  if (!isDirectPaymentMethod(paymentMethod)) {
    return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
  }
  if (paymentMethod === "transferencia" && !(comprobante instanceof File)) {
    return NextResponse.json({ error: "Adjuntá el comprobante de la transferencia" }, { status: 400 });
  }

  try {
    const config = await prisma.paymentMethodConfig.findUnique({ where: { method: paymentMethod } });
    if (!config?.enabled) {
      return NextResponse.json({ error: "Ese método de pago no está disponible" }, { status: 400 });
    }

    // Re-validado en el server: el envío elegido tiene que estar entre los
    // permitidos para este medio de pago (no confiamos solo en el filtro
    // que ya hizo el checkout del lado del cliente).
    const validShipping = await getShippingMethodsForPayment(config.id);
    const shipping = validShipping.find((s) => s.id === shippingMethodId);
    if (!shipping) {
      return NextResponse.json({ error: "Método de envío inválido para este medio de pago" }, { status: 400 });
    }
    if (shipping.requiresAddress && !shippingAddress) {
      return NextResponse.json({ error: "Falta la dirección de envío" }, { status: 400 });
    }

    const stock = await checkStock(items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
    if (!stock.ok) {
      return NextResponse.json(
        { error: "No hay stock suficiente para algunos productos", shortages: stock.shortages },
        { status: 409 }
      );
    }

    const session = await auth();
    let partnerId: number;

    if (session?.user?.id) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (user?.odooPartnerId) {
        partnerId = user.odooPartnerId;
      } else {
        partnerId = await findOrCreatePartner(customer);
        if (user) {
          await prisma.user.update({ where: { id: user.id }, data: { odooPartnerId: partnerId } });
        }
      }
    } else {
      partnerId = await findOrCreatePartner(customer);
    }

    const resolvedItems = await Promise.all(
      items.map(async (item) => ({
        ...item,
        variantId: await resolveVariantId(item.productId),
      }))
    );

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Revalidado en el server (no confiamos en el descuento que ya mostró el
    // checkout): si el código dejó de ser válido (venció, se agotó, etc.)
    // entre que el cliente lo aplicó y confirmó el pedido, se ignora sin
    // bloquear la compra.
    let couponId: string | undefined;
    let couponDiscount = 0;
    if (typeof couponCode === "string" && couponCode) {
      const couponResult = await validateCoupon(couponCode, {
        subtotal,
        paymentMethod,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        userId: session?.user?.id,
      });
      if (couponResult.ok) {
        couponId = couponResult.couponId;
        couponDiscount = couponResult.discountAmount;
      }
    }

    const total = Math.max(0, subtotal * (1 - config.discountPct / 100) - couponDiscount) + shipping.cost;

    const transferProofUrl =
      paymentMethod === "transferencia" && comprobante instanceof File ? await saveComprobante(comprobante) : undefined;

    // status queda en "pending" (default del schema): el pago todavía no
    // está confirmado para transferencia/contra-entrega, alguien del equipo
    // lo confirma a mano desde el admin cuando llega la plata.
    const order = await prisma.order.create({
      data: {
        userId: session?.user?.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        subtotal,
        total,
        paymentMethod,
        transferProofUrl,
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
    });

    if (couponId) await registerCouponUse(couponId);

    // Aviso al equipo por Telegram (si está configurado). Fire and forget: no
    // lo esperamos para no demorarle la respuesta al cliente, y si falla no
    // rompe la venta (ya está guardada).
    void notifyNewOrder({
      orderId: order.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      paymentMethod,
      total,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
      shippingName: shipping.name,
      shippingAddress: shipping.requiresAddress ? String(shippingAddress) : null,
    });

    // Mail de confirmación al cliente (según el proveedor configurado, SMTP o
    // Resend). También fire and forget.
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
      paymentMethod,
      shippingAddress: shipping.requiresAddress ? String(shippingAddress) : null,
    });

    try {
      const pickingId = await createPicking(partnerId, resolvedItems, `Web #${order.id.slice(0, 8)}`);
      await prisma.order.update({ where: { id: order.id }, data: { odooPickingId: pickingId } });
      return NextResponse.json({ orderId: order.id, partnerId, pickingId }, { status: 201 });
    } catch (odooErr) {
      // El pedido ya quedó guardado (fuente de verdad); si falla la reserva
      // de stock en Odoo, queda sin odooPickingId para resolver a mano en
      // vez de perder el registro de la venta.
      console.error("stock.picking failed for order", order.id, odooErr);
      return NextResponse.json(
        { orderId: order.id, partnerId, warning: "No se pudo reservar el stock en Odoo" },
        { status: 201 }
      );
    }
  } catch (err) {
    console.error("POST /api/orders failed", err);
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 502 });
  }
}
