# Estado actual del proyecto (12/11/2026)

> **Actualización del 12/11/2026:** el 11/11/2026 pasaron las 145 pruebas de la API (84,9 % de cobertura de sentencias) y las 48 de la pantalla; la nota de Codex que sigue describe un estado anterior, ya reparado. Decisiones nuevas: DEC-86 a DEC-104 (`docs/decisiones/DECISIONES_CERRADAS.md` §13). Se desarrolla de forma vertical, módulo por módulo (DEC-87).

> **Revisión posterior de Codex (05/11/2026):** tras los últimos cambios de S5, la interfaz pasa 48/48; la API registra 56 aprobadas y 82 fallidas (138 en total). Se observan datos de prueba incompatibles con la nueva validación documental y una base `posventa_test` sin la columna `preciosGrupo`. Los resultados 135/135 citados abajo corresponden a la ejecución anterior y no certifican el código actual. S5 requiere cerrar esta verificación. Detalle y relevo: [revisión de continuidad](revision/2026-11-05-revision-continuidad.md).

Este documento manda sobre cualquier otro texto del repositorio que describa el estado. Si un archivo dice que el sistema «no existe» o que la pila está «propuesta», es histórico.

## Qué existe
- **El sistema real**, en un monorepo pnpm: `apps/api` (NestJS), `apps/web` (React + TypeScript + Vite) y `database` (Prisma con PostgreSQL). Pila aceptada el 20/10/2026 (`docs/decisiones/ADR-001-pila-tecnologica.md`).
- **Slices S1 y S2 terminados y S3 en curso:** acceso, roles y menú por rol; clientes y vehículos con lecturas de km; órdenes de servicio (ítems, estados, abonos, evidencias de ingreso, estado del vehículo, cierre y eliminación). En S3 faltan los ajustes R8.2 (RN-05, RN-06 y garantía enlazada); RF-018 se terminó el 16/11/2026.
- **Requisitos R8.2 (05/11/2026):** bajaron de 99 a 49. Implementados: RF-001 a 005, 007, 008 a 010, 011, 018, 089 y 100 a 102 (S5); parciales: RF-015, 016, 060, 063 y 071. Fuente: `docs/requisitos/R82/` (requisitos, criterios, reglas de negocio, RNF, HU, casos de prueba y trazabilidad), generada junto con el anexo Excel de la tesis.
- **Pruebas (15/11/2026):** 171 de la API y 76 de la pantalla, todas aprobadas el 16/11/2026 (tras el modal único de cliente y proveedor, DEC-95, el alta rápida desde vehículos, DEC-96, el modal de pagos recibidos, DEC-97, los PDF de la orden, DEC-98, y el botón «Nuevo» con consulta de documento, DEC-99); cobertura de la API 84,9 % de sentencias el 11/11/2026 (`test:cov`), sin volver a medir. Dato anterior: 135 de la API (en la base de pruebas `posventa_test`) y 48 de la pantalla, ejecutadas el 05/11/2026 sin fallos; la tesis las presenta por sprint (`docs/requisitos/R82/ejecucion/`), y 17 del prototipo R7.8.
- **Prototipo HTML R7.8** (`prototipo/`): guía visual. Si el sistema real se aparta del prototipo, manda el sistema real.

## Qué falta
- Cerrar S3 y los slices S4 a S14 (migración interna, maestros y precios por grupo, planes, línea de tiempo, tareas y vistas, citas, bitácora, comercial, inventario, posventa y reportes).
- Entorno de pruebas en internet (staging) y copias de seguridad (la integración continua ya existe: `.github/workflows/ci.yml`).
- Mediciones de la validación (30 vehículos, HE-1 a HE-4) y fichas de las entrevistas.
- Aceptación de usuarios del taller y del profesor.

## Fuentes vigentes
| Tema | Vigente | Histórico |
|---|---|---|
| Requisitos | `docs/requisitos/R82/` (49 RF, 18 RN, 12 RNF, 15 HU, 58 CP) | R81 (99 RF), R77 a R80 y `CLASIFICACION_RF.csv` |
| Trazabilidad | `docs/requisitos/R82/MATRIZ_TRAZABILIDAD_R82.csv` | R81 (`MATRIZ_TRAZABILIDAD_R81.csv`, `ESTADO_IMPLEMENTACION.csv`) y R78 a R80 |
| Diagramas | `diagramas/tesis/` (29 diagramas, código sin versión, DEC-86) | `R82`, `R81_consolidados`, R8, R77 y R78 (ver `diagramas/LEEME.md`) |
| Plan de desarrollo | `docs/plan/SLICES_NUCLEO.md` | `PLAN_DESARROLLO.md` por incrementos INC |
| Criterios de aceptación | `docs/requisitos/R82/CRITERIOS_ACEPTACION_R82.csv` y las pruebas (DEC-87) | `specs/S1-base-del-sistema.md`, `specs/INC-01-*.md` a `specs/INC-07-*.md` y `specs/R7.7-*.md` |
| Reglas de trabajo | `AGENTS.md` | — |

## Slices
Se desarrolla **por slices**; el plan vigente (S1 a S14, R8.2) está en `docs/plan/SLICES_NUCLEO.md`. S1, S2 y S5 están terminados, S3 en curso y S4 es la migración interna (sin requisitos), que va después del S5 porque también carga los maestros. El S5 usa el modelo de grupos, precios y solapamiento del paquete de integración (`database/seeds/precarga/s5/`, referencia Autodata en combinación con datos del taller RSA).

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
