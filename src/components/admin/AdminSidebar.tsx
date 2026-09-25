"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PackageIcon, SalesIcon, UsersIcon, StoreIcon, UserIcon, CardIcon, TruckIcon, TagIcon, MailIcon, CartIcon, StarIcon, GearIcon, BellIcon, BellRingIcon, SendIcon, HomeIcon, ClipboardIcon, TrendUpIcon, EyeIcon } from "@/components/icons";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";

const LINKS = [
  { href: "/admin/inicio", label: "Inicio", icon: HomeIcon },
  { href: "/admin/productos", label: "Productos", icon: PackageIcon },
  { href: "/admin/ventas", label: "Ventas", icon: SalesIcon },
  { href: "/admin/estadisticas", label: "Estadísticas", icon: TrendUpIcon },
  { href: "/admin/visitas", label: "Visitas", icon: EyeIcon },
  { href: "/admin/carritos-abandonados", label: "Carritos abandonados", icon: CartIcon },
  { href: "/admin/lista-espera", label: "Lista de espera", icon: BellIcon },
  { href: "/admin/mailing", label: "Mailing", icon: SendIcon },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: BellRingIcon },
  { href: "/admin/pagos", label: "Pagos", icon: CardIcon },
  { href: "/admin/envios", label: "Envíos", icon: TruckIcon },
  { href: "/admin/cupones", label: "Cupones", icon: TagIcon },
  { href: "/admin/puntos", label: "Puntos", icon: StarIcon },
  { href: "/admin/usuarios", label: "Usuarios", icon: UsersIcon },
  { href: "/admin/suscriptores", label: "Suscriptores", icon: MailIcon },
  { href: "/admin/logs", label: "Registro", icon: ClipboardIcon },
  { href: "/admin/configuracion", label: "Configuración", icon: GearIcon },
];

export function AdminSidebar({ userLabel }: { userLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <aside className="relative z-50 flex w-full shrink-0 flex-col border-b border-black/5 bg-white px-3 py-2 md:h-full md:w-56 md:border-0 md:bg-brand-ink md:py-3">
      <div className="flex min-h-11 shrink-0 items-center justify-between px-1 md:mb-2.5 md:justify-center md:rounded-lg md:bg-white md:px-3 md:py-2">
        <Image src="/logo2.png" alt="ModaShop" width={300} height={120} className="h-9 w-auto md:h-8" priority />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Cerrar menú del panel" : "Abrir menú del panel"}
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-brand-ink hover:bg-brand-soft md:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      <div
        className={`${open ? "flex" : "hidden"} absolute left-0 right-0 top-full max-h-[calc(100dvh-3.75rem)] flex-col border-b border-black/10 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl md:static md:flex md:min-h-0 md:flex-1 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
      >
        <nav className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-px overflow-y-auto py-2 md:scrollbar-thin-dark md:py-0">
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:min-h-0 md:px-2 md:py-1.5 md:text-[12px] ${
                active
                  ? "bg-brand-pink/10 text-brand-pink-dark md:bg-brand-pink md:text-white"
                  : "text-brand-muted hover:bg-black/[0.03] hover:text-brand-ink md:text-white/70 md:hover:bg-white/10 md:hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 md:h-3 md:w-3" />
              {link.label}
            </Link>
          );
        })}
        </nav>

        <div className="mt-1.5 flex shrink-0 flex-col gap-px border-t border-black/5 pt-1.5 md:border-white/10">
        <p className="flex items-center gap-2 px-2 py-1 text-xs text-brand-muted md:text-white/70">
          <UserIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{userLabel}</span>
        </p>
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-brand-muted transition-colors hover:bg-black/[0.03] hover:text-brand-ink md:text-white/70 md:hover:bg-white/10 md:hover:text-white"
        >
          <StoreIcon className="h-3.5 w-3.5 shrink-0" />
          Volver al sitio
        </Link>
        <AdminLogoutButton />
        </div>
      </div>
    </aside>
  );
}
