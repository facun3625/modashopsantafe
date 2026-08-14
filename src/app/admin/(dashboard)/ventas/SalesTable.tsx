"use client";

import { useState, useTransition } from "react";
import type { SalesOrder } from "@/lib/sales";
import { orderStatusLabel, paymentMethodLabel, ORDER_STATUS_STYLES } from "@/lib/orderLabels";
import { confirmOrderPayment, cancelOrder, markOrderDelivered, deleteOrder } from "./actions";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif", "avif"];

function receiptKind(url: string | null): "image" | "pdf" | "other" | null {
  if (!url) return null;
  const ext = url.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

export function SalesTable({ orders }: { orders: SalesOrder[] }) {
  const [selected, setSelected] = useState<SalesOrder | null>(null);

  return (
    <>
      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
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
            {orders.map((o) => (
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
                  {receiptKind(o.transferProofUrl) && (
                    <span className="ml-1.5 align-middle text-brand-pink-dark" title="Tiene comprobante">📎</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ORDER_STATUS_STYLES[o.status] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {orderStatusLabel(o.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs font-semibold text-brand-pink-dark">Ver →</span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-brand-muted">
                  Todavía no hay pedidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <OrderDetailModal order={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function OrderDetailModal({ order, onClose }: { order: SalesOrder; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [lightbox, setLightbox] = useState(false);
  const kind = receiptKind(order.transferProofUrl);
  const showPdfPanel = kind === "pdf";

  function run(action: (id: string) => Promise<void>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    startTransition(async () => {
      await action(order.id);
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
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ORDER_STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"}`}
              >
                {orderStatusLabel(order.status)}
              </span>
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
                    onClick={() => setLightbox(true)}
                    className="max-h-40 cursor-zoom-in rounded-lg border border-black/10 object-contain"
                  />
                ) : kind === "pdf" ? (
                  <a
                    href={order.transferProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft"
                  >
                    📄 Abrir comprobante (PDF) en pestaña nueva
                  </a>
                ) : (
                  <a
                    href={order.transferProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-brand-pink-dark hover:underline"
                  >
                    Descargar comprobante
                  </a>
                )}
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-wrap gap-2 border-t border-black/10 pt-4">
              {order.status === "pending" && (
                <button
                  disabled={isPending}
                  onClick={() => run(confirmOrderPayment)}
                  className="cursor-pointer rounded-full bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-50"
                >
                  Confirmar pago
                </button>
              )}
              {(order.status === "pending" || order.status === "confirmed") && (
                <button
                  disabled={isPending}
                  onClick={() => run(markOrderDelivered)}
                  title="Normalmente se marca solo cuando despachás en Odoo. Usalo solo si necesitás liberar la reserva a mano."
                  className="cursor-pointer rounded-full border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  Marcar entregado (manual)
                </button>
              )}
              {order.status !== "cancelled" && order.status !== "delivered" && (
                <button
                  disabled={isPending}
                  onClick={() => run(cancelOrder)}
                  className="cursor-pointer rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-muted hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
              )}
              <button
                disabled={isPending}
                onClick={() => run(deleteOrder, "¿Eliminar este pedido definitivamente? No se puede deshacer.")}
                className="ml-auto cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>

          {/* Panel PDF al lado */}
          {showPdfPanel && order.transferProofUrl && (
            <div className="min-h-[300px] border-t border-black/10 bg-brand-soft/30 md:border-l md:border-t-0">
              <iframe
                src={order.transferProofUrl}
                title="Comprobante"
                className="h-full min-h-[400px] w-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* Lightbox de imagen */}
      {lightbox && kind === "image" && order.transferProofUrl && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(false);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={order.transferProofUrl}
            alt="Comprobante de transferencia"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
