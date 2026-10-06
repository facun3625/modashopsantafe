import { prisma } from "@/lib/prisma";

// Números de la campanita del panel (consultas baratas: solo conteos)
export type AdminCounts = { pendingOrders: number; staleOrders: number };

export async function getAdminCounts(): Promise<AdminCounts> {
  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  const [pendingOrders, staleOrders] = await Promise.all([
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.count({ where: { status: "pending", createdAt: { lt: dayAgo } } }),
  ]);
  return { pendingOrders, staleOrders };
}
