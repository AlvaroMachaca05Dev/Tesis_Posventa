# Plan de desarrollo

> **Histórico (31/10/2026).** Plan por incrementos INC; el desarrollo se hace por slices (`docs/plan/SLICES_NUCLEO.md`). El estado vigente está en `../ESTADO_ACTUAL.md`.


Estado: **propuesta de estructura de ejecución**, 17/10/2026. Construida desde `docs/contexto/06_ALCANCE_TOTAL_VS_TESIS.md` (incrementos y corte recomendado) y `docs/requisitos/CATALOGO_RF.md`. Las fechas y duraciones **no están definidas** en las fuentes y no se inventan aquí: el calendario depende de OPEN-11 (congelación de requisitos).

## 1. Dos pistas independientes

| Pista | Qué es | Estado hoy | Siguiente |
|---|---|---|---|
| **P — Prototipo (demostración)** | HTML local R7.6, 117 requisitos demostrados con pruebas Playwright, sin servidor ni autenticación real | Vigente: **R7.6**. Pendiente: **R7.7** | `specs/R7.7-prototipo.md` y `specs/R7.7-motor-automatizaciones.md` |
| **S — Sistema (implementación real)** | Aplicación web con servidor, base relacional, autorización en servidor, importación XLSX | **No existe.** Solo hay diseño (UML, SQL propuesto, matriz de trazabilidad) y un motor de dominio de referencia | Fase 0 y luego INC-01 |

La pista P sirve de **especificación ejecutable** de la pista S: lo que el prototipo demuestra y prueba se convierte en criterio de aceptación de la implementación. Pueden avanzar en paralelo; **no comparten código** (ver `AGENTS.md`).

## 2. Pista S — fases

### Fase 0 — Preparación (bloquea el código)
| Paso | Entregable | Responsable | Referencia |
|---|---|---|---|
| 0.1 | Cerrar **OPEN-01** (pila), **OPEN-02** (sede piloto) y **OPEN-03** (dónde vive el código) | Investigador | `docs/decisiones/ADR-001-pila-tecnologica.md` |
| 0.2 | Preparar el entorno de desarrollo y de pruebas | Investigador (con asistente) | `docs/plan/ENTORNO.md` |
| 0.3 | Resolver las inconsistencias del modelo que afectan a INC-01: INC-A1 (decisión del cliente), INC-A2 (bitácora), INC-A6 (roles) | Investigador decide; asistente actualiza el modelo | `docs/decisiones/INCONSISTENCIAS.md` |
| 0.4 | Confirmar que el RUC del seed del prototipo no es real (INC-E1) | Investigador | — |
| 0.5 | Conseguir XLSX reales **anonimizados** (OPEN-07) antes de INC-02 | Investigador / empresa | — |

### Incrementos
Orden de las fuentes (`06` §7). **Dependencias: propuesta del asistente.**

| Inc. | Resultado vertical (criterio de cierre, según `06` §7) | RF propuestos | Depende de | Spec |
|---|---|---:|---|---|
| **INC-01** | Cliente, vehículo y ODS: alta, consulta, edición y archivado con roles, bitácora y pruebas | 26 | Fase 0 | `specs/INC-01-base-operativa.md` |
| **INC-02** | Importador XLSX: reimportación sin duplicados, conciliación y errores explicables | 7 | INC-01 | `specs/INC-02-importacion.md` |
| **INC-03** | Servicios y agenda: planificación y ejecución por técnico, con segmentos y cierre diario | 16 | INC-01 | `specs/INC-03-servicios-agenda.md` |
| **INC-04** | Plan preventivo: versiones, aplicabilidad y línea temporal verificable | 17 | INC-01 (y datos de INC-02 para historial real) | `specs/INC-04-plan-preventivo.md` |
| **INC-05** | Reajuste: una ODS válida altera solo la proyección futura y conserva la evidencia | 1 | INC-04 | `specs/INC-05-reajuste.md` |
| **INC-06** | Posventa: tarea de seguimiento, contacto, cita, llegada y retorno | 17 | INC-01, INC-03, INC-04 | `specs/INC-06-posventa.md` |
| **INC-07** *(opcional)* | Productos y logística: solicitud → cotización → compra → entrega → conformidad | 12 | INC-01, INC-03 | `specs/INC-07-productos-logistica.md` |

Más 16 requisitos de **evolución** (no comprometidos), 2 transversales de interfaz y 3 sin asignar (`docs/requisitos/CATALOGO_RF.md`).

**Corte recomendado por las fuentes** (`06` §10): compromiso base INC-01 a INC-06; extensión preferida INC-07; finanzas, bancos y documentos comerciales solo como visión futura; inventario, SUNAT, contabilidad, RR. HH., SaaS, OBD2 e integración bancaria, excluidos. **Es una recomendación, no una decisión tomada** (OPEN-05, OPEN-06).

## 3. Cómo se ejecuta cada incremento (SDD)

Flujo del proyecto: Product Backlog → Sprint Planning → especificación SDD → implementación → pruebas → revisión humana → Review y retrospectiva.

| Paso | Qué se hace | Agente | Skills |
|---|---|---|---|
| 1. Leer | `REGISTRO_CAMBIOS.md`, la spec del incremento, `DECISIONES_ABIERTAS.md` | cualquiera | `revisar-cambios-carpeta` |
| 2. Afinar la spec | Cerrar dudas, completar criterios Given/When/Then, marcar lo que bloquea | `tesis_analista_sdd` | `redactar-spec-sdd` |
| 3. Diseñar | Contratos, modelo y diagramas coherentes con las reglas del profesor | `tesis_disenador_dominio` | `generar-diagramas-tesis-rmotriz`, `validar-plan-rmotriz` |
| 4. Pruebas primero | Escribir las pruebas desde los criterios de aceptación | `tesis_implementador` | `verificar-ods-rmotriz` (INC-01) |
| 5. Implementar | Código mínimo que haga pasar las pruebas, en `src/` | `tesis_implementador` | — |
| 6. Revisar | Lectura y rutas negativas; nada de editar código | `tesis_revisor` | `verificar-ods-rmotriz`, `sanear-datos-reales` |
| 7. Documentar | Evidencia, matriz de trazabilidad, LaTeX, CAMBIOS | `tesis_documentador` | `actualizar-trazabilidad`, `registrar-cambios` |
| 8. Revisión humana | El investigador acepta o rechaza | Investigador | — |

## 4. Definición de «hecho» de un incremento
Un incremento **no** se da por cerrado salvo que se cumpla **todo** lo siguiente, y cada punto tenga evidencia en `docs/evidencias/`:
1. Cada requisito comprometido tiene criterios de aceptación y **pruebas automáticas que pasan** (incluidas rutas negativas).
2. La **autorización se comprueba en el servidor** por rol y sede (`07` §9); ocultar un botón no cuenta.
3. Toda operación sensible deja **auditoría** (actor, fecha de servidor, motivo, antes/después).
4. Las operaciones compuestas son **transaccionales** e **idempotentes** donde la spec lo exige (importación, archivado, conversión de cita).
5. Solo **datos sintéticos** (`sanear-datos-reales` sin hallazgos).
6. Diagramas y matriz de trazabilidad actualizados y coherentes con el código (reglas del profesor para UML).
7. Entrada en `REGISTRO_CAMBIOS.md` con lo hecho, lo probado y lo **pendiente de revisión humana**.
8. **Aceptación humana registrada** por el rol que corresponda (OPEN-09). Las pruebas automáticas **no** equivalen a aceptación.

## 5. Pista P — R7.7
> **Actualización del 19/10/2026:** el investigador delimitó la primera versión (`docs/alcance/DELIMITACION_PRIMERA_VERSION_R77.md`, `DECISIONES_CERRADAS.md` §10). Sustituye al «corte recomendado» de la §1: INC-07 (inventario y logística) entra, los bancos entran en versión simple, la apertura y cierre de caja quedan en beta y la entrada de datos es la carga masiva diaria de ODS (API como contrato beta).

Especificada en `specs/R7.7-prototipo.md` (pedidos del 17/10/2026: tablet, menú, tablas, ODS, cotización, nota de venta, simulador de fecha, Maestros al núcleo) y `specs/R7.7-motor-automatizaciones.md` (motor de reglas tipo ClickUp). Requiere Python 3 (instalado; usar `python`, no `python3`), Node (portable) y el paquete npm Playwright (ver `ENTORNO.md`). Cada versión lleva pruebas Playwright y un `CAMBIOS_R7.X.md`.

## 6. Riesgos conocidos
- **Estado de la pila sin decidir** bloquea todo el código (OPEN-01).
- **Sin XLSX anonimizados** no se puede probar INC-02 con casos reales (OPEN-07).
- **Planes sin validación mecánica** (OPEN-08): INC-04 e INC-05 solo pueden entregar «propuesta pendiente de validación».
- **Inconsistencias del modelo** (`INCONSISTENCIAS.md`): hay que corregirlas dentro de cada incremento.
- **Alcance creciente:** el proyecto ya creció de 60 a 117 requisitos. La congelación (OPEN-11) es una decisión de gestión, no técnica.
- **Código en una carpeta sincronizada con Drive** (OPEN-03).
