// Cliente de la API de Payway (gateway Decidir "de marca blanca" que usa
// Payway/Prisma en Argentina — https://developers.payway.com.ar/). El cobro
// es SÍNCRONO: se llama a /payments con el token que generó el cliente
// (decidir.js) y la respuesta ya trae "approved" o "rejected" al toque, sin
// necesidad de webhook.
//
// Fuente verificada contra los SDKs oficiales (payway-ar/sdk-*-ventaonline,
// que son forks de decidir/sdk-*-v2): header "apikey" con la private key,
// endpoint POST /payments, monto en centavos. La URL de producción exacta
// (live.decidir.com vs. otra que te haya dado el soporte de Payway) convdiene
// confirmarla con soporte@payway.com.ar antes de salir a producción — si te
// dieron una distinta, cambiala acá.
const SANDBOX_BASE_URL = "https://developers.decidir.com/api/v2";
const PRODUCTION_BASE_URL = "https://live.decidir.com/api/v2";

export function getPaywayBaseUrl(sandbox: boolean): string {
  return sandbox ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;
}

// Decidir necesita el ID numérico de la marca/tipo de tarjeta (no lo infiere
// del BIN de forma confiable vía API pública), tomado de la tabla oficial de
// medios de pago. Se lo pedimos al cliente con un select en vez de
// adivinarlo por los primeros dígitos, para no enrutar mal un cobro.
export const PAYWAY_CARD_BRANDS = [
  { id: 1, label: "Visa crédito" },
  { id: 31, label: "Visa débito" },
  { id: 15, label: "Mastercard crédito" },
  { id: 66, label: "Mastercard débito" },
  { id: 65, label: "American Express" },
  { id: 27, label: "Cabal" },
  { id: 24, label: "Tarjeta Naranja" },
  { id: 30, label: "Argencard" },
  { id: 8, label: "Diners" },
] as const;

export type PaywayPaymentResult =
  | { ok: true; id: number; status: string }
  | { ok: false; error: string };

type CreatePaywayPaymentArgs = {
  privateKey: string;
  sandbox: boolean;
  token: string; // token generado por decidir.js en el cliente
  paymentMethodId: number;
  bin: string; // primeros 6 dígitos de la tarjeta
  amount: number; // en la MISMA moneda que "total", se convierte acá a centavos
  siteTransactionId: string; // id único nuestro (referencia del pedido)
  description: string;
  customerEmail: string;
};

export async function createPaywayPayment(args: CreatePaywayPaymentArgs): Promise<PaywayPaymentResult> {
  const url = `${getPaywayBaseUrl(args.sandbox)}/payments`;

  const body = {
    site_transaction_id: args.siteTransactionId.slice(0, 39),
    token: args.token,
    payment_method_id: args.paymentMethodId,
    bin: args.bin,
    amount: Math.round(args.amount * 100), // Decidir espera centavos (los últimos 2 dígitos son decimales)
    currency: "ARS",
    installments: 1,
    description: args.description.slice(0, 89),
    payment_type: "single",
    sub_payments: [],
    customer: { email: args.customerEmail },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: args.privateKey },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      const message =
        data?.error_type || data?.message || data?.[0]?.message || `Payway respondió ${res.status}`;
      return { ok: false, error: String(message) };
    }

    if (data.status !== "approved") {
      const reason = data?.status_details?.error?.reason?.description || data.status_details?.ticket || data.status;
      return { ok: false, error: `Pago ${data.status}${reason ? ` (${reason})` : ""}` };
    }

    return { ok: true, id: data.id, status: data.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo conectar con Payway" };
  }
}

// Reembolso total — se usa como red de seguridad si el cobro se aprobó pero
// después no se pudo confirmar el pedido (ej. se quedó sin stock en el
// candado de reserva justo en ese instante).
export async function refundPaywayPayment(args: {
  privateKey: string;
  sandbox: boolean;
  paymentId: number;
}): Promise<{ ok: boolean; error?: string }> {
  const url = `${getPaywayBaseUrl(args.sandbox)}/payments/${args.paymentId}/refunds`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: args.privateKey },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.message || `Payway respondió ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo conectar con Payway" };
  }
}
