import { prisma } from "@/lib/prisma";
import { executeKw } from "@/lib/odoo";

// Compartido entre las rutas que crean pedidos (/api/orders, /api/orders/payway).

export type OrderCustomer = {
  name: string;
  email: string;
  phone?: string;
  street?: string;
  city?: string;
};

export async function findOrCreatePartner(customer: OrderCustomer): Promise<number> {
  const existing = await executeKw<number[]>(
    "res.partner",
    "search",
    [[["email", "=", customer.email]]],
    { limit: 1 }
  );

  if (existing.length > 0) return existing[0];

  return executeKw<number>("res.partner", "create", [
    {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      street: customer.street,
      city: customer.city,
    },
  ]);
}

// Resuelve el res.partner de Odoo para el pedido: si el usuario logueado ya
// tiene uno guardado lo reusa; si no, busca/crea por email y se lo guarda
// para la próxima compra. Invitados (sin sesión) siempre buscan/crean sin
// guardar nada.
export async function resolvePartnerId(userId: string | undefined, customer: OrderCustomer): Promise<number> {
  if (!userId) return findOrCreatePartner(customer);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.odooPartnerId) return user.odooPartnerId;

  const partnerId = await findOrCreatePartner(customer);
  if (user) await prisma.user.update({ where: { id: user.id }, data: { odooPartnerId: partnerId } });
  return partnerId;
}
