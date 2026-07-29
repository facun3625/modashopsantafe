import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@/generated/prisma/enums";

const ALL_METHODS: PaymentMethod[] = ["mercadopago", "transferencia", "contra_entrega"];

// Se auto-crean las 3 filas (una por medio de pago) la primera vez que se
// entra a /admin/pagos, todas deshabilitadas por defecto — así no hace falta
// un seed aparte.
export async function getPaymentMethodConfigs() {
  const existing = await prisma.paymentMethodConfig.findMany({ include: { allowedShipping: true } });
  const byMethod = new Map(existing.map((c) => [c.method, c]));

  const missing = ALL_METHODS.filter((m) => !byMethod.has(m));
  if (missing.length > 0) {
    await prisma.paymentMethodConfig.createMany({
      data: missing.map((method) => ({ method })),
      skipDuplicates: true,
    });
    const all = await prisma.paymentMethodConfig.findMany({ include: { allowedShipping: true } });
    byMethod.clear();
    all.forEach((c) => byMethod.set(c.method, c));
  }

  return ALL_METHODS.map((m) => byMethod.get(m)!);
}
