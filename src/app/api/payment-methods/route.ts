import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Público: nunca expone las credenciales de Mercado Pago. CBU/alias/titular
// de transferencia sí, porque el checkout los necesita mostrarle al
// cliente para que sepa a dónde transferir.
export async function GET() {
  const configs = await prisma.paymentMethodConfig.findMany({
    where: { enabled: true },
    select: {
      method: true,
      discountPct: true,
      bankCbu: true,
      bankAlias: true,
      bankHolderName: true,
    },
  });

  return NextResponse.json(configs);
}
