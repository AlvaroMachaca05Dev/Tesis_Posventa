# INC-04 — Plan preventivo, aplicabilidad y línea temporal

> **Referencia por incremento (31/10/2026).** Se desarrolla por slices (S5 y S6). El estado vigente está en `../docs/ESTADO_ACTUAL.md`.


**Estado:** BORRADOR · **Versión:** 0.1 · **Fecha:** 17/10/2026 · **Autor:** asistente (Claude), derivado de las fuentes · **Aprobada por:** nadie todavía
**Bloqueada por:** OPEN-08 (quién valida los planes), OPEN-20 (aceite no especificado), OPEN-33 (mapeo R/A), OPEN-38 (grupos G1–G8 y tasa km/mes), OPEN-04 (alcance de IA). **Depende de:** INC-01 (y de INC-02 para historial real).

## 1. Objetivo y resultado vertical
Criterio de cierre (`06` §7): **«Versiones, aplicabilidad y línea temporal verificable».**
Dado un vehículo con historial, el sistema determina qué planes preventivos le aplican, permite asignar uno **de forma explícita**, y muestra una línea temporal que **separa lo realizado de lo proyectado**: qué venció, qué está programado y qué es condicional, por km o por tiempo, lo que ocurra primero. Un plan se edita creando una **versión nueva**; el pasado no se reescribe.

## 2. Alcance
- **Incluye** los 17 requisitos de [`requisitos-por-incremento/INC-04.md`](requisitos-por-incremento/INC-04.md). Bloque T4 de `06` §3: catálogo técnico y planes versionados; reglas y aplicabilidad; asignación explícita; línea temporal real/futura. Se añaden por afinidad los RF-85 a RF-117 que describen el cálculo de la línea temporal (clasificación *media*).
- **Excluye:** el **reajuste** (INC-05); la generación de tareas de seguimiento a partir de la línea temporal (INC-06); inventario y OBD2 (exclusión firme).
- **IA:** RF-22, 32 y 33 (propuesta de plan con soporte computacional, evaluación del modelo, validación por experto) **solo si OPEN-04 decide que hay un modelo**. La recomendación de las fuentes es reglas explicables con abstención.

## 3. Reglas de dominio
| # | Regla | Fuente | Estado |
|---|---|---|---|
| R1 | **Plan, versión, regla, aplicabilidad y asignación son entidades separadas** | `07` §6; `CONTEXTO_TESIS` | Cerrada |
| R2 | Aplicabilidad **conjunta** marca/modelo/rango de años/motor/uso. Sin coincidencia única → revisión; sin asignación explícita → no hay tarea preventiva | `07` §6; `CONTEXTO_TESIS` | Cerrada |
| R3 | Un plan activo señala una **versión inmutable**; editar crea una versión nueva; el plan base de una asignación se **congela** y es comparable | `07` §4.8; RF-17; `DCL-R8-0001B` | Cerrada |
| R4 | **No se inventan intervalos.** Sin intervalo documentado → `SIN_INTERVALO` (no se interpola). Los intervalos del PDF son **propuestas pendientes de validación**, no reglas técnicas publicadas | `AGENTS.md`; `01_RESUMEN` §2 | Cerrada |
| R5 | El origen de la proyección es la **ODS más antigua con km válido** o el km declarado; **la primera ODS disponible no es el primer mantenimiento de toda la vida del vehículo** | `CONTEXTO_TESIS`; `01_RESUMEN` | Cerrada |
| R6 | Horizonte de **100 000 km, ampliable**. Vence **primero** km o tiempo | `CONTEXTO_TESIS` | Cerrada |
| R7 | **Solo el primer pendiente** puede estar VENCIDO; los siguientes ciclos son **CONDICIONAL** (presuponen atención del anterior) | `CAMBIOS_R7.1` (2); `DCL-R8-0001B` | Cerrada |
| R8 | Sin evidencia con km: «Sin registro · revisar próxima visita» (`SIN_REGISTRO`), nunca un vencido inventado | `CAMBIOS_R7.1` | Cerrada |
| R9 | Operaciones **periódicas** frente a **autónomas**; las autónomas conservan su intervalo propio y no se reescalan | `07` §6; `DCL-R8-0001B` | Cerrada |
| R10 | **Inspección ≠ sustitución**; el aceite de motor no acredita aceite de caja; una ODS «No aprobada» no es evidencia; reparación de motor reinicia aceite y filtro (regla por defecto editable) | RF-86; `CAMBIOS_R7.1` y `R7.3` | Cerrada |
| R11 | Una lectura de km que rompe la serie se **excluye** de la proyección y se avisa, sin modificar la ODS | RF-87 | Cerrada |
| R12 | La «última consulta de km» es la lectura más reciente **por fecha y hora**, de cualquier origen (consulta, ODS, cita, cotización) | `CLAUDE_RMotriz` (decisiones vigentes); RF-105 | Cerrada |
| R13 | Línea temporal por **ciclos de cambio de aceite**; vistas Comprimida y Detalle; descarga PDF; versión compacta | RF-99, 34, 117 | Demostrada en el prototipo |
| R14 | Aceite no especificado | 5 000 km (R5) frente a «sin intervalo» (29/09) | **En conflicto: OPEN-20** |
| R15 | Tasa km/mes | Últimas 5 visitas (R7.2) frente a primera-última lectura (motor R8) | **En conflicto: OPEN-38 (INC-C9)** |
| R16 | Grupos G1–G8 y asignación de planes | «No asignar por G1–G8» frente a asignación automática (R7.4) | **En conflicto: OPEN-38 (INC-C8)** |

Intervalos de aceite de la demostración R5 (confirmados por el tesista **solo para la demo**): sintético o full sintético 7 500 km; mineral o semisintético 5 000 km.

## 4. Modelo de datos
Tablas: `planes`, `versiones_plan`, `reglas`, `aplicabilidades`, `asignaciones`, `evidencias_plan`, `proyecciones`, `propuestas_plan`, `grupos_vehiculo`, `lecturas_km`, `vehiculos`, `ordenes`, `detalles`, `catalogo`, `equivalencias`.
**Correcciones necesarias:**
- Añadir lo que INC-05 necesita en `proyecciones` (estado de reajuste) o una tabla de reajustes (INC-A3).
- `reglas` debe representar `TipoOperacion` (PERIODICA/AUTONOMA); hoy hay un campo `autonomia`. Confirmar el mapeo `R`→PERIODICA y `A`→AUTONOMA (**interpretación sin confirmar**, OPEN-33).
- Valores de `proyecciones.estado`: el UML R8 define `EstadoProyeccion` = EJECUTADO, PROGRAMADO, VENCIDO, CONDICIONAL, SIN_REGISTRO, SIN_INTERVALO.

## 5. Contratos
Del diagrama `DCL-R8-0001B`:

| Clase | Métodos |
|---|---|
| `ServicioPlanes` | `evaluarAplicabilidad(vehiculoId)`, `asignarPlan(vehiculoId, versionId, usuarioId)`, `publicarVersion(planId, cambios, motivo)` |
| `ServicioLineaTemporal` | `construir(vehiculoId, kmActual, fechaCorte)`, `compararConBase(asignacionId, kmActual, fechaCorte)` |
| `ReglaIntervalo` | `intervaloPara(uso)`, `calcularSiguiente(ancla, uso)` |
| `Aplicabilidad` | `coincide(vehiculo): ResultadoAplicabilidad` |
| `Asignacion` | `congelarBase(proyecciones)` |
| `VersionPlan` | `congelar()` |
| Entidades | `Plan`, `VersionPlan`, `Proyeccion` (estado, km, fecha), `Evidencia`, `LineaTemporal` |

Referencia ejecutable: `nucleo-referencia/src/motor.js` (`proyectar`, `intervaloPara`, `contextoKm`, `buscarEvidencias`, `ServicioPlanes`, `ServicioLineaTemporal`) y `nucleo-referencia/src/planes_r7.json` (3 planes, 33 reglas, **sin validación técnica**).

## 6. Criterios de aceptación
| ID | RF | Dado / Cuando / Entonces | Origen |
|---|---|---|---|
| CA-04-01 | RF-13 | **Dado** un vehículo y una versión de plan con aplicabilidad por marca, modelo, años, motor y uso, **cuando** se evalúa, **entonces** solo aplica si coinciden **todos**; el grupo comercial no decide la elegibilidad | R2; INC-C8 |
| CA-04-02 | RF-13 | **Dado** un vehículo con dos planes posibles o ninguno, **cuando** se evalúa, **entonces** el resultado es **revisión**, no una asignación automática | R2 |
| CA-04-03 | RF-14 | **Dado** un vehículo sin asignación explícita, **cuando** se genera el trabajo preventivo, **entonces** no se crea ninguna tarea preventiva | R2 |
| CA-04-04 | RF-14 | **Dado** una asignación, **cuando** se crea, **entonces** guarda fecha base, km base y quién la asignó, y congela el plan base | `DCL-R8-0001B` |
| CA-04-05 | RF-17 | **Dado** un plan con asignaciones, **cuando** se edita, **entonces** se crea una **versión nueva**; las versiones anteriores y la proyección histórica no cambian | R3 |
| CA-04-06 | RF-12, RF-15 | **Dado** un vehículo con ODS que acredita un cambio de aceite a 100 000 km y regla de 5 000 km, **cuando** se construye la línea temporal, **entonces** el próximo hito es 105 000 km y es PROGRAMADO si no se ha alcanzado | R6; R7 |
| CA-04-07 | RF-15, RF-85 | **Dado** un hito vencido, **cuando** se proyectan varios ciclos, **entonces** solo el **primero** pendiente es VENCIDO y los siguientes son CONDICIONAL | R7 |
| CA-04-08 | RF-85 | **Dado** una regla con km y meses, **cuando** vence el tiempo antes que el km, **entonces** el vencimiento es **por tiempo** y se indica el motivo; y viceversa | R6 |
| CA-04-09 | RF-15 | **Dado** una regla sin intervalo para el uso elegido, **cuando** se proyecta, **entonces** el estado es SIN_INTERVALO y no se interpola | R4 |
| CA-04-10 | RF-15, RF-85 | **Dado** un vehículo sin ODS que acredite el servicio, **cuando** se proyecta, **entonces** el estado es SIN_REGISTRO, no VENCIDO | R8 |
| CA-04-11 | RF-86 | **Dado** una línea «Revisión de frenos», **cuando** se busca evidencia para «Cambio de frenos», **entonces** **no** cuenta; una ODS «No aprobada» tampoco | R10 |
| CA-04-12 | RF-86 | **Dado** un «Cambio de aceite de motor», **cuando** se busca evidencia de «aceite de caja», **entonces** no cuenta | R10 |
| CA-04-13 | RF-87 | **Dado** una lectura de km inconsistente (ej.: 25 647 entre lecturas de unos 258 000), **cuando** se calcula, **entonces** se excluye de la proyección, se avisa y la ODS no se modifica | R11 |
| CA-04-14 | RF-92 | **Dado** el historial de un vehículo, **cuando** se calcula la tasa km/mes, **entonces** se usa **el método que decida OPEN-38**, y el valor coincide en el motor, el prototipo y la implementación | R15 |
| CA-04-15 | RF-105, RF-115 | **Dado** varias lecturas de distintos orígenes, **cuando** se pide la última consulta de km, **entonces** es la más reciente **por fecha y hora**, no la de mayor km | R12 |
| CA-04-16 | RF-99 | **Dado** una regla «reparación de motor reinicia aceite y filtro», **cuando** hay una ODS de reparación de motor, **entonces** los ciclos se cuentan desde ese km; la regla se puede desactivar | `CAMBIOS_R7.3` |
| CA-04-17 | RF-15 | **Dado** una operación autónoma, **cuando** cambia el ciclo de otra operación, **entonces** conserva su intervalo propio | R9 |
| CA-04-18 | RF-14 | **Dado** una línea temporal calculada, **cuando** se compara con el plan base congelado, **entonces** se ven las diferencias (`compararConBase`) sin alterar el pasado | `DCL-R8-0001B` |
| CA-04-19 | RF-34 | **Dado** una línea temporal, **cuando** se descarga, **entonces** el PDF refleja lo mostrado y distingue realizado de proyectado | RF-34 |
| CA-04-20 | RF-22 | **Dado** un vehículo sin evidencia suficiente, **cuando** se pide una propuesta de plan, **entonces** el sistema **se abstiene** y explica qué falta (**solo si OPEN-04 incluye propuestas**) | `07` §6; OPEN-04 |

## 7. Pruebas previstas
- **Dominio:** proyección (km/tiempo, ciclos, estados), equivalencias y evidencias, aplicabilidad. Referencia: `nucleo-referencia/pruebas_motor.js` (40 pruebas) y `prototipo/pruebas/e2e_regresion72.mjs` (12 comprobaciones de R7.1: estados de ODS, aceite de caja, inspección ≠ sustitución, km inconsistente, placa/VIN, 0,75 H-H y reanclaje del aceite; cubren **en parte** CA-04-11, 12 y 13; **no ejecutadas**).
- **Con planes reales** solo cuando un experto valide (OPEN-08); hasta entonces, **ejemplos marcados como simulados**.
- Skill de apoyo: `validar-plan-rmotriz`; agente `tesis_disenador_dominio`.

## 8. Datos y dependencias externas
Los 3 planes y 33 reglas de `planes_r7.json` provienen de **AutoData recuperado y no están validados**. Hace falta un **validador técnico identificado** (OPEN-08) y, para el historial real, los XLSX de INC-02.

## 9. Decisiones abiertas que lo afectan
| OPEN | Efecto |
|---|---|
| OPEN-08, 34 | Sin validador, los planes solo son propuestas pendientes |
| OPEN-20 | Intervalo de aceite no especificado |
| OPEN-33 | Mapeo de tipo de operación de los planes importados |
| OPEN-38 | Grupos G1–G8 y tasa km/mes |
| OPEN-04 | Si hay propuestas con IA (CA-04-20) |
| OPEN-42 | Clasificación de los RF-85 a RF-117 |

## 10. Riesgos y brechas
- **Reglas mecánicas no validadas para toda la flota** (`08` §7): no puede decirse que los planes estén validados.
- Datos históricos incompletos y equivalencias ambiguas.
- Tres definiciones en conflicto (aceite, tasa km/mes, grupos) que cambian resultados de la línea temporal.
- La matriz R7.6 y los diagramas pueden usar nombres antiguos (`reajustarFuturo`, `cerrar`): INC-B3 y B4.

## 11. Definición de hecho
`docs/plan/PLAN_DESARROLLO.md` §4, más: los 20 criterios con pruebas que **no** dependan de intervalos reales, y una nota explícita de que los intervalos usados son de demostración y pendientes de validación mecánica.

## 12. Referencias
`docs/contexto/01_RESUMEN_EJECUTIVO.md` §2, `04` §2.12–2.13, `05`, `07` §6; `docs/historial/R7/CAMBIOS_R7.1.md`, `R7.3.md`, `R7.5.md`, `R7.6.md`; `diagramas/R8_propuesta/DCL-R8-0001B_plan_timeline_reajuste.puml`, `DSE-R8-0004_placa_plan_linea_temporal`; `nucleo-referencia/`; skills `validar-plan-rmotriz` y `normalizar-servicios-rmotriz`.
