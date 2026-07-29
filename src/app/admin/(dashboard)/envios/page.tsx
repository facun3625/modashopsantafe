import { getAllShippingMethods } from "@/lib/shipping";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { ChipCheckbox } from "@/components/admin/ChipCheckbox";
import { Badge } from "@/components/admin/Badge";
import { SaveButton } from "@/components/admin/SaveButton";
import { CardAccordion } from "@/components/admin/CardAccordion";
import { createShippingMethod, updateShippingMethod, deleteShippingMethod } from "./actions";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-semibold text-brand-muted";

export default async function AdminEnviosPage() {
  const methods = await getAllShippingMethods();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Envíos</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Creá los métodos de envío que ofrecés (ej. envío a domicilio, retiro en el local).
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {methods.map((m) => (
          <form
            key={m.id}
            action={updateShippingMethod}
            className={`rounded-xl border bg-white p-5 transition-colors ${
              m.enabled ? "border-brand-pink/30" : "border-black/10"
            }`}
          >
            <input type="hidden" name="id" value={m.id} />

            <CardAccordion
              titleArea={
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      name="name"
                      defaultValue={m.name}
                      required
                      className="min-w-0 flex-1 border-0 p-0 text-base font-semibold text-brand-ink focus:outline-none"
                    />
                    {m.cost > 0 ? (
                      <Badge tone="pink">${m.cost.toFixed(2)}</Badge>
                    ) : (
                      <Badge tone="green">Gratis</Badge>
                    )}
                  </div>
                  <input
                    name="description"
                    defaultValue={m.description ?? ""}
                    placeholder="Descripción (opcional)"
                    className="mt-1 w-full border-0 p-0 text-sm text-brand-muted focus:outline-none"
                  />
                </div>
              }
              headerRight={<ToggleSwitch name="enabled" defaultChecked={m.enabled} />}
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-32">
                  <label className={labelClasses}>Costo</label>
                  <input type="number" name="cost" defaultValue={m.cost} min={0} step={0.01} className={fieldClasses} />
                </div>

                <div className="pb-0.5">
                  <label className={labelClasses}>&nbsp;</label>
                  <ChipCheckbox name="requiresAddress" label="Pide dirección de envío" defaultChecked={m.requiresAddress} />
                </div>
              </div>

              <div className="mt-5 flex gap-3 border-t border-black/5 pt-4">
                <SaveButton trackDirty />
                <button
                  type="submit"
                  formAction={deleteShippingMethod.bind(null, m.id)}
                  className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-brand-muted transition-colors hover:border-red-300 hover:text-red-700"
                >
                  Eliminar
                </button>
              </div>
            </CardAccordion>
          </form>
        ))}

        {methods.length === 0 && (
          <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-brand-muted">
            Todavía no creaste ningún método de envío.
          </p>
        )}
      </div>

      <div className="mt-6 shrink-0">
        <form action={createShippingMethod} className="rounded-xl border border-dashed border-black/20 bg-white p-5">
          <p className="mb-3 font-semibold text-brand-ink">Nuevo método de envío</p>

          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <label className={labelClasses}>Nombre</label>
              <input type="text" name="name" required placeholder="Envío a domicilio" className={fieldClasses} />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className={labelClasses}>Descripción (opcional)</label>
              <input type="text" name="description" placeholder="Entrega en 24-48hs en Santa Fe" className={fieldClasses} />
            </div>
            <div className="w-32">
              <label className={labelClasses}>Costo</label>
              <input type="number" name="cost" defaultValue={0} min={0} step={0.01} className={fieldClasses} />
            </div>

            <div className="pb-0.5">
              <label className={labelClasses}>&nbsp;</label>
              <ChipCheckbox name="requiresAddress" label="Pide dirección" defaultChecked />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4 border-t border-black/5 pt-4">
            <div className="flex items-center gap-2">
              <ToggleSwitch name="enabled" defaultChecked />
              <span className="text-sm text-brand-ink">Habilitado</span>
            </div>
            <SaveButton label="Crear" />
          </div>
        </form>
      </div>
    </div>
  );
}
