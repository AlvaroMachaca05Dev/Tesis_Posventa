---
name: registrar-cambios
description: Dejar constancia de lo hecho, lo probado y lo pendiente en REGISTRO_CAMBIOS.md y en docs/evidencias/, y fijar la nueva base de cambios, al terminar un trabajo.
---

**Cuándo:** al terminar cualquier trabajo que modifique la carpeta.

**Pasos**
1. Añade una entrada **al principio** de `../REGISTRO_CAMBIOS.md` (después de la cabecera), con este formato:
   - `## AAAA-MM-DD · <herramienta> (<contexto>)`
   - **Pedido:** qué se pidió.
   - **Hecho:** archivos creados, modificados, movidos o eliminados (rutas).
   - **Probado:** comandos ejecutados y su resultado real. Si no se ejecutó, escribe «no probado».
   - **Pendiente:** decisiones, revisiones humanas y trabajo que queda.
   - **Conflictos o decisiones abiertas** nuevas (con su ID `OPEN-xx` o `INC-xx`).
2. Si el trabajo tiene resultados verificables, crea `docs/evidencias/AAAA-MM-DD-<tema>.md` con: fecha, requisito o criterio, cambio, comando, resultado y pendientes. **No resumas una prueba como aprobada si no la ejecutaste.**
3. Ejecuta `powershell -ExecutionPolicy Bypass -File herramientas\revisar_cambios.ps1 -Guardar` para fijar la nueva base. Comprueba que la lista de cambios que muestra coincide con lo que dices haber hecho.
4. Ejecuta la skill `sanear-datos-reales` si se tocó contenido (datos, ejemplos, documentos).

**Reglas de honestidad (del proyecto):** distingue configuración, código, pruebas ejecutadas y aceptación humana. No declares entrevistas, aprobación técnica, porcentajes de mejora, revisión visual o uso de subagentes sin evidencia. Una prueba del almacenamiento no acredita la interfaz; una cabecera `%PDF` no acredita el contenido.

**No hagas:** no edites entradas antiguas del registro (solo añade); no registres secretos, tokens ni datos reales.
