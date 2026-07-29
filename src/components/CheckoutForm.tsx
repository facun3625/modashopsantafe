"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCart } from "@/lib/cart";
import { getCartSessionId } from "@/lib/cartSession";

type PaymentMethod = "mercadopago" | "transferencia" | "contra_entrega";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia bancaria",
  contra_entrega: "Contra entrega",
};

type AvailableMethod = {
  method: PaymentMethod;
  discountPct: number;
  bankCbu?: string | null;
  bankAlias?: string | null;
  bankHolderName?: string | null;
};

type ShippingMethod = {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  requiresAddress: boolean;
};

export function CheckoutForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const { items, total, clear } = useCart();

  const [methods, setMethods] = useState<AvailableMethod[] | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[] | null>(null);
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortages, setShortages] = useState<{ name: string; available: number; requested: number }[] | null>(null);

  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);

  useEffect(() => {
    fetch("/api/payment-methods")
      .then((res) => res.json())
      .then((data: AvailableMethod[]) => {
        setMethods(data);
        if (data.length > 0) setSelectedMethod(data[0].method);
      })
      .catch(() => setMethods([]));
  }, []);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? "");
      setEmail(session.user.email ?? "");
    }
  }, [session]);

  // El sync de lib/cart.tsx solo manda datos de la sesión — un visitante
  // anónimo que ya tipeó nombre/email/teléfono acá pero todavía no confirmó
  // el pedido quedaba con esos datos perdidos (el carrito abandonado se
  // guardaba como "Anónimo"). Este segundo sync manda lo que se va
  // completando en el checkout, para el mismo sessionId.
  useEffect(() => {
    if (!name.trim() && !email.trim() && !phone.trim()) return;
    const handle = setTimeout(() => {
      const sessionId = getCartSessionId();
      if (!sessionId || items.length === 0) return;
      fetch("/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId: session?.user?.id,
          email: email.trim() || undefined,
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          items: items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
          total,
        }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, email, phone]);

  // Los envíos válidos dependen del medio de pago elegido (algunos medios
  // pueden estar restringidos a ciertos envíos, ej. contra entrega -> solo
  // retiro en el local).
  useEffect(() => {
    if (!selectedMethod) return;
    setShippingMethods(null);
    setSelectedShippingId(null);
    fetch(`/api/shipping-methods?paymentMethod=${selectedMethod}`)
      .then((res) => res.json())
      .then((data: ShippingMethod[]) => {
        setShippingMethods(data);
        setSelectedShippingId(data[0]?.id ?? null);
      })
      .catch(() => setShippingMethods([]));
  }, [selectedMethod]);

  // Un cupón ya aplicado puede dejar de ser válido si se cambia de medio de
  // pago (algunos cupones aplican solo a un medio específico).
  useEffect(() => {
    setAppliedCoupon(null);
    setCouponError(null);
  }, [selectedMethod]);

  const selectedConfig = methods?.find((m) => m.method === selectedMethod);
  const selectedShipping = shippingMethods?.find((s) => s.id === selectedShippingId);
  const discountedTotal = selectedConfig ? total * (1 - selectedConfig.discountPct / 100) : total;
  const finalTotal = Math.max(0, discountedTotal - (appliedCoupon?.discountAmount ?? 0)) + (selectedShipping?.cost ?? 0);

  async function handleApplyCoupon() {
    if (!couponCode.trim() || !selectedMethod) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode,
          subtotal: total,
          paymentMethod: selectedMethod,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCouponError(data.error ?? "No se pudo aplicar el cupón.");
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon({ code: couponCode.trim().toUpperCase(), discountAmount: data.discountAmount });
    } catch {
      setCouponError("No se pudo conectar con el servidor.");
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMethod) return;
    setLoading(true);
    setError(null);
    setShortages(null);

    const form = new FormData();
    form.set(
      "items",
      JSON.stringify(items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price, name: i.name })))
    );
    form.set("customer", JSON.stringify({ name, email, phone: phone || undefined }));
    form.set("paymentMethod", selectedMethod);
    if (selectedShippingId) form.set("shippingMethodId", selectedShippingId);
    if (shippingAddress) form.set("shippingAddress", shippingAddress);
    if (appliedCoupon) form.set("couponCode", appliedCoupon.code);
    if (comprobante) form.set("comprobante", comprobante);

    try {
      const res = await fetch("/api/orders", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.shortages) {
          setShortages(data.shortages);
          setError("Algunos productos no tienen stock suficiente.");
        } else {
          setError(data.error ?? "No se pudo crear el pedido.");
        }
        setLoading(false);
        return;
      }

      clear();
      router.push(`/carrito/gracias?id=${data.orderId}`);
    } catch {
      setError("No se pudo conectar con el servidor. Probá de nuevo.");
      setLoading(false);
    }
  }

  if (methods === null) {
    return <p className="mt-6 text-sm text-brand-muted">Cargando métodos de pago...</p>;
  }

  if (methods.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        No hay métodos de pago disponibles en este momento. Escribinos por WhatsApp para coordinar tu pedido.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-5">
      <h2 className="font-semibold text-brand-ink">Finalizar compra</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-brand-muted">Nombre</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-brand-muted">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-brand-muted">Teléfono</label>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-brand-muted">Medio de pago</p>
        <div className="flex flex-col gap-3">
          {methods.map((m) => {
            const selected = selectedMethod === m.method;
            const bankDetails = [
              m.bankHolderName && { label: "Titular", value: m.bankHolderName },
              m.bankAlias && { label: "Alias", value: m.bankAlias },
              m.bankCbu && { label: "CBU", value: m.bankCbu },
            ].filter(Boolean) as { label: string; value: string }[];

            return (
              <div
                key={m.method}
                className={`rounded-xl border px-4 py-3.5 text-sm transition-colors ${
                  selected ? "border-brand-pink bg-brand-pink/5" : "border-black/10 hover:border-black/20"
                }`}
              >
                <label className="flex cursor-pointer items-center justify-between">
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={selected}
                      onChange={() => setSelectedMethod(m.method)}
                      className="accent-brand-pink"
                    />
                    {METHOD_LABELS[m.method]}
                  </span>
                  {m.discountPct > 0 && (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                      {m.discountPct}% off
                    </span>
                  )}
                </label>

                {selected && m.method === "transferencia" && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-brand-pink/20 pt-4">
                    {bankDetails.length > 0 && (
                      <div className="rounded-lg bg-white p-3.5">
                        <p className="mb-2 text-xs font-semibold text-brand-muted">Datos para transferir</p>
                        <dl className="flex flex-col gap-1.5">
                          {bankDetails.map((d) => (
                            <div key={d.label} className="flex items-baseline justify-between gap-3">
                              <dt className="text-xs text-brand-muted">{d.label}</dt>
                              <dd className="font-mono text-sm font-medium text-brand-ink">{d.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-brand-muted">
                        Comprobante de la transferencia
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        required
                        onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                        className="block w-full cursor-pointer text-sm text-brand-muted file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-brand-pink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-pink-dark"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {shippingMethods && shippingMethods.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-brand-muted">Método de envío</p>
          <div className="flex flex-col gap-3">
            {shippingMethods.map((s) => {
              const selected = selectedShippingId === s.id;
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border px-4 py-3.5 text-sm transition-colors ${
                    selected ? "border-brand-pink bg-brand-pink/5" : "border-black/10 hover:border-black/20"
                  }`}
                >
                  <label className="flex cursor-pointer items-center justify-between">
                    <span>
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="shippingMethod"
                          checked={selected}
                          onChange={() => setSelectedShippingId(s.id)}
                          className="accent-brand-pink"
                        />
                        {s.name}
                      </span>
                      {s.description && <span className="ml-6 block text-xs text-brand-muted">{s.description}</span>}
                    </span>
                    <span className="font-semibold text-brand-ink">
                      {s.cost > 0 ? `$${s.cost.toFixed(2)}` : "Gratis"}
                    </span>
                  </label>

                  {selected && s.requiresAddress && (
                    <div className="mt-4 border-t border-brand-pink/20 pt-4">
                      <label className="mb-1.5 block text-xs font-semibold text-brand-muted">Dirección de envío</label>
                      <textarea
                        required
                        rows={2}
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder="Calle, número, ciudad..."
                        className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {shippingMethods && shippingMethods.length === 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No hay métodos de envío disponibles para el medio de pago elegido.
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold text-brand-muted">Cupón de descuento (opcional)</p>
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 px-3.5 py-2.5 text-sm">
            <span className="font-medium text-green-800">
              &ldquo;{appliedCoupon.code}&rdquo; aplicado — -${appliedCoupon.discountAmount.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => {
                setAppliedCoupon(null);
                setCouponCode("");
              }}
              className="cursor-pointer text-xs font-semibold text-green-800 hover:underline"
            >
              Quitar
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Código de cupón"
              className="flex-1 rounded-lg border border-black/10 px-3.5 py-2 text-sm uppercase focus:border-brand-pink focus:outline-none"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={couponLoading || !couponCode.trim()}
              className="cursor-pointer rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {couponLoading ? "..." : "Aplicar"}
            </button>
          </div>
        )}
        {couponError && <p className="mt-1.5 text-xs text-red-600">{couponError}</p>}
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p>{error}</p>
          {shortages && (
            <ul className="mt-1.5 list-disc pl-4">
              {shortages.map((s) => (
                <li key={s.name}>
                  {s.name}: quedan {s.available}, pediste {s.requested}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>

      <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-5 lg:sticky lg:top-24 lg:mt-0">
        <h2 className="font-semibold text-brand-ink">Resumen</h2>

        <div className="flex flex-col gap-1">
          {appliedCoupon && (
            <div className="flex items-center justify-between text-sm text-green-700">
              <p>Cupón ({appliedCoupon.code})</p>
              <p>-${appliedCoupon.discountAmount.toFixed(2)}</p>
            </div>
          )}
          {selectedShipping && selectedShipping.cost > 0 && (
            <div className="flex items-center justify-between text-sm text-brand-muted">
              <p>Envío</p>
              <p>${selectedShipping.cost.toFixed(2)}</p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-black/10 pt-2">
            <p className="text-sm text-brand-muted">Total a pagar</p>
            <p className="text-lg font-bold text-brand-pink-dark">${finalTotal.toFixed(2)}</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !selectedShippingId}
          className="w-full cursor-pointer rounded-full bg-brand-pink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Confirmando..." : "Confirmar pedido"}
        </button>
      </div>
    </form>
  );
}
