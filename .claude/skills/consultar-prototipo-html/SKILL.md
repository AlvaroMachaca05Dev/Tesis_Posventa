---
name: consultar-prototipo-html
description: Antes y después de cada funcionalidad, consulta el prototipo HTML (R_Motriz_R7.7.html) para entender cómo funciona y comprobar que la versión real se comporta igual. Úsala siempre que se vaya a construir o validar una pantalla o regla.
---

# Consultar el prototipo HTML

El prototipo `prototipo/R_Motriz_R7.7.html` es la **referencia viva de comportamiento**: lo que hace allí es lo que debe hacer el sistema real (front y back), salvo que una especificación diga otra cosa.

## Antes de construir: sacar la ficha
Para la funcionalidad en curso:
1. **Ubica el código** en `prototipo/capas/` (por capas r72 a r77). Busca por palabra o nombre de pantalla:
   - Vistas: `views.<módulo>=` (por ejemplo `views.cobrar`, `views.movinv`, `views.vehiculos`).
   - Acciones: funciones `r73…`, `r74…`, `r77…` que se llaman desde los botones.
   - Reglas y datos: busca en el mismo archivo la función y sus vecinas.
2. **Míralo funcionando:** abre el HTML en el navegador (menú › elegir rol) o con Playwright (`prototipo/pruebas/*.mjs` muestran el recorrido y los datos de ejemplo).
3. **Escribe la ficha** en este formato y muéstrala al investigador:

   ```
   ## Ficha: <funcionalidad>
   Pantallas: (nombre y ruta del menú)
   Campos: (etiqueta · tipo · obligatorio · valores permitidos)
   Reglas: (validaciones, estados, permisos por rol, cálculos)
   Mensajes: (textos de error y de éxito, exactos)
   Acciones del menú ⚙: (cuáles y para qué rol)
   Datos de ejemplo: (de dónde salen en el prototipo)
   Pruebas del prototipo que la cubren: (archivo y paso)
   Dudas: (lo que no queda claro; se pregunta, no se inventa)
   ```
4. Si el HTML y los requisitos (RF) se contradicen, **no resuelvas en silencio**: avisa al investigador.

## Después de construir: comparar
- Recorre la misma tarea en el HTML y en el sistema real y compara campos, orden, reglas y mensajes.
- Anota las diferencias en dos grupos: **intencionales** (la especificación lo pidió) y **a corregir**.
- Entrega la lista antes de cerrar el slice.

## Qué no hacer
- No copies el código del prototipo tal cual: es JavaScript de navegador con datos en `localStorage`. Se **entiende** y se reescribe sobre la API y la base de datos.
- No cambies el prototipo salvo que el investigador lo pida (es la referencia).
