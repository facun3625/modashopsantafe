import { prisma } from "@/lib/prisma";
import { executeKw } from "@/lib/odoo";
import { getReservedQuantities } from "@/lib/reservations";
import { WhatsAppSentCell } from "@/components/admin/WhatsAppSentCell";
import { WhatsAppSendLink } from "@/components/admin/WhatsAppSendLink";
import { buildWhatsAppLink, isLikelyPhone } from "@/lib/whatsapp";
import { CopyEmailsButton } from "./CopyEmailsButton";
import { deleteWaitlistEntry, markWaitlistWhatsApp } from "./actions";

// Disponible real de cara al cliente: stock físico de Odoo menos lo ya
// reservado por pedidos web sin despachar (mismo cálculo que usa la tienda).
async function getAvailableStock(productIds: number[]): Promise<Map<number, number>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Map();
  const [products, reserved] = await Promise.all([
    executeKw<{ id: number; qty_available: number }[]>("product.template", "read", [ids], { fields: ["qty_available"] }),
    getReservedQuantities(ids),
  ]);
  return new Map(products.map((p) => [p.id, Math.max(0, p.qty_available - (reserved.get(p.id) ?? 0))]));
}

export default async function AdminListaEsperaPage() {
  const entries = await prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" } });
  const emails = [...new Set(entries.map((e) => e.email))];
  const stockByProductId = await getAvailableStock(entries.map((e) => e.productId));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Lista de espera</h1>
        <p className="mt-1 text-sm text-brand-muted">
          {entries.length} clientes esperando que vuelva el stock de algún producto. Se anotan solos desde &quot;Avisarme
          cuando haya stock&quot; en la tienda — no se les avisa automático todavía.
        </p>

        <div className="mt-6">
          <CopyEmailsButton emails={emails} />
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Stock</th>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">WhatsApp</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const stock = stockByProductId.get(e.productId);
              return (
                <tr key={e.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
                  <td className="px-4 py-3 font-medium text-brand-ink">{e.productName}</td>
                  <td className="px-4 py-3 text-brand-muted">{e.categoryName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {stock === undefined ? (
                      <span className="text-brand-muted">—</span>
                    ) : stock > 0 ? (
                      <span className="font-medium text-green-700">{stock} en stock</span>
                    ) : (
                      <span className="font-medium text-red-700">Sin stock</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-brand-ink">{e.name}</p>
                    <p className="text-xs text-brand-muted">
                      {e.email}
                      {e.phone ? ` · ${e.phone}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-brand-muted">{e.createdAt.toLocaleDateString("es-AR")}</td>
                  <td className="px-4 py-3">
                    {e.phone && isLikelyPhone(e.phone) ? (
                      <div className="flex flex-col gap-1">
                        <WhatsAppSentCell date={e.whatsappSentAt} count={e.whatsappCount} />
                        <WhatsAppSendLink
                          sent={Boolean(e.whatsappSentAt)}
                          onSent={markWaitlistWhatsApp.bind(null, e.id)}
                          href={buildWhatsAppLink(
                            e.phone,
                            `Hola ${e.name}! Te escribimos de ModaShop porque estabas esperando que vuelva el stock de "${e.productName}" — ¡ya está disponible!`
                          )}
                        />
                      </div>
                    ) : (
                      <span className="text-brand-muted">Sin teléfono</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={deleteWaitlistEntry.bind(null, e.id)}>
                      <button
                        type="submit"
                        className="cursor-pointer text-xs font-medium text-brand-muted hover:text-red-700"
                      >
                        Eliminar
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-brand-muted">
                  Todavía no hay nadie anotado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
