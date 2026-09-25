import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStoreSettingsRow } from "@/lib/settings";
import { MaskedCredentialField } from "@/components/admin/MaskedCredentialField";
import { SaveButton } from "@/components/admin/SaveButton";
import { DEFAULT_AI_MODELS } from "@/lib/ai/types";
import { MailProviderFields } from "./MailProviderFields";
import { MailTestButton } from "./MailTestButton";
import { updateOdooSettings, updateAiSecretSettings, updateMailProviderSettings } from "./actions";

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

      <h1 className="mt-12 text-2xl font-bold text-brand-ink">Vendedora IA — configuración técnica</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Proveedor, modelo, API key e instrucciones de venta. Prender/apagar la vendedora y el horario de WhatsApp se
        maneja desde el panel de la tienda, en Configuración.
      </p>

      <form action={updateAiSecretSettings} className="mt-6 rounded-xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[220px] flex-1">
            <label className={labelClasses}>Proveedor</label>
            <select name="aiProvider" defaultValue={settings.aiProvider ?? ""} className={fieldClasses}>
              <option value="">Elegir más adelante</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
            <p className="mt-1 text-xs text-brand-muted">Si cambiás de proveedor, cargá también su nueva API key.</p>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className={labelClasses}>Modelo</label>
            <input
              type="text"
              name="aiModel"
              defaultValue={settings.aiModel ?? ""}
              placeholder="Se completa según el proveedor"
              className={fieldClasses}
            />
            <p className="mt-1 text-xs text-brand-muted">
              Recomendados: {DEFAULT_AI_MODELS.openai} o {DEFAULT_AI_MODELS.gemini}.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <MaskedCredentialField
            name="aiApiKey"
            label="API key del proveedor"
            configured={Boolean(settings.aiApiKey)}
            placeholder="Pegá la clave privada"
            type="password"
          />
        </div>
        <p className="mt-1 text-xs text-brand-muted">La clave se usa únicamente en el servidor y nunca se envía al navegador.</p>

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-black/5 pt-5 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Nombre visible</label>
            <input
              type="text"
              name="aiAssistantName"
              maxLength={60}
              defaultValue={settings.aiAssistantName ?? ""}
              placeholder="Vendedora virtual"
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Mensaje de bienvenida</label>
            <input
              type="text"
              name="aiWelcomeMessage"
              maxLength={500}
              defaultValue={settings.aiWelcomeMessage ?? ""}
              placeholder="¡Hola! Contame qué estás buscando…"
              className={fieldClasses}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClasses}>Instrucciones para vender</label>
          <textarea
            name="aiInstructions"
            rows={7}
            maxLength={6000}
            defaultValue={settings.aiInstructions ?? ""}
            placeholder={"Ejemplo:\n- Priorizá la nueva colección.\n- Preguntá para qué ocasión busca la prenda.\n- Mencioná el descuento por transferencia cuando corresponda."}
            className={`${fieldClasses} resize-y`}
          />
          <p className="mt-1 text-xs text-brand-muted">
            Estas reglas complementan las protecciones fijas: la vendedora no puede inventar stock, precios ni
            descuentos.
          </p>
        </div>

        <div className="mt-5 border-t border-black/5 pt-4">
          <SaveButton label="Guardar configuración" trackDirty />
        </div>
      </form>

      <h1 className="mt-12 text-2xl font-bold text-brand-ink">Envío de mail — configuración técnica</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Proveedor (SMTP o Resend), credenciales y remitente. El nombre y la sucursal de la franquicia se manejan
        desde el panel de la tienda, en Configuración.
      </p>

      <form action={updateMailProviderSettings} className="mt-6 rounded-xl border border-black/10 bg-white p-5">
        <MailProviderFields
          provider={settings.mailProvider === "resend" ? "resend" : "smtp"}
          smtp={{
            host: settings.smtpHost ?? "",
            port: settings.smtpPort ?? 587,
            secure: settings.smtpSecure,
            user: settings.smtpUser ?? "",
            passwordConfigured: Boolean(settings.smtpPassword),
          }}
          resendConfigured={Boolean(settings.resendApiKey)}
        />

        <p className={`${labelClasses} mt-5 border-t border-black/5 pt-4`}>Remitente (para ambos proveedores)</p>
        <div className="flex flex-wrap gap-4">
          <div className="w-56">
            <label className={labelClasses}>Nombre del remitente</label>
            <input
              type="text"
              name="mailFromName"
              defaultValue={settings.mailFromName ?? ""}
              placeholder="ModaShop"
              className={fieldClasses}
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className={labelClasses}>Email remitente</label>
            <input
              type="email"
              name="mailFromEmail"
              defaultValue={settings.mailFromEmail ?? ""}
              placeholder="hola@modashop.com.ar"
              className={fieldClasses}
            />
          </div>
        </div>

        <MailTestButton />

        <div className="mt-5 border-t border-black/5 pt-4">
          <SaveButton trackDirty />
        </div>
      </form>
    </div>
  );
}
