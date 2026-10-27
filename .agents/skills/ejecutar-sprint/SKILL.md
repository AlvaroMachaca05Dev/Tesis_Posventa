---
name: ejecutar-sprint
description: Ejecuta un Sprint de desarrollo del sistema real (monorepo React, NestJS y PostgreSQL) a partir de su especificación SDD, con pruebas primero y revisión humana. Úsala al empezar o continuar un Sprint.
---

# Ejecutar un Sprint

Metodología: Scrum + IA-ASE (`docs/plan/METODOLOGIA_SCRUM_IA_ASE.md`). El investigador decide qué se acepta; la IA propone y construye bajo su supervisión.

## Antes de empezar
1. Confirma que el **ADR-001 está ACEPTADO** (`docs/decisiones/ADR-001-pila-tecnologica.md`). Si no lo está, **no escribas código de aplicación**: pide al investigador que lo acepte.
2. Ejecuta `herramientas/revisar_cambios.ps1` y lee `REGISTRO_CAMBIOS.md` para saber qué cambió desde la última vez.
3. Lee el plan del Sprint (`docs/plan/SPRINT_<n>.md`) y su especificación (`specs/S<n>-*.md`). La especificación manda: criterios Dado, Cuando y Entonces.
4. Si algo del Sprint exige cambiar un requisito, un diagrama, el modelo de datos o el LaTeX, **detente y usa la skill `guardian-coherencia-tesis`** antes de seguir.

## Bucle de trabajo (una tarea pequeña a la vez)
1. Elige **una** tarea del Sprint y su criterio de aceptación.
2. Crea una rama: `feat/<área>-<tema>`.
3. **Escribe primero la prueba** que demuestra el criterio y comprueba que falla.
4. Implementa lo mínimo para que pase. Sigue el contrato (`docs/api/`) y el modelo (`database/`).
5. Corre todo: pruebas del paquete tocado, `lint` y compilación. Todo debe estar en verde.
6. Compara con el prototipo (`prototipo/R_Motriz_R7.7.html`): el comportamiento esperado es el suyo, salvo lo que la especificación cambie.
7. Haz el commit: `tipo(área): resumen (RF-xxx)`. Una pull request pequeña que enlace la especificación y los RF.
8. Anota el avance en `REGISTRO_CAMBIOS.md` (fecha, qué se hizo, qué queda pendiente y qué **no** se verificó).

## Reglas que no se rompen
- Solo los 99 RF de la primera versión; los módulos beta no se programan.
- Vocabulario: «local», «cerrar», Cant./H-H en pasos de 0.25; siete roles con jerarquía como datos (ver AGENTS.md, sección 15).
- Permisos en el servidor, no solo en la pantalla. Costos, márgenes y bancos restringidos.
- Migraciones versionadas: nunca se edita una ya aplicada.
- Cero datos reales, claves ni tokens (`.env.example` sí, `.env` no).
- Nunca se marca algo como «implementado» sin una prueba que pase.
- Si falta información, se deja como pregunta abierta (OPEN-xx) y se avisa al investigador; no se inventa.

## Al cerrar el Sprint
- Demuestra el incremento (captura o video corto) y la lista de comprobación de la entrega.
- Actualiza la columna Estado de la matriz de trazabilidad **solo con lo que pasó sus pruebas**, mediante la skill `guardian-coherencia-tesis`.
- Registra lo aprendido para el Product Backlog.
