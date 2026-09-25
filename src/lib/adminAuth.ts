import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Check current privileges at the mutation boundary, never just the JWT role.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") throw new Error("No autorizado");
  return session;
}
