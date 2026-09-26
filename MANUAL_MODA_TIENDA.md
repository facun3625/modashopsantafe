# Manual Moda Tienda

## Guía funcional y operativa

**Versión actualizada:** 26 de septiembre de 2026

Este manual explica las funciones disponibles para administrar y utilizar ModaShop. Está orientado al dueño de la tienda y al equipo comercial.

---

## 1. Descripción general

ModaShop es una tienda online conectada con el catálogo y el inventario de Odoo. Desde una misma plataforma permite publicar productos, recibir pedidos, administrar promociones, atender clientes y analizar el funcionamiento del negocio.

La tienda incluye:

- Catálogo conectado con Odoo.
- Buscador y navegación por categorías.
- Carrito y proceso de compra.
- Medios de pago y envío configurables.
- Cupones y programa de puntos.
- Vendedora virtual con inteligencia artificial.
- Atención humana mediante WhatsApp.
- Carritos abandonados y lista de espera.
- Mailing y notificaciones push.
- Estadísticas de ventas y visitas.
- Contenido promocional administrable.
- Pop-up promocional.
- Instalación como Web App.

### Qué se administra desde Odoo

Odoo mantiene:

- Productos.
- Imágenes de productos.
- Categorías.
- Precios.
- Stock físico.

### Qué se administra desde ModaShop

El panel de ModaShop mantiene:

- Pedidos de la tienda online.
- Reservas de stock web.
- Medios de pago.
- Métodos de envío.
- Cupones y puntos.
- Usuarios y favoritos.
- Contenido de la portada.
- Vendedora virtual.
- Pop-up promocional.
- Mailing, push y contactos comerciales.
- Estadísticas y visitas.

---

## 2. Tipos de usuario

### Visitante

Puede recorrer la tienda, buscar productos, consultar a la vendedora virtual, utilizar el carrito, anotarse en la lista de espera y comprar sin crear una cuenta.

### Cliente registrado

Además de comprar, puede:

- Guardar favoritos.
- Consultar sus pedidos.
- Acumular puntos.
- Canjear recompensas.
- Recibir avisos en los dispositivos donde activó las notificaciones.

### Administrador

Puede ingresar al panel y gestionar ventas, productos, usuarios, promociones, comunicaciones, estadísticas y configuración general.

---

## 3. Tienda pública

### 3.1 Página de inicio

La portada reúne los principales elementos comerciales:

- Barra con ubicación e Instagram.
- Menú de navegación.
- Buscador con sugerencias.
- Slider principal.
- Franja de textos promocionales.
- Beneficios de la tienda.
- Categorías destacadas.
- Productos destacados.
- Ubicación y contacto.
- Suscripción al newsletter.

### 3.2 Slider principal

Desde **Configuración → Slider** se pueden crear hasta tres piezas promocionales.

Cada slide admite:

- Imagen principal.
- Texto superior.
- Título.
- Subtítulo.
- Texto dentro del círculo promocional.
- Hasta tres botones con enlace.
- Orden de aparición.
- Activación o desactivación.

### 3.3 Beneficios de la tienda

La franja de beneficios del inicio permite destacar información como medios de pago, envíos y retiro en el local.

Desde **Configuración → General → Franja de beneficios** se administran sus tres bloques. En cada uno se puede elegir:

- Icono.
- Título.
- Subtítulo.

Si un texto se deja vacío, la tienda utiliza el valor automático que aparece como referencia en el formulario.

### 3.4 Catálogo

La tienda consulta los productos activos de Odoo y muestra:

- Imagen.
- Nombre.
- Precio.
- Categoría.
- Disponibilidad.

El administrador puede decidir si los productos agotados permanecen visibles o se ocultan por completo.

### 3.5 Categorías

Las categorías conservan la organización definida en Odoo. Se utilizan para:

- Navegar el catálogo.
- Mostrar secciones destacadas.
- Aplicar cupones.
- Configurar descuentos.
- Generar recomendaciones.

### 3.6 Buscador

El buscador permite encontrar productos por nombre y muestra sugerencias mientras el cliente escribe. Está disponible tanto en escritorio como en dispositivos móviles.

### 3.7 Productos

Desde cada tarjeta el cliente puede:

- Ampliar la imagen.
- Agregar el producto al carrito.
- Guardarlo como favorito.
- Consultar su disponibilidad.
- Solicitar un aviso si no tiene stock.

### 3.8 Favoritos

Los clientes registrados pueden guardar productos y consultarlos desde **Mi cuenta → Favoritos**. El precio y el stock se actualizan desde Odoo cuando se abre la lista.

### 3.9 Lista de espera

Cuando un producto está agotado, el cliente puede dejar sus datos. El administrador encuentra esos contactos en **Lista de espera** y puede:

- Ver el producto solicitado.
- Consultar nombre, email y teléfono.
- Abrir una conversación por WhatsApp.
- Copiar los correos.
- Eliminar registros atendidos.

### 3.10 Newsletter

El formulario del sitio guarda los emails interesados en novedades. Esos contactos pueden utilizarse desde el módulo de Mailing.

---

## 4. Carrito y compra

### 4.1 Carrito

El carrito se conserva en el navegador y permite:

- Agregar y quitar productos.
- Modificar cantidades.
- Consultar el subtotal.
- Ver recomendaciones relacionadas.
- Continuar hacia el checkout.

### 4.2 Datos del comprador

La compra puede realizarse con una cuenta o como invitado. Se solicitan nombre, email, teléfono y domicilio cuando el tipo de entrega lo requiere.

### 4.3 Métodos de envío

Desde **Envíos** se pueden crear y administrar alternativas de entrega con:

- Nombre.
- Descripción.
- Costo.
- Activación.
- Requisito de domicilio.

Los envíos disponibles también pueden limitarse según el medio de pago.

### 4.4 Cupones

Desde **Cupones** se pueden crear promociones con:

- Código.
- Descuento porcentual o monto fijo.
- Producto o categoría.
- Medio de pago.
- Compra mínima.
- Vencimiento.
- Límite de usos.
- Estado activo o inactivo.

La opción **Cupón rápido** permite generar una promoción sencilla para compartir inmediatamente por WhatsApp.

### 4.5 Medios de pago

La tienda admite:

- Transferencia bancaria.
- Pago contra entrega.
- Mercado Pago.
- Payway para tarjetas.

Cada medio puede activarse o desactivarse desde **Pagos**. También se puede configurar un descuento general y excepciones por categoría.

### 4.6 Transferencia bancaria

El checkout muestra los datos bancarios cargados en el panel y solicita un comprobante en imagen o PDF. El pedido queda pendiente hasta que un administrador lo confirme.

### 4.7 Pago contra entrega

El pedido queda pendiente y se confirma desde el panel cuando corresponde.

### 4.8 Pagos con tarjeta

Cuando el proveedor aprueba el cobro, el pedido se confirma automáticamente. Si el pago es rechazado, el pedido se cancela y el stock reservado vuelve a quedar disponible.

### 4.9 Confirmación de compra

Después de registrar el pedido, el cliente puede recibir:

- Email de confirmación.
- Notificación push si tiene una cuenta y activó los avisos.

El comercio puede recibir un aviso del nuevo pedido mediante Telegram.

---

## 5. Pedidos y stock

### 5.1 Estados

| Estado | Significado |
|---|---|
| **Pendiente** | Espera confirmación de pago o revisión del comercio. |
| **Confirmado** | La operación fue aceptada y se prepara el pedido. |
| **Entregado** | La entrega fue completada. |
| **Cancelado** | La operación fue anulada. |

### 5.2 Reserva de stock

Los pedidos pendientes y confirmados reservan unidades para la tienda online. La disponibilidad publicada descuenta esas reservas del stock físico informado por Odoo.

### 5.3 Gestión desde Ventas

En **Ventas** el administrador puede:

- Buscar por cliente, email o teléfono.
- Filtrar por estado y medio de pago.
- Consultar productos e importes.
- Abrir comprobantes.
- Cambiar el estado.
- Eliminar un pedido.

### 5.4 Relación con Odoo

Al confirmar una venta se genera el movimiento de inventario correspondiente. Cuando la entrega queda validada en Odoo, ModaShop puede actualizar el pedido y acreditar puntos al cliente.

---

## 6. Vendedora virtual

### 6.1 Función

La vendedora virtual atiende consultas, interpreta necesidades y recomienda productos del catálogo real.

Puede consultar automáticamente:

- Productos y categorías.
- Precios y stock.
- Dirección y datos de contacto.
- Instagram y WhatsApp.
- Días y horarios de atención.
- Medios de pago y descuentos.
- Datos de transferencia.
- Métodos y costos de envío.

No hace falta repetir estos datos dentro de las instrucciones comerciales.

### 6.2 Configuración desde el panel

En **Configuración → Vendedora IA** el dueño puede modificar:

- Activación o desactivación.
- Nombre visible.
- Mensaje de bienvenida.
- Instrucciones comerciales.
- Días de atención humana.
- Horario de WhatsApp.

Las instrucciones comerciales sirven para definir prioridades y estilo. Por ejemplo:

- Priorizar una colección.
- Preguntar para qué ocasión busca el producto.
- Mantener un tono cercano.
- Recomendar primero determinados estilos.

### 6.3 Recomendaciones

Las respuestas pueden incluir tarjetas de productos. El cliente puede agregarlos al carrito directamente desde la conversación.

### 6.4 Atención humana

Dentro del horario configurado, la vendedora puede ofrecer contacto con una persona por WhatsApp. Fuera del horario informa cuándo vuelve a estar disponible.

Si la vendedora se desactiva, la tienda muestra el acceso directo a WhatsApp.

### 6.5 Limpiar conversación

El botón **Limpiar chat** borra el historial de esa conversación y comienza una sesión nueva.

---

## 7. Clientes y fidelización

### 7.1 Registro e ingreso

Los clientes pueden crear una cuenta con nombre, email y contraseña, o ingresar mediante Google cuando esta opción se encuentra disponible.

### 7.2 Mi cuenta

La sección permite consultar:

- Pedidos.
- Favoritos.
- Puntos y recompensas.

### 7.3 Programa de puntos

Desde **Puntos** se configura:

- Activación del programa.
- Puntos otorgados por cada $1.000.
- Recompensas disponibles.
- Descuento porcentual o fijo de cada recompensa.

Los puntos se acreditan al cliente registrado cuando el pedido figura como entregado.

### 7.4 Canje

Cuando el cliente canjea una recompensa, el sistema descuenta los puntos y crea un cupón personal de un solo uso.

### 7.5 Usuarios

Desde **Usuarios** se puede:

- Buscar clientes.
- Consultar datos básicos.
- Cambiar el rol entre cliente y administrador.
- Eliminar una cuenta.

---

## 8. Recuperación y comunicación

### 8.1 Carritos abandonados

El panel conserva la última actividad de los carritos y permite:

- Diferenciar clientes registrados, invitados y anónimos.
- Ver productos y valor estimado.
- Copiar emails.
- Abrir un mensaje de recuperación por WhatsApp.
- Eliminar registros.
- Limpiar carritos antiguos.

### 8.2 Mailing

El módulo permite crear campañas para:

- Usuarios registrados.
- Suscriptores del newsletter.
- Carritos abandonados.
- Lista de espera.

El editor permite utilizar:

- Negrita.
- Alineación.
- Distintos tamaños de texto.
- Enlaces.
- Imágenes.

El panel muestra destinatarios, cantidad enviada, estado e historial de campañas.

La pestaña **Disponibilidad** permite:

- Definir un cupo mensual de emails.
- Consultar cuántos envíos se utilizaron durante el mes.
- Ver cuántos quedan disponibles.
- Revisar las campañas enviadas desde el primer día del mes.

El cupo es informativo: ayuda a controlar el consumo, pero no bloquea automáticamente una campaña.

### 8.3 Notificaciones push

Los clientes que instalan la Web App y aceptan los avisos pueden recibir notificaciones aunque no tengan la tienda abierta.

Desde **Notificaciones** el administrador puede definir:

- Título.
- Mensaje.
- Enlace interno opcional.

También puede consultar la cantidad de dispositivos activos y el historial de envíos.

### 8.4 Telegram

Cuando entra una venta, el comercio puede recibir un mensaje automático en un grupo de Telegram. Desde Configuración se pueden guardar los datos del bot y realizar una prueba.

### 8.5 WhatsApp

WhatsApp está integrado en:

- Vendedora virtual.
- Atención directa cuando la IA está apagada.
- Carritos abandonados.
- Lista de espera.
- Cupones rápidos.

---

## 9. Pop-up promocional

### 9.1 Qué es

El pop-up es una ventana promocional que aparece 600 milisegundos después de ingresar al sitio. Puede utilizarse para comunicar descuentos, lanzamientos, horarios especiales, eventos o novedades.

### 9.2 Dónde se configura

Ingresar a **Configuración → Pop-up**.

### 9.3 Opciones disponibles

- **Habilitado:** activa o desactiva la ventana.
- **Dónde se muestra:** todo el sitio, solo el inicio o solo la tienda.
- **Frecuencia:** una vez por visitante o cada vez que ingresa.
- **Título:** encabezado de hasta 100 caracteres.
- **Texto:** contenido principal con formato enriquecido.

### 9.4 Editor del contenido

El texto admite:

- Negrita.
- Alineación izquierda, centrada o derecha.
- Tamaño normal, grande o título.
- Enlaces.
- Imágenes PNG, JPG, WEBP, GIF o AVIF de hasta 4 MB.

### 9.5 Frecuencia “Una vez”

El navegador recuerda que el visitante ya cerró el pop-up. Si el administrador modifica el título o el contenido, la nueva versión vuelve a mostrarse aunque la anterior ya haya sido vista.

### 9.6 Comportamiento en la tienda

- Se adapta a computadoras y teléfonos.
- Puede cerrarse con el botón superior o tocando fuera de la ventana.
- El contenido tiene desplazamiento interno cuando es extenso.
- Las imágenes se adaptan al ancho disponible.

---

## 10. Panel administrativo

### 10.1 Inicio

El tablero presenta:

- Ingresos confirmados.
- Pedidos por estado.
- Usuarios y altas recientes.
- Carritos abandonados.
- Lista de espera.
- Suscriptores.
- Evolución de ventas.
- Pedidos recientes.
- Estado del catálogo de Odoo.

### 10.2 Productos

Permite consultar el catálogo de Odoo con búsqueda, categorías, rangos de precio, stock, orden y paginación. Las modificaciones de productos se realizan en Odoo.

### 10.3 Estadísticas

Muestra información de 7 días, 30 días, 12 meses o todo el historial:

- Ingresos.
- Ticket promedio.
- Unidades vendidas.
- Clientes.
- Pedidos.
- Descuentos.
- Envíos cobrados.
- Productos más vendidos.
- Resultados por pago, envío y estado.

### 10.4 Visitas

Permite consultar páginas vistas, sesiones únicas, evolución y páginas más visitadas.

### 10.5 Configuración

Las pestañas disponibles son:

- **General:** mantenimiento, stock, contacto, textos y categorías destacadas.
- **Franquicia:** nombre y ubicación.
- **Mail de compra:** contenido del mensaje enviado al cliente.
- **Telegram:** avisos de ventas.
- **Vendedora IA:** identidad, instrucciones y horarios.
- **Slider:** banners principales.
- **Pop-up:** ventana promocional del sitio.

### 10.6 Registro de actividad

El panel registra acciones administrativas relevantes, como cambios de pedidos y configuración de medios de pago.

### 10.7 Modo mantenimiento

Al activarlo, los clientes ven una pantalla de mantenimiento. Los administradores pueden continuar ingresando al panel y revisar la tienda.

---

## 11. Web App y dispositivos

### 11.1 Instalación

La tienda puede instalarse desde navegadores compatibles en teléfonos y computadoras. Una vez instalada, se abre con una apariencia similar a una aplicación.

El acceso **Descargar Web App** guía al cliente según su dispositivo:

- En Android, Chrome, Edge y navegadores compatibles abre la instalación.
- En Safari de iPhone o iPad explica cómo utilizar **Compartir → Agregar a inicio**.
- En otros navegadores de iPhone indica que la instalación debe realizarse desde Safari.
- Si el navegador no permite instalarla, informa qué alternativa utilizar.

Cuando la aplicación ya está instalada, el botón deja de mostrarse.

### 11.2 Notificaciones

Después de instalarla, el cliente puede aceptar notificaciones para recibir novedades y avisos de pedidos.

### 11.3 Adaptación a pantallas

La interfaz está preparada para:

- Computadoras.
- Tablets.
- Teléfonos.
- Pantallas pequeñas desde 320 px.
- Áreas seguras de iPhone.
- Navegación táctil.

---

## 12. Protección de la operación

### 12.1 Precios y totales

El servidor vuelve a consultar los productos y recalcula precios, descuentos, cupones, envío y total antes de registrar la compra.

### 12.2 Stock

Las compras simultáneas se controlan para reducir la posibilidad de vender más unidades de las disponibles.

### 12.3 Pagos

Los datos completos de tarjeta son procesados por el proveedor de pago. ModaShop utiliza el resultado de esa operación y no guarda los números completos de la tarjeta.

### 12.4 Acceso administrativo

Las acciones del panel requieren una cuenta administradora. Los cambios de rol se verifican nuevamente al realizar operaciones protegidas.

### 12.5 Vendedora virtual

La asistente consulta fuentes reales antes de responder sobre productos, stock, precios, pagos, envíos y datos de la tienda. Las instrucciones comerciales no pueden reemplazar estas protecciones.

---

**Fin del Manual Moda Tienda**
