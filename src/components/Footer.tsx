import Image from "next/image";
import Link from "next/link";
import { WhatsAppIcon, InstagramIcon, MailIcon } from "@/components/icons";
import { CONTACT_EMAIL } from "@/lib/contact";
import type { SiteSettings } from "@/lib/settings";

export function Footer({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();

  return (
    <footer id="contacto" className="scroll-mt-24 bg-brand-ink">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-3">
        <div>
          <div className="inline-block rounded-lg bg-white px-2 py-1.5">
            <Image src="/logo.png" alt="ModaShop" width={300} height={120} className="h-8 w-auto" />
          </div>
          <p className="mt-4 max-w-xs text-sm text-white/60">
            Accesorios de moda, bijouterie y mucho más. Todo lo que buscás, en un solo lugar.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Navegación</p>
          <ul className="mt-4 space-y-2 text-sm text-white/60">
            <li>
              <Link href="/" className="hover:text-brand-pink">Inicio</Link>
            </li>
            <li>
              <Link href="/tienda" className="hover:text-brand-pink">Tienda</Link>
            </li>
            <li>
              <Link href="/#donde-estamos" className="hover:text-brand-pink">Dónde estamos</Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Contacto</p>
          <ul className="mt-4 space-y-3 text-sm text-white/60">
            <li className="flex items-center gap-2">
              <WhatsAppIcon className="h-4 w-4 shrink-0" />
              <a
                href={`https://wa.me/${settings.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-pink"
              >
                WhatsApp
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MailIcon className="h-4 w-4 shrink-0" />
              <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-brand-pink">
                {CONTACT_EMAIL}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <InstagramIcon className="h-4 w-4 shrink-0" />
              <a
                href={`https://instagram.com/${settings.instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-pink"
              >
                @{settings.instagramHandle}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-6 pr-20 text-center text-xs text-white/50 sm:pr-6">
        © {year} ModaShop. Todos los derechos reservados.
      </div>
    </footer>
  );
}
