# INC-03 — Servicios, tareas y agenda de técnicos

> **Referencia por incremento (31/10/2026).** Se desarrolla por slices (S7 a S9). El estado vigente está en `../docs/ESTADO_ACTUAL.md`.


**Estado:** BORRADOR · **Versión:** 0.1 · **Fecha:** 17/10/2026 · **Autor:** asistente (Claude), derivado de las fuentes · **Aprobada por:** nadie todavía
**Bloqueada por:** OPEN-24 (almuerzo y horario), OPEN-25 (máximo de simultáneos), OPEN-01. **Depende de:** INC-01.

## 1. Objetivo y resultado vertical
Criterio de cierre (`06` §7): **«Planificación y ejecución por técnico con segmentos y cierre diario».**
Cada ODS genera una tarea raíz con dos contenedores (Servicios y Productos). Los servicios se planifican en la agenda de cada técnico en bloques de 15 minutos, se pueden dividir, postergar, extender o reasignar sin alterar la hora de llegada de la ODS, y el jefe de taller cierra la jornada de cada sede y fecha. El sistema calcula el esfuerzo real y los huecos reales.

## 2. Alcance
- **Incluye** los 16 requisitos de [`requisitos-por-incremento/INC-03.md`](requisitos-por-incremento/INC-03.md). Bloque T3 de `06` §3: tarea raíz y contenedor Servicios; agenda de técnicos en 15 minutos; división, extensión, postergación y reasignación; cierre de jornada; cálculo de esfuerzo y huecos reales.
- **Excluye:** el contenedor **Productos** y su flujo de cotización, compra, evidencia y conformidad (INC-07); citas y posventa (INC-06); optimización automática de técnicos y bahías (exclusión firme, `06` §6).
- **Depende de:** INC-01 (ODS, usuarios, sedes).

## 3. Reglas de dominio
| # | Regla | Fuente | Estado |
|---|---|---|---|
| R1 | Una ODS tiene **una tarea raíz y exactamente dos contenedores** (Servicios, Productos); los ítems son listas de control; solo se crean tareas relacionadas cuando cambia el responsable | DEC-07; `04` §2.6 | Cerrada |
| R2 | Tareas: Pendiente, En proceso, Completada; «Archivada» es condición. Tipos: Tarea, Proyecto, Recurrente, Evento | DEC-06; RF-108 | Cerrada |
| R3 | La **hora de llegada** de la ODS es un atributo de la ODS e independiente de los bloques | DEC-16 | Cerrada |
| R4 | Agenda en **15 min**; H-H en múltiplos de **0,25** | DEC-17 | Cerrada |
| R5 | Se puede dividir, postergar, extender y reasignar a otro técnico autorizado; la **continuación conserva referencia** al bloque/servicio original | DEC-17; `05` §11 | Cerrada |
| R6 | El **esfuerzo real** es la suma de los segmentos ejecutados o corregidos; el total estimado puede distribuirse entre servicios en múltiplos de 0,25 | DEC-18 | Cerrada |
| R7 | La extensión genera **advertencia** y permite motivo | `05` §11; RF-45 | Cerrada |
| R8 | El jefe de taller **cierra la jornada** por sede y fecha; un día cerrado no se edita; solo el administrador lo reabre con motivo auditado | DEC-19 | Cerrada |
| R9 | **Horas perdidas** = horario disponible menos la unión temporal de segmentos, **excluyendo el almuerzo**; no se monetizan | DEC-20; `05` §11 | Cerrada |
| R10 | Las H-H no multiplican automáticamente el precio del servicio | `05` §11; `DECISIONES_R5` | Cerrada |
| R11 | Horario inicial: lunes a sábado 08:00–18:00, almuerzo 13:00–14:00, **configurable** | `05` §11 | **Almuerzo en conflicto (13–14 R5 frente a 14–15 seed R7): OPEN-24** |
| R12 | «Máximo dos servicios simultáneos por técnico» | `05` §11; RF-44 | **Por confirmar: OPEN-25** |
| R13 | Reasignación de un bloque exige permiso y queda en bitácora («de 09:00–10:00 a 09:30–10:30») | `CAMBIOS_R7.3`; RF-67 | Demostrada en el prototipo |
| R14 | La vista de tarea del técnico no muestra precios ni costos | DEC-24 | Cerrada |

## 4. Modelo de datos
Tablas: `tareas`, `checklists`, `horarios`, `bloques`, `servicios_cita`, `detalles`, `auditoria`.
**Correcciones necesarias** (ver `INCONSISTENCIAS.md`):
- **INC-A4:** `detalles.minutos_iniciales` y `minutos_revisados` exigen múltiplos de **30**, pero la regla es 15 min / 0,25 H-H. Corregir el `CHECK` a 15 antes de implementar.
- `bloques` exige que `servicio_cita_id` o `detalle_id` no sea nulo y `fin > inicio`; el solapamiento **no** lo impone el DDL: lo comprueba la aplicación en la misma transacción.
- `tareas.estado` incluye `cancelada` pero R7.6 la retiró como estado seleccionable (INC-C5): decidir si se conserva solo como marca del sistema.

## 5. Contratos
Del diagrama `DCL-R8-0001C` (propuesta no validada por el profesor):

| Clase | Métodos |
|---|---|
| `Planificador` | `validarCapacidad(tecnicoId, bloques)`, `enlazarBloques(citaId, ordenId)`, `agregarContinuacion(detalleId, inicio, fin, motivo)` |
| Entidades | `BloqueTrabajo` (inicio, fin, horas reales, `continuacionDeId`), `Horario` (jornada, descanso, excepciones), `LineaCita` (`duracionHH`, `tecnicoId`, `asignacionExplicita`) |

⚠ **`Planificador.agregarContinuacion` lanza deliberadamente «No implementado en R8»** (`ESTADO_MIGRACION` §5): hay que implementarlo desde cero. Faltan además en el UML las operaciones de **cierre y reapertura de jornada**, **dividir**, **postergar**, **extender** y **reasignar** (están en el prototipo, no en el diagrama): proponer su incorporación al profesor.

## 6. Criterios de aceptación
| ID | RF | Dado / Cuando / Entonces | Origen |
|---|---|---|---|
| CA-03-01 | RF-61 | **Dado** una ODS creada, **cuando** se genera su trabajo, **entonces** existe **una** tarea raíz con **exactamente** los contenedores Servicios y Productos | DEC-07 |
| CA-03-02 | RF-48 | **Dado** un servicio sin responsable propio, **cuando** se crea, **entonces** hereda el responsable de la tarea | RF-48 |
| CA-03-03 | RF-66 | **Dado** un total estimado de 3 h y tres servicios de 1, 2 y 1 h, **cuando** se redistribuye, **entonces** quedan 0,75 / 1,5 / 0,75 (múltiplos de 0,25) y la suma es 3 | `CAMBIOS_R7.2` (ejemplo de proporción) |
| CA-03-04 | RF-66 | **Dado** un valor de H-H que no es múltiplo de 0,25 o un bloque que no es múltiplo de 15 min, **cuando** se guarda, **entonces** se rechaza | DEC-17; INC-A4 |
| CA-03-05 | RF-67 | **Dado** un bloque, **cuando** se divide, **entonces** los segmentos referencian el **mismo servicio** y la suma de sus duraciones no cambia | `07` §4.7 |
| CA-03-06 | RF-67 | **Dado** un bloque, **cuando** se posterga, extiende o reasigna a otro técnico autorizado, **entonces** la **hora de llegada de la ODS no cambia** y el cambio queda en bitácora con el antes/después | DEC-16; R13 |
| CA-03-07 | RF-45 | **Dado** una extensión de un bloque, **cuando** se confirma, **entonces** se muestra una advertencia y se puede registrar el motivo | R7 |
| CA-03-08 | RF-44 | **Dado** un técnico con dos servicios simultáneos, **cuando** se intenta un tercero que se solape, **entonces** se rechaza (**si OPEN-25 mantiene la regla**) | `05` §11; modelo README |
| CA-03-09 | RF-44 | **Dado** dos escrituras concurrentes que producirían solapamiento, **cuando** se confirman, **entonces** la segunda se rechaza (revalidación dentro de la misma transacción con intervalos [inicio, fin)) | modelo README |
| CA-03-10 | RF-42 | **Dado** el horario de un técnico con excepciones, **cuando** se planifica fuera de jornada o en el almuerzo, **entonces** el sistema lo impide o lo advierte según la configuración | RF-42 |
| CA-03-11 | RF-68 | **Dado** una jornada de una sede y fecha, **cuando** el jefe de taller la cierra, **entonces** queda bloqueada; **cuando** cualquiera intenta editarla, **entonces** se rechaza | DEC-19 |
| CA-03-12 | RF-68 | **Dado** una jornada cerrada, **cuando** el jefe intenta reabrirla, **entonces** se rechaza; **cuando** lo hace el administrador con motivo, **entonces** se reabre y se audita | DEC-19 |
| CA-03-13 | RF-46 | **Dado** una ejecución histórica, **cuando** se corrige con permiso, **entonces** la corrección queda auditada | RF-46 |
| CA-03-14 | RF-69 | **Dado** un técnico con jornada 08:00–18:00, almuerzo 13:00–14:00 y segmentos que dejan 90 min libres fuera del almuerzo, **cuando** se calculan las horas perdidas, **entonces** son 1,5 h | R9 |
| CA-03-15 | RF-47 | **Dado** dos segmentos solapados del mismo técnico, **cuando** se reporta la disponibilidad, **entonces** no hay doble conteo (se usa la unión temporal) | R9 |
| CA-03-16 | RF-71 | **Dado** un técnico, **cuando** abre su tarea, **entonces** ve H-H y nombres de servicio y producto pero ningún precio, costo ni rentabilidad | DEC-24 |
| CA-03-17 | RF-35, RF-108 | **Dado** el espacio de trabajo, **cuando** se cambia entre Lista, Tablero y Calendario, **entonces** las tres vistas muestran el mismo conjunto de tareas con los mismos estados (tablero de 3 columnas) | RF-35; `CAMBIOS_R7.6` |
| CA-03-18 | RF-67 | **Dado** una continuación de un servicio, **cuando** se agrega con `agregarContinuacion`, **entonces** conserva `continuacionDeId` y el esfuerzo real total del servicio es la suma de todos sus bloques | R5; INC-B5 |
| CA-03-19 | RF-60 | **Dado** una tablet, **cuando** se usa la agenda, **entonces** las operaciones táctiles esenciales (mover y estirar bloques) funcionan sin ratón | RF-60; pedido R7.7 |

## 7. Pruebas previstas
- **Dominio:** distribución de H-H, huecos reales (unión de intervalos), validación de capacidad, cierre/reapertura de jornada. El motor R8 tiene un `Planificador` parcial (`nucleo-referencia/src/motor.js`).
- **Servicio:** concurrencia en `validarCapacidad`, permisos de jefe/administrador, inmutabilidad de jornada cerrada.
- **Interfaz:** referencia `prototipo/pruebas/e2e73_sobre_r74.mjs` y `e2e76.mjs` (**no ejecutadas**).

## 8. Datos y dependencias externas
Datos sintéticos de técnicos, sedes y horarios. Confirmar con el taller el horario real y el almuerzo (OPEN-24).

## 9. Decisiones abiertas que lo afectan
| OPEN | Efecto |
|---|---|
| OPEN-24 | Valor inicial del almuerzo y del horario semanal |
| OPEN-25 | Mantener o retirar «máximo dos simultáneos» (RF-44, CA-03-08/09) |
| OPEN-27 | Si «Cancelado» es estado seleccionable (R2) |
| OPEN-37 | Corrección del `CHECK` de minutos (A4) |

## 10. Riesgos y brechas
- `agregarContinuacion` no existe aún (INC-B5).
- El diagrama de clases R8 no cubre cierre de jornada, dividir, postergar, extender ni reasignar.
- La regla de simultáneos y el almuerzo tienen **valores contradictorios** entre fuentes.
- El prototipo corre las automatizaciones solo con el sistema abierto; un servidor las ejecutará de otra manera.

## 11. Definición de hecho
`docs/plan/PLAN_DESARROLLO.md` §4, más: una jornada completa planificada, ejecutada y cerrada con evidencia, y el cálculo de horas perdidas comprobado con un caso conocido.

## 12. Referencias
`docs/contexto/04_VISION_COMPLETA_MODULOS.md` §2.5–2.8, `05` §11, `docs/historial/R7/CAMBIOS_R7.2.md`, `CAMBIOS_R7.3.md`, `CAMBIOS_R7.6.md`; `diagramas/R8_propuesta/DCL-R8-0001C_posventa_citas_agenda.puml`; `tesis/latex/modelo/esquema_propuesto.sql`.
