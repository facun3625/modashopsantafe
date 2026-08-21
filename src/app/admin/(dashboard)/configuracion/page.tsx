import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { SaveButton } from "@/components/admin/SaveButton";
import { CardAccordion } from "@/components/admin/CardAccordion";
import { MaskedCredentialField } from "@/components/admin/MaskedCredentialField";
import { ImagePreviewInput } from "@/components/admin/ImagePreviewInput";
import { TelegramTestButton } from "./TelegramTestButton";
import { MailProviderFields } from "./MailProviderFields";
import { MailTestButton } from "./MailTestButton";
import { SettingsTabs } from "./SettingsTabs";
import { WrenchIcon, PackageIcon } from "@/components/icons";
import { DEFAULT_INTRO, DEFAULT_NOTES, DEFAULT_CLOSING } from "@/lib/orderEmails";
import {
  updateSiteSettings,
  updateMailSettings,
  updateOdooSettings,
  updateTelegramSettings,
  updateOrderEmailSettings,
  updateMaintenanceMode,
  updateHideOutOfStock,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
} from "./actions";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-semibold text-brand-muted";
const MAX_HERO_SLIDES = 3;

export default async function AdminConfiguracionPage() {
  const [settings, slides] = await Promise.all([
    getStoreSettingsRow(),
    prisma.heroSlide.findMany({ orderBy: { position: "asc" } }),
  ]);

  const canAddSlide = slides.length < MAX_HERO_SLIDES;

  // --- Panel: General (mantenimiento + datos de contacto) ---
  const generalPanel = (
    <div className="flex flex-col gap-8">
      <form
        action={updateMaintenanceMode}
        className={`rounded-xl border p-5 transition-colors ${
          settings.maintenanceMode ? "border-amber-300 bg-amber-50" : "border-black/10 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                settings.maintenanceMode ? "bg-amber-100 text-amber-700" : "bg-brand-soft text-brand-muted"
              }`}
            >
              <WrenchIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-brand-ink">Modo mantenimiento</p>
              <p className="text-xs text-brand-muted">
                {settings.maintenanceMode
                  ? "El sitio está apagado para clientes ahora mismo — solo ven la pantalla de mantenimiento."
                  : "Apaga el sitio para clientes (ven una pantalla de mantenimiento). Los admins entran igual, panel y sitio."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch name="maintenanceMode" defaultChecked={settings.maintenanceMode} />
            <SaveButton trackDirty />
          </div>
        </div>
      </form>

      <form action={updateHideOutOfStock} className="rounded-xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-muted">
              <PackageIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-brand-ink">Ocultar productos sin stock</p>
              <p className="text-xs text-brand-muted">
                {settings.hideOutOfStock
                  ? "Los productos en 0 no aparecen en la tienda ni en el buscador."
                  : "Los productos en 0 se muestran igual, con \"Sin stock\" y el aviso de reposición."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch name="hideOutOfStock" defaultChecked={settings.hideOutOfStock} />
            <SaveButton trackDirty />
          </div>
        </div>
      </form>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">Datos de contacto</h2>
        <form action={updateSiteSettings} className="mt-3 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex flex-wrap gap-4">
            <div className="w-64">
              <label className={labelClasses}>Instagram (usuario, sin @)</label>
              <input
                type="text"
                name="instagramHandle"
                defaultValue={settings.instagramHandle ?? ""}
                placeholder="modashop.sf"
                className={fieldClasses}
              />
            </div>
            <div className="w-64">
              <label className={labelClasses}>WhatsApp (con código de país, sin +)</label>
              <input
                type="text"
                name="whatsappPhone"
                defaultValue={settings.whatsappPhone ?? ""}
                placeholder="5493420000000"
                className={fieldClasses}
              />
            </div>
            <div className="min-w-[240px] flex-1">
              <label className={labelClasses}>Dirección</label>
              <input
                type="text"
                name="address"
                defaultValue={settings.address ?? ""}
                placeholder="San Martín 2191 — Santa Fe, Argentina"
                className={fieldClasses}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className={labelClasses}>Texto del marquee (uno por línea)</label>
            <textarea
              name="marqueeText"
              rows={3}
              defaultValue={settings.marqueeText ?? ""}
              placeholder={"Nueva colección\nPromociones\nModaShop"}
              className={fieldClasses}
            />
            <p className="mt-1 text-xs text-brand-muted">Es la franja que se desplaza debajo del slider del home.</p>
          </div>

          <div className="mt-5 border-t border-black/5 pt-4">
            <SaveButton trackDirty />
          </div>
        </form>
      </div>
    </div>
  );

  // --- Panel: Odoo ---
  const odooPanel = (
    <form action={updateOdooSettings} className="rounded-xl border border-black/10 bg-white p-5">
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
  );

  // --- Panel: Mailing (franquicia + proveedor + remitente) ---
  const mailingPanel = (
    <form action={updateMailSettings} className="rounded-xl border border-black/10 bg-white p-5">
      <p className={labelClasses}>Identidad de la franquicia</p>
      <div className="flex flex-wrap gap-4">
        <div className="w-56">
          <label className={labelClasses}>Nombre de la franquicia</label>
          <input
            type="text"
            name="franchiseName"
            defaultValue={settings.franchiseName ?? ""}
            placeholder="ModaShop"
            className={fieldClasses}
          />
          <p className="mt-1 text-xs text-brand-muted">Encabezado de los mailings.</p>
        </div>
        <div className="w-56">
          <label className={labelClasses}>Sucursal / lugar</label>
          <input
            type="text"
            name="franchiseLocation"
            defaultValue={settings.franchiseLocation ?? ""}
            placeholder="Santa Fe"
            className={fieldClasses}
          />
          <p className="mt-1 text-xs text-brand-muted">
            Mailings y el badge de la barra superior del sitio público.
          </p>
        </div>
      </div>

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
  );

  // --- Panel: Mail de compra ---
  const textareaClasses = `${fieldClasses} min-h-[70px] resize-y`;
  const orderEmailPanel = (
    <form action={updateOrderEmailSettings} className="rounded-xl border border-black/10 bg-white p-5">
      <p className="text-sm text-brand-muted">
        El mail que recibe el cliente apenas compra. El detalle de productos y los totales siempre son los reales
        del pedido — acá editás el mensaje alrededor. Podés usar <code className="rounded bg-brand-soft px-1">{"{nombre}"}</code>{" "}
        y <code className="rounded bg-brand-soft px-1">{"{pedido}"}</code> (se reemplazan por el nombre del cliente y
        el número de pedido). Dejá un campo vacío para usar el texto por defecto que ves de fondo.
      </p>

      <div className="mt-4">
        <label className={labelClasses}>Mensaje de bienvenida</label>
        <textarea
          name="orderEmailIntro"
          defaultValue={settings.orderEmailIntro ?? ""}
          placeholder={DEFAULT_INTRO}
          rows={2}
          className={textareaClasses}
        />
      </div>

      <p className={`${labelClasses} mt-5 border-t border-black/5 pt-4`}>Nota según el medio de pago</p>
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelClasses}>Transferencia</label>
          <textarea
            name="orderEmailNoteTransfer"
            defaultValue={settings.orderEmailNoteTransfer ?? ""}
            placeholder={DEFAULT_NOTES.transferencia}
            rows={2}
            className={textareaClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Contra entrega</label>
          <textarea
            name="orderEmailNoteCash"
            defaultValue={settings.orderEmailNoteCash ?? ""}
            placeholder={DEFAULT_NOTES.contra_entrega}
            rows={2}
            className={textareaClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Mercado Pago</label>
          <textarea
            name="orderEmailNoteMercadopago"
            defaultValue={settings.orderEmailNoteMercadopago ?? ""}
            placeholder={DEFAULT_NOTES.mercadopago}
            rows={2}
            className={textareaClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Payway (tarjeta)</label>
          <textarea
            name="orderEmailNotePayway"
            defaultValue={settings.orderEmailNotePayway ?? ""}
            placeholder={DEFAULT_NOTES.payway}
            rows={2}
            className={textareaClasses}
          />
        </div>
      </div>

      <div className="mt-5 border-t border-black/5 pt-4">
        <label className={labelClasses}>Cierre</label>
        <textarea
          name="orderEmailClosing"
          defaultValue={settings.orderEmailClosing ?? ""}
          placeholder={DEFAULT_CLOSING}
          rows={2}
          className={textareaClasses}
        />
      </div>

      <div className="mt-5 border-t border-black/5 pt-4">
        <SaveButton trackDirty />
      </div>
    </form>
  );

  // --- Panel: Telegram ---
  const telegramPanel = (
    <form action={updateTelegramSettings} className="rounded-xl border border-black/10 bg-white p-5">
      <p className="mb-4 text-sm text-brand-muted">
        Cuando entra una venta web, el equipo recibe un mensaje al instante en un grupo de Telegram. Creá un bot con{" "}
        <span className="font-medium text-brand-ink">@BotFather</span>, agregá el bot a tu grupo, y cargá acá el token y
        el ID del chat.
      </p>
      <div className="flex flex-wrap gap-4">
        <MaskedCredentialField
          name="telegramBotToken"
          label="Token del bot"
          configured={Boolean(settings.telegramBotToken)}
          placeholder="123456789:ABCdef..."
        />
        <div className="w-48">
          <label className={labelClasses}>ID del chat / grupo</label>
          <input
            type="text"
            name="telegramChatId"
            defaultValue={settings.telegramChatId ?? ""}
            placeholder="-1001234567890"
            className={fieldClasses}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-black/5 pt-4">
        <SaveButton trackDirty />
        <TelegramTestButton />
      </div>
    </form>
  );

  // --- Panel: Slider principal ---
  // Contenido compartido entre "editar slide" y "nuevo slide" — mismo orden
  // visual en los dos para que no se sientan como formularios distintos:
  // imagen (con vista previa) → textos en grilla prolija → botones como
  // lista numerada, en vez del flex-wrap amontonado que había antes.
  function slideFields(opts: {
    imageExisting?: string | null;
    imageRequired: boolean;
    defaults?: {
      promoText?: string | null;
      eyebrow?: string;
      title?: string;
      subtitle?: string | null;
      buttons?: readonly [string | null, string | null][];
    };
  }) {
    const d = opts.defaults;
    const buttons = d?.buttons ?? [
      [null, null],
      [null, null],
      [null, null],
    ];

    return (
      <div className="flex flex-col gap-5">
        <ImagePreviewInput
          name="image"
          label="Imagen"
          existingUrl={opts.imageExisting}
          required={opts.imageRequired}
          helperText={
            opts.imageRequired
              ? "Apaisada y de buena resolución — es el fondo del banner principal del home."
              : "Dejá sin elegir para mantener la imagen actual."
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Texto chico (eyebrow)</label>
            <input type="text" name="eyebrow" required placeholder="ModaShop" defaultValue={d?.eyebrow} className={fieldClasses} />
          </div>
          <div>
            <label className={labelClasses}>Subtítulo</label>
            <input type="text" name="subtitle" defaultValue={d?.subtitle ?? ""} className={fieldClasses} />
          </div>
          <div>
            <label className={labelClasses}>Título (hasta 2 líneas)</label>
            <textarea
              name="title"
              rows={2}
              required
              placeholder={"Brillá\ncon estilo"}
              defaultValue={d?.title}
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Texto del círculo (opcional, hasta 2 líneas)</label>
            <textarea name="promoText" rows={2} defaultValue={d?.promoText ?? ""} className={fieldClasses} />
          </div>
        </div>

        <div>
          <p className={`${labelClasses} normal-case`}>Botones (opcional, hasta 3)</p>
          <div className="flex flex-col gap-2">
            {buttons.map(([label, href], i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2.5 rounded-lg border border-black/10 bg-brand-soft/50 p-2.5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-muted shadow-sm">
                  {i + 1}
                </span>
                <input
                  type="text"
                  name={`button${i + 1}Label`}
                  placeholder="Texto del botón"
                  defaultValue={label ?? ""}
                  className="w-44 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-brand-ink focus:border-brand-pink focus:outline-none"
                />
                <input
                  type="text"
                  name={`button${i + 1}Href`}
                  placeholder="/tienda o https://..."
                  defaultValue={href ?? ""}
                  className="min-w-[180px] flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-brand-ink focus:border-brand-pink focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sliderPanel = (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-muted">
        Hasta {MAX_HERO_SLIDES} slides para el carrusel del home. Tenés {slides.length}.
      </p>

      {slides.map((slide) => (
        <form
          key={slide.id}
          action={updateHeroSlide}
          className={`rounded-xl border bg-white p-5 transition-colors ${
            slide.enabled ? "border-brand-pink/30" : "border-black/10"
          }`}
        >
          <input type="hidden" name="id" value={slide.id} />
          <CardAccordion
            titleArea={
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {slide.imageUrl && (
                  <Image
                    src={slide.imageUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-ink">{slide.title.split("\n")[0]}</p>
                  <p className="truncate text-xs text-brand-muted">{slide.eyebrow}</p>
                </div>
              </div>
            }
            headerRight={<ToggleSwitch name="enabled" defaultChecked={slide.enabled} />}
          >
            <div className="mb-4 w-24">
              <label className={labelClasses}>Orden</label>
              <input type="number" name="position" min={0} defaultValue={slide.position} className={fieldClasses} />
            </div>

            {slideFields({
              imageExisting: slide.imageUrl,
              imageRequired: false,
              defaults: {
                promoText: slide.promoText,
                eyebrow: slide.eyebrow,
                title: slide.title,
                subtitle: slide.subtitle,
                buttons: [
                  [slide.button1Label, slide.button1Href],
                  [slide.button2Label, slide.button2Href],
                  [slide.button3Label, slide.button3Href],
                ],
              },
            })}

            <div className="mt-5 flex gap-3 border-t border-black/5 pt-4">
              <SaveButton trackDirty />
              <button
                type="submit"
                formAction={deleteHeroSlide.bind(null, slide.id)}
                className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-brand-muted transition-colors hover:border-red-300 hover:text-red-700"
              >
                Eliminar
              </button>
            </div>
          </CardAccordion>
        </form>
      ))}

      {slides.length === 0 && (
        <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-brand-muted">
          Todavía no creaste ningún slide — el home usa el contenido por defecto.
        </p>
      )}

      {canAddSlide ? (
        <form action={createHeroSlide} className="rounded-xl border border-dashed border-black/20 bg-white p-5">
          <p className="mb-4 text-base font-semibold text-brand-ink">Nuevo slide</p>

          {slideFields({ imageRequired: true })}

          <div className="mt-5 flex items-center gap-4 border-t border-black/5 pt-4">
            <div className="flex items-center gap-2">
              <ToggleSwitch name="enabled" defaultChecked />
              <span className="text-sm text-brand-ink">Habilitado</span>
            </div>
            <SaveButton label="Crear" />
          </div>
        </form>
      ) : (
        <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-brand-muted">
          Ya tenés el máximo de {MAX_HERO_SLIDES} slides. Borrá uno para poder crear otro.
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Configuración</h1>
        <p className="mt-1 text-sm text-brand-muted">Todo lo que se ve en el sitio y las integraciones de la tienda.</p>
      </div>

      <SettingsTabs
        tabs={[
          { id: "general", label: "General", content: generalPanel },
          { id: "odoo", label: "Odoo", content: odooPanel },
          { id: "mailing", label: "Mailing", content: mailingPanel },
          { id: "mail-compra", label: "Mail de compra", content: orderEmailPanel },
          { id: "telegram", label: "Telegram", content: telegramPanel },
          { id: "slider", label: "Slider", content: sliderPanel },
        ]}
      />
    </div>
  );
}
