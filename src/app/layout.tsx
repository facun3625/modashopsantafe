import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Providers } from "@/components/Providers";
import { SiteChrome } from "@/components/SiteChrome";
import { getSiteSettings } from "@/lib/settings";
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
  icons: {
    icon: "/favicon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();

  return (
    <html lang="es" className={`${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <SiteChrome settings={settings}>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
