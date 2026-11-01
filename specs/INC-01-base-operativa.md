# INC-01 — Base operativa: usuarios, clientes, vehículos y ODS

> **Referencia por incremento (31/10/2026).** Se desarrolla por slices (S1 a S3 cubren este incremento). El estado vigente está en `../docs/ESTADO_ACTUAL.md`.


**Estado:** BORRADOR · **Versión:** 0.1 · **Fecha:** 17/10/2026 · **Autor:** asistente (Claude), derivado de las fuentes del proyecto · **Aprobada por:** nadie todavía
**Bloqueada por:** OPEN-01 (pila), OPEN-02 (sede piloto), OPEN-03 (dónde vive el código), OPEN-23 (roles). Ver §9.

## 1. Objetivo y resultado vertical
Criterio de cierre (`docs/contexto/06_ALCANCE_TOTAL_VS_TESIS.md` §7): **«Alta/consulta/edición/cierre con roles, bitácora y pruebas».**
Un usuario autenticado, según su rol y sede, puede: registrar un cliente y un vehículo (con datos incompletos), consultar por placa, crear una ODS con líneas de Servicio y Producto, avanzar su estado hasta Archivada, registrar la decisión del cliente, retirar o agregar ítems, reabrir o corregir una ODS archivada con autorización, y ver la bitácora y la auditoría de todo ello. El técnico nunca ve precios ni costos.

## 2. Alcance
- **Incluye** los 26 requisitos de [`requisitos-por-incremento/INC-01.md`](requisitos-por-incremento/INC-01.md). Bloque T1 de `06` §3: usuarios, roles y sede; clientes y vehículos; ODS con llegada, servicios, decisión e historial; bitácora y auditoría mínima. Se añaden los **maestros** (marcas y modelos, categorías, catálogo plano sin stock, tipos de documento) porque R7.7 los pasa al núcleo (`docs/historial/R7/CLAUDE_RMotriz_tesis_contexto.md`, «Tesis»).
- **Excluye:** importación (INC-02), agenda y tareas (INC-03), planes y línea temporal (INC-04/05), citas y posventa (INC-06), logística y finanzas (INC-07 y evolución). Consulta vehicular por API externa (RF-04/ESP-0016 depende de un proveedor y contrato; `docs/CONTEXTO_TESIS.md`).
- **Depende de:** Fase 0 (`docs/plan/PLAN_DESARROLLO.md`).

## 3. Reglas de dominio
| # | Regla | Fuente | Estado |
|---|---|---|---|
| R1 | IDs internos independientes de placa/DNI; los incompletos conservan vacíos y procedencia | `07` §4; `AGENTS.md` | Cerrada |
| R2 | VIN, serie, motor, tipo de aceite y viscosidad son atributos **separados** | `AGENTS.md` (invariantes); RF-03 | Cerrada |
| R3 | La consulta por placa se hace **primero en la base local**; la API futura no es requisito | RF-04 | Cerrada |
| R4 | Estados de ODS: Recepción → En proceso → Entrega → Archivada. Recepción/En proceso → Archivada solo si la decisión es **No aprobada** | DEC-05, DEC-04; `DES-R8-0001` | Cerrada |
| R5 | La decisión del cliente es de **toda la ODS**; solo **agregar un ítem nuevo** revierte Aprobada → Pendiente; editar uno existente no | DEC-01, DEC-02 | Cerrada |
| R6 | Un ítem retirado deja de sumar pero conserva antes/después en bitácora y auditoría | DEC-03 | Cerrada |
| R7 | **ARCHIVADA no equivale a facturada.** Una ODS archivada bloquea el detalle | `DCL-R8-0001A` (nota); `AGENTS.md` | Cerrada |
| R8 | Corregir una archivada requiere autorización administrativa y **no la reactiva**; continuar el trabajo exige **reapertura auditada** con hora de servidor | DEC-23 | Cerrada |
| R9 | **Bitácora única por ODS** (humana y de sistema) distinta de la auditoría técnica | DEC-21, DEC-22; `04` §2.8 y §2.17 | Cerrada |
| R10 | La vista técnica **nunca** muestra costos, precios ni rentabilidad | DEC-24 | Cerrada |
| R11 | Cada servicio tiene **un solo técnico responsable**; las H-H no multiplican el precio | `DECISIONES_R5` | Cerrada (demostración) |
| R12 | Baja de cliente **recuperable**, sin borrar vehículos, ODS ni historia | RF-02; `DECISIONES_R5` | Cerrada |
| R13 | Roles y permisos según la tabla de `05` §1, **comprobados en el servidor** | `05` §1; `07` §9 | **Lista de roles sin cerrar (OPEN-23)** |
| R14 | Tipos de documento: DNI (8 dígitos), RUC (11), carné de extranjería, pasaporte, otro | RF-103 | Demostrada en el prototipo |

## 4. Modelo de datos
Tablas implicadas en el SQL propuesto (`tesis/latex/modelo/esquema_propuesto.sql`): `sedes`, `usuarios`, `clientes`, `vehiculos`, `catalogo`, `categorias`, `ordenes`, `detalles`, `auditoria`.

**Correcciones necesarias antes de implementar** (ver `docs/decisiones/INCONSISTENCIAS.md`):
- **INC-A1:** añadir la **decisión del cliente** a `ordenes` (Pendiente / Aprobada / No aprobada). Hoy no existe.
- **INC-A2:** crear la **bitácora** (eventos humanos y de sistema, menciones, etiquetas, respuestas, adjuntos, antes/después legible). Hoy solo existe `auditoria`.
- **INC-A6:** cerrar la lista de roles; `usuarios.rol` es texto libre.
- Maestros de marca/modelo: el SQL guarda `marca` y `modelo` como texto en `vehiculos`; R7.4 (RF-111) los trata como maestros con modelos por marca. Decidir si se normalizan.

## 5. Contratos
Del diagrama `diagramas/R8_propuesta/DCL-R8-0001A_datos_importacion_ods.puml` (propuesta no validada por el profesor):

| Clase | Métodos | Notas |
|---|---|---|
| `ServicioODS` | `crearODS(vehiculoId, datos, usuarioId)`, `agregarLinea(ordenId, linea, usuarioId)`, `retirarLinea(ordenId, lineaId, motivo)`, `registrarDecision(ordenId, decision, usuarioId)`, `avanzarEstado(ordenId, destino, usuarioId)`, `archivar(ordenId, politicaSalida, claveEvento)`, `corregirArchivada(ordenId, cambios, motivo)`, `reabrir(ordenId, motivo)` | `crearDesdeCita` es de INC-06. Nombres R8: `archivar`, no `cerrar` (INC-B4). Falta **editar una línea existente** en el contrato (ver CA-01-19) |
| `ServicioAcceso` | `puede(usuarioId, accion, sedeId): booleano` | Permisos por rol **y sede** |
| `RegistroAuditoria` | `registrar(actor, accion, motivo, antes, despues)` | Hora de servidor |
| `Repositorio` | `iniciar()`, `guardar(datos)`, `confirmar()`, `revertir()` | Transacción |
| `ServicioVehiculos` | `buscarPorPlaca(placa)`, `consultarHistorial(vehiculoId)` | Placa normalizada (mayúsculas, sin separadores) |
| Entidades | `Usuario`, `Cliente`, `Vehiculo` (con `camposFaltantes()`), `OrdenServicio` (con `lineasActivas()`), `LineaODS`, `ServicioCatalogo`, `EventoAuditoria` | Enums `Rol`, `EstadoODS`, `DecisionCliente`, `TipoLinea` |

Estados y transiciones: `diagramas/R8_propuesta/DES-R8-0001_estados_ods.puml` (regiones concurrentes `EstadoODS` × `DecisionCliente`).

## 6. Criterios de aceptación
**Origen:** `DEC` = decisión cerrada · `Fuente` = regla de un documento · `Línea A` = brecha heredada de `docs/REVISION_INICIAL_2026-09-29.md` · `Deducido` = propuesta del asistente.

| ID | RF | Dado / Cuando / Entonces | Origen |
|---|---|---|---|
| CA-01-01 | RF-01 | **Dado** un usuario sin sesión válida, **cuando** solicita cualquier operación protegida, **entonces** se deniega (HTTP 401) sin ejecutar nada | `07` §9 |
| CA-01-02 | RF-23 | **Dado** un usuario con rol R y sede S, **cuando** pide una acción no permitida a R o fuera de S, **entonces** se rechaza **en el servidor** y se audita el intento | `05` §1; `07` §9 |
| CA-01-03 | RF-02 | **Dado** un cliente con solo algunos datos, **cuando** se registra, **entonces** se guarda con su procedencia y los campos vacíos como desconocidos (no cero) | R1; modelo README |
| CA-01-04 | RF-02 | **Dado** un cliente con vehículos y ODS, **cuando** se da de baja, **entonces** queda inactivo y recuperable, y vehículos, ODS e historial se conservan | R12 |
| CA-01-05 | RF-03 | **Dado** un vehículo sin VIN, **cuando** se registra, **entonces** el VIN queda vacío; placa, VIN, serie, motor, aceite y viscosidad se guardan por separado | R2 |
| CA-01-06 | RF-04 | **Dado** la placa «abc-123» o «ABC 123», **cuando** se consulta, **entonces** se normaliza y se busca en la base local sin llamar a ningún servicio externo | R3; `motor.js` `normPlaca` |
| CA-01-07 | RF-05, RF-89 | **Dado** cliente y vehículo, **cuando** se crea una ODS, **entonces** se guardan fecha y hora de ingreso (llegada, editable), sede y responsable; el tipo puede ser Express o Avanzada, y la Avanzada registra el estado del vehículo | RF-89 (R7.2) |
| CA-01-08 | RF-06, RF-88 | **Dado** una ODS, **cuando** se agregan líneas de tipo Servicio o Producto, **entonces** cada una conoce su tipo; cada servicio tiene un técnico responsable; el total **no** multiplica H-H por precio en servicios | R11; `CAMBIOS_R7.2` («Correcciones») |
| CA-01-09 | RF-07 | **Dado** una ODS en Recepción, **cuando** se avanza a En proceso, Entrega y Archivada **en ese orden**, **entonces** cada transición se acepta y se audita; **cuando** se intenta una transición no listada en `DES-R8-0001`, **entonces** se rechaza | R4 |
| CA-01-10 | RF-63 | **Dado** una ODS Pendiente, **cuando** la cajera registra Aprobada o No aprobada, **entonces** la decisión queda para toda la ODS | DEC-01 |
| CA-01-11 | RF-64 | **Dado** una ODS Aprobada, **cuando** se **agrega un ítem nuevo**, **entonces** vuelve a Pendiente; **cuando** solo se edita la descripción, cantidad o precio de un ítem existente, **entonces** sigue Aprobada | DEC-02 |
| CA-01-12 | RF-65 | **Dado** una ODS con un ítem, **cuando** se retira, **entonces** deja de sumar en los totales activos y la bitácora y la auditoría conservan sus valores anteriores | DEC-03 |
| CA-01-13 | RF-07 | **Dado** una ODS No aprobada, **cuando** se archiva, **entonces** se acepta sin nota de venta | DEC-04 |
| CA-01-14 | RF-28, RF-70 | **Dado** una ODS Archivada, **cuando** se intenta editar el detalle sin autorización, **entonces** se rechaza; **cuando** un administrador usa `corregirArchivada` con motivo, **entonces** se aplica, se audita y la ODS **sigue Archivada** | R7, R8 |
| CA-01-15 | RF-29 | **Dado** una ODS Archivada, **cuando** un administrador la reabre con motivo, **entonces** pasa a En proceso, se audita con hora de servidor y un nuevo archivado también se audita sin duplicar por clic (`claveEvento`) | R8; `07` §4 |
| CA-01-16 | RF-62 | **Dado** una ODS, **cuando** ocurre un evento relevante (alta/retiro/edición de ítem, cambio de decisión, reapertura…), **entonces** aparece **una sola** bitácora con actor, fecha, mensaje, etiquetas y antes/después legible, sin identificadores técnicos a la vista | DEC-21, DEC-22; `05` §12 |
| CA-01-17 | RF-21 | **Dado** una operación sensible, **cuando** se ejecuta, **entonces** `auditoria` registra actor, fecha de servidor, entidad, acción, motivo, antes y después, y **no se puede editar ni borrar** | RF-21; `07` §9 |
| CA-01-18 | RF-71, RF-08 | **Dado** un técnico, **cuando** abre una ODS, **entonces** no recibe costos, precios ni rentabilidad **en ninguna respuesta del servidor**; la vista o PDF del cliente excluye costos y márgenes | DEC-24; RF-08 |
| CA-01-19 | RF-06 | **Dado** una línea existente, **cuando** se edita, **entonces** se modifica esa línea (no se agrega otra) y la edición se audita | **Línea A** («no hay edición de líneas existentes»; reapertura/edición con cobertura incompleta) |
| CA-01-20 | RF-02, RF-03 | **Dado** un cliente o vehículo con DNI o placa ya existentes, **cuando** se intenta crear, **entonces** el sistema detecta el posible duplicado **antes** de insertar y exige una decisión de revisión de identidad, sin usar DNI/placa como clave | **Línea A** (ESP-0001/0002, CU-02: «no se comprueba conflicto de DNI/placa») |
| CA-01-21 | RF-03, RF-111 | **Dado** el formulario de vehículo, **cuando** se da de alta una marca/modelo nueva desde esa pantalla, **entonces** el formulario conserva lo ya escrito y selecciona la entidad nueva | **Línea A** (PR-03: «el alta de marca/modelo no cumple modal ni conservación del formulario») |
| CA-01-22 | RF-08 | **Dado** una ODS con descripciones largas, **cuando** se genera el PDF, **entonces** el contenido **no se trunca** y una prueba verifica el texto y la paginación, no solo la cabecera `%PDF` | **Línea A** (PDF recorta a 105 caracteres); `AGENTS.md` |
| CA-01-23 | RF-103 | **Dado** un documento DNI de 7 dígitos o un RUC de 10, **cuando** se guarda, **entonces** se rechaza con un mensaje explicable; con 8 y 11 dígitos, se acepta | RF-103 |
| CA-01-24 | RF-01 | **Dado** un usuario, **cuando** inicia sesión, **entonces** la contraseña se almacena protegida, la sesión expira y las operaciones que modifican datos exigen protección CSRF | `07` §9; **Línea A** (contrato de sesión no coincidía con la implementación) |
| CA-01-25 | RF-110 | **Dado** el alta de un usuario, **cuando** se guardan apellidos, nombres, sede, celular, email (inicio de sesión), roles y activo, **entonces** el usuario inactivo no puede iniciar sesión | RF-110 |
| CA-01-26 | RF-23 | **Dado** una lectura de ODS, **cuando** la pide un usuario de otra sede, **entonces** se aplica la política de alcance de lectura por rol/sede **que se decida** | **Línea A** («las lecturas filtran organización pero no sede; precisar alcance»). **Sin decidir** |

## 7. Pruebas previstas
- **Dominio** (unitarias): transiciones de estado, decisión del cliente y reaprobación, retiro de ítem, totales, normalización de placa, validación de documento. Referencia: `nucleo-referencia/pruebas_motor.js`.
- **Servicio/API:** autorización por rol y sede (positivos y negativos), sesión sin autenticar, CSRF, idempotencia de archivar/reabrir, rechazo de edición de archivada, ausencia de costos en respuestas del técnico.
- **Interfaz:** recorrido cajera → crear cliente, vehículo, ODS → líneas → decisión → archivar → reabrir. Referencia de comportamiento: `prototipo/pruebas/e2e72.mjs` y `e2e_regresion72.mjs` (**no se han ejecutado**; ver `docs/plan/ENTORNO.md`).
- **PDF:** pruebas de contenido y paginación (CA-01-22).
- Datos 100 % sintéticos.

## 8. Datos y dependencias externas
Ninguna externa. Datos sintéticos (`DEM-xxx`, «Cliente demo»). Confirmar con el investigador qué sede es el piloto (OPEN-02) y la lista de roles (OPEN-23).

## 9. Decisiones abiertas que lo afectan
| OPEN | Efecto |
|---|---|
| OPEN-01 | Define lenguaje, marco y herramientas de prueba; **bloquea todo el código** |
| OPEN-02 | Una sede o varias cambia el alcance de lectura (CA-01-26) y los permisos por sede |
| OPEN-03 | Dónde se escribe el código y cómo se sincroniza |
| OPEN-23 | Lista de roles (¿Logística? ¿Experto?) |
| OPEN-37 | Corrección del modelo (A1, A2, A6) |

## 10. Riesgos y brechas
- El SQL propuesto **no** soporta decisión del cliente ni bitácora (A1, A2): hay que ampliarlo **antes** de escribir persistencia.
- La línea A (`avance_implementacion/`) ya intentó este incremento y dejó 9 brechas documentadas (`docs/REVISION_INICIAL_2026-09-29.md`): edición de líneas, conflicto de identidad, modal de marca/modelo, filtros y pestañas de ODS, contrato de sesión, cobertura de acceso, PDF truncado, contraseña inicial, campos numéricos fraccionarios. Los criterios CA-01-19, 20, 21, 22, 24 y 26 recogen seis de ellas; **filtros y pestañas de ODS, contraseña inicial y campos numéricos fraccionarios no tienen criterio todavía** (añadir al afinar la spec).
- Sin autenticación real, el prototipo **no** demuestra los criterios CA-01-01, 02, 18 y 24: solo existirán cuando haya servidor.
- Aceptación académica pendiente: «aceptación de interfaz pendiente» (`docs/CONTEXTO_TESIS.md`).

## 11. Definición de hecho
`docs/plan/PLAN_DESARROLLO.md` §4, más: recorrido manual con cajera y administrador registrado en `docs/evidencias/`, y rutas negativas de permisos ejecutadas.

## 12. Referencias
`docs/contexto/04_VISION_COMPLETA_MODULOS.md`, `05`, `06`, `07`; `docs/decisiones/DECISIONES_CERRADAS.md`; `diagramas/R8_propuesta/DCL-R8-0001A_datos_importacion_ods.puml` y `DES-R8-0001`; `tesis/latex/modelo/esquema_propuesto.sql`; `nucleo-referencia/src/motor.js` (`ServicioODS`, `ServicioVehiculos`); funciones del prototipo en la tabla de requisitos.
