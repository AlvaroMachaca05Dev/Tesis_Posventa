---
name: validar-plan-rmotriz
description: Revisar aplicabilidad, versiones, línea temporal y reajuste de planes preventivos (INC-04 e INC-05), separando lo demostrado de lo pendiente de validación mecánica.
---

**Entrada:** plantilla fuente/versionada, datos conocidos del vehículo, asignación y ODS de evidencia. Lee `AGENTS.md`, `specs/INC-04-plan-preventivo.md`, `specs/INC-05-reajuste.md` y `docs/decisiones/DECISIONES_ABIERTAS.md` (OPEN-08, 20, 21, 33, 38). Si faltan fuentes, registra la limitación y trabaja solo con ejemplos **marcados como simulados**.

**Comprobaciones**
- **Aplicabilidad conjunta** marca/modelo/rango de años/motor/uso. Sin coincidencia única → revisión. Sin asignación explícita → no hay tarea preventiva. Los grupos G1–G8 **en conflicto** (INC-C8): no los uses para decidir elegibilidad hasta que se resuelva.
- Distingue aceite y viscosidad. Sin aceite conocido, **no supongas** intervalos (OPEN-20).
- **Vence primero km o tiempo.** Solo el primer pendiente puede ser VENCIDO; los siguientes son CONDICIONAL. Sin intervalo → `SIN_INTERVALO`. Sin evidencia → `SIN_REGISTRO`.
- **Inspección ≠ sustitución.** Una ODS «No aprobada» no es evidencia. Las operaciones autónomas conservan su intervalo.
- Una lectura de km inconsistente se aísla sin modificar la ODS.
- **Reajuste** (INC-05): solo el futuro, con ODS archivada o importada finalizada, servicio confirmado y enlazado, versión de regla, y propuesta + aprobación humana si OPEN-21 lo confirma. El pasado y el plan base congelado no cambian.
- Muestra el impacto de una nueva versión compartida.

**Salida:** casos normales, ambiguos y negativos; diferencias futuras; regla, versión y ODS de origen; y las **validaciones pendientes**. **Terminado** cuando el pasado queda intacto y los cambios son reproducibles.

**No declares** un plan publicado ni validado por un técnico sin evidencia. Los intervalos del PDF y de `planes_r7.json` (3 planes, 33 reglas) son **propuestas pendientes de validación mecánica**. No publiques reglas globales sin aprobación humana.
