---
name: redactar-spec-sdd
description: Crear o afinar una especificación SDD de un incremento (INC-01 a INC-07 o R7.7) con requisitos, reglas con fuente, contratos y criterios de aceptación Given/When/Then, marcando lo deducido y lo bloqueado.
---

**Entrada:** el incremento o requisito, `specs/_PLANTILLA_SPEC.md`, `specs/00-convenciones.md`, `docs/requisitos/CATALOGO_RF.md` y la tabla generada en `specs/requisitos-por-incremento/`.

**Pasos**
1. Lee `AGENTS.md`, `../REGISTRO_CAMBIOS.md`, `docs/decisiones/DECISIONES_CERRADAS.md`, `DECISIONES_ABIERTAS.md` e `INCONSISTENCIAS.md`. Lee las fuentes que cita cada regla (`docs/contexto/`).
2. Completa las secciones de la plantilla: objetivo (criterio de cierre de `docs/contexto/06_ALCANCE_TOTAL_VS_TESIS.md` §7), alcance (incluye/excluye/depende), **reglas con fuente y estado** (cerrada, confirmar, deducida), modelo de datos con correcciones necesarias, contratos (nombres de `diagramas/R8_propuesta/`), criterios, pruebas, dependencias, decisiones abiertas, riesgos.
3. Escribe cada criterio como `CA-0X-NN [RF-xx] Dado… cuando… entonces…` con su **origen**: `DEC-xx`, regla de una fuente (con archivo), `Línea A`, o `Deducido`. Todo lo deducido pide confirmación.
4. Añade casos **negativos** por cada permiso, dato faltante, repetición y concurrencia relevante.
5. Si encuentras una contradicción o una falta de datos, **no la resuelvas**: regístrala en `INCONSISTENCIAS.md` o `DECISIONES_ABIERTAS.md` y enlaza desde la spec.
6. Si cambias requisitos o su incremento, ejecuta la skill `actualizar-trazabilidad`.
7. Registra el cambio con `registrar-cambios`.

**Estado:** toda spec nueva nace como **BORRADOR**; «Aprobada por» solo lo rellena el investigador.

**No hagas:** no pegues datos reales como ejemplos; no declares que algo está implementado o probado; no cambies nombres de clases del UML sin proponerlo al diseñador y al investigador.
