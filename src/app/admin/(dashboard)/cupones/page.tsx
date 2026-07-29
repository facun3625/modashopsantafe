import { prisma } from "@/lib/prisma";
import { getAllCategories } from "@/lib/categories";
import { createCoupon, updateCoupon } from "./actions";
import { CouponFields } from "./CouponFields";

export default async function AdminCuponesPage() {
  const [coupons, categories] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    getAllCategories(),
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Cupones</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Creá códigos de descuento. Todas las condiciones son opcionales: si no cargás ninguna, el cupón aplica a
          cualquier compra.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {coupons.map((coupon) => (
          <form
            key={coupon.id}
            action={updateCoupon}
            className={`rounded-xl border bg-white p-5 transition-colors ${
              coupon.enabled ? "border-brand-pink/30" : "border-black/10"
            }`}
          >
            <input type="hidden" name="id" value={coupon.id} />
            <CouponFields defaults={coupon} categories={categories} submitLabel="Guardar" couponId={coupon.id} />
          </form>
        ))}

        {coupons.length === 0 && (
          <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-brand-muted">
            Todavía no creaste ningún cupón.
          </p>
        )}
      </div>

      <div className="mt-6 shrink-0">
        <form action={createCoupon} className="rounded-xl border border-dashed border-black/20 bg-white p-5">
          <p className="mb-4 font-semibold text-brand-ink">Nuevo cupón</p>
          <CouponFields defaults={null} categories={categories} submitLabel="Crear" />
        </form>
      </div>
    </div>
  );
}
