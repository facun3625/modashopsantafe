import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Texto legible por código de acción. Si aparece uno sin mapear, se muestra
// el código crudo (mejor que ocultarlo).
const ACTION_LABELS: Record<string, string> = {
  "order.confirm": "Confirmó el pago",
  "order.cancel": "Canceló el pedido",
  "order.deliver": "Marcó como entregado",
  "order.reopen": "Reabrió el pedido (pago pendiente)",
  "order.delete": "Eliminó el pedido",
  "payment.enable": "Activó un medio de pago",
  "payment.disable": "Desactivó un medio de pago",
  "payment.update": "Editó un medio de pago",
};

export function adminActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export async function getAdminLogsPage(opts: { limit: number; offset: number }) {
  const [logs, total] = await Promise.all([
    prisma.adminLog.findMany({
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      skip: opts.offset,
    }),
    prisma.adminLog.count(),
  ]);
  return { logs, total };
}

// Deja registro de una acción del admin en el log de auditoría (/admin/logs).
// Se llama desde los server actions del panel, después de hacer el cambio.
// Nunca rompe la acción principal: si falla el log, solo se avisa por consola.
export async function logAdminAction(
  action: string,
  opts?: { targetType?: string; targetId?: string; detail?: string; adminEmail?: string; adminId?: string }
): Promise<void> {
  try {
    const session = await auth();
    await prisma.adminLog.create({
      data: {
        adminId: opts?.adminId ?? session?.user?.id ?? null,
        adminEmail: opts?.adminEmail ?? session?.user?.email ?? "desconocido",
        action,
        targetType: opts?.targetType,
        targetId: opts?.targetId,
        detail: opts?.detail,
      },
    });
  } catch (err) {
    console.error("logAdminAction failed", action, err);
  }
}
