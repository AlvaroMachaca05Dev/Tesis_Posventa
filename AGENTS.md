# Tesis de Álvaro Machaca — Sistema de posventa para R Motriz (Robert Service Automotriz)

Fuente única de instrucciones del proyecto para **Claude Code** (y Codex si el equipo lo usa) (`CLAUDE.md` solo importa este archivo). Actualizado el 19/10/2026. Si un archivo antiguo contradice este, prevalece este y las instrucciones explícitas del investigador.

## 1. Antes de trabajar (obligatorio)
1. **Revisa si la carpeta cambió** (la edita más de una herramienta y está sincronizada con Google Drive): `powershell -ExecutionPolicy Bypass -File herramientas\revisar_cambios.ps1` (skill `revisar-cambios-carpeta`).
2. Lee `../REGISTRO_CAMBIOS.md`: qué se hizo y qué quedó pendiente.
3. Al terminar: skill `registrar-cambios` (entrada en el registro, evidencia y `revisar_cambios.ps1 -Guardar`). Distingue lo configurado, lo implementado, lo **probado** y lo **aceptado por una persona**.

## 2. Estado real del proyecto (17/10/2026)
- **Línea principal: B** (decisión del investigador): prototipo HTML R7.x y tesis en LaTeX. Versión vigente **R7.7** (delimitada el 19/10/2026). El contexto original está en `../RMotriz_tesis_contexto/` (solo lectura); aquí están las fuentes de trabajo del proyecto y la tesis está en `../fuentes-latex/`.
- **Existe:** una **demostración local** (HTML sin servidor ni autenticación real) con 117 requisitos demostrados y pruebas Playwright; un **motor de dominio de referencia** (JavaScript, en memoria); la tesis de 145 páginas; diagramas UML; un modelo SQL **propuesto**.
- **NO existe:** el sistema. No hay servidor, base de datos operativa, autenticación real, importación XLSX ejecutada ni aceptación de usuarios o de un experto mecánico.
- **Delimitación (19/10/2026):** producto = software automotriz de **posventa**; las ODS se cargan a diario de forma masiva (Excel/CSV; la API queda como contrato beta); lo que no es beta es la primera versión; los módulos beta van al final del menú y son ocultables; quitados: reglas de precios, auditoría interna y movimientos de cuentas; sin apertura/cierre de caja (apagada); series por sede. Fuente: `docs/alcance/DELIMITACION_PRIMERA_VERSION_R77.md` y `DECISIONES_CERRADAS.md` §10.
- **Línea A** (`../archivo/avance_implementacion/`, Python/SQLite, INC-01): **antecedente**; no se desarrolla.
- **Pila tecnológica: ACEPTADA el 20/10/2026** (`docs/decisiones/ADR-001-pila-tecnologica.md`): React + TypeScript + Vite, NestJS, PostgreSQL con Prisma. El código vive en el repositorio de GitHub del proyecto (cierra OPEN-01 y OPEN-03).

## 3. Reglas de la carpeta
- **Las fuentes se editan aquí; nunca se editan a mano `../../1_github-proyecto/` ni `../../2_documento-tesis-overleaf/`.**
- **`../RMotriz_tesis_contexto/` es de solo lectura:** se lee, no se edita, mueve internamente ni borra. Sus propios documentos citan rutas internas.
- El resto se puede corregir o reorganizar, **registrando cada cambio**. Antes de borrar o mover masivamente, confirma con el investigador (`../archivo/` conserva lo retirado).
- **El trabajo nuevo de la línea B se crea fuera de `../RMotriz_tesis_contexto/`:** el prototipo en `prototipo/`, la tesis en `../fuentes-latex/`, las specs en `specs/`.
- **Los agentes y las skills se editan en su fuente** (`agentes/definiciones/` y `.agents/skills/`) y se regeneran con `node herramientas/sincronizar_agentes_skills.mjs`.

## 4. Mapa de la carpeta
| Ruta | Qué es |
|---|---|
| `AGENTS.md`, `CLAUDE.md`, `README.md` | Instrucciones y entrada humana |
| `../REGISTRO_CAMBIOS.md` | Bitácora compartida entre herramientas |
| `docs/00_INDICE.md` | Índice de toda la documentación |
| `docs/contexto/` | Contexto maestro (resumen, decisiones, módulos, reglas, alcance, arquitectura, glosario) |
| `docs/decisiones/` | Decisiones **cerradas**, **abiertas**, **inconsistencias** y el ADR de la pila |
| `docs/requisitos/` | Catálogo RF-01 a RF-117 con incremento propuesto (generado); mapeo R7.7 (RF-118 a RF-215) y matriz de permisos |
| `docs/alcance/` | **Delimitación de la primera versión** (R7.7, 19/10/2026) |
| `docs/api/` | Contrato de API previsto (propuesta; no existe servidor) |
| `docs/plan/` | Plan de desarrollo, entorno y flujo de trabajo |
| `docs/evidencias/` | Evidencia de cada trabajo (fecha, comando, resultado) |
| `docs/historial/R7/` | Cambios R7.1–R7.6, estado de migración, análisis de ClickUp |
| `docs/referencias/` | PDF fuente y análisis de ClickUp (sin datos reales) |
| `specs/` | **Especificaciones SDD** por incremento (INC-01 a INC-07) y R7.7 |
| `prototipo/` | Prototipo HTML R7.7, base R7.6, capas y pruebas Playwright (pista P) |
| `nucleo-referencia/` | Motor de dominio R8 (JavaScript) y sus pruebas |
| `../../1_github-proyecto/` | Copia generada de lo que se sube a GitHub |
| `../../2_documento-tesis-overleaf/` | Copia generada para Overleaf |
| `diagramas/R8_propuesta/` | UML R8 (clases, estados, secuencias) y verificador |
| `diagramas/R77_delimitacion/` | UML de la delimitación R7.7 (casos de uso, módulos, clases, secuencias y estados) y verificador |
| `../fuentes-latex/` | LaTeX, PDF, trazabilidad, capturas y modelo SQL propuesto |
| `src/`, `tests/` | Implementación real (**vacías hasta que el Sprint 1 cree el esqueleto) |
| `agentes/definiciones/` | Fuente de los 6 agentes |
| `.agents/skills/`, `.codex/agents/`, `.claude/` | Skills y agentes de Codex y de Claude Code (**generados/sincronizados**) |
| `herramientas/` | Scripts de apoyo y binarios (`herramientas/bin/`: PlantUML, Tectonic) |
| `../RMotriz_tesis_contexto/` | **Solo lectura.** Origen del contexto y de la línea B |
| `../archivo/` | Línea A, entregables, temporales y demás material histórico |

## 5. Qué leer primero
1. `docs/00_INDICE.md` y `docs/plan/PLAN_DESARROLLO.md`.
2. `docs/contexto/00_LEEME_PRIMERO.md` (orden de lectura del contexto) y `docs/contexto/06_ALCANCE_TOTAL_VS_TESIS.md`.
3. `docs/decisiones/DECISIONES_ABIERTAS.md` e `INCONSISTENCIAS.md` **antes de proponer nada**.
4. La spec del incremento en `specs/`.
5. `docs/historial/R7/CLAUDE_RMotriz_tesis_contexto.md`: reglas de la línea B y pendientes de R7.7.

## 6. Cómo se trabaja (Scrum + IA-ASE con SDD)
Metodología unificada y decidida el 19/10/2026: `docs/plan/METODOLOGIA_SCRUM_IA_ASE.md`. Herramienta de IA: Claude Code (no ChatGPT).

Product Backlog → Sprint Planning → **especificación** → **pruebas primero** → implementación → revisión → evidencia → revisión humana. Detalle y mensajes listos en `docs/plan/FLUJO_DE_TRABAJO.md`.

**Puerta del código:** el ADR-001 está ACEPTADO (20/10/2026), así que se puede escribir código de aplicación **solo dentro de un Sprint** con su especificación (`specs/S<n>-*.md`), pruebas primero y revisión del investigador (skill `ejecutar-sprint`). Fuera de eso, pregunta.

| Agente (Codex / Claude) | Para qué |
|---|---|
| `tesis_analista_sdd` / `tesis-analista-sdd` | Afinar especificaciones y criterios de aceptación |
| `tesis_analista_importacion` | Perfilar Excel y proponer mapeo (INC-02) |
| `tesis_disenador_dominio` | Contratos, modelo y UML (reglas del profesor) |
| `tesis_implementador` | Implementar un cambio acotado con pruebas (con el ADR aceptado) |
| `tesis_revisor` | Revisar sin editar, con rutas negativas |
| `tesis_documentador` | Evidencias, trazabilidad, registro y tesis |

Skills (`.agents/skills/`): `revisar-cambios-carpeta`, `registrar-cambios`, `sanear-datos-reales`, `redactar-spec-sdd`, `actualizar-trazabilidad`, `generar-diagramas-tesis-rmotriz`, `inspeccionar-excel-rmotriz`, `normalizar-servicios-rmotriz`, `validar-plan-rmotriz`, `verificar-ods-rmotriz`, `probar-prototipo-playwright`. Configurar un agente o una skill **no equivale a haberlo ejecutado**.

## 7. Reglas de contenido (obligatorias)
- **Solo datos sintéticos** (placas `DEM-xxx`, «Cliente demo …»). Nunca nombres, placas, RUC, DNI, teléfonos, direcciones ni empleados reales: la carpeta se sincroniza con la nube. Ejecuta `sanear-datos-reales`. **Hoy hay datos reales en material antiguo** (`docs/decisiones/INCONSISTENCIAS.md` INC-E5): no los abras ni los copies.
- **No es producción.** No presentes la demostración como sistema productivo ni las pruebas como aceptación del experto o de usuarios.
- **No afirmes sin evidencia:** entrevistas, aprobación técnica, porcentajes de mejora, revisión visual o uso de subagentes. Una prueba de PDF o de almacenamiento no acredita contenido ni interfaz. Las metas (más de 90 % de reajustes documentados; al menos 20 % menos de tiempo de generación de planes) son **metas, no mediciones**.
- **Decisiones y conflictos:** márcalos para que el investigador los confirme; **no los resuelvas en silencio**. Los intervalos técnicos de mantenimiento son propuestas pendientes de validación mecánica.
- **Secretos:** nunca escribas tokens, claves ni contraseñas en archivos o comandos.
- Respuestas en español, concisas, con decisiones y límites.
- **Reglas del profesor para UML:** primero clases, después estados; casos de uso sin cruces de asociación; mensajes de secuencia numerados (1, 1.1, 1.1.1); el receptor de cada mensaje es una clase del diagrama de clases y el método existe en ella.
- **LaTeX:** conserva portada, título vigente, logotipo, encabezado/pie, figuras, tablas y referencias cruzadas. Registra con qué compilador se compiló (xelatex no está instalado; hay Tectonic).

## 8. Alcance (resumen)
Aplicación web de planificación del mantenimiento preventivo y gestión de posventa; **no es un ERP completo** (el ERP, Tuulapp y AYMPerú, queda separado). Capas: **A** núcleo de tesis; **B** operación ampliada (futuro/demo); **C** exclusiones (kardex, SUNAT, contabilidad, RR. HH., SaaS, OBD2, conciliación bancaria). **Corte:** decidido el 19/10/2026 por el investigador: todo lo que no es beta es primera versión (incluye inventario, bancos simple y la carga masiva diaria de ODS); beta: cajas, paquetes, ingreso y egreso sin comprobante, flujo de caja, comparativo, integraciones, Gemini y API. Sigue excluido: SUNAT, contabilidad, RR. HH., SaaS, OBD2 y conciliación bancaria. Detalle: `docs/plan/PLAN_DESARROLLO.md`.

## 9. Entorno (resumen; detalle en `docs/plan/ENTORNO.md`)
Python 3.13.3 está instalado pero el comando `python3` apunta a la tienda de Windows: usa **`python`** o **`py`**. Node solo existe portable en `F:\Tesis\reverse-lab\node`. El disco C: está casi lleno: instala y guarda cachés en F:. Ejecuta los scripts desde la raíz del proyecto.

## 10. Decisiones abiertas que más pesan
OPEN-01 pila · OPEN-02 sede piloto · OPEN-03 dónde vive el código · OPEN-07 datos reales anonimizados · OPEN-08 validador mecánico · OPEN-21 reajuste directo o con aprobación · OPEN-22/26 estados de cita y «convertida». Lista completa: `docs/decisiones/DECISIONES_ABIERTAS.md`.

## 11. Antes de cambiar documentos, diagramas, requisitos o el modelo de datos
Los diagramas, los requisitos, la matriz de trazabilidad, las especificaciones, el código y las pruebas dependen entre sí (ver `docs/plan/MAPA_DE_DEPENDENCIAS.md`). **Ningún agente cambia el LaTeX de la tesis, un diagrama, un RF, una especificación, el modelo de datos o un contrato de la API sin pasar antes por la skill `guardian-coherencia-tesis`:** mide el impacto con `python herramientas/analizar_impacto.py <código>`, presenta el informe (qué se afecta, qué rompe lógica y qué no) y **espera la aprobación del investigador**. Sin un «sí» claro no se edita. Agente asociado: `agentes/definiciones/guardian_coherencia.md`.

## 12. Sprints de desarrollo
El código de aplicación solo se escribe con el **ADR-001 aceptado** por el investigador. Cada Sprint tiene su plan (`docs/plan/SPRINT_<n>.md`) y su especificación (`specs/S<n>-*.md`); se ejecuta con la skill `ejecutar-sprint` (prueba primero, una tarea pequeña por rama, commit `tipo(área): resumen (RF-xxx)`).

## 13. Desarrollo por funcionalidad (vigente desde el 27/10/2026)
El núcleo son 50 requisitos organizados en 11 slices (`docs/plan/SLICES_NUCLEO.md`). Cada slice se desarrolla de punta a punta con la skill `pareja-vertical`, consultando el prototipo con `consultar-prototipo-html` y cerrando la sesión con `resumen-de-sesion`. La skill `ejecutar-sprint` queda como guía general; si chocan, manda `pareja-vertical`.
