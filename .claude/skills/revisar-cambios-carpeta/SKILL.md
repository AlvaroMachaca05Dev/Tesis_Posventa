---
name: revisar-cambios-carpeta
description: Revisar si la carpeta de la tesis cambió desde la última revisión (otra herramienta, otro chat, Drive) antes de ejecutar cualquier trabajo, y leer lo último registrado.
---

**Cuándo:** SIEMPRE antes de empezar a trabajar en esta carpeta, y de nuevo antes de escribir si pasó mucho tiempo.

**Pasos**
1. Ejecuta, desde la raíz del proyecto: `powershell -ExecutionPolicy Bypass -File herramientas\revisar_cambios.ps1`. Solo lee; no modifica nada del proyecto.
2. Interpreta la salida: «Sin cambios» o la lista de **nuevos, modificados y eliminados** desde la última foto guardada en `.estado/`.
3. Lee `../REGISTRO_CAMBIOS.md` (la entrada más reciente primero) para saber qué hizo la última herramienta y qué quedó pendiente.
4. Si hay cambios que **no** aparecen en el registro, léelos antes de seguir: los hizo otra persona o herramienta. **No los sobrescribas.** Si afectan al archivo que ibas a tocar, dilo y pregunta.
5. Informa al investigador en una frase: qué cambió y cómo afecta a la tarea.

**No hagas:** no ejecutes el script con `-Guardar` al empezar (eso fija la nueva base y oculta los cambios ajenos); `-Guardar` es para el **final** del trabajo, junto con la skill `registrar-cambios`.

**Límites:** el script compara tamaño y fecha de modificación, no el contenido. Drive puede tardar en sincronizar entre equipos; si el investigador dice que otro equipo editó, espera a que se sincronice. `../RMotriz_tesis_contexto/` se revisa pero **nunca** se edita.
