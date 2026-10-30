---
name: sanear-datos-reales
description: Buscar datos reales o secretos (placas, RUC, DNI, celulares, VIN, correos, tokens) antes de entregar, sincronizar o dar por terminado un trabajo en la carpeta de la tesis.
---

**Por qué:** la carpeta se sincroniza con Google Drive y la regla obligatoria del proyecto dice **solo datos sintéticos** (placas `DEM-xxx`, «Cliente demo …»). Nunca nombres, placas, RUC, teléfonos, direcciones ni empleados reales.

**Pasos**
1. Ejecuta `powershell -ExecutionPolicy Bypass -File herramientas\buscar_datos_reales.ps1` (revisa todo salvo `../RMotriz_tesis_contexto/`; añade `-Ruta <carpeta>` para acotar o `-IncluirContextoOriginal` para incluirla).
2. Los hallazgos salen **enmascarados**: no repitas el dato real en tu respuesta, en un archivo ni en el registro. Describe el hallazgo por tipo y ruta.
3. Revisa cada hallazgo a mano: hay **falsos positivos** (un número de 11 dígitos que no es RUC, un código con forma de placa) y **falsos negativos** (nombres propios, direcciones, datos dentro de imágenes o PDF, que el script no lee).
4. Si es real: no lo copies a archivos nuevos; avisa al investigador y propón sustituirlo por un valor sintético. **No borres ni muevas archivos antiguos por tu cuenta**: es decisión del investigador.
5. Antes de crear ejemplos, usa siempre datos inventados evidentes.

**Hallazgos conocidos al 17/10/2026** (ver `docs/decisiones/INCONSISTENCIAS.md` INC-E1 y E5): una placa y un VIN reales en los HTML de `../archivo/entregables/` y en scripts de `../archivo/tmp/`; exportaciones de Tuulapp en `../archivo/tmp/sesion5_base/datos/`; texto de PDF con placas y VIN en `../archivo/tmp/tuulapp_revision/`; seed del prototipo con RUC de proveedores por verificar. Son anteriores a esta skill.

**Límite:** el script ayuda, no certifica. Ninguna ausencia de hallazgos prueba que no haya datos reales.
