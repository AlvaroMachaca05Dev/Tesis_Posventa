---
name: resumen-de-sesion
description: Al terminar una sesión de desarrollo (o una vez al día) captura lo que cambió, lo explica de forma sencilla y avisa de cambios drásticos. Úsala al cerrar la sesión o cuando el investigador diga «resume».
---

# Resumen de sesión

Sirve para que el investigador **entienda y valide** lo que se fue construyendo, sin tener que leer todos los archivos.

## Procedimiento
1. Ejecuta:
   ```bash
   python herramientas/resumen_sesion.py
   ```
   Genera `docs/plan/sesiones/AAAA-MM-DD.md` con los commits, los archivos cambiados, las alertas de cambios drásticos y los apartados por completar. Si el archivo del día ya existe, agrega una sección nueva.
2. **Completa los apartados** del archivo, con lenguaje sencillo:
   - *Qué quedó funcionando* (en pasos que el investigador pueda probar).
   - *Qué aprendimos* (2 o 3 ideas de cómo funciona, para que pueda explicarlo).
   - *Qué quedó pendiente o sin verificar*.
   - *Decisiones tomadas y dudas abiertas*.
3. **Cambios drásticos:** si la herramienta los señala (esquema de base de datos, requisitos, especificaciones, tesis, más de 15 archivos o borrados), explícalos primero y pregunta si siguen. Si tocan requisitos o diagramas, usa `guardian-coherencia-tesis`.
4. Anota una línea en `REGISTRO_CAMBIOS.md` (carpeta de contexto, junto a la del repositorio) con la fecha, el slice y el enlace al resumen.
5. Muestra al investigador el resumen en 5 líneas y recuerda cuál es el siguiente paso.

## Reglas
- Solo afirma lo que se comprobó: pruebas corridas, pantallas abiertas. Lo demás va a «sin verificar».
- No incluyas datos reales, claves ni nombres de personas ajenas al proyecto.
- No hagas commit ni push: solo lo propones.
