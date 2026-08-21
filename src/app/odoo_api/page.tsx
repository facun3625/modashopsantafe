import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStoreSettingsRow } from "@/lib/settings";
import { MaskedCredentialField } from "@/components/admin/MaskedCredentialField";
import { SaveButton } from "@/components/admin/SaveButton";
import { updateOdooSettings } from "./actions";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-semibold text-brand-muted";

// Ruta a propósito fuera de /admin/configuracion y sin link en ningún menú
// — la conexión a Odoo es de esas cosas que se cargan una vez al instalar
// la tienda y no hace falta que el resto del equipo la vea ni la toque.
// Igual queda protegida por sesión de admin, no por "nadie conoce el link".
export default async function OdooApiPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    redirect("/");
  }

  const settings = await getStoreSettingsRow();

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold text-brand-ink">Conexión con Odoo</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Catálogo, stock y pedidos dependen de esto — se carga una sola vez por instalación.
      </p>

      <form action={updateOdooSettings} className="mt-6 rounded-xl border border-black/10 bg-white p-5">
        {!settings.odooUrl && (
          <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Todavía no está conectado — el catálogo, stock y pedidos no van a funcionar hasta que cargues esto.
          </p>
        )}
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[220px] flex-1">
            <label className={labelClasses}>URL de Odoo</label>
            <input
              type="text"
              name="odooUrl"
              defaultValue={settings.odooUrl ?? ""}
              placeholder="https://tufranquicia.odoo.com"
              className={fieldClasses}
            />
          </div>
          <div className="w-48">
            <label className={labelClasses}>Base de datos</label>
            <input
              type="text"
              name="odooDb"
              defaultValue={settings.odooDb ?? ""}
              placeholder="nombre-db"
              className={fieldClasses}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <div className="min-w-[220px] flex-1">
            <label className={labelClasses}>Usuario</label>
            <input
              type="text"
              name="odooUser"
              defaultValue={settings.odooUser ?? ""}
              placeholder="usuario@tufranquicia.com"
              className={fieldClasses}
            />
          </div>
          <MaskedCredentialField
            name="odooApiKey"
            label="API Key"
            configured={Boolean(settings.odooApiKey)}
            placeholder="Clave de API de Odoo"
          />
        </div>

        <div className="mt-5 border-t border-black/5 pt-4">
          <SaveButton trackDirty />
        </div>
      </form>
    </div>
  );
}
