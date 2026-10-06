// Reglas del vencimiento de pedidos pendientes (sin dependencias de servidor: las usa también la lista de Ventas en el
// navegador). Los días salen de cada medio de pago (PaymentMethodConfig.pendingExpiryDays, editable en /admin/pagos solo
// para contra entrega). Sin días cargados (o 0), el medio no vence.
export type ExpiryDaysByMethod = Record<string, number>;

const DAY = 24 * 3600_000;

// Momento en que vence un pedido pendiente, o null si su medio de pago no vence.
export function pendingExpiresAt(order: { paymentMethod: string; createdAt: Date }, days: ExpiryDaysByMethod): Date | null {
  const d = days[order.paymentMethod];
  if (!d || d <= 0) return null;
  return new Date(order.createdAt.getTime() + d * DAY);
}
