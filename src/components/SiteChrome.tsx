"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import type { SiteSettings } from "@/lib/settings";

// El panel de administración tiene su propio layout (sidebar, header) y no
// debe mostrar el navbar/footer/whatsapp del sitio público.
export function SiteChrome({ children, settings }: { children: ReactNode; settings: SiteSettings }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    // El dashboard admin maneja su propio scroll interno (sidebar fijo +
    // contenido scrolleable) — hay que capar esto a la altura de la
    // pantalla, si no el body entero crece con el contenido y el sidebar
    // (que sí es h-screen) se queda corto.
    return <div className="h-screen overflow-hidden">{children}</div>;
  }

  return (
    <>
      <Navbar settings={settings} />
      <div className="flex-1">{children}</div>
      <Footer settings={settings} />
      <WhatsAppButton phone={settings.whatsappNumber} />
    </>
  );
}
