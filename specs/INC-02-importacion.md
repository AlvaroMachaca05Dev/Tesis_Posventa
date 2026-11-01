# INC-02 — Importación XLSX/CSV idempotente y atómica

> **Referencia por incremento (31/10/2026).** Se desarrolla por slices (S4). El estado vigente está en `../docs/ESTADO_ACTUAL.md`.


**Estado:** BORRADOR · **Versión:** 0.1 · **Fecha:** 17/10/2026 · **Autor:** asistente (Claude), derivado de las fuentes · **Aprobada por:** nadie todavía
**Bloqueada por:** OPEN-07 (no hay XLSX reales anonimizados), OPEN-01 (pila). **Depende de:** INC-01.

## 1. Objetivo y resultado vertical
Criterio de cierre (`06` §7): **«Reimportación sin duplicados, conciliación y errores explicables».**
Un usuario autorizado sube un archivo exportado de Tuulapp/ToolLab, el sistema reconoce su formato, valida **todo** el archivo, muestra un resumen de lo que haría (nuevos, existentes, conflictos, errores), y solo entonces lo aplica **de forma atómica**. Si se vuelve a subir el mismo archivo, no se duplica nada. Los datos incompletos se conservan con su procedencia.

## 2. Alcance
- **Incluye** los 7 requisitos de [`requisitos-por-incremento/INC-02.md`](requisitos-por-incremento/INC-02.md). Bloque T2 de `06` §3: XLSX Tuulapp/ToolLab, reconocimiento de encabezados, conciliación e idempotencia, conservación de incompletos y procedencia, ODS con múltiples líneas.
- **Excluye:** importación de planes preventivos (RF-12, va con INC-04); importación de documentos y pagos históricos (RF-30, opcional y depende del corte comercial); sincronización automática con el ERP, API o acceso directo a su base (la API **no** es requisito inicial: `01_RESUMEN` §3).
- **Depende de:** INC-01 (clientes, vehículos, ODS).

## 3. Reglas de dominio
| # | Regla | Fuente | Estado |
|---|---|---|---|
| R1 | Flujo: identificar perfil por encabezados → validar campos y tipos → normalizar **sin destruir originales** → resolver entidades por **origen + ID externo** → detectar conflictos → simular resumen → aplicar lote atómico → guardar resultado y errores → permitir reimportar sin duplicar | `07` §5 | Cerrada |
| R2 | **No inventar** VIN, kilometraje, teléfono, técnico, comprobante ni servicio; un dato incompleto se conserva con procedencia y estado de revisión | `07` §5 | Cerrada |
| R3 | No adivinar columnas ambiguas ni duplicar reimportaciones; mostrar resumen, errores y conciliación | `04` §2.10 | Cerrada |
| R4 | La identidad **no** se resuelve por placa ni DNI sino por origen + ID externo | `07` §4; `AGENTS.md` | Cerrada |
| R5 | Perfiles XLSX y alias de encabezados **versionados** | `04` §2.10 | Cerrada |
| R6 | Una actualización XLSX de ODS se diseña como **reemplazo completo y atómico del detalle identificado** | `DECISIONES_R5` | Cerrada (demostración) |
| R7 | Servicios: **inspección no equivale a sustitución**; el cambio de aceite de motor no acredita «aceite de caja»; reparación o venta de aceite no demuestran cambio de aceite | `CAMBIOS_R7.1` (4); skill `normalizar-servicios-rmotriz` | Cerrada en el motor R8 |
| R8 | Una equivalencia dudosa **no entra** al cómputo de mantenimiento | skill `normalizar-servicios-rmotriz` | Cerrada |
| R9 | La API del ERP no es condición de funcionamiento; otros adaptadores futuros no deben exigir reescribir el dominio | `01_RESUMEN` §3 | Cerrada |

## 4. Modelo de datos
Tablas: `lotes`, `filas_importacion`, `identidades_externas`, `equivalencias`, más `clientes`, `vehiculos`, `ordenes`, `detalles`, `catalogo` (INC-01).
- `identidades_externas` es **polimórfica** (`tipo`, `externo`, `interno`): la aplicación debe validar que el interno exista por tipo (modelo README).
- `lotes` guarda `origen`, `perfil_version`, `modo`, `hash`, `estado`; `UNIQUE(origen, tipo, externo)` protege la idempotencia.
- **Pendiente de decidir:** cómo se guarda la **acción inferida** de cada línea (`LineaODS.accion`, `accionInferida` en el UML) si el SQL no la tiene en `detalles`.

## 5. Contratos
Del diagrama `DCL-R8-0001A` (se conservan intactos de R7: `DCL-0003`):

| Clase | Métodos |
|---|---|
| `Importador` | `cargar(archivo, perfil, modo): Lote`, `reconocerPerfil(encabezados): PerfilImportacion` |
| `ValidadorLote` | `validarTodo(archivo, perfil): ResultadoValidacion` |
| `ResolvedorIdentidad` | `resolver(origen, idExterno, tipo): IdentidadExterna` |
| `AplicadorLote` | `aplicarAtomico(lote, modo): ResumenLote` |
| `NormalizadorServicios` | `resolverEquivalencia(descripcion, accion): EquivalenciaServicio` |
| Entidades | `PerfilImportacion` (columnas obligatorias), `Lote` (hash, estado, modo), `FilaOriginal` (número, contenido, errores), `IdentidadExterna`, `EquivalenciaServicio` (descripción de origen, acción, método, confianza) |

Referencia ejecutable: `nucleo-referencia/src/motor.js` (`Importador`, `ValidadorLote`, `AplicadorLote`, `NormalizadorServicios`, catálogo de 15 familias de servicio) con pruebas en `nucleo-referencia/pruebas_motor.js`. **Solo importa CSV; el adaptador XLSX no se ha ejecutado nunca** (`ESTADO_MIGRACION` §5).

## 6. Criterios de aceptación
| ID | RF | Dado / Cuando / Entonces | Origen |
|---|---|---|---|
| CA-02-01 | RF-09 | **Dado** un archivo con los encabezados de un perfil conocido, **cuando** se carga, **entonces** se identifica el perfil por encabezados y alias versionados | `04` §2.10 |
| CA-02-02 | RF-09 | **Dado** encabezados ambiguos o desconocidos, **cuando** se carga, **entonces** **no** se adivina: se rechaza o se pide revisión, sin escribir datos | R3 |
| CA-02-03 | RF-10 | **Dado** un archivo con una fila inválida entre muchas válidas, **cuando** se aplica, **entonces** **no se cambia nada** (atómico) y se informa qué fila y columna fallaron | `07` §5; PR |
| CA-02-04 | RF-10 | **Dado** un archivo ya importado, **cuando** se importa de nuevo, **entonces** no se crea ningún cliente, vehículo ni ODS nuevo | R1, `07` §4.3 |
| CA-02-05 | RF-02, RF-03, RF-10 | **Dado** una fila sin VIN, teléfono o kilometraje, **cuando** se importa, **entonces** esos campos quedan vacíos con procedencia (archivo, hoja, fila) y estado de revisión; **no** se rellenan | R2 |
| CA-02-06 | RF-10 | **Dado** dos filas con la misma placa pero distinto ID externo, **cuando** se importa, **entonces** no se fusionan por placa: se resuelve por origen + ID externo y se lista el posible conflicto | R4 |
| CA-02-07 | RF-26 | **Dado** un archivo válido, **cuando** se simula, **entonces** se muestra el resumen (nuevos, existentes, conflictos, errores) **antes** de aplicar | `07` §5 (6) |
| CA-02-08 | RF-25 | **Dado** el modo «crear» o «actualizar», **cuando** se aplica, **entonces** el modo elegido determina qué se inserta o reemplaza; en actualización, el detalle de la ODS identificada se **reemplaza completo y atómicamente** | R6 |
| CA-02-09 | RF-27 | **Dado** una ODS archivada, **cuando** una importación la corrige, **entonces** no se pierden líneas, se audita con motivo y la ODS sigue archivada | RF-27; DEC-23 |
| CA-02-10 | RF-10 | **Dado** una ODS con varias líneas, **cuando** se importa, **entonces** cada línea conserva su tipo, descripción original, cantidad y acción; la acción **inferida** se marca como tal | `DCL-R8-0001A` |
| CA-02-11 | RF-11 | **Dado** la descripción «Revisión de frenos», **cuando** se normaliza, **entonces** es **inspección** y no acredita un cambio de frenos; **dado** «Cambio de aceite de motor», **entonces** no acredita «aceite de caja» | R7 |
| CA-02-12 | RF-11 | **Dado** una descripción sin equivalencia segura, **cuando** se normaliza, **entonces** queda sin equivalencia (confianza 0), conserva su texto y **no** entra al cómputo de mantenimiento | R8 |
| CA-02-13 | RF-10 | **Dado** un lote aplicado, **cuando** se consulta, **entonces** se conservan el archivo, el hash, el perfil, el resultado y las filas con sus errores | `07` §5 (8) |
| CA-02-14 | RF-31 | **Dado** una exportación de datos, **cuando** se genera, **entonces** incluye IDs estables y no expone más datos personales de los necesarios | RF-31; `07` §9 |
| CA-02-15 | RF-10 | **Dado** un archivo con formato o extensión no admitido o de tamaño excesivo, **cuando** se carga, **entonces** se rechaza antes de procesar | `07` §9 («validación de tipo/tamaño») |

## 7. Pruebas previstas
- **Dominio:** reconocimiento de perfil, normalización de servicios (incluidos los casos negativos de R7), resolución por origen + ID externo. Referencia: `nucleo-referencia/pruebas_motor.js` (40 pruebas, solo CSV).
- **Servicio:** atomicidad (fila inválida → cero cambios), idempotencia (doble importación), modos crear/actualizar, ODS archivada.
- **Con archivos reales anonimizados** (cuando existan): perfil real de Tuulapp/ToolLab; **hasta entonces, solo muestras sintéticas** con la misma forma.
- Skill de apoyo: `inspeccionar-excel-rmotriz`; agente `tesis_analista_importacion`.

## 8. Datos y dependencias externas
**Necesita XLSX anonimizados de Tuulapp/ToolLab** (OPEN-07). Sin ellos solo se puede construir y probar con archivos sintéticos. Un historial real de un vehículo (42 ODS, 110 líneas) se usó en R5 para la demostración; **no está en esta carpeta** por la regla de datos.

## 9. Decisiones abiertas que lo afectan
| OPEN | Efecto |
|---|---|
| OPEN-07 | Sin archivos reales no se valida el perfil |
| OPEN-01 | Biblioteca de XLSX a usar (en Python ya está `openpyxl` instalado; en Node habría que elegirla) |
| OPEN-37 | Dónde se guarda la acción inferida de cada línea |
| OPEN-42 | Si RF-30 (documentos y pagos históricos) entra o no |

## 10. Riesgos y brechas
- El adaptador XLSX **nunca se ha ejecutado** (solo CSV).
- Equivalencias ambiguas de servicios y datos históricos incompletos (`08` §7).
- El catálogo maestro de 16 familias y las plantillas Autodata/Picanto **no están** entre los archivos del proyecto (`docs/CONTEXTO_TESIS.md`); el motor R8 usa 15 familias.
- La importación desde el ERP es una dependencia externa: no debe bloquear el funcionamiento (R9).

## 11. Definición de hecho
`docs/plan/PLAN_DESARROLLO.md` §4, más: dos importaciones seguidas del mismo archivo sin duplicados y una importación con error que no cambia nada, ambas con evidencia en `docs/evidencias/`.

## 12. Referencias
`docs/contexto/04_VISION_COMPLETA_MODULOS.md` §2.10, `07` §5, `08`; `diagramas/R8_propuesta/DCL-R8-0001A_datos_importacion_ods.puml`, `DSE-R8-0001_importacion`; `tesis/latex/modelo/esquema_propuesto.sql`; `nucleo-referencia/`; skills `inspeccionar-excel-rmotriz` y `normalizar-servicios-rmotriz`.
