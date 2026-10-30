---
name: normalizar-servicios-rmotriz
description: Proponer equivalencias entre descripciones de líneas de ODS y servicios canónicos, conservando evidencia y confirmación humana (INC-02 e INC-04).
---

**Entrada:** líneas de ODS autorizadas (anonimizadas) y el catálogo canónico disponible. Lee `AGENTS.md`, `specs/INC-02-importacion.md` (R7 y R8), `specs/INC-04-plan-preventivo.md` (R10) y el catálogo del motor de referencia (`nucleo-referencia/src/motor.js`, constante `CATALOGO`, **15 familias**). El «catálogo maestro de 16 familias» que menciona la tesis **no está** en la carpeta: no inventes los IDs canónicos que falten; entrega propuestas provisionales.

**Reglas**
- Conserva texto original, origen, ODS/línea y frecuencia. Agrupa descripciones repetidas y muestra ejemplos y diferencias relevantes.
- Separa **producto comprado**, **servicio realizado** y **mención ambigua**.
- **Inspección no equivale a sustitución.** Una revisión, regulación o limpieza no acredita un «cambio de…». El cambio de aceite de motor **no** acredita «aceite de caja». Reparar el motor o vender aceite **no** demuestra un cambio de aceite.
- Una descripción sin equivalencia segura queda **sin equivalencia** (confianza 0) y fuera del cómputo de mantenimiento.
- Pregunta por las decisiones ambiguas de alto impacto; **no publiques equivalencias globales** sin confirmación humana.

**Salida:** original, candidato, confianza razonada, evidencia, decisión pendiente/confirmada y responsable si existe. **Terminado** cuando cada equivalencia confirmada tiene evidencia de decisión y toda ambigüedad permanece fuera del cómputo.

**Datos:** solo anonimizados o sintéticos; no cites líneas de ODS reales.
