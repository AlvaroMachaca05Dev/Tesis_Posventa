# Decisiones cerradas (índice trazable)

Índice de lo ya decidido, con su fuente. **El texto completo y vinculante está en el original**: `docs/contexto/FUENTES_R7/DECISIONES_R7.md` (corte 12/10/2026) y `docs/contexto/03_DECISIONES_INICIALES_A_FINALES.md`. Aquí solo se resume para poder citarlas por ID desde las especificaciones.

Tipo de decisión (`03_DECISIONES` §1): **Explícita** (la confirmó el tesista), **Normalizada** (se redactó técnicamente una intención explícita), **Propuesta** (aún recortable; no está aquí). Las decisiones de las capas R7.1 a R7.6 marcadas «confirmar» **no** están aquí: siguen en `DECISIONES_ABIERTAS.md` o se listan abajo como «tomadas en el prototipo».

La columna **RF** muestra los requisitos relacionados según el texto de cada decisión; es una correspondencia del asistente, no una cita de la matriz.

## 1. ODS, tareas y aprobación

| ID | Decisión (R7 #) | RF relacionados |
|---|---|---|
| DEC-01 | La decisión del cliente pertenece a la **ODS completa**: Pendiente, Aprobada o No aprobada (#1) | RF-63 |
| DEC-02 | Solo **agregar un ítem nuevo** revierte Aprobada → Pendiente; editar descripción, cantidad o precio no (#2) | RF-64 |
| DEC-03 | Un **ítem retirado** sale de la ODS activa pero conserva antes/después en bitácora y auditoría; no se borra de la cotización histórica (#3) | RF-65 |
| DEC-04 | Una ODS **No aprobada** puede archivarse sin nota de venta; el diagnóstico cobrado se documenta aparte (#4) | RF-07 |
| DEC-05 | Estados visibles de ODS: **Recepción, En proceso, Entrega, Archivada** (#5) | RF-07 |
| DEC-06 | Tareas: solo **Pendiente, En proceso, Completada**; «Archivada» es una condición separada; Cotizando, Por comprar, Comprado, Entregado, Observado y Por cambiar son etiquetas (#6) | RF-108 |
| DEC-07 | Una **tarea raíz por ODS** y exactamente **dos contenedores**: Servicios y Productos; los ítems son listas de control (#7) | RF-61 |

## 2. Cotización y compras (extensión INC-07 y evolución)

| ID | Decisión | RF |
|---|---|---|
| DEC-08 | El módulo es **Cotización logística** y contiene solo productos (#8) | RF-72 |
| DEC-09 | Todo producto solicitado se vincula a una cotización; varias alternativas por producto (proveedor, marca, costo, margen, venta) (#9) | RF-73 |
| DEC-10 | Borrador editable; tras entregar, una modificación **crea una versión nueva** (#10) | RF-74 |
| DEC-11 | Al cargar una ODS solo entran productos activos **sin cotización** (#11) | RF-72 |
| DEC-12 | Comprobantes de compra **inmutables**; cambios, devoluciones y vínculos erróneos se corrigen con **ajustes** (#12) | RF-75, RF-77 |
| DEC-13 | Cada línea comprada se vincula a un producto de la ODS o crea uno; el **costo queda bloqueado** por la compra (#13) | RF-76 |
| DEC-14 | Evidencias **Compra** y **Entrega**, una foto/archivo por categoría, alcance individual o masivo (#14) | RF-78 |
| DEC-15 | La tarea logística no concluye hasta la **conformidad técnica** de todos los productos; la no conformidad conserva la misma tarea con Observado/Por cambiar (#15) | RF-79 |

## 3. Agenda y horas

| ID | Decisión | RF |
|---|---|---|
| DEC-16 | La **hora de llegada** de la ODS es independiente de los bloques de agenda (#16) | RF-67 |
| DEC-17 | Agenda en **15 min**; H-H en múltiplos de **0,25**; se puede dividir, postergar, extender o reasignar sin alterar la llegada (#17) | RF-66, RF-67 |
| DEC-18 | El total estimado puede distribuirse entre servicios; el esfuerzo real es la suma de segmentos (#18) | RF-66, RF-43 |
| DEC-19 | El jefe de taller **cierra la jornada** por sede y fecha; solo el administrador la reabre con motivo auditado (#19) | RF-68 |
| DEC-20 | **Horas perdidas** = huecos reales sin actividad dentro del horario; no se monetizan (#20) | RF-69 |

## 4. Bitácora, archivo y permisos

| ID | Decisión | RF |
|---|---|---|
| DEC-21 | **Bitácora única por ODS**, compartida por la tarea raíz, Servicios y Productos mediante etiquetas (#21) | RF-62 |
| DEC-22 | La exportación de bitácora prioriza autor, fecha, mensaje, menciones, etiquetas, respuestas y adjuntos; los IDs técnicos solo en el detalle (#22) | RF-62 |
| DEC-23 | Corregir una ODS archivada requiere tarea/autorización administrativa y no la reactiva; continuar el trabajo exige **reapertura auditada** (#23) | RF-28, RF-29, RF-70 |
| DEC-24 | La vista de tarea del técnico **nunca muestra costos, precios ni rentabilidad**; el administrador puede habilitar un enlace separado (#24) | RF-71 |

## 5. Cobros, cajas y bancos (evolución)

| ID | Decisión | RF |
|---|---|---|
| DEC-25 | Todo en **soles** (#25) | — |
| DEC-26 | Una caja por sede y por turno/usuario; Caja chica de administración sin sede fija (#26) | RF-82 |
| DEC-27 | La cajera ve su caja pero **no los saldos bancarios globales**; el administrador sí (#27) | RF-83 |
| DEC-28 | Un abono puede registrarse **antes** de la nota de venta; reduce el saldo, no el total (#28) | RF-80 |
| DEC-29 | Notas de venta **internas, no SUNAT**, en cualquier etapa, opcionales, total cero por garantía (#29) | RF-81 |
| DEC-30 | El reporte operativo usa valores de ODS; el reporte técnico de comisiones usa solo notas de venta (#30) | RF-93 |
| DEC-31 | Las transferencias generan movimiento de origen y de destino y un comprobante con firma del receptor (#31) | RF-84 |

## 6. Exclusiones confirmadas
Inventario/kardex completo, SUNAT y facturación electrónica, contabilidad completa, RR. HH. y planillas, SaaS multiempresa, OBD2, optimización automática de técnicos o bahías, integración bancaria automática. (`DECISIONES_R7` y `03_DECISIONES` §3.)

## 7. Estructura y método
- Alcance en **tres capas**: A núcleo de tesis, B operación ampliada, C exclusiones (`01_RESUMEN_EJECUTIVO` §5).
- Integración inicial por **XLSX exportado de Tuulapp/ToolLab** (vigente desde el 04/10/2026, 20:22); la API deja de ser requisito inicial (`01_RESUMEN` §3).
- **Monolito modular con modelo interno**; el SQL es una propuesta (`03_DECISIONES`, fila «Arquitectura»).
- Distinguir lo explícito, lo normalizado, lo propuesto y lo no afirmado (`03_DECISIONES` §1).
- Reglas del profesor para UML y LaTeX: ver `AGENTS.md`.
- Planes preventivos: no inventar intervalos; separar operaciones periódicas de autónomas; conservar fuente y versión; la primera ODS disponible no es el primer mantenimiento de toda la vida del vehículo (`01_RESUMEN` §2).

## 8. Reglas confirmadas por el tesista para la **demostración** (R5, 11/10/2026)
Límite de validez: no acreditan validación mecánica, aceptación académica ni uso productivo (`docs/DECISIONES_R5_2026-10-11.md`).
- Cada servicio tiene **un solo técnico responsable**; el apoyo va como nota.
- Las H-H se usan para capacidad y productividad; **no multiplican el precio** final.
- Baja de cliente **recuperable**, sin borrar vehículos, ODS ni historia.
- Nota de venta interna e inmutable; su anulación revierte los movimientos y conserva auditoría.
- Una actualización XLSX de ODS se diseña como reemplazo completo y atómico del detalle identificado.
- *(Las reglas de aceite, horario y simultáneos de R5 están en conflicto con otras fuentes: ver `DECISIONES_ABIERTAS.md` OPEN-20, 24 y 25.)*

## 9. Tomadas en el prototipo y pendientes de confirmar
Estas se decidieron al construir R7.2 a R7.6 y los propios documentos las marcan «confirmar». **No son vinculantes**:
- Tarea de compra al aprobar la ODS (no al confirmar la cita); tarea de cotizar con cualquier producto con logístico asignado (R7.2).
- Compras y auditoría sin opción de eliminar; luego R7.4 permitió editar y eliminar compras (R7.3 y R7.4: ver `docs/historial/R7/`).
- Grupos G1 a G8: precargados solo G2 y G3; precios de grupo referenciales (R7.4).
- Las automatizaciones corren mientras el sistema está abierto, por falta de servidor; una tarea de km por ciclo de aceite (R7.4).
- Series B001 y F001 creadas inactivas (R7.4).
- «Finalizar» se abre después de archivar la ODS (R7.5).
- Agendadas se cuentan por fecha de registro; llegadas y convertidas, por fecha de la cita; «Cajera demo 2» si solo hay una (R7.6).

## 10. Delimitación de la primera versión (19/10/2026)
Decididas por el **investigador** en un mensaje de chat del 19/10/2026 (no por el profesor ni por usuarios). Detalle y reglas: `docs/alcance/DELIMITACION_PRIMERA_VERSION_R77.md`; criterios: `specs/R7.7-delimitacion-primera-version.md`. **Modifican** la §6 (exclusiones) en lo indicado.

| ID | Decisión | Efecto |
|---|---|---|
| DEC-32 | El producto es un **software automotriz enfocado en la posventa del taller** (se vende primero así); debe ser funcional para esa área | Orienta todo el alcance |
| DEC-33 | Las **ODS se cargan a diario de forma masiva** (Excel o CSV), crean tareas y activan automatizaciones; por ahora por importación, luego por API | Carga masiva de ODS; contrato de API (`docs/api/CONTRATO_API_R77.md`) |
| DEC-34 | **Lo que no es beta es la primera versión** («todo lo demás va para la tesis») | Menú delimitado |
| DEC-35 | **Módulos beta**: Cajas, Paquetes, Ingreso y Egreso sin comprobante, Flujo de caja, Comparativo, Integraciones, Gemini y API. Van al final del menú y se pueden ocultar todos desde Configuración | No se implementan; no se eliminan del código |
| DEC-36 | **Quitados**: Reglas de precios, Auditoría interna (queda la Bitácora) y Movimientos de cuentas | Fuera del menú |
| DEC-37 | **Sin apertura ni cierre de caja**: la lógica se conserva apagada; el pago indica a qué caja o banco entró el dinero | Modifica RF-55, RF-82 (pasan a beta) |
| DEC-38 | **Bancos simple**: Movimientos, Trasladar a otra cuenta, Ingreso, Egreso (a un proveedor) y Editar; cada persona ve las cuentas de su sede y **todos ven los montos**; el pago de facturas de compra se hace en Egresos | Modifica RF-83 (los saldos ya no se restringen por rol); **precisa la exclusión «conexión bancaria»** (sigue excluida la conciliación) |
| DEC-39 | **Series por sede**: la cajera emite con la serie de su sede | Modifica RF-109 (series ya no por caja) |
| DEC-40 | **Inventario completo en la primera versión** (productos y servicios, almacenes, movimientos y requerimientos, kárdex, marcas, categorías) | **Cierra OPEN-05 (sí) y modifica la exclusión «Inventario/kardex completo» de la §6**; el profesor debe conocerla |
| DEC-41 | **Reportes**: todos con filtro por sede; el de técnicos agrupa por el técnico del servicio; se mantienen posventa, ventas, ítems, operaciones, rentabilidades, IGV y detracciones, técnicos y garantías | Modifica RF-93 |
| DEC-42 | **Métricas**: sin utilización de la capacidad productiva; «Venta de servicios» en lugar de «Ventas de mano de obra»; se conserva la satisfacción y el NPS | Modifica RF-114 |
| DEC-43 | **Encuesta con enlace**: el cliente responde en una página y la respuesta llega al sistema | Nuevo requisito; contrato en `CONTRATO_API_R77.md` §6 |
| DEC-44 | **Cuentas por cobrar y por pagar** muestran solo lo pendiente; el histórico está en Compras y Emitir comprobante | Modifica RF-97 |
| DEC-45 | **Cotización** con el diseño del sistema de referencia (pestañas Cliente y Cotización, agregar ítems, cuadros, lista, observaciones y totales) | Modifica RF-94 |
| DEC-46 | **Configuración** es el centro de todo lo configurable (estados de tarea, automatizaciones, usuarios, carga masiva, inventario, impuestos y APIs); las APIs de consulta las configura solo el superusuario | Reorganiza el menú |
| DEC-47 | **Rol nuevo «Asistente administrativo de finanzas»** (usuario de demostración «finanzas»): ve todas las cuentas y sus montos, trabaja Bancos, cuentas por cobrar y por pagar y ve flujo y reportes; no administra usuarios ni la carga masiva. El Logístico deja de entrar a Bancos | Decidido por el investigador el 19/10/2026; sustituye a la idea de usar el rol Logístico |
| DEC-48 | **Cajas en beta y apagadas, con la lógica conservada** (confirmado el 19/10/2026) | Confirma DEC-37 |
| DEC-49 | **Configuración** tiene los módulos Empresa (nombre comercial único «RMOTRIZ», logo, cuentas y formato de documentos), Gestión del espacio de trabajo (estados de tarea) e Inventario, impuestos y APIs, además de automatizaciones, usuarios y carga masiva | Decidido el 19/10/2026; sustituye los atajos |
| DEC-50 | **Documentos imprimibles en PDF o ticket** (cotización, ODS, nota de venta, requerimientos, movimientos de bancos): lista plana de productos y servicios, con los datos de la empresa y las cuentas bancarias elegidas | Decidido el 19/10/2026 |
| DEC-51 | **Movimientos de inventario = requerimientos** (el requerimiento aprobado produce el movimiento); el origen es opcional y lo asigna el logístico; se asocian facturas de compra; los productos sin código solo se registran como entrega; almacenes con local y dirección | Decidido el 19/10/2026; sustituye «Movimientos y requerimientos» |
| DEC-52 | **Impuesto por ítem** (IGV 18 % o sin impuesto) en cotizaciones, ODS y notas; reporte «Impuesto y detracciones» (referencial; alerta sobre S/ 700) | Decidido el 19/10/2026 |
| DEC-53 | **Metodología:** Scrum + IA-ASE (SDD, agentes de IA y harness) en un solo ciclo iterativo e incremental; se usa Claude Code y **no** ChatGPT | Decidido el 19/10/2026; ver `docs/plan/METODOLOGIA_SCRUM_IA_ASE.md` |
| DEC-54 | **Organización:** `github-proyecto/` (lo que sube a GitHub), `documento-tesis-overleaf/` (main.tex e `imagenes/{diagramas,graficos}`) y Drive (contexto completo); sin fichas de lectura, de deducción ni de especificación en la tesis | Decidido el 19/10/2026 |
| DEC-55 | **Estructura final numerada:** `1_github-proyecto/` y `2_documento-tesis-overleaf/` son copias generadas que no se editan; las fuentes canónicas viven en `3_contexto-drive/fuentes-proyecto/` y `3_contexto-drive/fuentes-latex/`; el contexto original continúa en solo lectura y lo antiguo se conserva en `3_contexto-drive/archivo/` | Decidido y ejecutado por el investigador el 19/10/2026; sustituye las rutas de salida de DEC-54 |
| DEC-56 | **Presentación y archivos visuales:** la tesis publica un único diagrama general vigente de casos de uso (DCU-R77-0001); los diagramas parciales anteriores quedan como respaldo técnico. Las imágenes se archivan por capítulo real, con código y nombre corto: antecedentes (cap. 1), fundamentos (cap. 2), diseño (cap. 4) y validación (cap. 5). Los `.puml` siguen siendo la fuente técnica separada de las PNG publicadas. | Decidido por el investigador el 19/10/2026; evita redundancia y mezcla de estado del arte con diseño propio |
| DEC-57 | **Pila tecnológica aceptada (ADR-001):** React + TypeScript + Vite, NestJS como monolito modular, PostgreSQL con Prisma, OpenAPI, Docker Compose y GitHub Actions; el código vive en GitHub | Decidido el 20/10/2026 por Álvaro Machaca; cierra OPEN-01 y OPEN-03 |
