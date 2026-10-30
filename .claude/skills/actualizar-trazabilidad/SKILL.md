---
name: actualizar-trazabilidad
description: Regenerar la clasificación de requisitos y las tablas por incremento desde la matriz de trazabilidad, y mantener coherentes la matriz, los diagramas y la tesis cuando cambian requisitos o nombres.
---

**Fuente de verdad de la matriz:** `../fuentes-latex/trazabilidad_R76.csv` (117 requisitos, columnas como `Código verificado`, `Código objetivo`, `Datos`, `Prueba / estado`). **Nunca** se edita en `../RMotriz_tesis_contexto/`.

**Pasos**
1. Pon Node en el PATH de la sesión (ver `docs/plan/ENTORNO.md` §4.1) y ejecuta, desde la raíz: `node herramientas/generar_requisitos.mjs`. Debe leer **117** requisitos; si no, la matriz cambió de forma y hay que revisar el script.
2. Se regeneran `docs/requisitos/CLASIFICACION_RF.csv`, `docs/requisitos/CATALOGO_RF.md` y `specs/requisitos-por-incremento/*.md`. **No los edites a mano.**
3. La asignación a incrementos está en el propio script (`mapa`); es una **propuesta del asistente**. Si el investigador decide otra, cámbiala ahí y deja constancia en `DECISIONES_CERRADAS.md`. Un RF sin entrada queda `PENDIENTE`.
4. Si cambian **requisitos o la matriz en sí**, el generador de la matriz LaTeX vive en `../archivo/tesis-restante/historial/gen.py` y `rf76.py` (Python; usa `python`, no `python3`) y tiene **rutas fijas de otra máquina** (`/tmp/claude-0/…`): hay que adaptarlas antes de ejecutarlo. Compila la tesis con Tectonic o xelatex y **anota cuál usaste**.
5. Si cambian nombres de clases o métodos, actualiza diagramas y vuelve a verificarlos (`generar-diagramas-tesis-rmotriz`) y revisa las specs afectadas.
6. «Demostrado en HTML» **no** pasa a «implementado» sin servidor y pruebas.
7. Registra con `registrar-cambios`.

**Límite:** el script no valida el contenido de los requisitos, solo reorganiza lo que dice la matriz.
