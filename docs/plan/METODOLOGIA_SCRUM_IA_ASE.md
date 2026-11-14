# Metodología unificada: Scrum + IA-ASE

Decidida por el investigador el 19/10/2026 (DEC-53). Figura: `fuentes-latex/imagenes/capitulo_04_diseno/diagramas/DAM-0002_metodologia_scrum_ia_ase.png` (también en `2_documento-tesis-overleaf/imagenes/capitulo_04_diseno/diagramas/`).

> **Actualización del 12/11/2026 (DEC-87):** el desarrollo es vertical, módulo por módulo: criterios de aceptación, base de datos, API, pantalla, pruebas y corrección, hasta que todo pasa. No se redacta una especificación por módulo; los criterios están en `docs/requisitos/R82/CRITERIOS_ACEPTACION_R82.csv` y en las pruebas. Figura vigente: `diagramas/tesis/png/DAM-001_metodologia_scrum_ia_ase.png` (se genera con `diagramas/tesis/DAM-001_metodologia.py`).

Un solo ciclo iterativo e incremental. **Herramienta de IA: Claude Code. ChatGPT no se usa para desarrollar.**

| Concepto | Qué es aquí |
|---|---|
| Product Backlog | Necesidades y criterios de aceptación del taller (`docs/requisitos/`, `specs/`) |
| Sprint Planning | Objetivo del Sprint e historias; se elige la spec del incremento |
| Sprint (Daily) | Período corto con seguimiento diario |
| Criterios | Los criterios Dado/Cuando/Entonces de cada requisito son la fuente (antes: una spec `specs/*.md` por incremento) |
| Construir (agentes IA) | `tesis-implementador` escribe pruebas primero y luego el cambio |
| Validar (harness) | Pruebas automáticas (Playwright hoy; las del sistema real mañana) y revisión humana (`tesis-revisor`) |
| Review + Retro | Demostración al taller y mejora; se registra en `REGISTRO_CAMBIOS.md` |
| Corregir | Si una prueba falla o la pantalla no se comporta como debe, se corrige y se vuelve a probar |
| Incremento | Un módulo (slice S1 a S14) integrado y probado; se acumulan |
| Humano valida / IA apoya | Toda decisión y aceptación es del investigador |

Agentes (`agentes/definiciones/`): analista SDD, analista de importación, diseñador de dominio, implementador, revisor y documentador. Skills en `.agents/skills/`. Configurar un agente no equivale a haberlo ejecutado.
