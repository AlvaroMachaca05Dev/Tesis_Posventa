# Sprint 1 de desarrollo: base del sistema real

> **Actualización 27/10/2026:** el trabajo se hace por funcionalidad completa y no por capas. El plan vigente está en `docs/plan/SLICES_NUCLEO.md`. Este documento queda como referencia del esqueleto mínimo, que ahora forma parte del slice S1.

**Periodo:** del 20/10/2026 al 31/10/2026 (dos entregas: sábado 24 y sábado 31).
**Meta:** dejar un sistema real mínimo que arranque, con base de datos, acceso por roles y los maestros de clientes y vehículos.
**Especificación:** `specs/S1-base-del-sistema.md`. **Metodología:** skill `ejecutar-sprint`.

## Antes de empezar (puertas de entrada)
- [ ] **ADR-001 aceptado** por el investigador (cambiar su estado a ACEPTADO con fecha y nombre).
- [ ] Node LTS, pnpm (o npm), Docker y Git instalados en cada equipo.
- [ ] Repositorio de trabajo creado y `main` protegida.

## Entrega 1 · sábado 24/10: esqueleto funcionando
| Tarea | Área | Listo cuando |
|---|---|---|
| Monorepo con workspaces y configuración común | raíz | `pnpm install` funciona en un equipo limpio |
| Base de datos PostgreSQL en Docker Compose | `infra/` | `docker compose up -d` levanta la base |
| Esquema Prisma del núcleo (organización, local, usuario, rol, permiso, cliente, vehículo, lectura de km, ODS, bitácora, auditoría) | `database/` | `prisma migrate dev` aplica la migración inicial |
| Semillas sintéticas (dos locales, siete roles, usuarios de ejemplo) | `database/seeds` | `prisma db seed` carga datos de ejemplo |
| API NestJS mínima: salud, autenticación y guardia de roles | `apps/api` | Una ruta protegida responde 401 sin sesión y 403 sin el rol |
| Web React mínima: inicio de sesión y menú por rol | `apps/web` | Se ve el menú del rol; los módulos beta se pueden ocultar |
| CI en GitHub Actions | `.github/` | Compila y corre las pruebas en cada push |

## Entrega 2 · sábado 31/10: maestros
| Tarea | Área | Listo cuando |
|---|---|---|
| Clientes: crear, editar, buscar (RF-004, RF-006) | api, web, bd | Pruebas de API y de pantalla en verde |
| Vehículos con cliente y lecturas de km (RF-005, RF-007) | api, web, bd | La búsqueda por placa, documento o nombre funciona |
| Usuarios y roles administrados desde Configuración (RF-001 a RF-003) | api, web | El permiso se aplica en el servidor |
| Auditoría de cambios en maestros (RF-060) | api, bd | Cada cambio guarda actor, antes, después y motivo |

## Fuera del Sprint 1
ODS, carga masiva, planes, tareas, citas, agenda, comercial e inventario: Sprints siguientes.

## Registro
Cada entrega se anota en `REGISTRO_CAMBIOS.md` con lo hecho, lo pendiente y lo no verificado.
