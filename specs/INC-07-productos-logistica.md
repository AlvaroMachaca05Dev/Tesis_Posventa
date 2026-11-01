# INC-07 — Productos y logística *(extensión opcional)*

> **Referencia por incremento (31/10/2026).** Extensión opcional, fuera de los slices del núcleo. El estado vigente está en `../docs/ESTADO_ACTUAL.md`.


**Estado:** BORRADOR · **Versión:** 0.1 · **Fecha:** 17/10/2026 · **Autor:** asistente (Claude), derivado de las fuentes · **Aprobada por:** nadie todavía
**Bloqueada por:** **OPEN-05** (¿entra a la tesis?), OPEN-01. **Depende de:** INC-01, INC-03. **No empezar** hasta que el núcleo (INC-01 a INC-06) esté estable (`06` §4 y §10).

## 1. Objetivo y resultado vertical
Criterio de cierre (`06` §7): **«Solicitud → cotización → compra → entrega → conformidad».**
Las fuentes insisten en que, si entra, debe implementarse **completo y vertical**: «una colección de pantallas parciales aporta menos que un flujo vertical terminado» (`06` §4). El técnico solicita productos sin ver precios; logística cotiza solo productos con alternativas; la cajera aprueba a nivel de ODS; logística compra y entrega con evidencia; el técnico da su conformidad; y el sistema mide los tiempos de cada tramo.

## 2. Alcance
- **Incluye** los 12 requisitos de [`requisitos-por-incremento/INC-07.md`](requisitos-por-incremento/INC-07.md): RF-50 a 52 (compras para ODS, vínculo, recargo y margen; clasificados *Extensión*) y RF-72 a 79 y RF-91 (cotización, compra, evidencia, conformidad, tareas de logística).
- **Excluye:** notas de venta, adelantos, caja, bancos, transferencias y reportes comerciales (evolución, OPEN-06); **inventario, kardex, almacenes**, lotes y valorización (exclusión firme: «No hay movimientos de inventario»).
- **Depende de:** INC-01 (ODS, ítems de tipo Producto, decisión del cliente) e INC-03 (contenedor Productos de la tarea raíz).

## 3. Reglas de dominio
Todas **cerradas** (`DECISIONES_R7` #8–#15; `05` §5 a §10):
| # | Regla | Fuente |
|---|---|---|
| R1 | El módulo es **Cotización logística** y contiene **solo productos** | DEC-08 |
| R2 | Todo producto solicitado se vincula a una cotización; una cotización agrupa varios productos; cada producto admite **varias alternativas** (proveedor, descripción, marca, costo, margen sobre costo, venta, observación) | DEC-09; `05` §8 |
| R3 | Al cargar una ODS en una cotización, solo entran **productos activos sin cotización** | DEC-11 |
| R4 | **Borrador editable; al entregar se congela la versión;** una modificación posterior crea una versión nueva | DEC-10 |
| R5 | La **decisión del cliente es de toda la ODS**; solo agregar un ítem nuevo vuelve Aprobada a Pendiente | DEC-01, DEC-02 |
| R6 | **Comprobante de compra inmutable**; cambio, devolución, pago adicional, saldo a favor o vínculo erróneo se corrigen con **ajustes** | DEC-12 |
| R7 | Cada línea comprada se vincula **una vez** a un producto de la ODS o crea uno; el **costo queda bloqueado** por la compra | DEC-13 |
| R8 | Venta sugerida = costo × (1 + margen/100); la cajera puede cambiar venta/descuento, **no el costo** | `05` §13 |
| R9 | Evidencias de **Compra** y **Entrega**, una foto/archivo por categoría, alcance individual o masivo; la evidencia marca avance pero **no** concluye Productos | DEC-14 |
| R10 | **Conformidad técnica** individual o masiva; Productos se completa solo cuando todos los productos aprobados tienen cotización, compra o ajuste, entrega y conformidad | DEC-15; `05` §6 |
| R11 | Una no conformidad conserva **la misma tarea** (En proceso) con etiquetas **Observado** y **Por cambiar** | DEC-15 |
| R12 | Etapas como **etiquetas**: Solicitud → Cotizando → Pendiente aprobación → Por comprar → Comprado → Entregado → Conforme (rama: Entregado → Observado → Por cambiar → Comprado/Entregado → Conforme) | `05` §5 |
| R13 | La vista del técnico **nunca** muestra precios ni costos | DEC-24 |
| R14 | Dinero en soles | DEC-25 |
| R15 | **Compras: ¿inmutables o editables?** R7 las declara inmutables; R7.4 permite editar y eliminar | **En conflicto: INC-C7** |

Métricas mínimas (`05` §7): solicitud → cotización entregada; aprobación → evidencia de entrega; entrega → conformidad técnica; solicitud → conformidad; cantidad de cambios y no conformidades.

## 4. Modelo de datos
Tablas existentes: `compras`, `lineas_compra`, `detalles`, `ordenes`, `tareas`, `auditoria`.
**Faltan** (INC-A5): cotizaciones, **versiones** de cotización, alternativas cotizadas, **proveedores** (hoy es un texto), evidencias de Compra/Entrega, conformidad técnica, ajustes de compra, y vínculos entre producto solicitado y línea comprada. Las entidades están nombradas en `docs/contexto/07_ARQUITECTURA_DATOS_TRAZABILIDAD.md` §3 («Logística opcional») pero **no** en el SQL. Hay que diseñar el modelo **antes** de implementar y presentarlo al profesor.

## 5. Contratos
**No hay diagramas de clases de logística en R8** (DCL-R8-0001A/B/C no los incluyen). Las clases de logística de R7 (`DCL-0001` a `0014` en `tesis/latex/diagramas/`) siguen la nomenclatura anterior. Hay que **diseñar y diagramar** los contratos respetando las reglas del profesor (clases primero, estados, casos de uso sin cruces, secuencias numeradas con receptor en una clase del diagrama).

## 6. Criterios de aceptación
| ID | RF | Dado / Cuando / Entonces | Origen |
|---|---|---|---|
| CA-07-01 | RF-72 | **Dado** una ODS con productos activos, unos cotizados y otros no, **cuando** se carga en una cotización, **entonces** entran solo los no cotizados | DEC-11 |
| CA-07-02 | RF-73 | **Dado** un producto, **cuando** se registran varias alternativas, **entonces** cada una guarda proveedor, marca, costo, margen y venta, y la venta sugerida = costo × (1 + margen/100) | R2, R8 |
| CA-07-03 | RF-74 | **Dado** una cotización entregada, **cuando** se modifica, **entonces** se crea una versión nueva y la anterior queda intacta y consultable | DEC-10 |
| CA-07-04 | RF-63, RF-64 | **Dado** una ODS Aprobada, **cuando** el técnico agrega un producto nuevo, **entonces** la ODS vuelve a Pendiente y se crea una tarea para cotizarlo | DEC-02; `CAMBIOS_R7.2` |
| CA-07-05 | RF-91 | **Dado** una ODS que la cajera aprueba, **cuando** se registra, **entonces** se crea «Comprar productos aprobados» para logística | `CAMBIOS_R7.2` (se mantiene la decisión tomada; **confirmar**) |
| CA-07-06 | RF-75 | **Dado** un comprobante de compra emitido, **cuando** se intenta editarlo o eliminarlo, **entonces** se rechaza **(si INC-C7 se resuelve como inmutable)**; la corrección se hace con un ajuste | DEC-12; INC-C7 |
| CA-07-07 | RF-77 | **Dado** una compra, **cuando** se registra un ajuste (cambio, devolución, pago adicional, saldo a favor, vínculo erróneo), **entonces** el comprobante original no cambia y el ajuste queda auditado | DEC-12 |
| CA-07-08 | RF-76 | **Dado** una línea comprada, **cuando** se vincula a un producto de la ODS o crea uno, **entonces** el vínculo es único y el costo del producto queda bloqueado | DEC-13 |
| CA-07-09 | RF-78 | **Dado** una compra o entrega, **cuando** se adjunta una foto o archivo (individual o masivo), **entonces** se guarda con categoría y hora de captura y se sabe qué productos cubre | DEC-14 |
| CA-07-10 | RF-78 | **Dado** un archivo de tipo o tamaño no permitido, **cuando** se adjunta, **entonces** se rechaza | `07` §9 |
| CA-07-11 | RF-79 | **Dado** productos entregados, **cuando** el técnico confirma todos (o uno por uno), **entonces** Productos puede completarse; **mientras falte alguno, no** | DEC-15 |
| CA-07-12 | RF-79 | **Dado** un producto que el técnico observa, **cuando** lo registra, **entonces** la misma tarea sigue En proceso con las etiquetas Observado y Por cambiar | R11 |
| CA-07-13 | RF-71 | **Dado** un técnico, **cuando** solicita o confirma productos, **entonces** ninguna respuesta incluye precios ni costos | R13 |
| CA-07-14 | RF-72 | **Dado** un producto solicitado, **cuando** se mide el flujo, **entonces** quedan registradas las marcas de tiempo de solicitud, cotización entregada, aprobación, compra, entrega y conformidad | `05` §7 |
| CA-07-15 | RF-52 | **Dado** una cajera, **cuando** corrige precio o descuento de venta, **entonces** se permite; **cuando** intenta cambiar el costo bloqueado por una compra, **entonces** se rechaza | R8; `05` §1 |

## 7. Pruebas previstas
Dominio (versionado, ajustes, cierre de Productos), servicio (permisos de logística, técnico y cajera; inmutabilidad), interfaz (referencia `prototipo/pruebas/e2e72.mjs` y `e2e73_sobre_r74.mjs`: **no ejecutadas**).

## 8. Datos y dependencias externas
Datos sintéticos de proveedores (**sin RUC reales**; ver INC-E1). Almacenamiento seguro de fotos y archivos (no existe aún). Captura de cámara en tablet: en el prototipo es solo demostración.

## 9. Decisiones abiertas que lo afectan
| OPEN | Efecto |
|---|---|
| OPEN-05 | **Si no entra a la tesis, esta spec queda como visión** |
| OPEN-23 | Rol Logística |
| OPEN-37 | Diseñar el modelo de datos logístico (A5) |
| INC-C7 | Compras inmutables o editables (RF-75 frente a RF-96) |

## 10. Riesgos y brechas
- No existe modelo de datos ni UML de R8 para este incremento.
- Almacenamiento de archivos y fotos: seguridad y tamaño.
- Si se implementa parcial, aporta menos que no hacerlo (`06` §4).

## 11. Definición de hecho
`docs/plan/PLAN_DESARROLLO.md` §4, más: **un flujo completo** de una ODS desde la solicitud hasta la conformidad, incluyendo una no conformidad, con los cinco tiempos medidos.

## 12. Referencias
`docs/contexto/03_DECISIONES_INICIALES_A_FINALES.md`, `04` §3, `05` §5–10, `06` §4, `07` §3; `docs/historial/R7/CAMBIOS_R7.2.md`, `R7.3.md`, `R7.4.md`.
