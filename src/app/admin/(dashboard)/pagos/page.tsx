import { getPaymentMethodConfigs } from "@/lib/paymentSettings";
import { getAllShippingMethods } from "@/lib/shipping";
import { paymentMethodLabel } from "@/lib/sales";
import { PaymentEnabledToggle } from "@/components/admin/PaymentEnabledToggle";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { ChipCheckbox } from "@/components/admin/ChipCheckbox";
import { MaskedCredentialField } from "@/components/admin/MaskedCredentialField";
import { SaveButton } from "@/components/admin/SaveButton";
import { CardAccordion } from "@/components/admin/CardAccordion";
import { savePaymentMethodConfig } from "./actions";

const METHOD_DESCRIPTIONS: Record<string, string> = {
  mercadopago: "Pago online con tarjeta, dinero en cuenta, etc. vía Mercado Pago.",
  transferencia: "El cliente transfiere y adjunta el comprobante al finalizar la compra.",
  contra_entrega: "El cliente paga en efectivo al recibir el pedido.",
  payway: "Pago con tarjeta directo en el checkout (gateway Payway). Se cobra y confirma al toque.",
};

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-semibold text-brand-muted";

export default async function AdminPagosPage() {
  const [configs, shippingMethods] = await Promise.all([getPaymentMethodConfigs(), getAllShippingMethods()]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Pagos</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Habilitá los medios de pago que aceptás y, si querés, aplicá un descuento a cada uno.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {configs.map((config) => (
          <form
            key={config.method}
            action={savePaymentMethodConfig}
            className={`rounded-xl border bg-white p-5 transition-colors ${
              config.enabled ? "border-brand-pink/30" : "border-black/10"
            }`}
          >
            <input type="hidden" name="method" value={config.method} />

            <CardAccordion
              titleArea={
                <div>
                  <p className="font-semibold text-brand-ink">{paymentMethodLabel(config.method)}</p>
                  <p className="mt-0.5 text-sm text-brand-muted">{METHOD_DESCRIPTIONS[config.method]}</p>
                </div>
              }
              headerRight={<PaymentEnabledToggle method={config.method} enabled={config.enabled} />}
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-40">
                  <label className={labelClasses}>Descuento (%)</label>
                  <input
                    type="number"
                    name="discountPct"
                    defaultValue={config.discountPct}
                    min={0}
                    max={100}
                    step={0.1}
                    className={fieldClasses}
                  />
                </div>

                {config.method === "mercadopago" && (
                  <>
                    <MaskedCredentialField
                      name="mpAccessToken"
                      label="Access Token"
                      type="password"
                      configured={Boolean(config.mpAccessToken)}
                      placeholder="APP_USR-..."
                    />
                    <MaskedCredentialField
                      name="mpPublicKey"
                      label="Public Key"
                      configured={Boolean(config.mpPublicKey)}
                      placeholder="APP_USR-..."
                    />
                  </>
                )}

                {config.method === "payway" && (
                  <>
                    <MaskedCredentialField
                      name="paywayPublicKey"
                      label="Public Key"
                      configured={Boolean(config.paywayPublicKey)}
                      placeholder="pub_..."
                    />
                    <MaskedCredentialField
                      name="paywayPrivateKey"
                      label="Private Key"
                      type="password"
                      configured={Boolean(config.paywayPrivateKey)}
                      placeholder="priv_..."
                    />
                    <div className="flex items-center gap-2.5 pb-2">
                      <ToggleSwitch name="paywaySandbox" defaultChecked={config.paywaySandbox} />
                      <div>
                        <p className="text-sm font-medium text-brand-ink">Modo de prueba (sandbox)</p>
                        <p className="text-xs text-brand-muted">
                          Apagalo recién cuando tengas las keys de producción.
                        </p>
                      </div>
                    </div>
                    <p className="w-full text-xs text-brand-muted">
                      Las keys te las da el soporte de Payway (soporte@payway.com.ar).
                    </p>
                  </>
                )}

                {config.method === "transferencia" && (
                  <>
                    <div className="min-w-[180px] flex-1">
                      <label className={labelClasses}>Titular</label>
                      <input
                        type="text"
                        name="bankHolderName"
                        defaultValue={config.bankHolderName ?? ""}
                        placeholder="Nombre del titular de la cuenta"
                        className={fieldClasses}
                      />
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <label className={labelClasses}>CBU</label>
                      <input
                        type="text"
                        name="bankCbu"
                        defaultValue={config.bankCbu ?? ""}
                        placeholder="0000003100000000000000"
                        className={fieldClasses}
                      />
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <label className={labelClasses}>Alias</label>
                      <input
                        type="text"
                        name="bankAlias"
                        defaultValue={config.bankAlias ?? ""}
                        placeholder="modashop.mp"
                        className={fieldClasses}
                      />
                    </div>
                  </>
                )}
              </div>

              {shippingMethods.length > 0 && (
                <div className="mt-5 border-t border-black/5 pt-4">
                  <p className="mb-2.5 text-xs font-semibold text-brand-muted">
                    Envíos permitidos con este medio de pago{" "}
                    <span className="font-normal normal-case text-brand-muted/70">
                      (ninguno marcado = acepta cualquier envío habilitado)
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {shippingMethods.map((s) => (
                      <ChipCheckbox
                        key={s.id}
                        name="shippingMethodIds"
                        value={s.id}
                        label={s.name}
                        defaultChecked={config.allowedShipping.some((a) => a.shippingMethodId === s.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 border-t border-black/5 pt-4">
                <SaveButton trackDirty />
              </div>
            </CardAccordion>
          </form>
        ))}
      </div>
    </div>
  );
}
