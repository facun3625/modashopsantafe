"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import type { SiteSettings } from "@/lib/settings";

// El panel de administración tiene su propio layout (sidebar, header) y no
// debe mostrar el navbar/footer/whatsapp del sitio público.
export function SiteChrome({
  children,
  settings,
  isMaintenancePage,
}: {
  children: ReactNode;
  settings: SiteSettings;
  isMaintenancePage: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  // En /carrito el botón fijo de WhatsApp queda tapando controles del
  // checkout en mobile (el botón "Confirmar pedido", el CVV de la tarjeta,
  // el resumen con el total) — cualquier contenido que coincida con esa
  // esquina al scrollear se ve tapado, porque el botón es fixed. Ahí el CTA
  // de la propia página tiene prioridad.
  const isCart = pathname?.startsWith("/carrito");
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
      <Navbar settings={settings} />
      <div className="flex-1">{children}</div>
      <Footer settings={settings} />
      {!isCart && <WhatsAppButton phone={settings.whatsappNumber} />}
    </>
  );
}
