"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SalesAssistant } from "@/components/SalesAssistant";
import { WhatsAppFloatingButton } from "@/components/WhatsAppFloatingButton";
import { VisitTracker } from "@/components/VisitTracker";
import { SitePopupModal } from "@/components/SitePopupModal";
import type { SiteSettings } from "@/lib/settings";

// El panel de administración tiene su propio layout (sidebar, header) y no
// debe mostrar el navbar/footer/whatsapp del sitio público.
export function SiteChrome({
  children,
  settings,
  isMaintenancePage,
  announcement,
  previewThemeName,
}: {
  children: ReactNode;
  settings: SiteSettings;
  isMaintenancePage: boolean;
  announcement: { text: string; href: string; bg: string; color: string } | null;
  previewThemeName: string | null;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  // Página de conexión a Odoo: aparte de /admin a propósito, pero misma
  // idea — pantalla propia, sin navbar/footer/whatsapp del sitio público.
  const isOdooApi = pathname === "/odoo_api";

  if (isAdmin) {
    // El dashboard admin maneja su propio scroll interno (sidebar fijo +
    // contenido scrolleable) — hay que capar esto a la altura de la
    // pantalla, si no el body entero crece con el contenido y el sidebar
    // (que sí es h-screen) se queda corto.
    return <div className="h-screen overflow-hidden">{children}</div>;
  }

  if (isOdooApi) {
    return <>{children}</>;
  }

  // La pantalla de mantenimiento arma su propio encabezado mínimo (solo
  // logo, sin menú/buscador/carrito) y no lleva footer — se renderiza sola.
  // `isMaintenancePage` viene del layout (que lo lee de un header que puso
  // proxy.ts) porque acá, del lado del cliente, la URL sigue siendo la
  // original (el rewrite es transparente para el navegador) — usePathname()
  // solo no alcanzaría para darse cuenta.
  if (isMaintenancePage) {
    return <>{children}</>;
  }

  return (
    <>
      <VisitTracker />
      {announcement && announcement.text && (
        <div className="px-4 py-2 text-center text-xs font-semibold sm:text-sm" style={{ backgroundColor: announcement.bg, color: announcement.color }}>
          {announcement.href ? (
            <a href={announcement.href} className="hover:underline">{announcement.text}</a>
          ) : (
            announcement.text
          )}
        </div>
      )}
      {previewThemeName && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-center text-xs text-amber-900">
          <span>Vista previa del tema <b>{previewThemeName}</b>: solo la ves vos.</span>
          <a href="/api/admin/themes/preview?exit=1" className="font-semibold underline">Salir de la vista previa</a>
        </div>
      )}
      <Navbar settings={settings} />
      <div className="flex-1">{children}</div>
      <Footer settings={settings} />
      {settings.assistant.enabled ? (
        <SalesAssistant settings={settings.assistant} />
      ) : (
        <WhatsAppFloatingButton humanSeller={settings.assistant.humanSeller} />
      )}
      <SitePopupModal popup={settings.popup} />
    </>
  );
}
