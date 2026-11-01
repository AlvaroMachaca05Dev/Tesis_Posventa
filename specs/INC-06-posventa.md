# INC-06 — Posventa: seguimiento, contacto, citas, llegada y retorno

> **Referencia por incremento (31/10/2026).** Se desarrolla por slices (S8, S10 y S11). El estado vigente está en `../docs/ESTADO_ACTUAL.md`.


**Estado:** BORRADOR · **Versión:** 0.1 · **Fecha:** 17/10/2026 · **Autor:** asistente (Claude), derivado de las fuentes · **Aprobada por:** nadie todavía
**Bloqueada por:** OPEN-22 (vocabulario de estados de cita), OPEN-26 (definición de «cita convertida»), OPEN-01. **Depende de:** INC-01, INC-03 (agenda) e INC-04 (tareas de kilometraje).

## 1. Objetivo y resultado vertical
Criterio de cierre (`06` §7): **«Tarea de seguimiento, contacto, cita, llegada y retorno».**
Al archivar una ODS el sistema asegura una tarea de seguimiento para la cajera responsable; ella registra intentos de contacto y su resultado (el envío por WhatsApp es **manual** y abrir un enlace **no** acredita envío ni respuesta); programa una cita por sede con servicios y técnico; cuando el vehículo llega, la cita se convierte en una ODS **sin duplicar reservas**; y el sistema mide el retorno (citas agendadas, que llegaron, convertidas).

## 2. Alcance
- **Incluye** los 17 requisitos de [`requisitos-por-incremento/INC-06.md`](requisitos-por-incremento/INC-06.md). Bloque T5 de `06` §3: seguimientos, intentos y resultados, citas y reprogramación, llegada de cita a ODS, indicadores de conversión. Y las **automatizaciones de tareas** de R7.4 (RF-104), la **consulta de km** (RF-105, 115) y la **encuesta de satisfacción** (RF-106).
- **Excluye:** envío real por WhatsApp o SMS (no hay integración contratada: se copia el texto y se registra el envío); el reajuste (INC-05); métricas comerciales (evolución).
- **Depende de:** INC-01 (ODS), INC-03 (bloques de agenda de la cita), INC-04 (línea temporal que dispara la tarea de km).

## 3. Reglas de dominio
| # | Regla | Fuente | Estado |
|---|---|---|---|
| R1 | La posventa exige **celular utilizable**; la **tarea preventiva** exige además **plan activo** | `CONTEXTO_TESIS` | Cerrada |
| R2 | **WhatsApp es un enlace de envío manual.** El envío o la respuesta **no se presumen**: solo `registrarIntento` + `registrarResultado` cambian el estado | `CONTEXTO_TESIS`; `DCL-R8-0001C` (nota) | Cerrada |
| R3 | Las citas son **por sede**; asistencia, ausencia y reprogramación **sincronizan su tarea** | `CONTEXTO_TESIS`; RF-20, 41 | Cerrada |
| R4 | La llegada **convierte la cita en ODS sin duplicar reservas**; idempotente por `claveConversion` | `04` §2.15; `DCL-R8-0001C` | Cerrada |
| R5 | La agenda técnica y las citas comparten la tabla `bloques`; la **hora de llegada** de la ODS es independiente | modelo README; DEC-16 | Cerrada |
| R6 | **Automatizaciones R7.4 (solo crean tareas; nunca agendan citas):** (a) «Consultar km» si faltan ≤ 500 km **o** ≤ 7 días para el cambio de aceite; una por ciclo; (b) «Confirmar cita» 1 h antes del inicio (si es a la apertura, 1 h antes del cierre del día hábil anterior); (c) llamada y encuesta a los **5 días hábiles** de la salida, hasta el día hábil 7 | `CAMBIOS_R7.4`; `CLAUDE_RMotriz` | Demostrada en el prototipo; las **reglas y plantillas del motor** están en `R7.7-motor-automatizaciones.md` |
| R7 | Idempotencia de tareas automáticas por `claveEvento` (`tareas.clave_evento UNIQUE`, `registro_automatizacion.clave_evento UNIQUE`) | SQL | Cerrada |
| R8 | **Encuesta:** 7 preguntas; varias respuestas por ODS; NPS de 1 a 10; envío por WhatsApp o SMS solo registra el envío | RF-106; SQL `encuestas`, `envios_encuesta` | Demostrada |
| R9 | Consulta de km: medio Llamada, WhatsApp u Otro (con texto), sin observación; recalcula la proyección y completa la tarea | RF-105 | Demostrada |
| R10 | **Estados de cita** | UML R8: RESERVADA, RECONFIRMADA, LLEGADA_CONVERTIDA, REPROGRAMADA, CANCELADA · SQL/R7.2: pendiente, confirmada, completada, cancelada, no_asistio | **En conflicto: OPEN-22 (INC-B1)** |
| R11 | **Definición de «cita convertida»** | Cita con ODS creada (reporte R7.6) frente a ODS archivada con al menos un servicio (RF-59) | **En conflicto: OPEN-26 (INC-C4)** |

## 4. Modelo de datos
Tablas: `tareas`, `checklists`, `intentos_contacto`, `metas`, `citas`, `servicios_cita`, `horarios`, `bloques`, `encuestas`, `envios_encuesta`, `automatizaciones`, `registro_automatizacion`, `notificaciones`, `lecturas_km`.
**Correcciones necesarias:**
- Unificar el **vocabulario de estados de cita** (INC-B1) y **mapear `EstadoSeguimiento`** (PENDIENTE, INTENTO_REGISTRADO, CONTACTO_DECLARADO, COMPLETADO_CON_CITA, COMPLETADO_SIN_CITA, COMPLETADO_CON_SUBTAREA) a `tareas` (INC-B2).
- `automatizaciones.tipo` solo admite `consultar_km`, `confirmar_cita`, `posventa`; si R7.7 incorpora el motor general, habrá que ampliarlo (ver `R7.7-motor-automatizaciones.md`).

## 5. Contratos
Del diagrama `DCL-R8-0001C`:

| Clase | Métodos |
|---|---|
| `ServicioPosventa` | `asegurarSeguimiento(ordenId, claveEvento)`, `registrarIntento(seguimientoId, canal)`, `registrarResultado(seguimientoId, resultado)`, `generarEnlaceWhatsApp(seguimientoId)` |
| `ServicioCitas` | `programarCita(seguimientoId, lineas, bloques)`, `convertirLlegada(citaId, clave)`, `reprogramar(citaId, bloques, motivo)` |
| `ServicioAvisos` | `crearReconfirmacion(citaId)` |
| `ServicioODS` | `crearDesdeCita(citaId, clave)` (de INC-01) |
| Entidades | `Seguimiento`, `IntentoContacto`, `Cita`, `LineaCita`, `BloqueTrabajo` |

Secuencia de referencia: `DSE-R8-0005_posventa_cita_llegada.puml`. Estados: `DES-R8-0003_estados_seguimiento.puml`.

## 6. Criterios de aceptación
| ID | RF | Dado / Cuando / Entonces | Origen |
|---|---|---|---|
| CA-06-01 | RF-18 | **Dado** una ODS que se archiva, **cuando** el cliente tiene celular utilizable, **entonces** se asegura **un** seguimiento para la cajera responsable con fecha de vencimiento | R1 |
| CA-06-02 | RF-18 | **Dado** el mismo evento de archivado repetido, **cuando** se procesa, **entonces** no se crea un segundo seguimiento (`claveEvento`) | R7 |
| CA-06-03 | RF-18 | **Dado** un cliente sin celular utilizable, **cuando** se archiva su ODS, **entonces** no se crea seguimiento y se informa el motivo | R1 |
| CA-06-04 | RF-19 | **Dado** un seguimiento, **cuando** se genera el enlace de WhatsApp y se abre, **entonces** el estado **no cambia**; cambia solo al registrar intento y resultado | R2 |
| CA-06-05 | RF-36 | **Dado** un seguimiento con intentos, **cuando** se registra el resultado, **entonces** pasa al estado que corresponda (con cita, sin cita o con subtarea) y cada intento guarda canal, fecha y resultado | `DCL-R8-0001C` |
| CA-06-06 | RF-20 | **Dado** un seguimiento, **cuando** se programa una cita en una sede, **entonces** la cita se vincula a su tarea y a bloques de agenda del técnico elegido | R3 |
| CA-06-07 | RF-39 | **Dado** una cita con servicios, **cuando** se asignan técnico y duración, **entonces** las duraciones son múltiplos de 0,25 H-H y se valida la capacidad del técnico | INC-03 |
| CA-06-08 | RF-40 | **Dado** una cita, **cuando** llega el vehículo y se convierte, **entonces** se crea **una** ODS con los servicios y adelantos de la cita y la cita queda marcada; **si se repite la conversión**, no se duplica (`claveConversion`) | R4 |
| CA-06-09 | RF-41 | **Dado** una cita, **cuando** se reprograma, **entonces** se actualizan sus bloques y se crea una tarea de aviso; la tarea original se sincroniza | R3 |
| CA-06-10 | RF-20 | **Dado** una cita que no asiste o se cancela, **cuando** se registra, **entonces** la tarea asociada se sincroniza y el sistema marca la tarea como cancelada | R3; `CLAUDE_RMotriz` |
| CA-06-11 | RF-24 | **Dado** una cajera desactivada con seguimientos abiertos, **cuando** se reasignan, **entonces** pasan a su sucesora con registro | RF-24; `ANALISIS_CLICKUP` §3 |
| CA-06-12 | RF-104 | **Dado** un cambio de aceite que vence en ≤ 500 km o ≤ 7 días, **cuando** corre la automatización, **entonces** se crea una sola tarea «Consultar km» por ciclo, con los servicios vencidos, por vencer y próximos | R6 |
| CA-06-13 | RF-104 | **Dado** una cita, **cuando** falta 1 h, **entonces** existe una tarea «Confirmar cita»; si la cita es a la apertura, se crea 1 h antes del cierre del día hábil anterior | R6 |
| CA-06-14 | RF-104 | **Dado** una ODS archivada, **cuando** pasan 5 días hábiles, **entonces** se crea la tarea de llamada y encuesta (hasta el día hábil 7 si el sistema no estuvo abierto) | R6 |
| CA-06-15 | RF-104 | **Dado** una automatización, **cuando** se ejecuta, **entonces** solo crea tareas; **nunca** agenda citas | R6 |
| CA-06-16 | RF-105, RF-115 | **Dado** una consulta de km registrada, **cuando** se guarda, **entonces** recalcula la proyección, completa la tarea y alimenta la «última consulta de km» | R9; INC-04 R12 |
| CA-06-17 | RF-106 | **Dado** una ODS archivada, **cuando** se envía o registra la encuesta, **entonces** se guarda el canal, la fecha y las 7 respuestas; se admiten varias respuestas y la ODS muestra la última | R8 |
| CA-06-18 | RF-38, RF-59, RF-116 | **Dado** un mes, **cuando** se pide el reporte de posventa, **entonces** muestra citas agendadas, que llegaron, convertidas (según la definición que decida **OPEN-26**) y tasa de conversión, con tareas completadas por cajera | OPEN-26 |
| CA-06-19 | RF-90 | **Dado** una cita con cotización propia, **cuando** se marca Completada, **entonces** se ofrece crear la ODS con la cotización y los adelantos de la cita | `CAMBIOS_R7.2` |

## 7. Pruebas previstas
- **Dominio:** estados de seguimiento y cita, claves de evento, cálculo de días hábiles, umbrales de km.
- **Servicio:** idempotencia de conversión y seguimiento; sincronización cita ↔ tarea; permisos de cajera y jefe.
- **Interfaz:** referencias `prototipo/pruebas/e2e74_sobre_r76.mjs` (73 comprobaciones de R7.4), `e2e75.mjs` y `e2e76.mjs` (**no ejecutadas**).
- Skill de apoyo: ninguna específica; agente `tesis_analista_sdd` para afinar.

## 8. Datos y dependencias externas
Datos sintéticos. **Ningún envío real** de WhatsApp o SMS. El número de celular de un cliente real **no** va en el repositorio.

## 9. Decisiones abiertas que lo afectan
| OPEN | Efecto |
|---|---|
| OPEN-22 | Vocabulario de estados de cita (UML, SQL, HTML y matriz) |
| OPEN-26 | Indicador principal del reporte |
| OPEN-27, 28 | Reglas del motor de automatizaciones (R7.7) |
| OPEN-37 | Mapeo de `EstadoSeguimiento` a `tareas` (INC-B2) |
| OPEN-35 | Parámetros de demostración (valor H-H, capacidad) usados en métricas |

## 10. Riesgos y brechas
- **Tres vocabularios de estado de cita.**
- `Planificador.agregarContinuacion` no está implementado (INC-B5).
- Las automatizaciones del prototipo corren **solo con el sistema abierto**; con servidor habrá que decidir un planificador (`R7.7-motor-automatizaciones.md`).
- La meta de «20 % de reducción del tiempo» es una meta, no una medición.

## 11. Definición de hecho
`docs/plan/PLAN_DESARROLLO.md` §4, más: recorrido completo ODS archivada → seguimiento → intento → cita → llegada → ODS nueva, con repetición de cada paso sin duplicados, y registro en `docs/evidencias/`.

## 12. Referencias
`docs/contexto/04_VISION_COMPLETA_MODULOS.md` §2.15, `05`, `06`; `docs/historial/R7/CAMBIOS_R7.2.md`, `R7.4.md`, `R7.5.md`, `R7.6.md`, `ANALISIS_CLICKUP_R77.md`; `diagramas/R8_propuesta/DCL-R8-0001C_posventa_citas_agenda.puml`, `DSE-R8-0005`, `DES-R8-0003`; `tesis/latex/modelo/esquema_propuesto.sql`.
