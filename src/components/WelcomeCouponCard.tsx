import { getActiveWelcomeCoupon } from "@/lib/welcomeCoupon";

// Recordatorio del cupón de bienvenida en Mi cuenta, mientras siga vigente y sin usar.
export async function WelcomeCouponCard({ userId }: { userId: string }) {
  const coupon = await getActiveWelcomeCoupon(userId);
  if (!coupon) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-brand-pink/60 bg-brand-soft px-5 py-4">
      <div>
        <p className="font-semibold text-brand-ink">Tu regalo de bienvenida: {coupon.label}</p>
        <p className="mt-0.5 text-xs text-brand-muted">
          Usalo en el checkout, en el campo de cupón.
          {coupon.expiresAt ? ` Vence el ${coupon.expiresAt.toLocaleDateString("es-AR")}.` : ""}
          {coupon.minPurchaseAmount ? ` Compra mínima $${Math.round(coupon.minPurchaseAmount).toLocaleString("es-AR")}.` : ""}
        </p>
      </div>
      <span className="rounded-xl bg-white px-4 py-2 font-mono text-lg font-bold tracking-wider text-brand-pink-dark">{coupon.code}</span>
    </div>
  );
}
