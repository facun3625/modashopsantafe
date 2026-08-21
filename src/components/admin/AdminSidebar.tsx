"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PackageIcon, SalesIcon, UsersIcon, StoreIcon, UserIcon, CardIcon, TruckIcon, TagIcon, MailIcon, CartIcon, StarIcon, GearIcon, BellIcon, SendIcon, HomeIcon, ClipboardIcon, TrendUpIcon } from "@/components/icons";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";

const LINKS = [
  { href: "/admin/inicio", label: "Inicio", icon: HomeIcon },
  { href: "/admin/productos", label: "Productos", icon: PackageIcon },
  { href: "/admin/ventas", label: "Ventas", icon: SalesIcon },
  { href: "/admin/estadisticas", label: "Estadísticas", icon: TrendUpIcon },
  { href: "/admin/carritos-abandonados", label: "Carritos abandonados", icon: CartIcon },
  { href: "/admin/lista-espera", label: "Lista de espera", icon: BellIcon },
  { href: "/admin/mailing", label: "Mailing", icon: SendIcon },
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

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-brand-ink px-3 py-3">
      <div className="mb-2.5 flex shrink-0 justify-center rounded-lg bg-white px-3 py-2">
        <Image src="/logo.png" alt="ModaShop" width={300} height={120} className="h-8 w-auto" />
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto">
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[12px] font-medium transition-colors ${
                active ? "bg-brand-pink text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-1.5 flex shrink-0 flex-col gap-px border-t border-white/10 pt-1.5">
        <p className="flex items-center gap-2 px-2 py-1 text-xs text-white/70">
          <UserIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{userLabel}</span>
        </p>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <StoreIcon className="h-3.5 w-3.5 shrink-0" />
          Volver al sitio
        </Link>
        <AdminLogoutButton />
      </div>
    </aside>
  );
}
