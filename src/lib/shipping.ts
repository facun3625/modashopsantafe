import { prisma } from "@/lib/prisma";

// Instalación nueva: si todavía no hay NINGÚN método de envío cargado, se
// siembran los dos más comunes para que la tienda arranque vendible desde el
// primer minuto (mismo espíritu que los medios de pago, ver
// paymentSettings.ts). El admin los edita, renombra o apaga cuando quiera —
// es un punto de partida, no algo forzado: si ya hay al menos uno cargado
// (aunque el admin haya borrado los que sembramos acá) no se vuelve a tocar.
async function ensureDefaultShippingMethods() {
  const count = await prisma.shippingMethod.count();
  if (count > 0) return;
  await prisma.shippingMethod.createMany({
    data: [
      { name: "Retiro en el local", cost: 0, requiresAddress: false, enabled: true },
      { name: "Envío a domicilio", cost: 0, requiresAddress: true, enabled: true },
    ],
  });
}

export async function getAllShippingMethods() {
  await ensureDefaultShippingMethods();
  return prisma.shippingMethod.findMany({ orderBy: { createdAt: "asc" } });
}

// Si el medio de pago tiene alguna restricción cargada (PaymentMethodShipping),
// solo esos envíos son válidos para él; si no tiene ninguna, acepta
// cualquier envío habilitado.
export async function getShippingMethodsForPayment(paymentMethodConfigId: string) {
  await ensureDefaultShippingMethods();
  const restrictions = await prisma.paymentMethodShipping.findMany({
    where: { paymentMethodConfigId },
    select: { shippingMethodId: true },
  });

  if (restrictions.length === 0) {
    return prisma.shippingMethod.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
  }

  return prisma.shippingMethod.findMany({
    where: { id: { in: restrictions.map((r) => r.shippingMethodId) }, enabled: true },
    orderBy: { createdAt: "asc" },
  });
}
