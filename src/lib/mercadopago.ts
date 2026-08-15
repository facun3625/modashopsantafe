// Cliente de la API de Mercado Pago (Payments API clásica, POST /v1/payments
// — sigue vigente y tipada en el SDK oficial actual, no está deprecada a
// favor de la Orders API más nueva). El cobro es SÍNCRONO, igual que Payway:
// se manda el token que generó el cliente (mp.createCardToken) y la
// respuesta ya trae "approved"/"rejected" al toque.
//
// Confirmado leyendo el código fuente real del SDK oficial (mercadopago@3.4.0
// y el JS de sdk.mercadopago.com/js/v2), no solo documentación:
// - No hace falta distinguir sandbox/producción por URL — es siempre
//   api.mercadopago.com; lo que cambia es si las credenciales son de prueba
//   (empiezan con "TEST-") o reales, eso lo resuelve Mercado Pago solo.
// - El monto va en la moneda normal (pesos con centavos), NO en centavos
//   como Payway — ojo con esto, es la diferencia más peligrosa entre los dos.
// - No exige un bloque de antifraude tipo Cybersource para cobrar.
const API_BASE_URL = "https://api.mercadopago.com";

export type MercadoPagoIdentification = { type: string; number: string };

// `error` es SIEMPRE genérico y seguro para el cliente. `detail` es el
// motivo técnico real, solo para el log del server — mismo criterio que
// Payway: un motivo de rechazo específico le sirve a un atacante para
// probar tarjetas robadas una por una.
export type MercadoPagoPaymentResult =
  | { ok: true; id: number; status: string }
  | { ok: false; error: string; detail: string };

const GENERIC_DECLINE_MESSAGE = "El pago fue rechazado. Probá con otra tarjeta o con otro medio de pago.";
const GENERIC_SYSTEM_ERROR_MESSAGE = "No se pudo procesar el pago. Probá de nuevo en un momento.";

type CreateMercadoPagoPaymentArgs = {
  accessToken: string;
  token: string; // token generado por mp.createCardToken en el cliente
  paymentMethodId: string; // ej. "visa", "master" — viene de mp.getPaymentMethods({bin})
  issuerId?: string;
  installments: number;
  amount: number; // en pesos, con centavos — NO se multiplica por 100 acá
  description: string;
  customerEmail: string;
  identification: MercadoPagoIdentification;
  externalReference: string; // id del pedido, para conciliar
};

export async function createMercadoPagoPayment(
  args: CreateMercadoPagoPaymentArgs
): Promise<MercadoPagoPaymentResult> {
  const url = `${API_BASE_URL}/v1/payments`;

  const body = {
    transaction_amount: Math.round(args.amount * 100) / 100,
    token: args.token,
    description: args.description.slice(0, 250),
    installments: args.installments,
    payment_method_id: args.paymentMethodId,
    issuer_id: args.issuerId,
    payer: {
      email: args.customerEmail,
      identification: args.identification,
    },
    external_reference: args.externalReference,
    // binary_mode: la respuesta siempre resuelve aprobado/rechazado al toque,
    // nunca queda un pedido en limbo en estado "pendiente de revisión".
    binary_mode: true,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.accessToken}`,
        "X-Idempotency-Key": args.externalReference,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (typeof data?.status === "string") {
      if (data.status !== "approved") {
        return {
          ok: false,
          error: GENERIC_DECLINE_MESSAGE,
          detail: `Pago ${data.status} (${data.status_detail ?? "sin detalle"})`,
        };
      }
      return { ok: true, id: data.id, status: data.status };
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

// Reembolso total — red de seguridad si el cobro se aprobó pero después no
// se pudo confirmar el pedido (mismo caso que en Payway: se quedó sin stock
// en el candado de reserva justo en ese instante).
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
