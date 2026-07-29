import { MapPinIcon, InstagramIcon } from "@/components/icons";

// Extraída de Navbar para poder reusarla tal cual en /mantenimiento, que no
// lleva el resto del navbar (menú, buscador, carrito).
export function TopContactBar({ settings }: { settings: { address: string; instagramHandle: string } }) {
  return (
    <div className="bg-brand-pink px-3 py-2 text-[11px] tracking-wide text-white/90 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-2 sm:grid-cols-3">
        <span className="flex items-center gap-1.5">
          <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="sm:hidden">Santa Fe</span>
          <span className="hidden sm:inline">{settings.address}</span>
        </span>
        <span className="hidden justify-self-center sm:block">
          <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
            Santa Fe
          </span>
        </span>
        <a
          href={`https://instagram.com/${settings.instagramHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-self-end gap-1.5 hover:text-white"
        >
          <InstagramIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Instagram</span>
        </a>
      </div>
    </div>
  );
}
