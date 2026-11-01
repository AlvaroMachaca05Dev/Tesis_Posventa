# Paquete para los desarrolladores (R7.7, 19/10/2026)

> **Histórico (31/10/2026).** Escrito antes de que existiera el sistema. El estado vigente está en `../ESTADO_ACTUAL.md`.


Esta carpeta es el paquete. Lo que el investigador **delimitó** está en `DELIMITACION_PRIMERA_VERSION_R77.md`; lo que **decidan juntos** distinto debe quedar en `docs/decisiones/DECISIONES_CERRADAS.md`. Nada de esto es el sistema: es un prototipo HTML local, documentos y diagramas **propuestos**. No hay servidor, base de datos operativa ni autenticación real.

## Orden de lectura
| # | Documento | Qué aprenderás |
|---|---|---|
| 1 | [`DELIMITACION_PRIMERA_VERSION_R77.md`](DELIMITACION_PRIMERA_VERSION_R77.md) | Qué entra, qué es beta, qué se quitó, reglas y dudas |
| 2 | [`../requisitos/MAPEO_COMPLETO_R77.md`](../requisitos/MAPEO_COMPLETO_R77.md) | Los 208 requisitos y el nivel de cada módulo (CSV: `MAPEO_R77.csv`) |
| 3 | [`../../specs/R7.7-delimitacion-primera-version.md`](../../specs/R7.7-delimitacion-primera-version.md) | 24 criterios de aceptación Dado/Cuando/Entonces |
| 4 | [`../api/CONTRATO_API_R77.md`](../api/CONTRATO_API_R77.md) y `prototipo/carga_masiva/09_plantilla_ordenes_de_servicio.xlsx` | Cómo entran las ODS (carga masiva hoy, API después) |
| 5 | [`../requisitos/MATRIZ_PERMISOS_R77.md`](../requisitos/MATRIZ_PERMISOS_R77.md) | Qué rol ve y hace qué (propuesta) |
| 6 | `../../diagramas/R77_delimitacion/` | Casos de uso, módulos, clases, secuencias y estados (propuesta, sin validar por el profesor) |
| 7 | `../../specs/INC-01 … INC-07` y `R7.7-motor-automatizaciones.md` | Especificaciones por incremento y motor de reglas |
| 8 | `../decisiones/` | Decisiones, inconsistencias y el ADR de la pila (sin aceptar) |
| 9 | [`../../../evidencias/compilaciones/fuente-latex-main.pdf`](../../../evidencias/compilaciones/fuente-latex-main.pdf) | PDF de comprobación de la tesis (con la actualización R7.7) |

## Cómo ver el prototipo
1. Abre `prototipo/R_Motriz_R7.7.html` en Chrome. Con `#sinlogin` al final de la dirección se omite el inicio de sesión provisional; sin él, elige un rol con los botones.
2. Recorre: Órdenes de servicio, Espacio de trabajo (tareas y listas), Configuración › Carga masiva (tipo «Órdenes de servicio»), Ingresos › Cotizaciones, Finanzas › Bancos, Reportes (filtro por sede) y Beta (final del menú).
3. Los datos son sintéticos y viven en el navegador (`localStorage`). Para empezar de cero, borra los datos del sitio.

## Cómo reconstruir y probar el prototipo
```bash
python prototipo/capas/aplicar_r77.py prototipo/R_Motriz_R7.6.html prototipo/R_Motriz_R7.7.html
```
Pruebas: `prototipo/pruebas/*.mjs` con Playwright (Chromium). `e2e77.mjs` recibe la ruta del HTML y usa `#sinlogin`. Resultado del 19/10/2026: **597 pasan, 0 fallan** (`docs/alcance/DELIMITACION_PRIMERA_VERSION_R77.md` §7). Con Python usa `python`, no `python3`.

## Qué no hacer
- **No copies el código del HTML** a la implementación real: está hecho por capas que redefinen funciones. Usa los **comportamientos** y los criterios de aceptación.
- **No escribas código de aplicación** hasta que el investigador acepte `ADR-001` (pila) y cierre OPEN-03 (dónde vive el código).
- **No pongas datos reales, claves ni tokens** en esta carpeta (se sincroniza con la nube). Las APIs de placa y DNI/RUC se configuran con claves propias del superusuario, fuera de los archivos.
- **No resuelvas en silencio** las dudas de `DELIMITACION_PRIMERA_VERSION_R77.md` §9: pregunta al investigador.
- `../RMotriz_tesis_contexto/` es de **solo lectura**.

## Qué está probado y qué no
Probado: el **prototipo local** con datos sintéticos (597 comprobaciones). **No** probado: el sistema real (no existe), las APIs reales de placa y DNI/RUC, la carga con archivos reales de producción, los permisos en servidor, el rendimiento, el uso por usuarios reales ni la validación del experto mecánico.

## Preguntas que traen para decidir con el investigador
Series de comprobantes (¿beta con numeración por sede?), módulos beta (¿ocultos de fábrica?), todos ven los montos de Bancos, API (quién la consume y cómo se autentica), pila y lugar del código, volumen diario de ODS, detracción (monto mínimo), y qué hacer con el inventario frente a la exclusión original (el profesor debe conocerla).
