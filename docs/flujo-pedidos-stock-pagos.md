# Flujo de pedidos, stock y pagos

Decisiones tomadas en las conversaciones de diseño. **Actualizado**: este Odoo no
tiene el módulo de Ventas instalado (`sale.order` no existe) — sí tiene Inventario,
Compras, Punto de Venta y Facturación. El plan original asumía `sale.order`; esta
versión ya refleja el pivot a `stock.picking` directo (implementado en
`POST /api/orders`).

## Cómo funciona el stock en Odoo (importante entenderlo)

- `qty_available` (el campo "Quantity On Hand") es el **stock físico real en el depósito**.
  No se descuenta al crear ni confirmar un `stock.picking`.
- El pedido online crea un `stock.picking` de salida (tipo "Santa Fe: Órdenes de
  entrega") **confirmado y reservado** (`action_confirm` + `action_assign`) — queda
  comprometido para ese pedido, pero `qty_available` no cambia todavía.
- El stock recién baja cuando alguien del equipo **valida la transferencia** (botón
  "Validar" en Inventario → Transferencias, o escaneo con lector de código de barras)
  al empaquetar/despachar el pedido. Es el mismo gesto que ya tendrían que hacer para
  saber qué mandar — no es un paso nuevo si ya usan Odoo para preparar pedidos.
  **Decisión explícita**: no se auto-valida desde la app, justamente para no perder
  ese hábito ni la cola de "pendientes de armar" en Odoo.
- **Importante**: si hoy despachan pedidos (WhatsApp, mostrador) sin pasar por Inventario
  en Odoo, hay que incorporar ese hábito, si no el stock del sitio nunca se actualiza solo.

## Dónde queda registrado cada pedido

- **Prisma (`Order` + `OrderItem`)** es la única fuente de verdad del pedido en sí
  (cliente, items, total, estado) — Odoo no tiene dónde guardar esto sin el módulo
  de Ventas. El admin panel (`/admin/ventas`) lee de acá.
- **Odoo** solo se usa para el `res.partner` (cliente) y el `stock.picking` (para que
  el descuento de stock físico pase por el mismo lugar que cualquier otro despacho).
- `Order.odooPartnerId` / `Order.odooPickingId` en Prisma guardan la trazabilidad
  hacia Odoo.

## Flujo de checkout acordado (negocio con pocos empleados)

Prioridad: minimizar carga operativa y evitar sobreventa, sin sistemas de reserva
en tiempo real que no se puedan mantener con poco equipo.

1. **Carrito**: estado del lado del cliente (no toca Odoo todavía).
2. **Antes de pagar**: chequear `qty_available` de cada ítem del carrito contra Odoo.
   Si algo no alcanza, avisar ahí mismo ("quedan 2 unidades") y bloquear el checkout.
   Cubre la mayoría de los casos de sobreventa sin necesidad de reservar stock.
3. **Crear preferencia de pago en Mercado Pago**: todavía sin crear nada en Odoo ni
   en Prisma — si el cliente abandona el pago, no queda un pedido fantasma.
4. **Webhook de Mercado Pago (pago aprobado)**:
   - Re-chequear stock una última vez (por si pasó algo entre el paso 2 y el pago —
     caso raro de dos compras simultáneas del último producto).
   - Buscar o crear el `res.partner` (cliente logueado → vincula `odooPartnerId` en
     Postgres; invitado → se crea/busca por email directamente en Odoo, sin cuenta).
   - Crear el `Order` en Prisma y el `stock.picking` reservado en Odoo (esto ya está
     implementado en `POST /api/orders` — falta dispararlo desde acá en vez de
     llamarlo directo desde el cliente).
5. **El pedido queda visible** en `/admin/ventas` (Prisma) y en Odoo → Inventario →
   Transferencias (reservado, pendiente de armar) listo para que el equipo lo
   prepare. El stock baja solo cuando validan la transferencia física.

## Decisiones de arquitectura ya tomadas

- **Pagos**: Mercado Pago gestionado desde Next.js. El pedido se crea ya
  confirmado/pagado (no se usan los proveedores de pago nativos de Odoo).
- **Auth de clientes**: cuenta propia (NextAuth + Credentials + Postgres/Prisma) y
  checkout como invitado (crea `res.partner` al vuelo, sin cuenta). Los usuarios
  y sus sesiones viven en la Postgres propia del proyecto — Odoo solo conoce a los
  clientes como `res.partner` cuando hacen una compra.
- **Catálogo**: NO se espeja/cachea en Postgres. Se lee siempre en vivo de Odoo vía
  `product.template` + `product.category`, navegando por categoría con paginación
  (`limit`/`offset`) — el catálogo tiene ~2400 productos activos, no se cargan todos
  de una vez.

## Piezas que faltan implementar

- [ ] Chequeo de stock antes de generar la preferencia de pago (paso 2).
- [ ] Integración Mercado Pago: creación de preferencia + ruta de webhook
      (`MERCADOPAGO_ACCESS_TOKEN` en `.env.local` todavía vacío).
- [ ] Adaptar `POST /api/orders` (hoy crea el pedido y el picking sin pago) para que
      se dispare desde el webhook de MP en vez de llamarse directo desde el cliente.
- [ ] Guardar `paymentId`/referencia de Mercado Pago en el `Order` de Prisma para
      poder conciliar pagos.
- [ ] Conectar el botón "Finalizar compra" (hoy deshabilitado) al flujo real.
