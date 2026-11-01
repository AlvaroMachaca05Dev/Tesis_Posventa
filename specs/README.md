# Especificaciones (SDD)

> **31/10/2026:** el desarrollo se hace por slices (`S1-base-del-sistema.md` y `docs/plan/SLICES_NUCLEO.md`). Las specs INC quedan como referencia por incremento; la equivalencia está en `docs/ESTADO_ACTUAL.md`.

Una especificación por incremento, escrita para que un agente (Claude Code o Codex) o una persona pueda implementar y probar **sin tener que adivinar**. Derivadas el 17/10/2026 de `docs/contexto/` y `docs/requisitos/`.

**Estado de todas las specs: BORRADOR.** Son una propuesta del asistente construida con las fuentes del proyecto; **nadie las ha aprobado**. Cada una indica qué viene de una fuente y qué es deducción propia. Hasta que se cierren las decisiones que cada spec lista, **no se implementa lo que dependa de ellas**.

| Spec | Qué cubre | RF | Estado de las dudas |
|---|---|---:|---|
| [`00-convenciones.md`](00-convenciones.md) | Reglas transversales (datos, tiempo, dinero, seguridad, trazabilidad, pruebas) | — | — |
| [`INC-01-base-operativa.md`](INC-01-base-operativa.md) | Usuarios, sedes, clientes, vehículos, ODS, bitácora, auditoría, maestros | 26 | Bloqueada por OPEN-01, 02, 03, 23 |
| [`INC-02-importacion.md`](INC-02-importacion.md) | Importación XLSX/CSV idempotente y atómica | 7 | Bloqueada por OPEN-07 |
| [`INC-03-servicios-agenda.md`](INC-03-servicios-agenda.md) | Tareas, servicios, agenda de técnicos, cierre de jornada | 16 | Bloqueada por OPEN-24, 25 |
| [`INC-04-plan-preventivo.md`](INC-04-plan-preventivo.md) | Planes, aplicabilidad, línea temporal | 17 | Bloqueada por OPEN-08, 20, 33, 38 |
| [`INC-05-reajuste.md`](INC-05-reajuste.md) | Reajuste del futuro con evidencia | 1 | Bloqueada por OPEN-21 |
| [`INC-06-posventa.md`](INC-06-posventa.md) | Seguimiento, contacto, citas, llegada, encuesta | 17 | Bloqueada por OPEN-22, 26 |
| [`INC-07-productos-logistica.md`](INC-07-productos-logistica.md) | Cotización, compra, evidencia, conformidad *(opcional)* | 12 | Bloqueada por OPEN-05 |
| [`R7.7-prototipo.md`](R7.7-prototipo.md) | Pedidos para la siguiente versión del prototipo (pista P) | — | Varias preguntas abiertas |
| [`R7.7-delimitacion-primera-version.md`](R7.7-delimitacion-primera-version.md) | Delimitación de la primera versión del 19/10/2026: criterios CA-D-01 a CA-D-24 | — | Dudas en la §9 |
| [`R7.7-motor-automatizaciones.md`](R7.7-motor-automatizaciones.md) | Motor de reglas «Cuando / Y si / Entonces» tipo ClickUp (pista P) | — | OPEN-27, 28 |
| [`R7.7-plantillas-reglas-iniciales.md`](R7.7-plantillas-reglas-iniciales.md) | Cómo se crearían las 3 reglas iniciales (km, cita, posventa) con el motor nuevo | — | Posventa sin teléfono; OPEN-22, 27, 38 |
| [`requisitos-por-incremento/`](requisitos-por-incremento/) | Tablas de requisitos por incremento, **generadas** desde la matriz | 117 | — |
| [`_PLANTILLA_SPEC.md`](_PLANTILLA_SPEC.md) | Plantilla para crear o revisar specs | — | — |

## Cómo se usan
1. El investigador cierra las decisiones que bloquean (`docs/decisiones/DECISIONES_ABIERTAS.md`).
2. El agente `tesis_analista_sdd` (skill `redactar-spec-sdd`) afina la spec: criterios, casos negativos, dudas.
3. El agente `tesis_implementador` escribe **primero las pruebas** desde los criterios `CA-xx` y luego el código.
4. El agente `tesis_revisor` verifica cada criterio y las rutas negativas.
5. Se registra evidencia en `docs/evidencias/` y el resultado en `REGISTRO_CAMBIOS.md`.

## Cómo leer un criterio de aceptación
`CA-01-07 [RF-06] Dado…, cuando…, entonces…` → incremento 01, criterio 07, requisito relacionado. La columna **Origen** indica de dónde viene: una **decisión cerrada** (`DEC-xx`), una **regla de las fuentes** (con archivo), una **brecha heredada** de la revisión de la línea A, o **deducción del asistente**. Lo deducido necesita confirmación.

## Lo que ninguna spec afirma
Ninguna spec dice que algo esté implementado, probado o aceptado. «Demostrado en el prototipo» significa que existe en el HTML local, que no tiene servidor ni autenticación real.
