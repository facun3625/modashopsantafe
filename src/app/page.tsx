import Link from "next/link";
import { getAllCategories } from "@/lib/categories";
import { getProductsPage, getCategoryShowcaseImage } from "@/lib/products";
import { getHeroSlides, getSiteSettings } from "@/lib/settings";
import { MapPinIcon } from "@/components/icons";
import { ProductCarousel } from "@/components/ProductCarousel";
import { CategoryCarousel } from "@/components/CategoryCarousel";
import { NewsletterBanner } from "@/components/NewsletterBanner";
import { HeroSlider, type HeroSlide } from "@/components/HeroSlider";
import type { OdooProductListItem } from "@/types/odoo";

// Elegidas a mano por ahora. Cuando exista el panel de administración,
// esta selección (y el orden) debería salir de ahí en vez de estar hardcodeada.
const HERO_CATEGORY_IDS = [43, 40, 44, 45];
const FEATURED_CATEGORY_IDS = [43, 40, 44, 45, 238, 62];

export default async function Home() {
  let hero: { id: number; name: string; image: string | false }[] = [];
  let featured: { id: number; name: string; image: string | false }[] = [];
  let carouselProducts: OdooProductListItem[] = [];
  let error: string | null = null;

  const [slidesFromDb, settings] = await Promise.all([getHeroSlides(), getSiteSettings()]);

  try {
    const categories = await getAllCategories();
    const byId = new Map(categories.map((c) => [c.id, c]));

    const [heroResults, featuredResults, carouselResults] = await Promise.all([
      Promise.all(
        HERO_CATEGORY_IDS.map(async (id) => {
          const category = byId.get(id);
          if (!category) return null;
          const image = await getCategoryShowcaseImage(id, "image_1024");
          return { id, name: category.name, image };
        })
      ),
      Promise.all(
        FEATURED_CATEGORY_IDS.map(async (id) => {
          const category = byId.get(id);
          if (!category) return null;
          const image = await getCategoryShowcaseImage(id, "image_128");
          return { id, name: category.name, image };
        })
      ),
      Promise.all(
        FEATURED_CATEGORY_IDS.map((id) => getProductsPage({ categoryId: id, limit: 4, offset: 0 }))
      ),
    ]);

    hero = heroResults.filter((c): c is NonNullable<typeof c> => c !== null && c.image !== false);
    featured = featuredResults.filter((c): c is NonNullable<typeof c> => c !== null && c.image !== false);
    carouselProducts = carouselResults.flatMap((r) => r.products);
  } catch (err) {
    error = err instanceof Error ? err.message : "Error desconocido";
  }

  const MARQUEE_ITEMS = settings.marqueeItems;

  // Si todavía no se cargó ningún slide desde /admin/configuracion, se
  // muestra un slide de ejemplo con las categorías destacadas como botones
  // (mismo comportamiento que había antes de que el slider fuera editable).
  const heroSlides: HeroSlide[] =
    slidesFromDb.length > 0
      ? slidesFromDb.map((s) => ({
          image: s.imageUrl ?? "/hero-bg.jpg",
          eyebrow: s.eyebrow,
          title: s.title,
          subtitle: s.subtitle,
          promoText: s.promoText,
          buttons: (
            [
              [s.button1Label, s.button1Href],
              [s.button2Label, s.button2Href],
              [s.button3Label, s.button3Href],
            ] as const
          )
            .filter((b): b is [string, string] => Boolean(b[0] && b[1]))
            .map(([label, href]) => ({ label, href })),
        }))
      : [
          {
            image: "/hero-bg.jpg",
            eyebrow: "ModaShop",
            title: "Brillá\ncon estilo",
            subtitle: "Bijouterie, cosmética, accesorios de cabello y mucho más — todo en un solo lugar.",
            promoText: "Nueva\nColección",
            buttons: [
              ...hero.slice(0, 3).map((c) => ({ label: c.name, href: `/categoria/${c.id}` })),
              { label: "Ver todo", href: "/tienda" },
            ],
          },
        ];

  return (
    <div>
      {/* Hero */}
      <section className="px-3 pt-6 sm:px-6 sm:pt-10">
        <div className="mx-auto max-w-6xl">
          <HeroSlider slides={heroSlides} />

          {/* Marquee de promociones */}
          <div className="mt-3 overflow-hidden rounded-3xl bg-brand-ink py-3">
            <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
              {Array(12)
                .fill(MARQUEE_ITEMS)
                .flat()
                .map((text, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-10 text-xs font-semibold uppercase tracking-[0.25em] text-white/90"
                  >
                    {text}
                    <span className="text-brand-pink">✦</span>
                  </span>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categorías destacadas */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-bold text-brand-ink">Explorá por categoría</h2>
        <p className="mt-1 text-brand-muted">Los rubros más elegidos de la tienda.</p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">No se pudo conectar con Odoo</p>
            <p className="mt-1 font-mono text-xs opacity-80">{error}</p>
          </div>
        )}

        <div className="mt-8">
          <CategoryCarousel categories={featured} />
        </div>

        <div className="mt-8 text-center">
          <Link href="/tienda" className="text-sm font-medium text-brand-pink-dark hover:underline">
            Ver todas las categorías →
          </Link>
        </div>
      </section>

      {/* Productos destacados */}
      {carouselProducts.length > 0 && (
        <section className="bg-brand-pink px-6 py-14">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold text-white">Productos destacados</h2>
            <p className="mt-1 text-white/80">Lo más elegido de la tienda.</p>

            <div className="mt-8">
              <ProductCarousel products={carouselProducts} />
            </div>
          </div>
        </section>
      )}

      {/* Dónde estamos */}
      <section id="donde-estamos" className="scroll-mt-24 bg-brand-soft px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-brand-ink">Dónde estamos</h2>

          <div className="mt-8 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
            <iframe
              src={`https://www.google.com/maps?q=${encodeURIComponent(settings.address)}&output=embed`}
              className="h-72 w-full grayscale-[15%] sm:h-96"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación de ModaShop en el mapa"
            />
            <div className="flex flex-col items-center gap-4 px-6 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
              <p className="flex items-center gap-2 text-brand-ink">
                <MapPinIcon className="h-5 w-5 shrink-0 text-brand-pink" />
                {settings.address}
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
              >
                Abrir en Google Maps
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <NewsletterBanner />
    </div>
  );
}
