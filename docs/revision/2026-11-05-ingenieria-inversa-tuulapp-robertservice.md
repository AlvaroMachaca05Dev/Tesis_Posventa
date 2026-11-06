# Qué se puede aprender de Tuulapp y Sistema Robert Service — 05/11/2026

## Origen y límite de esta nota

Otra sesión (con el MCP `craft-anything`, autorizado para leer `https://app.tuulapp.com/` y `https://sistemarobertservice.com/`, ambas de solo lectura y sin guardar credenciales) dejó un proyecto de investigación en `F:\Tesis\reverse-lab\craft-projects\tuulapp-rsa.cany`. Sus archivos de síntesis (`investigation/findings.md`, `hypotheses.md`, `handoff.md`) estaban vacíos; lo único con contenido eran 6 evidencias crudas de CDP (listado de scripts, análisis de los bundles con dependencias y DOM). Esta nota resume lo que esas evidencias dejan ver, para que el investigador decida qué aplicar. **No es una propuesta de cambio de alcance**: los 49 RF de R8.2 ya están decididos; esto son ideas de referencia para cuando corresponda (sobre todo S9 citas, S11 cotización/nota de venta, S13 posventa y beta).

## Sistema Robert Service (`sistemarobertservice.com`)

Es un sistema más antiguo (usa Flash/QuickTime plugin fallbacks, CKEditor clásico, AES.js para algo cifrado en el cliente). Su estructura de módulos (86 módulos, extraídos de los nombres de archivo reales) confirma el patrón `módulo/submódulo` con tres capas por vista (`...Tour.js` recorrido guiado, `...Rsc.js` recursos/plantilla, `...Ax.js` llamadas Ajax):

| Módulo/submódulo visto | Qué sugiere |
|---|---|
| `cotizar/cotizador` y **`cotizar/ordenServicio`** (la ODS vive dentro del módulo de cotizar, no al revés) | Confirma la decisión ya tomada: la ODS nace de una cotización. En su sistema la relación es tan fuerte que la ODS es un submódulo de «Cotizar». |
| `facturacion/venta`, `facturacion/cliente` | Coincide con nuestro RF-088 (nota de venta) y RF-004 (clientes). |
| `facturacion/pagare` | «Pagaré» (crédito/cuotas al cliente): no existe en nuestros 49 RF ni en beta; es una idea para cuentas por cobrar si se retoma esa línea (hoy quitada del alcance). |
| `facturacion/adelanto` | «Adelanto» como concepto separado del pago completo: parecido a nuestro Abono, pero ellos lo distinguen de la cotización en sí. Sin acción inmediata. |
| `facturacion/bitacora` | Bitácora específica de facturación (aparte de la bitácora general de la ODS). Nosotros ya tenemos una sola Bitacora por ODS; no hace falta separarla. |
| Rutas internas vistas: `system/init/getLista`, `facturacion/venta/getProducto`, `cotizar/cliente/getProducto` | Confirma el patrón de nombres `módulo/submódulo/acción`, nada que cambiar en lo nuestro (ya usamos rutas REST por recurso). |

El resto de los «98 endpoints» que reportó la otra sesión eran en su mayoría ruido: URLs de librerías de terceros (w3.org, GitHub, amCharts, reproductores Flash/QuickTime/RealPlayer) capturadas por el analizador junto con las 3 rutas reales de arriba. **El número no refleja 98 rutas de su API.**

## Tuulapp (`app.tuulapp.com/ingresos_ods.php`)

Sistema más moderno (Vue/webpack, socket.io, GA4, Facebook Pixel). De los «291 posibles endpoints», unos 120 son rutas propias de `{api}` (`tlp-api.tuulapp.com/api/v1/`); el resto son también CDN y URLs de ejemplo de las librerías. Las que sí aportan algo nuevo frente a lo que ya construimos:

1. **Aprobación por ítem, no solo por toda la orden**: `POST /proceso_orden_de_servicio/update_item_approval` y `/auto_approve`, además de `PUT /proceso_orden_de_servicio` para la orden completa. Nuestra «decisión del cliente» (RN-06/beta) es una sola decisión para toda la ODS. Si se retoma esa parte en beta, aprobar ítem por ítem (el cliente acepta el cambio de aceite pero no la alineación) es una mejora real sobre lo que ya pensamos — **para confirmar, no para aplicar ahora**.
2. **Plantillas de mensaje por etapa de la ODS**: `GET /message_templates/by_stage/{reception|diagnosis|post_approval|delivery|satisfaction_survey}`, usadas por `POST /sms` y `POST /notificaciones/send_one|send_all`. Esto encaja directo con lo ya decidido («automatizaciones como reglas fijas del servidor») y con RF-095 (seguimiento) y la encuesta de satisfacción: en vez de una regla genérica, conviene pensar los mensajes **por etapa** (recepción, diagnóstico, aprobado, entrega, encuesta), que es justo el vocabulario que ya usamos para los estados de la ODS.
3. **Formularios configurables por cuenta y por tipo**: `GET /account_custom_forms_by_type/{type}` y `/account_custom_form_responses?relatedEntityId={idOds}`. Nuestra lista de chequeo del vehículo (`EstadoVehiculo`) es un JSON de forma fija. Si más adelante se quiere que cada taller arme su propia lista de chequeo (y no solo el presente), este es el patrón: formulario por tipo, respuestas enlazadas a la ODS. No está en los 49 RF; queda como idea para cuando se revise ese límite.
4. **Fotos de evidencia por URL prefirmada de S3**, no subidas al servidor: `POST /proceso_orden_de_servicio/presigned_url` y luego `PUT` directo al `signedUrl`. Nosotros guardamos la foto como bytes en la base (`EvidenciaIngreso.datos`), que es la decisión correcta para una demostración sin nube propia. Si el sistema real pasa a producción con almacenamiento en la nube, este es el patrón estándar a seguir — **nota para esa etapa, no ahora**.
5. **Verificación de placa con el usuario que la pide**: `GET /vehiculos/verify/{placa}/{userId}`. Confirma que la consulta vehicular (RN-10, ya decidida) también suele registrar quién la pidió; si no lo guardamos ya en la auditoría, es un detalle menor a verificar, no un cambio de diseño.
6. `GET /inventario_bodegas`, `/inventario_items_proveedores/filtro`: confirma que «bodega» (= nuestro `Local`) y «proveedor por producto» son el vocabulario estándar del rubro; no cambia nada de lo ya construido en el S5.
7. `GET /puntos_equilibrio`: métrica de punto de equilibrio para reportes financieros. Fuera de nuestro alcance (reportes básicos, S14); se anota por si se amplía esa parte.

## Conclusión para el investigador

Nada de esto obliga a tocar el S5 ya cerrado ni los 49 RF. Las dos ideas con más valor para cuando toquen sus slices son la **aprobación por ítem** (si se retoma «decisión del cliente» en beta) y los **mensajes por etapa de la ODS** (encaja con S9/S13 y con las reglas fijas ya decididas). El resto son confirmaciones de que el vocabulario y la estructura que ya se usó (local/bodega, proveedor por producto, cotización → ODS) coinciden con el rubro, no hallazgos que cambien algo.

**No se procesaron** los grafos completos de módulos/dependencias (`nodes`/`edges`) de ninguno de los dos sistemas: son estructuras internas del bundler, no aportan vocabulario de negocio adicional al ya extraído aquí.
