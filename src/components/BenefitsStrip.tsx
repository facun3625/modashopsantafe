import { TagIcon, TruckIcon, StoreIcon } from "@/components/icons";

type Benefit = { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; title: string; subtitle: string };

// Franja de 3 beneficios debajo del hero — los textos que dependen de datos
// reales de la tienda (descuento en efectivo, zona de envío, dirección) se
// arman en el caller (page.tsx) a partir de settings/PaymentMethodConfig en
// vez de vivir hardcodeados acá, para no quedar desactualizados si cambian.
export function BenefitsStrip({
  cashDiscountPct,
  franchiseLocation,
  address,
}: {
  cashDiscountPct: number | null;
  franchiseLocation: string;
  address: string;
}) {
  const benefits: Benefit[] = [
    cashDiscountPct
      ? { icon: TagIcon, title: `${cashDiscountPct}% OFF pagando en efectivo`, subtitle: "En toda la tienda" }
      : { icon: TagIcon, title: "Múltiples medios de pago", subtitle: "Efectivo, transferencia y tarjeta" },
    { icon: TruckIcon, title: `Envíos a ${franchiseLocation}`, subtitle: "Rápidos y seguros" },
    { icon: StoreIcon, title: "Retiro en local", subtitle: address },
  ];

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 rounded-3xl border border-black/5 bg-white px-4 py-5 shadow-sm sm:grid-cols-3 sm:px-6">
      {benefits.map((b, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-pink-dark shadow-sm">
            <b.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-ink">{b.title}</p>
            <p className="truncate text-xs text-brand-muted">{b.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
