import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { setUserRole } from "./actions";

export default async function AdminUsuariosPage() {
  const session = await auth();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Usuarios</h1>
        <p className="mt-1 text-sm text-brand-muted">{users.length} cuentas registradas.</p>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Alta</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
                <td className="px-4 py-3 font-medium text-brand-ink">{u.name ?? "—"}</td>
                <td className="px-4 py-3 text-brand-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      u.role === "admin" ? "bg-brand-pink/10 text-brand-pink-dark" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {u.role === "admin" ? "Administrador" : "Cliente"}
                  </span>
                </td>
                <td className="px-4 py-3 text-brand-muted">{u.createdAt.toLocaleDateString("es-AR")}</td>
                <td className="px-4 py-3 text-right">
                  {u.role === "admin" ? (
                    <form action={setUserRole.bind(null, u.id, "customer")}>
                      <button
                        type="submit"
                        disabled={u.id === session?.user?.id}
                        className="cursor-pointer text-xs font-semibold text-brand-muted hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-brand-muted"
                        title={u.id === session?.user?.id ? "No podés quitarte el rol a vos mismo" : undefined}
                      >
                        Quitar admin
                      </button>
                    </form>
                  ) : (
                    <form action={setUserRole.bind(null, u.id, "admin")}>
                      <button
                        type="submit"
                        className="cursor-pointer text-xs font-semibold text-brand-pink-dark hover:underline"
                      >
                        Hacer admin
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brand-muted">
                  Todavía no hay usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
