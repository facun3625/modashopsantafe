# Integración de PayWay (Decidir) — Referencia técnica

Resumen de todo lo aprendido integrando PayWay como medio de pago con tarjeta en SGO
(agosto 2026). Sirve como referencia para replicar esta integración en otro proyecto
o para agregar los flujos que faltan acá mismo.

## Qué es

PayWay es la marca comercial de **Decidir** (Prisma/Banco Galicia) para venta online.
Detrás usa el motor antifraude **Cybersource** de Visa. A diferencia de MercadoPago
(que redirige a un checkout externo), PayWay tokeniza la tarjeta **en el navegador**
del cliente y el cobro se ejecuta **desde tu backend** con ese token — nunca ves el
número de tarjeta.

## Arquitectura (dos pasos, dos keys distintas)

| Paso | Dónde corre | Key que usa | Qué hace |
|---|---|---|---|
| 1. Tokenización | Navegador | Pública | Manda los datos de tarjeta a Payway, recibe un token de un solo uso |
| 2. Cobro | Backend | Privada (secreta) | Ejecuta el pago con ese token — respuesta síncrona, aprobado o rechazado en el momento |

No hace falta webhook (a diferencia de MercadoPago): la respuesta del cobro llega
en la misma request HTTP.

## Documentación oficial

La única fuente confiable son los README de GitHub — **no hay PDF de integración
para Node**. El sitio `docs.payway.com.ar` es una SPA (Next.js) que no se puede
scrapear con fetch simple, hay que leer el contenido renderizado a mano.

- SDK Node (backend, referencia de campos): https://github.com/payway-ar/sdk-node-ventaonline
- SDK JavaScript (frontend, se usa tal cual): https://github.com/payway-ar/sdk-javascript-ventaonline
- Soporte para credenciales: soporte@payway.com.ar

**Importante**: no instalamos el SDK Node oficial (`sdk-node-payway`) porque trae
dependencias viejas (`express`, `node-rest-client` de 2018) solo para envolver dos
llamadas HTTP. Se llama la API REST directo con `fetch`. El contrato exacto (campos,
headers) se confirmó leyendo el código fuente del SDK oficial + probando en vivo
contra la sandbox real — no hay que adivinar nada, está todo abajo.

## Credenciales y ambientes

Se piden por mail a soporte@payway.com.ar (el comercio tiene que estar adherido a
"venta online", distinto del alta para terminales físicas). Piden:

- Public API Key
- Private/Secret API Key
- Site ID (8 dígitos)

| Ambiente | URL base API | Script frontend |
|---|---|---|
| Sandbox | `https://developers.decidir.com/api/v2` | `https://ventasonline.payway.com.ar/static/v2.6.4/decidir.js` |
| Producción | `https://ventasonline.payway.com.ar/api/v2` | (mismo script, cambia solo la URL base que se le pasa al constructor) |

⚠️ **La URL de producción NO es `live.decidir.com`** — ese dominio es de otro
producto de la misma empresa. Confirmado leyendo `lib/utils/constants.js` del SDK
oficial (`ENDPOINT_PRD_V2 = "https://ventasonline.payway.com.ar/api/v2"`).

En este proyecto las credenciales se guardan en la tabla `Config` (mismo patrón que
MercadoPago), configurables desde Admin → Métodos de Pago — no en `.env`. Sandbox y
producción tienen credenciales **separadas** (Payway las emite distintas para cada
ambiente — ver el pedido de producción más abajo), guardadas en claves con sufijo:
`paywaySiteId_developer`/`paywaySiteId_production`, `paywayPublicKey_developer`/`_production`,
`paywaySecretKey_developer`/`_production`, más `paywayAmbiente` (`developer`|`production`)
que define cuál de las dos se usa en cada momento. Las claves viejas sin sufijo
(`paywaySiteId`, `paywayPublicKey`, `paywaySecretKey`) quedan como fallback de
migración en `getPaywayConfig()` — si todavía no se cargó nada en la clave nueva
del ambiente activo, se usa el valor viejo tal cual.

## Flujo técnico (implementado en SGO)

1. **Frontend** ([PaywayCardForm.tsx](../src/components/pagos/PaywayCardForm.tsx)):
   - Carga `decidir.js` por `<Script>` (no está en npm).
   - `new Decidir(apiUrl)` → `setPublishableKey(publicKey)`.
   - **Esto dispara solo** (sin que vos hagas nada) una llamada a `/frauddetectionconf`
     que trae el `org_id` de Cybersource de esa cuenta, y con eso inyecta el script de
     "device fingerprint" (`h.online-metrix.net/fp/tags.js?org_id=...&session_id=...`).
     **No hay que configurar el `org_id` a mano en ningún lado** — es 100% automático
     del SDK. Esto fue el hallazgo más importante de toda la integración: parecía un
     bloqueo grande y no lo es.
   - Formulario con inputs `data-decidir="card_number"` etc. (el SDK lee el DOM, no
     recibe un objeto JS).
   - `decidir.createToken(form, callback)` → tokeniza. El fingerprint generado en el
     paso anterior **viaja pegado al token automáticamente** (se ve en el código
     fuente del SDK: `r.fraud_detection.device_unique_identifier = this.device_unique_identifier`
     dentro de la función que arma el POST a `/tokens`).
   - Se detecta la marca de la tarjeta con `decidir.cardType(numero)` — **cuidado**:
     si el usuario escribe la tarjeta antes de que `setPublishableKey` termine de
     inicializar (la llamada a `/frauddetectionconf` es async), la detección corre
     una vez con el SDK todavía no listo y no se reintenta. Hay que re-disparar la
     detección cuando el SDK queda listo, no solo cuando cambia el número.

2. **Backend** ([lib/payway.ts](../src/lib/payway.ts)):
   - `POST {apiUrl}/payments` con header `apikey: <secretKey>`.
   - El **monto siempre se recalcula server-side** desde la base — nunca se confía
     en lo que manda el cliente.
   - `site_transaction_id` único por operación (no un timestamp pelado — puede
     colisionar si dos usuarios pagan en el mismo milisegundo).

## payment_method_id — NO son universales

Cada cuenta de Payway tiene sus propios códigos por marca de tarjeta. Se confirmaron
a mano contra la sandbox real (probando token real + POST /payments y viendo si el
error era "invalid_param: payment_method_id" o si avanzaba a la siguiente etapa de
validación):

| Marca | payment_method_id confirmado |
|---|---|
| Visa (crédito) | **1** |
| Visa Débito | **31** — código totalmente distinto al de crédito. Mandar el de crédito (1) para una tarjeta de débito real no da "marca no soportada", da **"invalid_param: bin"** (el bin no corresponde a ese medio de pago) — así se detectó este caso. |
| Mastercard (crédito) | **104** (¡no 15! — el genérico "15 MasterCard" da inválido en esta cuenta, hay que usar el específico "MasterCard Payway") |
| Mastercard Débito | **105** ("MC Debit Payway" — no confundir con "133 MC Debit Fiserv", otro proveedor) |
| Cabal | ⚠️ **pendiente** — se probaron 27, 63, 67, 97, 107, 120, 134 y ninguno cerró completo (63 fue el más cercano, pasó la validación de `payment_method_id` pero falló en `bin`) |

El frontend (`PaywayCardForm.tsx`) detecta débito vs. crédito a partir de lo que
devuelve `decidir.cardType()` (busca "debit"/"débito" en el string) y manda la
marca ya distinguida (`visa_debito`, `mastercard_debito`, etc.) — el backend no
adivina nada, solo mapea esa marca a su `payment_method_id` en `PAYWAY_PAYMENT_METHOD_ID`.

Para ver el listado completo de códigos de esta cuenta: `GET /payment-methods/all`
con la public key (endpoint no documentado en el README, se encontró probando).

## El bloqueo grande: Cybersource obligatorio, vertical "Retail"

Esta cuenta tiene Cybersource **obligatorio** (no se puede desactivar por config del
lado nuestro) y configurada específicamente en la vertical **"Retail"** (comercio con
envío físico), aunque SGO no envía nada por correo — son cuotas/cursos/matrícula.
Cybersource exige entonces datos de "envío" que no tienen sentido real para nosotros.

**Solución**: no inventar los datos — pedirle al usuario su dirección de facturación
real (dirección, ciudad, provincia, CP) en el mismo formulario de pago, y usar esos
datos genuinos también como `ship_to`. No hace falta mentir ni fabricar nada.

### Payload de `fraud_detection` que funciona (vertical Retail)

```js
fraud_detection: {
  send_to_cs: true,
  channel: "web",
  bill_to: {
    city, country: "AR", customer_id, email, first_name, last_name,
    phone_number, postal_code, state, street1,
  },
  purchase_totals: { currency: "ARS", amount: amountEnCentavos },
  customer_in_site: { days_in_site, is_guest, num_of_transactions },
  retail_transaction_data: {
    dispatch_method: "homeDelivery",  // valor probado y aceptado, aunque no haya envío real
    days_to_delivery: "0",            // ⚠️ STRING, no number — si mandás number da invalid_param
    ship_to: { city, country: "AR", email, first_name, last_name, postal_code, state, street1 },
    items: [{ code, description, name, sku, total_amount, quantity, unit_price }],
    // ⚠️ OJO: el ejemplo corto del README oficial usa {id, value, description, quantity}
    // — ESTÁ MAL / desactualizado. Cybersource pide productCode/productName/productSKU/
    // totalAmount/unitPrice, que mapean a code/name/sku/total_amount/unit_price.
    // total_amount tiene que ser igual a unit_price × quantity.
  },
}
```

### Gotchas de validación encontrados en vivo (todos con evidencia real, no doc)

- **`state`**: código de una letra por provincia (NO el nombre, NO 2 letras). Tabla
  completa en [lib/payway.ts](../src/lib/payway.ts) (`PROVINCIA_CODIGO`) — ej. Santa
  Fe = `S`, Buenos Aires = `B`, CABA = `C`.
- **`customer_id`**: **nunca puede ser un email** — Cybersource lo rechaza con un
  error genérico y opaco (`cybersource_error`, `reason.id: -1`, status `annulled`,
  **incluso con la tarjeta ya autorizada por el banco** — este fue el bug más difícil
  de diagnosticar porque el error no menciona el campo real). Usar DNI/expediente/id
  interno, nunca el mail.
- **Nombres/ciudad con acentos o ñ**: se rechazan ("Martín", "Núñez"). Sanitizar con
  `.normalize("NFD").replace(...)` antes de mandar (función `sinAcentos` en
  `lib/payway.ts`).
- **`address_validation_code: "VTE0011"`**: esto **NO es un error** — aparece en los
  ejemplos oficiales de pagos aprobados. Si lo ves, no es la pista — mirar
  `error.type` y `reason.id` en cambio.
- **`days_to_delivery`**: string, no number.

## Tarjetas de prueba (sandbox, dadas por Payway)

| Marca | Número | Vencimiento | CVV |
|---|---|---|---|
| Visa | 4507 9800 0000 4905 | 12/30 | 123 |
| Mastercard | 5269 9100 1000 0005 | 12/30 | 123 |
| Cabal | 5860 5700 0000 0008 | 12/30 | 123 |

Titular de prueba: `APRO APRO` (aprueba). Usar un DNI cualquiera de 8 dígitos.

## Checklist de seguridad (verificado en esta integración)

- [x] La secret key nunca se expone al frontend — hay un endpoint público
      (`/api/payway/config`) que devuelve *solo* la public key.
- [x] El monto se recalcula siempre server-side desde la base, nunca se confía en
      el del cliente.
- [x] El motivo técnico de rechazo nunca se muestra al usuario (mensaje genérico) —
      el detalle completo va solo al log del servidor.
- [x] `site_transaction_id` único y trazable al registro real (no timestamp pelado).

## Estado en SGO al cierre de esta sesión

- ✅ **Cursos (invitados no matriculados)**: funcionando end-to-end, verificado con
  navegador real contra sandbox (tokenización → autorización bancaria → confirmación
  en base). Ver [api/cursos/pago/payway/route.ts](../src/app/api/cursos/pago/payway/route.ts).
- ⏳ Pendiente replicar el mismo patrón a: matrícula mensual/anual, deudas, ventas
  (cursos con matriculados con sesión). El componente `PaywayCardForm` y el servicio
  `lib/payway.ts` ya son reutilizables tal cual para eso.
- ⏳ Cabal sin `payment_method_id` confirmado — consultar a Payway soporte.
- ⏳ Credenciales de producción: son un pedido aparte a Payway, distintas de las de
  sandbox.
