# Tesis — Sistema de posventa para R Motriz

Tesis de Ingeniería de Software (La Salle, Arequipa) de Álvaro Machaca: una aplicación web que convierte el historial de órdenes de servicio (ODS) en **planes de mantenimiento preventivo, reajuste, citas y posventa**.

- **Repositorio:** `https://github.com/AlvaroMachaca05Dev/Tesis_Posventa.git`, copia de trabajo en `F:\Tesis\Tesis_Posventa`.
- **Estado:** el sistema existe y los slices S1 a S3 están terminados (acceso, maestros y ODS). El detalle y las fuentes vigentes están en **[`docs/ESTADO_ACTUAL.md`](docs/ESTADO_ACTUAL.md)**.
- **Reglas de trabajo:** [`AGENTS.md`](AGENTS.md).

## Cómo verlo funcionando
1. Copia `.env.example` a `.env` y escribe en `VITE_DEMO_PASSWORD` la misma contraseña que en `SEED_PASSWORD`.
2. Instala Node 22 y pnpm, y ejecuta `pnpm install`.
3. La primera vez prepara la base: `pnpm db:dev` (déjala abierta) y, en otra terminal, `pnpm db:migrate` y `pnpm db:seed`.
4. Después basta con `pnpm dev` y abrir `http://localhost:5173`. La pantalla de ingreso trae botones para entrar con cada rol de demostración.
5. Pruebas: `pnpm test` (API y pantalla).

## Carpetas
| Carpeta | Qué es |
|---|---|
| `apps/api`, `apps/web` | API (NestJS) y pantalla (React), ordenadas por módulo |
| `database/` | Esquema Prisma, migraciones, semillas y precarga |
| `docs/` | Estado actual, decisiones, requisitos, plan, alcance y contrato de API |
| `specs/` | Especificaciones de slices e incrementos |
| `diagramas/` | UML (vigente: `R81_consolidados/`) |
| `prototipo/` | Prototipo HTML R7.8 y sus pruebas |
| `nucleo-referencia/` | Motor de dominio de referencia (antecedente) |
| `agentes/`, `.agents/`, `.claude/`, `.codex/` | Agentes y skills |
| `herramientas/` | Scripts de apoyo |

## Reglas que no se negocian
Solo datos sintéticos en el repositorio · nunca se suben claves, tokens ni el `.env` · no se afirma nada que no se haya probado · cada cambio se puede ver en localhost. Detalle en `AGENTS.md`.
