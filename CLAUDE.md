# CLAUDE.md — Tesis sistema posventa (R Motriz)

Este archivo no duplica reglas: la fuente única es `AGENTS.md`. Se importa aquí para que Claude Code lo cargue al abrir la carpeta.

@AGENTS.md

## Resumen mínimo (por si el importador no carga)
- **Antes de trabajar:** ejecuta `herramientas\revisar_cambios.ps1` y lee `../REGISTRO_CAMBIOS.md`. **Al terminar:** skill `registrar-cambios`.
- **Línea principal: B** (prototipo HTML R7.x y tesis LaTeX). **No existe el sistema** todavía; la pila tecnológica está **aceptada (ADR-001, 20/10/2026)** (`docs/decisiones/ADR-001-pila-tecnologica.md`): **no escribas código de aplicación** hasta que esté ACEPTADO.
- **No toques `../RMotriz_tesis_contexto/`** (solo lectura).
- **Solo datos sintéticos**; usa `sanear-datos-reales`. Hay datos reales en material antiguo (`docs/decisiones/INCONSISTENCIAS.md` INC-E5): no los abras ni los copies.
- **No resuelvas en silencio** decisiones abiertas ni inconsistencias.
- **Python:** usa `python` o `py`, no `python3` (apunta a la tienda de Windows).
- Plan y mensajes listos: `docs/plan/PLAN_DESARROLLO.md` y `docs/plan/FLUJO_DE_TRABAJO.md`. Especificaciones: `specs/`.

## Agentes y skills de Claude Code
Generados desde `agentes/definiciones/` y `.agents/skills/` con `node herramientas/sincronizar_agentes_skills.mjs`: agentes en `.claude/agents/` (`tesis-analista-sdd`, `tesis-analista-importacion`, `tesis-disenador-dominio`, `tesis-implementador`, `tesis-revisor`, `tesis-documentador`) y skills en `.claude/skills/`. **No los edites a mano.** *(No se ha comprobado aún que Claude Code los cargue en esta carpeta.)*

## Mapa
Ver la tabla de `AGENTS.md` §4.
