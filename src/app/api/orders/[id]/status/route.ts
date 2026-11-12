import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Público a propósito: solo devuelve el estado (ni items, ni total, ni datos
// del cliente), y el id del pedido ya es en sí el control de acceso (cuid,
// no adivinable) — mismo criterio que /carrito/gracias, que también toma el
// id por URL sin pedir sesión. Lo usa la página de gracias para avisar en
// vivo cuándo se confirma un pago de Mercado Pago (llega por webhook, no en
// la misma request que creó el pedido).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ status: order.status });
}
