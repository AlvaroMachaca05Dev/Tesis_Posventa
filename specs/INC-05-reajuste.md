# INC-05 — Reajuste del futuro con evidencia de ODS

> **Referencia por incremento (31/10/2026).** Se desarrolla por slices (S6). El estado vigente está en `../docs/ESTADO_ACTUAL.md`.


**Estado:** BORRADOR · **Versión:** 0.1 · **Fecha:** 17/10/2026 · **Autor:** asistente (Claude), derivado de las fuentes · **Aprobada por:** nadie todavía
**Bloqueada por:** OPEN-21 (reajuste directo o con propuesta y aprobación), OPEN-08, OPEN-20. **Depende de:** INC-04.

## 1. Objetivo y resultado vertical
Criterio de cierre (`06` §7): **«Una ODS válida altera solo la proyección futura y conserva la evidencia».**
Cuando una ODS archivada (o importada y finalizada) confirma que se ejecutó un servicio, el sistema **propone** re-anclar los hitos futuros de ese componente desde la fecha y el km reales. Una persona autorizada aprueba o rechaza. El pasado no se reescribe y todo queda con regla, evidencia, antes y después.

## 2. Alcance
- **Incluye** el requisito RF-16 ([`requisitos-por-incremento/INC-05.md`](requisitos-por-incremento/INC-05.md)).
- **Excluye:** el cálculo de la línea temporal (INC-04); las tareas de seguimiento (INC-06).
- **Depende de:** INC-04 (planes, asignaciones, proyecciones, evidencias) e INC-01 (ODS archivada).

## 3. Reglas de dominio
| # | Regla | Fuente | Estado |
|---|---|---|---|
| R1 | **Solo se altera el futuro.** El historial ejecutado y el plan base congelado no se reescriben | `07` §6; RF-16 | Cerrada |
| R2 | Se exige: ODS **cerrada/archivada o importada finalizada**; línea de servicio **confirmada y enlazada**; **equivalencia suficientemente segura**; fecha y/o km válido; **versión** de plan y regla; evento antes/después | `07` §6 | Cerrada |
| R3 | Una operación **autónoma** conserva su intervalo propio | `07` §6; `DCL-R8-0001B` | Cerrada |
| R4 | Si falta evidencia (sin km/fecha o equivalencia dudosa), el sistema **se abstiene** y solicita revisión | `07` §6 | Cerrada |
| R5 | El reajuste es de **un solo componente** (la regla afectada) | `ESTADO_MIGRACION` §2 | Cerrada en el motor R8 |
| R6 | **Idempotente por `claveEvento`**: repetir el archivado no duplica el reajuste | `DCL-R8-0001B` (nota) | Cerrada en el motor R8 |
| R7 | Reapertura y nuevo cierre **recalculan el futuro** | `CONTEXTO_TESIS`; `REVISION_INICIAL` (PR-07) | **Verificable solo cuando exista INC-04** |
| R8 | **¿Directo o con propuesta y aprobación?** R7 y el HTML reajustan directamente al archivar; R8 propone, y `JEFE_TALLER` o `EXPERTO` aprueban o rechazan | `DIAGNOSTICO_UML` DIF-004/011 | **En conflicto: OPEN-21 (INC-B3)** |

La spec se redacta con el contrato **R8 (propuesta y aprobación)** porque la fuente lo justifica: «validación humana antes de modificar la programación» (`ESTADO_MIGRACION` §2). **Si OPEN-21 decide otra cosa, se reescribe §5 y §6.**

## 4. Modelo de datos
Tablas existentes: `proyecciones`, `evidencias_plan`, `reglas`, `asignaciones`, `ordenes`, `detalles`, `auditoria`.
**Falta la tabla de reajustes** (INC-A3): el UML R8 define `Reajuste` con `estado` (PENDIENTE, APROBADO, RECHAZADO, ABSTENIDO), `antesKm`, `antesFecha`, `despuesKm`, `despuesFecha`, `motivo` y `claveEvento`. Hay que añadirla al modelo, con `UNIQUE(claveEvento)`.

## 5. Contratos
Del diagrama `DCL-R8-0001B`:

| Clase | Métodos |
|---|---|
| `MotorPlanes` | `proponerReajuste(ordenId, evidenciaId, version): lista de Reajuste` · `aprobarReajuste(reajusteId, usuarioId, motivo)` · `rechazarReajuste(reajusteId, usuarioId, motivo)` · *(privado)* `reajustarFuturo(ordenId, evidenciaId, version)` |
| Entidades | `Reajuste`, `Evidencia` (ordenId, lineaId, km, fecha), enum `EstadoReajuste` |

`proponerReajuste` **no modifica la programación definitiva**. `ServicioODS.archivar` ya **no** reajusta: solo dispara la propuesta (`DSE-R8-0002`); la aprobación es `DSE-R8-0003`.
Diagramas de estados: `DES-R8-0002_estados_reajuste.puml`.

## 6. Criterios de aceptación
| ID | RF | Dado / Cuando / Entonces | Origen |
|---|---|---|---|
| CA-05-01 | RF-16 | **Dado** una ODS archivada con un servicio confirmado, enlazado a una línea, con fecha y km válidos, **cuando** se archiva, **entonces** se crea un reajuste **PENDIENTE** con antes/después, regla y versión; la proyección vigente **no** cambia todavía | R2, R8 |
| CA-05-02 | RF-16 | **Dado** un reajuste PENDIENTE, **cuando** `JEFE_TALLER` o `EXPERTO` lo aprueba con motivo, **entonces** pasa a APROBADO, se re-anclan los hitos futuros de **ese componente** y se audita | R8 |
| CA-05-03 | RF-16 | **Dado** un reajuste PENDIENTE, **cuando** un usuario sin esos roles intenta aprobarlo, **entonces** se rechaza en el servidor | `motor.js` (permisos); `07` §9 |
| CA-05-04 | RF-16 | **Dado** un reajuste PENDIENTE, **cuando** se rechaza con motivo, **entonces** pasa a RECHAZADO y la proyección no cambia | R8 |
| CA-05-05 | RF-16 | **Dado** una ODS sin km ni fecha válidos, o con una equivalencia dudosa, **cuando** se archiva, **entonces** el reajuste queda **ABSTENIDO** con el motivo, sin tocar nada | R4 |
| CA-05-06 | RF-16 | **Dado** un reajuste aprobado, **cuando** se consulta la línea temporal, **entonces** el historial ejecutado y el plan base congelado son **idénticos** a antes; solo cambian los hitos futuros afectados | R1 |
| CA-05-07 | RF-16 | **Dado** una operación autónoma, **cuando** se aprueba un reajuste de otro componente, **entonces** conserva su intervalo | R3 |
| CA-05-08 | RF-16 | **Dado** el mismo evento de archivado repetido (misma `claveEvento`), **cuando** se procesa de nuevo, **entonces** no se crea otro reajuste | R6 |
| CA-05-09 | RF-16 | **Dado** una ODS inspeccionada («Revisión de frenos»), **cuando** se evalúa como evidencia de «Cambio de frenos», **entonces** **no** genera propuesta de reajuste | `INC-04` R10 |
| CA-05-10 | RF-16, RF-29 | **Dado** una ODS reabierta y archivada de nuevo con otro km, **cuando** se vuelve a archivar, **entonces** se recalcula el futuro con una nueva clave de evento de negocio y queda trazable | R7 (cuando exista INC-04) |
| CA-05-11 | RF-16 | **Dado** cualquier reajuste, **cuando** se consulta, **entonces** muestra regla, versión del plan, evidencia (ODS y línea), antes/después, actor y fecha de servidor | R2 |

## 7. Pruebas previstas
- **Dominio:** propuesta/aprobación/rechazo/abstención, idempotencia, pasado intacto. Referencia: el motor R8 y sus 40 pruebas (`nucleo-referencia/pruebas_motor.js`), con **el contrato R8**.
- **Servicio:** permisos de aprobación, concurrencia sobre la misma `claveEvento`.
- Diagramas de referencia: `DSE-R8-0002_archivar_proponer_reajuste`, `DSE-R8-0003_aprobar_reajuste`, `DES-R8-0002_estados_reajuste`.

## 8. Datos y dependencias externas
Planes y equivalencias **validados por un experto mecánico** (OPEN-08) para cualquier uso fuera de la demostración. Sin eso, los reajustes son **propuestas pendientes de validación**.

## 9. Decisiones abiertas que lo afectan
| OPEN | Efecto |
|---|---|
| OPEN-21 | **Contrato completo** del incremento (directo o con aprobación) |
| OPEN-08 | Validez técnica de los intervalos |
| OPEN-20 | Intervalo de aceite no especificado afecta a cuándo hay evidencia suficiente |
| OPEN-37 | Añadir la tabla de reajustes (INC-A3) |

## 10. Riesgos y brechas
- La matriz R7.6 y el capítulo III pueden describir el reajuste directo: hay que alinearlos con el profesor.
- Sin validador técnico, el incremento solo puede demostrar el **mecanismo**, no la validez de los intervalos.
- La meta «más de 90 % de reajustes documentados» es **una meta, no una medición** (`AGENTS.md`).

## 11. Definición de hecho
`docs/plan/PLAN_DESARROLLO.md` §4, más: los 11 criterios con pruebas y un caso demostrativo en el que una ODS cambia solo el futuro y deja el pasado idéntico (comparación antes/después guardada en `docs/evidencias/`).

## 12. Referencias
`docs/contexto/07_ARQUITECTURA_DATOS_TRAZABILIDAD.md` §6; `docs/historial/R7/DIAGNOSTICO_UML.md`, `ESTADO_MIGRACION_CLAUDE.md`; `diagramas/R8_propuesta/DCL-R8-0001B_plan_timeline_reajuste.puml`, `DSE-R8-0002/0003`, `DES-R8-0002`; `nucleo-referencia/src/motor.js` (`MotorPlanes`); skill `validar-plan-rmotriz`.
