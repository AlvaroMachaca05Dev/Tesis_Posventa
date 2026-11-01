# Estado actual del proyecto (31/10/2026)

Este documento manda sobre cualquier otro texto del repositorio que describa el estado. Si un archivo dice que el sistema «no existe» o que la pila está «propuesta», es histórico.

## Qué existe
- **El sistema real**, en un monorepo pnpm: `apps/api` (NestJS), `apps/web` (React + TypeScript + Vite) y `database` (Prisma con PostgreSQL). Pila aceptada el 20/10/2026 (`docs/decisiones/ADR-001-pila-tecnologica.md`).
- **Slices S1 a S3 terminados:** acceso, roles y menú por rol; clientes y vehículos con lecturas de km; órdenes de servicio completas (ítems, estados, abonos, evidencias de ingreso, estado del vehículo, cierre y eliminación).
- **14 requisitos implementados y probados:** RF-001 a RF-007 y RF-011 a RF-017. El avance de cada RF vive en `docs/requisitos/ESTADO_IMPLEMENTACION.csv`.
- **Pruebas:** 109 de la API (con la base real), 42 de la pantalla y 17 del prototipo R7.8.
- **Prototipo HTML R7.8** (`prototipo/`): guía visual. Si el sistema real se aparta del prototipo, manda el sistema real.

## Qué falta
- Slices S4 a S11 (carga masiva, planes, línea de tiempo y reajuste, tareas, citas y agenda, bitácora, posventa y reportes).
- Entorno de pruebas en internet (staging), copias de seguridad y CI.
- Aceptación de usuarios del taller y del profesor.

## Fuentes vigentes
| Tema | Vigente | Histórico |
|---|---|---|
| Requisitos | `docs/requisitos/REQUISITOS_FUNCIONALES_FINALES_R81.*` (99 RF) | R77 a R80 y `CLASIFICACION_RF.csv` (numeración antigua de 117 RF) |
| Trazabilidad | `docs/requisitos/MATRIZ_TRAZABILIDAD_R81.csv` y `ESTADO_IMPLEMENTACION.csv` | R78 a R80 |
| Diagramas | `diagramas/R81_consolidados/` | R8, R77 y R78 (ver `diagramas/LEEME.md`) |
| Plan de desarrollo | `docs/plan/SLICES_NUCLEO.md` | `PLAN_DESARROLLO.md` por incrementos INC |
| Especificaciones | `specs/S1-base-del-sistema.md` y los slices | `specs/INC-01-*.md` a `specs/INC-07-*.md` y `specs/R7.7-*.md` |
| Reglas de trabajo | `AGENTS.md` | — |

## Slices e incrementos
Se desarrolla **por slices**. Los incrementos INC son la agrupación de la tesis; la equivalencia es por tema:

| Slice | Funcionalidad | RF (R81) | INC | Estado |
|---|---|---|---|---|
| S1 | Acceso, roles y menú por rol | 001–003 | INC-01 | Terminado |
| S2 | Clientes y vehículos con lecturas de km | 004–007 | INC-01 | Terminado |
| S3 | Órdenes de servicio | 011–017 | INC-01 | Terminado |
| S4 | Carga masiva diaria | 019–023 | INC-02 | Siguiente |
| S5 | Planes preventivos | 026–030 | INC-04 | Pendiente |
| S6 | Línea de tiempo y reajuste | 031–035 | INC-04 y INC-05 | Pendiente |
| S7 | Tareas | 036–040 | INC-03 | Pendiente |
| S8 | Citas, llegada y agenda | 053–056 | INC-03 y INC-06 | Pendiente |
| S9 | Bitácora | 059, 060, 063, 064 | INC-01 y INC-03 | Pendiente |
| S10 | Posventa y encuesta | 093–095, 097, 098 | INC-06 | Pendiente |
| S11 | Reportes y configuración mínima | 066–068, 071 | INC-06 | Pendiente |

INC-07 (productos y logística) queda como extensión opcional.

## Dónde está cada cosa
| Carpeta | Qué es |
|---|---|
| `apps/` | API y pantalla, ordenadas por módulo (`AGENTS.md` §19) |
| `database/` | Esquema, migraciones, semillas y precarga |
| `docs/` | Decisiones, requisitos, plan, alcance y contrato de API |
| `specs/` | Especificaciones de slices e incrementos |
| `diagramas/` | UML en PlantUML |
| `prototipo/` | Prototipo HTML y sus pruebas Playwright |
| `nucleo-referencia/` | Motor de dominio de referencia (JavaScript), antecedente |
| `herramientas/` | Scripts de apoyo (`pnpm dev`, trazabilidad, sincronización de skills) |

La tesis (LaTeX) y el registro de cambios viven en Google Drive, fuera de este repositorio (`AGENTS.md` §14).
