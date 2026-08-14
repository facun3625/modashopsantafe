"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import { paymentMethodLabel } from "@/lib/orderLabels";
import type { PaymentMethod } from "@/generated/prisma/enums";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("No autorizado");
}

// Activar/desactivar un medio de pago se guarda solo, al instante (el toggle
// del admin lo llama en onChange). Se maneja aparte del resto del form para no
// pisar el descuento ni las credenciales al togglear.
export async function setPaymentMethodEnabled(method: PaymentMethod, enabled: boolean) {
  await requireAdmin();
  await prisma.paymentMethodConfig.update({ where: { method }, data: { enabled } });
  await logAdminAction(enabled ? "payment.enable" : "payment.disable", {
    targetType: "payment",
    targetId: method,
    detail: paymentMethodLabel(method),
  });
  revalidatePath("/admin/pagos");
}

export async function savePaymentMethodConfig(formData: FormData) {
  await requireAdmin();

  const method = formData.get("method") as PaymentMethod;
  const discountPct = Math.max(0, Number(formData.get("discountPct")) || 0);

  // `enabled` NO se toca acá: lo maneja setPaymentMethodEnabled (toggle
  // instantáneo). Así guardar el descuento/credenciales no lo pisa.
  const data: {
    discountPct: number;
    mpAccessToken?: string;
    mpPublicKey?: string;
    bankCbu?: string;
    bankAlias?: string;
    bankHolderName?: string;
  } = { discountPct };

  if (method === "mercadopago") {
    // Los campos de credenciales se muestran vacíos (enmascarados) aunque ya
    // haya un valor guardado, para no exponerlo en el HTML. Si el admin no
    // escribe nada nuevo, no lo pisamos.
    const accessToken = formData.get("mpAccessToken") as string;
    const publicKey = formData.get("mpPublicKey") as string;
    if (accessToken) data.mpAccessToken = accessToken;
    if (publicKey) data.mpPublicKey = publicKey;
  }

  if (method === "transferencia") {
    // CBU/alias/titular no son secretos (se le muestran al cliente), así que
    // acá sí se pisan directo con lo que haya en el formulario.
    data.bankCbu = (formData.get("bankCbu") as string) || undefined;
    data.bankAlias = (formData.get("bankAlias") as string) || undefined;
    data.bankHolderName = (formData.get("bankHolderName") as string) || undefined;
  }

  const config = await prisma.paymentMethodConfig.update({ where: { method }, data });

  // Sin filas = sin restricción (acepta cualquier envío habilitado).
  const shippingMethodIds = formData.getAll("shippingMethodIds").map(String);
  await prisma.paymentMethodShipping.deleteMany({ where: { paymentMethodConfigId: config.id } });
  if (shippingMethodIds.length > 0) {
    await prisma.paymentMethodShipping.createMany({
      data: shippingMethodIds.map((shippingMethodId) => ({
        paymentMethodConfigId: config.id,
        shippingMethodId,
      })),
    });
  }

  await logAdminAction("payment.update", {
    targetType: "payment",
    targetId: method,
    detail: `${paymentMethodLabel(method)} — ${discountPct}% desc.`,
  });

  revalidatePath("/admin/pagos");
}
