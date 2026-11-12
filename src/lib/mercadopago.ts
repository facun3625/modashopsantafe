// Cliente de la API de Mercado Pago — Checkout Pro: se crea una "preferencia"
// (carrito con un link de pago) y el cliente paga en una página de Mercado
// Pago, no en un formulario propio. Ahí mismo elige entre todas las tarjetas
// y cuotas que tenga habilitadas en su cuenta — no hay que resolverlas acá.
//
// Confirmado leyendo la documentación oficial actual de Checkout Pro
// (api.mercadopago.com/checkout/preferences) y del webhook de pagos
// (api.mercadopago.com/v1/payments/{id}):
// - No hace falta distinguir sandbox/producción por URL — es siempre
//   api.mercadopago.com; lo que cambia es si las credenciales son de prueba
//   (empiezan con "TEST-") o reales, eso lo resuelve Mercado Pago solo.
// - El monto va en la moneda normal (pesos con centavos), NO en centavos.
const API_BASE_URL = "https://api.mercadopago.com";

type CreateMercadoPagoPreferenceArgs = {
  accessToken: string;
  orderId: string; // external_reference — así se concilia el webhook con el pedido
  title: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
};

export type MercadoPagoPreferenceResult =
  | { ok: true; preferenceId: string; initPoint: string }
  | { ok: false; error: string; detail: string };

const GENERIC_SYSTEM_ERROR_MESSAGE = "No se pudo iniciar el pago con Mercado Pago. Probá de nuevo en un momento.";

export async function createMercadoPagoPreference(
  args: CreateMercadoPagoPreferenceArgs
): Promise<MercadoPagoPreferenceResult> {
  const body = {
    items: [
      {
        title: args.title.slice(0, 250),
        quantity: 1,
        currency_id: "ARS",
        unit_price: Math.round(args.amount * 100) / 100,
      },
    ],
    payer: {
      name: args.customerName,
      email: args.customerEmail,
      phone: args.customerPhone ? { number: args.customerPhone } : undefined,
    },
    external_reference: args.orderId,
    back_urls: {
      success: args.successUrl,
      failure: args.failureUrl,
      pending: args.pendingUrl,
    },
    // Solo aplica a pagos aprobados — rechazados o pendientes muestran igual
    // el link de Mercado Pago para "volver al sitio", no hace falta forzarlo.
    auto_return: "approved",
    notification_url: args.notificationUrl,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.accessToken}`,
        "X-Idempotency-Key": args.orderId,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (res.ok && typeof data?.id === "string" && typeof data?.init_point === "string") {
      return { ok: true, preferenceId: data.id, initPoint: data.init_point };
    }

    const detail = data?.message || data?.cause?.[0]?.description || `Mercado Pago respondió ${res.status}`;
    return { ok: false, error: GENERIC_SYSTEM_ERROR_MESSAGE, detail: String(detail) };
  } catch (err) {
    return {
      ok: false,
      error: GENERIC_SYSTEM_ERROR_MESSAGE,
      detail: err instanceof Error ? err.message : "No se pudo conectar con Mercado Pago",
    };
  }
}

export type MercadoPagoPayment = {
  id: number;
  status: string; // "approved" | "rejected" | "pending" | "in_process" | "cancelled" | ...
  externalReference: string | null;
};

// El webhook solo manda un id — nunca hay que confiar en el resto de lo que mande, se vuelve a pedir el pago
// completo con NUESTRO access token. Si el id no es un pago real de esta cuenta, Mercado Pago devuelve 404: es
// la verificación en sí, no hace falta validar ninguna firma aparte.
export async function getMercadoPagoPayment(accessToken: string, paymentId: string | number): Promise<MercadoPagoPayment | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.id !== "number" || typeof data?.status !== "string") return null;
    return { id: data.id, status: data.status, externalReference: data.external_reference ?? null };
  } catch (err) {
    console.error("getMercadoPagoPayment failed", paymentId, err);
    return null;
  }
}

// Reembolso total — red de seguridad si el pago se aprobó pero el pedido no se pudo confirmar igual (ej. se quedó
// sin stock en el candado de reserva justo en ese instante).
export async function refundMercadoPagoPayment(args: {
  accessToken: string;
  paymentId: number;
}): Promise<{ ok: boolean; error?: string }> {
  const url = `${API_BASE_URL}/v1/payments/${args.paymentId}/refunds`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.accessToken}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.message || `Mercado Pago respondió ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo conectar con Mercado Pago" };
  }
}
