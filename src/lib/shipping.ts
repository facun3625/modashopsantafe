import { prisma } from "@/lib/prisma";

export async function getAllShippingMethods() {
  return prisma.shippingMethod.findMany({ orderBy: { createdAt: "asc" } });
}

// Si el medio de pago tiene alguna restricción cargada (PaymentMethodShipping),
// solo esos envíos son válidos para él; si no tiene ninguna, acepta
// cualquier envío habilitado.
export async function getShippingMethodsForPayment(paymentMethodConfigId: string) {
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
