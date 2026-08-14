"use client";

import { useState, useTransition } from "react";
import type { SalesOrder } from "@/lib/sales";
import type { OrderStatus } from "@/generated/prisma/enums";
import { orderStatusLabel, paymentMethodLabel, ORDER_STATUS_STYLES } from "@/lib/orderLabels";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EyeIcon } from "@/components/icons";
import { changeOrderStatus, deleteOrder } from "./actions";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif", "avif"];
const STATUSES: OrderStatus[] = ["pending", "confirmed", "delivered", "cancelled"];

function receiptKind(url: string | null): "image" | "pdf" | "other" | null {
  if (!url) return null;
  const ext = url.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

// Select de estado que aplica el cambio al instante (sin botón aceptar).
// Optimista: muestra el nuevo estado enseguida y revierte si el server falla.
function OrderStatusSelect({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [value, setValue] = useState<OrderStatus>(status);
  const [pending, startTransition] = useTransition();

  function onChange(next: OrderStatus) {
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        await changeOrderStatus(orderId, next);
      } catch {
        setValue(prev);
      }
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as OrderStatus)}
      className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-pink/40 disabled:opacity-60 ${ORDER_STATUS_STYLES[value] ?? "bg-gray-100 text-gray-700"}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {orderStatusLabel(s)}
          {s === "delivered" ? " (se pone solo al despachar en Odoo)" : ""}
        </option>
      ))}
    </select>
  );
}

export function SalesTable({ orders }: { orders: SalesOrder[] }) {
  const [selected, setSelected] = useState<SalesOrder | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Abre el comprobante directo desde la lista: imagen en lightbox, PDF/otros
  // en pestaña nueva.
  function openReceipt(url: string) {
    if (receiptKind(url) === "image") setLightbox(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Items</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Pago</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold text-right">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const kind = receiptKind(o.transferProofUrl);
              return (
                <tr
                  key={o.id}
                  id={`order-${o.id.slice(0, 8)}`}
                  onClick={() => setSelected(o)}
                  className="scroll-mt-4 cursor-pointer border-b border-black/5 target:bg-brand-soft last:border-0 hover:bg-brand-soft/50"
                >
                  <td className="px-4 py-3 font-medium text-brand-ink">
                    {o.customerName}
                    <span className="block text-xs font-normal text-brand-muted">{o.customerEmail}</span>
                  </td>
                  <td className="px-4 py-3 text-brand-muted">{o.items.length}</td>
                  <td className="px-4 py-3 text-brand-muted">{o.createdAt.toLocaleDateString("es-AR")}</td>
                  <td className="px-4 py-3 text-brand-pink-dark">${o.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-brand-muted">
                    {paymentMethodLabel(o.paymentMethod)}
                    {kind && o.transferProofUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReceipt(o.transferProofUrl!);
                        }}
                        title={kind === "image" ? "Ver comprobante (imagen)" : "Abrir comprobante (PDF)"}
                        className="ml-2 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-pink text-white shadow-sm transition-colors hover:bg-brand-pink-dark align-middle"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusSelect orderId={o.id} status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-semibold text-brand-pink-dark">Ver →</span>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-brand-muted">
                  No hay pedidos que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <OrderDetailModal order={selected} onClose={() => setSelected(null)} onOpenReceipt={openReceipt} />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Comprobante de transferencia"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}

function OrderDetailModal({
  order,
  onClose,
  onOpenReceipt,
}: {
  order: SalesOrder;
  onClose: () => void;
  onOpenReceipt: (url: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const kind = receiptKind(order.transferProofUrl);
  const showPdfPanel = kind === "pdf";

  function doDelete() {
    startTransition(async () => {
      await deleteOrder(order.id);
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${showPdfPanel ? "max-w-5xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-brand-ink">{order.customerName}</h2>
            <p className="text-xs text-brand-muted">
              Pedido #{order.id.slice(0, 8)} · {order.createdAt.toLocaleString("es-AR")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-brand-ink hover:bg-brand-soft"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className={`min-h-0 flex-1 overflow-auto ${showPdfPanel ? "grid grid-cols-1 md:grid-cols-2" : ""}`}>
          {/* Columna: detalle */}
          <div className="space-y-5 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Estado:</span>
              <OrderStatusSelect orderId={order.id} status={order.status} />
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">
                {paymentMethodLabel(order.paymentMethod)}
              </span>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-brand-ink">{order.customerEmail}</p>
              {order.customerPhone && <p className="text-brand-muted">{order.customerPhone}</p>}
              {order.shippingMethod && (
                <p className="text-brand-muted">
                  Envío: {order.shippingMethod.name}
                  {order.shippingCost > 0 && ` ($${order.shippingCost.toFixed(2)})`}
                </p>
              )}
              {order.shippingAddress && <p className="text-brand-muted">📍 {order.shippingAddress}</p>}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">Productos</p>
              <div className="divide-y divide-black/5 rounded-lg border border-black/10">
                {order.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-brand-ink">
                      {it.quantity}× {it.name}
                    </span>
                    <span className="text-brand-muted">${(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-brand-muted">
                <span>Subtotal</span>
                <span>${order.subtotal.toFixed(2)}</span>
              </div>
              {/* No se guarda aparte: se deduce de subtotal/cupón/envío/total.
                  Es el % de descuento que tenía configurado el medio de pago
                  (/admin/pagos) al momento de la compra — por eso el total no
                  cierra a simple vista contra el subtotal. */}
              {(() => {
                const paymentDiscount = order.subtotal - order.couponDiscount - order.total + order.shippingCost;
                if (paymentDiscount <= 0.01) return null;
                const pct = Math.round((paymentDiscount / order.subtotal) * 100);
                return (
                  <div className="flex justify-between text-brand-muted">
                    <span>Descuento {paymentMethodLabel(order.paymentMethod)} ({pct}%)</span>
                    <span>−${paymentDiscount.toFixed(2)}</span>
                  </div>
                );
              })()}
              {order.couponDiscount > 0 && (
                <div className="flex justify-between text-brand-muted">
                  <span>Descuento cupón</span>
                  <span>−${order.couponDiscount.toFixed(2)}</span>
                </div>
              )}
              {order.shippingCost > 0 && (
                <div className="flex justify-between text-brand-muted">
                  <span>Envío</span>
                  <span>${order.shippingCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-black/10 pt-1 text-base font-bold text-brand-ink">
                <span>Total</span>
                <span className="text-brand-pink-dark">${order.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Comprobante */}
            {kind && order.transferProofUrl && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">Comprobante</p>
                {kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.transferProofUrl}
                    alt="Comprobante de transferencia"
                    onClick={() => onOpenReceipt(order.transferProofUrl!)}
                    className="max-h-40 cursor-zoom-in rounded-lg border border-black/10 object-contain"
                  />
                ) : (
                  <button
                    onClick={() => onOpenReceipt(order.transferProofUrl!)}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft"
                  >
                    📄 Abrir comprobante (PDF)
                  </button>
                )}
              </div>
            )}

            {/* Eliminar */}
            <div className="flex justify-end border-t border-black/10 pt-4">
              <button
                disabled={isPending}
                onClick={() => setConfirmDelete(true)}
                className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Eliminar pedido
              </button>
            </div>
          </div>

          {/* Panel PDF al lado */}
          {showPdfPanel && order.transferProofUrl && (
            <div className="min-h-[300px] border-t border-black/10 bg-brand-soft/30 md:border-l md:border-t-0">
              <iframe src={order.transferProofUrl} title="Comprobante" className="h-full min-h-[400px] w-full" />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        danger
        pending={isPending}
        title="Eliminar pedido"
        message="Se elimina definitivamente y no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
