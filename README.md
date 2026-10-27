# Tesis — Sistema de posventa para R Motriz

> **Ubicación de trabajo:** este repositorio se trabaja en `F:\Tesis\Tesis_Posventa` y se sube a `https://github.com/AlvaroMachaca05Dev/Tesis_Posventa.git`. La carpeta de Drive ya no contiene el código.


Tesis de Ingeniería de Software (La Salle, Arequipa) de Álvaro Machaca: una aplicación web que convierte el historial de órdenes de servicio (ODS) en **planes de mantenimiento preventivo, reajuste, citas y posventa**. Esta carpeta reúne **todo el contexto, las decisiones, las especificaciones, los agentes y las skills** para ejecutar el desarrollo con Claude Code o Codex.

## Dónde estamos (19/10/2026)
Delimitación de la primera versión **decidida por el investigador el 19/10/2026** (prototipo R7.7): `docs/alcance/DELIMITACION_PRIMERA_VERSION_R77.md`. Para los desarrolladores: empieza por ese documento, luego `docs/api/CONTRATO_API_R77.md`, `specs/R7.7-delimitacion-primera-version.md` y `diagramas/R77_delimitacion/`.

| Lo que ya existe | Lo que NO existe todavía |
|---|---|
| Visión completa documentada y corte de tesis recomendado | **El sistema real**: no hay servidor, base de datos operativa ni autenticación real |
| 117 requisitos clasificados por incremento (propuesta) | La **pila tecnológica decidida** (ADR-001 está PROPUESTO) |
| Prototipo HTML R7.7 (delimitado) con 597 pruebas Playwright (demostración local) | Datos reales anonimizados para probar la importación |
| Motor de dominio de referencia (JavaScript) y UML R8 | Validación mecánica de los planes e intervalos |
| **7 especificaciones** (INC-01 a INC-07, más R7.7) en borrador | Aceptación de usuarios o del profesor |
| 6 agentes y 11 skills para Claude Code y Codex | |

## Lo primero que hay que hacer (en este orden)
1. **Decidir lo que bloquea el código:** pila (OPEN-01), sede piloto (OPEN-02) y dónde vive el código (OPEN-03). → `docs/decisiones/ADR-001-pila-tecnologica.md` y `DECISIONES_ABIERTAS.md`.
2. **Resolver los datos reales del material histórico** conservado en `../archivo/` y retirarlo de Drive o anonimizarlo con autorización. → `docs/decisiones/INCONSISTENCIAS.md`, hallazgo INC-E5.
3. **Revocar el token de ClickUp** que se pegó en un chat el 17/10/2026, si no se hizo ya.
4. **Preparar el entorno** (`docs/plan/ENTORNO.md`).
5. **Empezar INC-01** con `specs/INC-01-base-operativa.md`.

## Cómo trabajar con Claude Code o Codex
Abre esta carpeta con la herramienta. Primer mensaje:

> Ejecuta la skill `revisar-cambios-carpeta` y dime qué cambió. Luego lee `AGENTS.md` y `../REGISTRO_CAMBIOS.md` y dime el siguiente paso pendiente.

Más mensajes listos, por etapa, en `docs/plan/FLUJO_DE_TRABAJO.md`.

## Carpetas
| | |
|---|---|
| `docs/` | Contexto, decisiones, requisitos, plan, evidencias, historial y referencias. Empieza por `docs/00_INDICE.md` |
| `specs/` | Especificaciones de cada incremento |
| `prototipo/`, `nucleo-referencia/`, `diagramas/`, `../fuentes-latex/` | Prototipo, motor de dominio, UML y tesis |
| `src/`, `tests/` | **Vacías** hasta decidir la pila |
| `agentes/`, `.agents/`, `.claude/`, `.codex/` | Agentes y skills |
| `herramientas/` | Scripts de apoyo |
| `../RMotriz_tesis_contexto/` | **No se toca.** Origen del contexto |
| `../fuentes-latex/` | Fuentes editables de la tesis |
| `../archivo/` | Línea A, entregables, temporales y material antiguo |
| `../../1_github-proyecto/`, `../../2_documento-tesis-overleaf/` | Copias generadas; no se editan a mano |

## Reglas que no se negocian
Solo datos sintéticos · no tocar `../RMotriz_tesis_contexto/` · revisar cambios antes de trabajar y registrar al terminar · no programar hasta aceptar el ADR-001 · no resolver en silencio las decisiones abiertas · no afirmar nada que no se haya probado. Detalle en `AGENTS.md`.

## Cómo verlo funcionando en tu computadora
1. Copia `.env.example` a `.env` (y escribe en `VITE_DEMO_PASSWORD` la contraseña de demostración que definas en `SEED_PASSWORD`).
2. Instala Node 22 y pnpm, y ejecuta `pnpm install`.
3. La primera vez prepara la base: `pnpm db:dev` (déjala abierta), y en otra terminal `pnpm db:migrate` y `pnpm db:seed`. Luego basta con `pnpm dev`.
4. Abre `http://localhost:5173`. En modo demostración la pantalla de ingreso trae la cuenta del Desarrollador y botones para entrar como cada rol.
5. Pruebas: `pnpm test` (API y pantalla).
