# Verificación del checkout

## Cambios

- Las tres rutas de compra validan cantidades enteras positivas, agrupan productos repetidos y consultan nombres y precios en Odoo. Los precios del navegador no determinan el cobro.
- Mercado Pago y Payway guardan el pedido pendiente y reservan stock antes de cobrar. El ID del pedido es la referencia enviada al proveedor.
- El navegador conserva el identificador del intento en sessionStorage. Una repetición del mismo intento no vuelve a cobrar ni enviar avisos. Un pedido aprobado devuelve su ID existente.
- Un rechazo explícito cancela el pedido y libera stock. Un error de conexión o resultado incierto conserva el pedido pendiente; no se interpreta como rechazo.
- Solo los pagos aprobados generan automáticamente el picking en Odoo, Telegram y correo. Transferencia y contra entrega conservan su confirmación manual y sus avisos al recibir la compra.
- El rol de la sesión se consulta en la base. Las acciones administrativas usan un guard compartido que verifica que el usuario exista y siga siendo administrador.

## Pagos pendientes de verificación

Ante un resultado incierto, buscar el pedido pendiente en Ventas y verificar el pago en el proveedor usando el ID completo del pedido como referencia (external_reference en Mercado Pago, site_transaction_id en Payway). No confirmar ni cancelar basándose solamente en el mensaje de error del navegador.

Si el proveedor confirma el cobro, confirmar el pedido desde el panel para generar el picking en Odoo. Si confirma que no hubo cobro, cancelar para liberar la reserva. El intento cancelado permite iniciar uno nuevo. Si hay un reembolso pendiente, verificarlo también antes de liberar el caso.

La conciliación de resultados inciertos es manual: no se agregó un webhook ni un proceso de consulta automática. Los avisos automáticos del checkout solo se envían cuando la aprobación y su registro terminan en esa solicitud; en un caso conciliado manualmente, comunicar la resolución al cliente.

## Comprobaciones locales

```sh
node --test tests/checkout-security.test.mjs
npx tsc --noEmit --incremental false
npm run lint
```

Las pruebas ejecutan las rutas y los helpers reales con base de datos, Odoo, pagos, archivos y avisos simulados. Cubren precios alterados, cantidades inválidas, productos repetidos, rechazo, resultado incierto, reembolso, reintentos simultáneos del mismo pedido, transferencia, contra entrega, avisos y revocación de permisos. No prueban bloqueos contra PostgreSQL real ni cobran tarjetas.

Antes de producción, verificar una compra en sandbox de cada proveedor, una transferencia y una contra entrega en una instalación de prueba, incluyendo correo, Telegram y picking en Odoo. No se requieren migraciones de base para estos cambios.
