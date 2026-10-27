---
name: pareja-vertical
description: Desarrolla UNA funcionalidad completa (base de datos, API, pantalla y prueba) en pareja con el investigador, paso a paso y con pausa de aprobación. Úsala para cada slice del núcleo (docs/plan/SLICES_NUCLEO.md).
---

# Pareja vertical: una funcionalidad de punta a punta

La IA conduce, el investigador navega y valida. Se trabaja por **funcionalidad**, no por capas: cada slice atraviesa base de datos, servidor, pantalla y prueba, y al terminar **funciona de verdad**.

## Principios
- **No inventes.** Lo que falta se pregunta. El comportamiento esperado sale del prototipo HTML (skill `consultar-prototipo-html`), no de la imaginación.
- **Lo más simple que funcione.** Nada de abstracciones «para el futuro».
- **Pasos pequeños:** una prueba y unas 50 líneas. Después, **pausa y espera**.
- **Explica para que aprenda:** al terminar cada paso, 3 líneas: qué hiciste, por qué así y qué haría si cambia X.
- **Nunca** hagas commit, edites pruebas para que pasen ni agregues cosas que no se pidieron.

## Fases (cada una termina esperando el «sí» del investigador)
### 0. Ficha del prototipo
Ejecuta la skill `consultar-prototipo-html` para la funcionalidad. Muestra la ficha (pantallas, campos, reglas, mensajes) y espera confirmación o correcciones.

### 1. Historia y criterios
Escribe la historia (una línea) y **2 o 3 criterios Dado, Cuando y Entonces**, con los RF que cubre. Si hacen falta más de tres, propón partir la historia. Añade un plan de **máximo cinco puntos**. Espera aprobación.

Si algo exige cambiar un requisito, un diagrama, el modelo de datos del esquema o la tesis, **detente y usa `guardian-coherencia-tesis`**.

### 2. Bucle por criterio
1. **Prueba primero** (rojo): demuestra el criterio y confirma que falla.
2. **Código mínimo** para pasarla: tabla o migración, servicio de la API y, cuando corresponda, la pantalla.
3. **Verde:** corre las pruebas del paquete y el resto. Todo en verde.
4. **Pausa:** resume en tres líneas y espera. El investigador mira y pide ajustes (como hizo con el HTML).

### 3. Pantalla fiel al HTML
Cuando el criterio incluya una pantalla, compárala con la del prototipo: mismos campos, mismo orden, mismos mensajes. Anota las diferencias.

### 4. Cierre del slice
- Todas las pruebas del slice en verde y las anteriores sin romperse.
- Lista corta: qué funciona, qué no se hizo, qué diferencias hay con el HTML.
- Llama a `resumen-de-sesion` si termina la sesión.
- Propón el mensaje de commit (`tipo(área): resumen (RF-xxx)`) y **espera la orden** para hacerlo.

## Reglas del proyecto que no se rompen
Vocabulario («local», «cerrar», Cant./H-H en 0.25), siete roles, permisos en el servidor, migraciones versionadas, cero datos reales o claves, y solo los RF del núcleo (50) salvo que el investigador amplíe. Detalle en `AGENTS.md`.
