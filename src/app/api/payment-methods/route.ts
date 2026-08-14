import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Público: nunca expone las credenciales de Mercado Pago ni la private key de
// Payway. CBU/alias/titular de transferencia sí, porque el checkout los
// necesita mostrarle al cliente para que sepa a dónde transferir. La public
// key de Payway también se expone a propósito: es justamente la que usa
// decidir.js en el navegador para tokenizar la tarjeta (no es secreta).
export async function GET() {
  const configs = await prisma.paymentMethodConfig.findMany({
    where: { enabled: true },
    select: {
      method: true,
      discountPct: true,
      bankCbu: true,
      bankAlias: true,
      bankHolderName: true,
      paywayPublicKey: true,
      paywaySandbox: true,
    },
  });

  return NextResponse.json(configs);
}
