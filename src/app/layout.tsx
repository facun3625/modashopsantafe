import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/components/Providers";
import { SiteChrome } from "@/components/SiteChrome";
import { getSiteSettings } from "@/lib/settings";
import { getThemeForRequest } from "@/lib/themeRuntime";
import { themeCss, themeFontHref } from "@/lib/themes";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ModaShop | Accesorios de moda",
  description:
    "ModaShop — accesorios de moda, bijouterie, cosmética y más. Descubrí el catálogo completo online.",
  manifest: "/manifest.json",
  // capable: true es lo que hace que, instalada, abra sin la barra de
  // Safari. Sin icons.apple, Safari muestra una captura de pantalla en vez
  // del logo como ícono — los tres campos van juntos, no alcanza con el
  // manifest solo (Safari no lo lee para esto).
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, requestHeaders, theme] = await Promise.all([getSiteSettings(), headers(), getThemeForRequest()]);
  const isMaintenancePage = requestHeaders.get("x-maintenance-page") === "1";
  const fontHref = theme ? themeFontHref(theme.config) : null;

  return (
    <html lang="es" className={`${poppins.variable} h-full antialiased`}>
      <head>
        {/* Tema vigente (campaña o aspecto base): colores, tipografía de títulos, botones y fondo — valores ya validados en lib/themes.ts */}
        {theme && <style id="theme-css" dangerouslySetInnerHTML={{ __html: themeCss(theme.config) }} />}
        {fontHref && <link rel="stylesheet" href={fontHref} />}
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <Providers cartAutoCloseSeconds={settings.cartAutoCloseSeconds}>
          <SiteChrome
            settings={settings}
            isMaintenancePage={isMaintenancePage}
            announcement={theme?.config.announcement.enabled ? theme.config.announcement : null}
            previewThemeName={theme?.previewing ? theme.name : null}
          >
            {children}
          </SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
