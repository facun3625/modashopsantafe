import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/admin/Badge";
import { WhatsAppIcon } from "@/components/icons";
import { buildWhatsAppLink, isLikelyPhone } from "@/lib/whatsapp";
import { CopyEmailsButton } from "./CopyEmailsButton";
import { UserTypeFilter } from "./UserTypeFilter";
import { deleteAbandonedCart, cleanupOldAbandonedCarts } from "./actions";

type CartItemJson = { productId: number; name: string; price: number; quantity: number };

type UserType = "all" | "registered" | "guest" | "anonymous";

function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

export default async function AdminCarritosAbandonadosPage({
  searchParams,
}: {
  searchParams: Promise<{ userType?: string }>;
}) {
  const params = await searchParams;
  const userType: UserType =
    params.userType === "registered" || params.userType === "guest" || params.userType === "anonymous"
      ? params.userType
      : "all";

  const carts = await prisma.abandonedCart.findMany({
    where: {
      ...(userType === "registered" && { userId: { not: null } }),
      ...(userType === "guest" && { userId: null, email: { not: null } }),
      ...(userType === "anonymous" && { userId: null, email: null }),
    },
    orderBy: { lastActive: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  const emails = carts.map((c) => c.user?.email ?? c.email).filter((e): e is string => Boolean(e));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Carritos abandonados</h1>
        <p className="mt-1 text-sm text-brand-muted">
          {carts.length} carritos con productos sin comprar. No es automático: es una foto del último estado de cada
          carrito, para que puedan contactar a mano a quien no terminó la compra.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <UserTypeFilter defaultValue={userType} />

          <CopyEmailsButton emails={emails} />

          <form action={cleanupOldAbandonedCarts}>
            <button
              type="submit"
              title="Borra los que no tienen actividad hace más de 30 días"
              className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-brand-muted transition-colors hover:border-red-300 hover:text-red-700"
            >
              Limpiar viejos (+30 días)
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Items</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Última actividad</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {carts.map((cart) => {
              const items = (cart.items as unknown as CartItemJson[]) ?? [];
              const email = cart.user?.email ?? cart.email;
              const label = cart.user?.name ?? cart.name ?? email ?? cart.phone ?? "Anónimo";
              const type = cart.userId ? "registered" : email || cart.phone ? "guest" : "anonymous";

              return (
                <tr key={cart.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-ink">{label}</p>
                    {email && <p className="text-xs text-brand-muted">{email}</p>}
                    {cart.phone && <p className="text-xs text-brand-muted">{cart.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={type === "registered" ? "pink" : type === "guest" ? "neutral" : "amber"}>
                      {type === "registered" ? "Registrado" : type === "guest" ? "Invitado" : "Anónimo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-brand-muted">
                    {items.length} {items.length === 1 ? "producto" : "productos"}
                  </td>
                  <td className="px-4 py-3 text-brand-pink-dark">${cart.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-brand-muted">{timeAgo(cart.lastActive)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {cart.phone && isLikelyPhone(cart.phone) && (
                        <a
                          href={buildWhatsAppLink(
                            cart.phone,
                            `Hola ${cart.user?.name ?? cart.name ?? ""}! Vimos que dejaste ${items.length === 1 ? items[0]?.name ?? "un producto" : `${items.length} productos`} en tu carrito de ModaShop. ¿Te ayudamos a completar la compra?`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Escribir por WhatsApp"
                          className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline"
                        >
                          <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
                          WhatsApp
                        </a>
                      )}
                      <form action={deleteAbandonedCart.bind(null, cart.id)}>
                        <button
                          type="submit"
                          className="cursor-pointer text-xs font-semibold text-brand-muted hover:text-red-700"
                        >
                          Eliminar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {carts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-muted">
                  No hay carritos abandonados por ahora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
