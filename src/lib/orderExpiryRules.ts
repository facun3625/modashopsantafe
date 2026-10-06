// Reglas del vencimiento de pedidos pendientes (sin dependencias de servidor: las usa también la lista de Ventas en el
// navegador). Solo vence contra entrega: en transferencia el cliente ya adjuntó el comprobante (queda esperando que el
// equipo lo verifique), y en Mercado Pago y Payway un pendiente puede ser un pago en conciliación — cancelarlos solos
// podría anular una venta cobrada.
export const PENDING_EXPIRY_DAYS = 5;
export const EXPIRING_PAYMENT_METHODS: readonly string[] = ["contra_entrega"];

const DAY = 24 * 3600_000;

// Momento en que vence un pedido pendiente, o null si no vence (otro medio de pago).
export function pendingExpiresAt(order: { paymentMethod: string; createdAt: Date }): Date | null {
  if (!EXPIRING_PAYMENT_METHODS.includes(order.paymentMethod)) return null;
  return new Date(order.createdAt.getTime() + PENDING_EXPIRY_DAYS * DAY);
}
