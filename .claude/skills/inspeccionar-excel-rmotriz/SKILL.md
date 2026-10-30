---
name: inspeccionar-excel-rmotriz
description: Perfilar un Excel o CSV de clientes, vehículos y ODS (muestra autorizada y anonimizada) antes del mapeo e importación de INC-02.
---

**Entrada:** archivo de muestra **autorizado y anonimizado** y entidades de destino. Lee `AGENTS.md`, `specs/INC-02-importacion.md` y `docs/contexto/07_ARQUITECTURA_DATOS_TRAZABILIDAD.md` §5.

**Importante sobre datos:** en esta carpeta hay exportaciones reales de Tuulapp en `../archivo/tmp/sesion5_base/datos/` (ver `docs/decisiones/INCONSISTENCIAS.md` INC-E5). **No las abras ni las cites** salvo que el investigador lo pida expresamente; si lo hace, no copies filas reales a ningún archivo: trabaja con agregados (columnas, tipos, conteos) y ejemplos **sintéticos** de la misma forma. Si no hay muestra anonimizada, INC-02 queda bloqueada por OPEN-07.

**Pasos**
1. Examina el original **sin modificarlo**: hojas, encabezados candidatos, tipos, filas vacías, duplicados, IDs externos y campos faltantes. Para fórmulas o formato usa la herramienta de hojas de cálculo disponible (en Python está `openpyxl`).
2. Propón correspondencias origen→destino con **confianza** y evidencia anonimizada. Un encabezado ambiguo **no se adivina**.
3. No inventes placa, DNI, km, teléfono ni fecha, ni descartes incompletos. Distingue normalización de identidad (origen + ID externo) de resolución humana de conflictos.
4. No ejecutes una importación por el mero encargo de inspección.

**Salida:** perfil del archivo, tabla origen→destino, incidencias y criterios de importación idempotente (archivo/hoja/fila/origen/ID externo). **Terminado** cuando toda columna observada tiene destino propuesto o exclusión explicada y las ambigüedades están identificadas.

**No afirmes** que el adaptador XLSX existe: en el motor R8 solo hay importación CSV y el XLSX nunca se ha ejecutado.
