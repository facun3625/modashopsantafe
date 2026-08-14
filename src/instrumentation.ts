// Se ejecuta una única vez cuando arranca el server (ver
// node_modules/next/dist/docs/.../instrumentation.md). Lo usamos para
// disparar la sincronización automática de puntos: cada 15 minutos revisa
// en Odoo qué pedidos ya se entregaron (picking en estado "done") y les
// acredita los puntos correspondientes. También hay un botón manual en
// /admin/puntos que llama a la misma función para no depender solo de esto.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { syncDeliveredOrders } = await import("@/lib/points");
  const { releaseDeliveredReservations } = await import("@/lib/reservations");
  const INTERVAL_MS = 15 * 60 * 1000;

  const run = () => {
    // Acredita puntos de pedidos ya entregados en Odoo...
    syncDeliveredOrders().catch((err) => console.error("syncDeliveredOrders (auto) failed", err));
    // ...y libera la reserva de stock de esos mismos pedidos (picking "done"),
    // reemplazando el paso manual "Marcar entregado".
    releaseDeliveredReservations().catch((err) =>
      console.error("releaseDeliveredReservations (auto) failed", err)
    );
  };

  setTimeout(run, 30_000);
  setInterval(run, INTERVAL_MS);
}
