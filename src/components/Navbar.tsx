"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { UserIcon, CartIcon, SearchIcon, StoreIcon, DashboardIcon, StarIcon, LogoutIcon, PackageIcon } from "@/components/icons";
import { useCart } from "@/lib/cart";
import { useAuthModal } from "@/lib/authModal";
import { useProductSuggestions } from "@/lib/useProductSuggestions";
import { SearchSuggestions } from "@/components/SearchSuggestions";
import { TopContactBar } from "@/components/TopContactBar";
import type { SiteSettings } from "@/lib/settings";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/#donde-estamos", label: "Dónde estamos" },
  { href: "/#contacto", label: "Contacto" },
  { href: "/tienda", label: "Tienda" },
];

function NavbarSearch({ className }: { className: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const { suggestions, loading, active } = useProductSuggestions(query);

  function go(q: string) {
    const trimmed = q.trim();
    if (trimmed) router.push(`/tienda?q=${encodeURIComponent(trimmed)}`);
    setFocused(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(query);
      }}
      className={`relative ${className}`}
    >
      <label className="flex items-center gap-2 rounded-full border border-black/10 px-3.5 py-2 text-brand-ink/70 focus-within:border-brand-pink">
        <SearchIcon className="h-4 w-4 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Buscar productos..."
          className="w-full bg-transparent text-sm text-brand-ink placeholder:text-brand-ink/40 focus:outline-none"
        />
      </label>
      {focused && active && (
        <SearchSuggestions suggestions={suggestions} loading={loading} onSelect={go} />
      )}
    </form>
  );
}

export function Navbar({ settings }: { settings: SiteSettings }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"inicio" | "donde-estamos" | "contacto">("inicio");
  const pathname = usePathname();
  const { data: session } = useSession();
  const { count, openCart } = useCart();
  const { openLogin } = useAuthModal();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (pathname !== "/") return;

    function onScroll() {
      const donde = document.getElementById("donde-estamos");
      const contacto = document.getElementById("contacto");
      const scrollPos = window.scrollY + 150;
      let next: "inicio" | "donde-estamos" | "contacto" = "inicio";
      if (donde && scrollPos >= donde.offsetTop) next = "donde-estamos";
      if (contacto && scrollPos >= contacto.offsetTop) next = "contacto";
      setActiveSection(next);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  function isActive(href: string) {
    if (pathname !== "/") return false;
    if (href === "/") return activeSection === "inicio";
    if (href === "/#donde-estamos") return activeSection === "donde-estamos";
    if (href === "/#contacto") return activeSection === "contacto";
    return false;
  }

  function handleNavClick(e: React.MouseEvent, href: string) {
    if (pathname !== "/") return;
    if (href === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (href.startsWith("/#")) {
      e.preventDefault();
      document.getElementById(href.slice(2))?.scrollIntoView({ behavior: "smooth" });
    }
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-50">
      <TopContactBar settings={settings} />

      {/* Barra principal */}
      <div className="border-b border-black/5 bg-white px-3 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <button
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center text-brand-ink lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menú"
          >
            {open ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>

          <Link href="/" className="shrink-0">
            <Image src="/logo.png" alt="ModaShop" width={300} height={120} priority className="h-14 w-auto sm:h-16" />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex">
            {LINKS.map((link) => {
              const active = isActive(link.href);
              const isTienda = link.href === "/tienda";
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`flex cursor-pointer items-center gap-1.5 py-2 text-xs font-medium uppercase tracking-widest transition-colors ${
                    isTienda
                      ? "text-brand-pink-dark hover:text-brand-pink"
                      : active
                        ? "text-brand-pink-dark"
                        : "text-brand-ink/70 hover:text-brand-pink-dark"
                  }`}
                >
                  {isTienda && <StoreIcon className="h-3.5 w-3.5 shrink-0" />}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex flex-1 items-center justify-end gap-3 lg:flex-none">
            <NavbarSearch className="hidden max-w-[220px] flex-1 sm:block" />

            {session?.user?.role === "admin" && (
              <Link
                href="/admin/inicio"
                title="Panel de administración"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark"
              >
                <DashboardIcon className="h-4.5 w-4.5" />
              </Link>
            )}

            {session ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  title="Mi cuenta"
                  aria-expanded={profileOpen}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark"
                >
                  <UserIcon className="h-4.5 w-4.5" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-2xl border border-black/10 bg-white p-2 shadow-lg">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold text-brand-ink">
                        {session.user?.name || "Mi cuenta"}
                      </p>
                      <p className="truncate text-xs text-brand-muted">{session.user?.email}</p>
                    </div>
                    <div className="my-1 border-t border-black/5" />
                    <Link
                      href="/mi-cuenta/pedidos"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-soft"
                    >
                      <PackageIcon className="h-4 w-4 shrink-0" />
                      Mis pedidos
                    </Link>
                    <Link
                      href="/mi-cuenta/puntos"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-soft"
                    >
                      <StarIcon className="h-4 w-4 shrink-0" />
                      Mis puntos
                    </Link>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogoutIcon className="h-4 w-4 shrink-0" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={openLogin}
                title="Iniciar sesión"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark"
              >
                <UserIcon className="h-4.5 w-4.5" />
              </button>
            )}

            <button
              onClick={openCart}
              title="Carrito"
              className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark"
            >
              <CartIcon className="h-4.5 w-4.5" />
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand-pink-dark text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        <NavbarSearch className="mx-auto mt-3 max-w-6xl sm:hidden" />
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-b border-black/5 bg-white px-6 py-3 lg:hidden">
          {LINKS.map((link) => {
            const isTienda = link.href === "/tienda";
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium uppercase tracking-wide ${
                  isTienda ? "text-brand-pink-dark" : "text-brand-ink hover:text-brand-pink-dark"
                }`}
              >
                {isTienda && <StoreIcon className="h-4 w-4 shrink-0" />}
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
