---
name: probar-prototipo-playwright
description: Ejecutar las pruebas Playwright del prototipo HTML R7.x y reportar su resultado real, o declarar que no se pudo ejecutar. Referencia de comportamiento, no prueba de la implementación real.
---

**Qué son:** `prototipo/pruebas/*.mjs` (`base.mjs`: todas las vistas sin errores; `e2e76`, `e2e75`, `e2e74_sobre_r76`, `e2e73_sobre_r74`, `e2e_regresion72`, `e2e72`). Recorren `prototipo/R_Motriz_R7.6.html`, que **no tiene servidor ni autenticación real**. Pasar estas pruebas **no** acredita la implementación real.

**Preparación (ver `docs/plan/ENTORNO.md` §4):**
- Node portable: `$env:Path = "F:\Tesis\reverse-lab\node;" + $env:Path`.
- Paquete npm `playwright` instalado **fuera de Drive** (por ejemplo `F:\Tesis\reverse-lab\pw-tests`) y una variable `PW_CHROMIUM` con la ruta de un navegador ya instalado (Chrome o un Chromium de `%LOCALAPPDATA%\ms-playwright`). **Esto no se ha probado todavía**: si falla, dilo.
- No instales dependencias dentro de la carpeta de Drive sin comprobar antes cómo la trata.

**Ejecución:** `node prototipo\pruebas\<archivo>.mjs <ruta absoluta al HTML> [etiqueta]`. Las pruebas imprimen líneas `PASÓ` / `FALLÓ` y un resumen.

**Reporte:** copia el **conteo real** (por ejemplo «30/30») y los `FALLÓ`; guarda salida y fecha en `docs/evidencias/`. **No uses los conteos que dicen los documentos (30, 55, 73…) como si fueran resultados tuyos.** Si no ejecutaste la prueba, escribe «no ejecutada».

**Regeneración del HTML:** ver `docs/plan/ENTORNO.md` §3 (usa `python`, normaliza saltos de línea; `construir.sh` usa `python3` y no funciona tal cual en esta máquina).

**Datos:** el seed del prototipo trae RUC de proveedores a verificar (INC-E1); no copies capturas ni salidas con datos reales a la documentación.
