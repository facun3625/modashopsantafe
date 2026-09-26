import Image from "next/image";
import Link from "next/link";
import { WhatsAppIcon, InstagramIcon, MailIcon } from "@/components/icons";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import type { SiteSettings } from "@/lib/settings";

export function Footer({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();

  return (
    <footer id="contacto" className="scroll-mt-36 border-t border-black/5 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-3">
        <div>
          <Image src="/logo2.png" alt="ModaShop" width={300} height={120} className="h-8 w-auto" />
          <p className="mt-4 max-w-xs text-sm text-brand-muted">
            Accesorios de moda, bijouterie y mucho más. Todo lo que buscás, en un solo lugar.
          </p>
          <div className="mt-4">
            <InstallPwaButton />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-brand-ink">Navegación</p>
          <ul className="mt-4 space-y-2 text-sm text-brand-muted">
            <li>
              <Link href="/" className="hover:text-brand-pink-dark">Inicio</Link>
            </li>
            <li>
              <Link href="/tienda" className="hover:text-brand-pink-dark">Tienda</Link>
            </li>
            <li>
              <Link href="/#donde-estamos" className="hover:text-brand-pink-dark">Dónde estamos</Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-brand-ink">Contacto</p>
          <ul className="mt-4 space-y-3 text-sm text-brand-muted">
            <li className="flex items-center gap-2">
              <WhatsAppIcon className="h-4 w-4 shrink-0" />
              {/* Mismo horario que configura el admin para la vendedora IA
                  (ver /admin/configuracion → horario de WhatsApp) — fuera de
                  esas horas no tiene sentido invitar a escribir. */}
              {settings.assistant.humanSeller.available && settings.assistant.humanSeller.whatsappUrl ? (
                <a
                  href={settings.assistant.humanSeller.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-pink-dark"
                >
                  WhatsApp
                </a>
              ) : (
                <span title={`Fuera de horario — ${settings.assistant.humanSeller.scheduleText}`} className="text-brand-muted/50">
                  WhatsApp (fuera de horario)
                </span>
              )}
            </li>
            <li className="flex items-center gap-2">
              <MailIcon className="h-4 w-4 shrink-0" />
              <a href={`mailto:${settings.contactEmail}`} className="hover:text-brand-pink-dark">
                {settings.contactEmail}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <InstagramIcon className="h-4 w-4 shrink-0" />
              <a
                href={`https://instagram.com/${settings.instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-pink-dark"
              >
                @{settings.instagramHandle}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-black/5 px-6 py-6 pr-20 text-center text-xs text-brand-muted sm:pr-6">
        © {year} ModaShop. Todos los derechos reservados.
      </div>
    </footer>
  );
}
