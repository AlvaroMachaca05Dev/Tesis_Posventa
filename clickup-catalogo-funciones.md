# Catálogo de funciones de ClickUp, orientado a un software de postventa automotriz

> Documento de análisis interno (tesis). Describe **qué hace** ClickUp y **cómo se comporta**, sin copiar código ni diseño.
> Fuente: conocimiento general del producto y de su API pública. **Verifica los detalles contra developer.clickup.com y help.clickup.com** antes de basar decisiones en ellos, porque ClickUp cambia con frecuencia.
> Complejidad: B = baja, M = media, A = alta.

---

## 1. Modelo de datos (jerarquía)

```
Workspace (organización)
 └─ Space (área / departamento)
     └─ Folder (agrupador opcional)
         └─ List (lista de tareas)
             └─ Task
                 ├─ Subtask (anidables varios niveles)
                 ├─ Checklist (ítems con asignado)
                 └─ Comentarios, adjuntos, relaciones, tiempo
```

Entidades clave de una **Task**: título, descripción (rich text), estado, prioridad (Urgente / Alta / Normal / Baja), asignados (varios), observadores, fecha de inicio y vencimiento, estimación de tiempo, etiquetas (tags), campos personalizados, adjuntos, dependencias, enlaces a otras tareas, historial de actividad.

**Rasgos de diseño a notar**
- Los **estados son configurables por Space/Folder/List** y se agrupan en tipos (Sin iniciar, Activo, Hecho, Cerrado).
- Una tarea puede vivir en **varias listas** (multi-home), sin duplicarse.
- Todo cambio queda en un **log de actividad**.

**Mapeo a postventa:** Workspace = concesionario / grupo; Space = sucursal o taller; List = tipo de proceso (Citas, Órdenes de trabajo, Garantías); Task = Orden de servicio; Subtask = trabajo o operación; Checklist = inspección multipunto.

---

## 2. Módulos y funciones

### 2.1 Tareas
| Función | Qué hace | Compl. | Relevancia postventa |
|---|---|---|---|
| Estados personalizados | Flujo de estados propio por lista | B | **Alta**: Recibido → Diagnóstico → Esperando repuesto → En reparación → Control de calidad → Entregado |
| Prioridades | 4 niveles | B | Media |
| Múltiples asignados | Varios responsables por tarea | B | Alta (asesor + técnico) |
| Subtareas | Jerarquía de trabajos | B | Alta (operaciones de la OT) |
| Checklists | Listas de verificación con ítems asignables | B | **Alta**: inspección de recepción y entrega |
| Dependencias | "Bloquea a / Espera a" | M | Alta (no pintar antes de latonería) |
| Tareas relacionadas | Enlace sin bloqueo | B | Media |
| Plantillas de tarea | Tareas preconfiguradas | B | **Alta**: paquetes de mantenimiento 10k / 20k km |
| Tareas recurrentes | Se repiten por calendario o al completar | M | Media: recordatorio de próximo servicio |
| Adjuntos | Fotos, PDFs | B | Alta (fotos de daños, firma) |
| Etiquetas | Clasificación libre | B | Media |
| Acciones masivas | Editar muchas tareas a la vez | M | Media |

### 2.2 Campos personalizados
Tipos: texto, número, moneda, fecha, desplegable, etiquetas, checkbox, email, teléfono, URL, valoración, ubicación, archivo, fórmula, relación a otra tarea, progreso (manual o automático).
Se definen a nivel de lista/espacio y se pueden filtrar, ordenar y agrupar.
**Postventa:** placa, VIN, kilometraje, modelo, año, tipo de garantía, número de póliza, monto estimado. Compl. **M**; es la función que más te conviene copiar en concepto.

### 2.3 Vistas
| Vista | Para qué sirve | Compl. | Postventa |
|---|---|---|---|
| Lista | Tabla agrupable | B | Alta |
| Tablero (Kanban) | Columnas por estado, arrastrar | M | **Alta**: tablero del taller |
| Calendario | Tareas por fecha | M | **Alta**: agenda de citas |
| Gantt | Barras con dependencias | A | Media |
| Tabla | Estilo hoja de cálculo | M | Media |
| Línea de tiempo / Carga de trabajo | Capacidad por persona | A | **Alta**: ocupación de técnicos y rampas |
| Mapa | Tareas con ubicación | M | Baja |
| Vistas guardadas con filtros | Filtro + orden + agrupación persistentes | M | Alta |

### 2.4 Automatizaciones
Estructura: **Disparador → Condiciones → Acciones**.
- Disparadores: cambio de estado, asignación, fecha vencida, campo modificado, tarea creada, comentario nuevo.
- Acciones: cambiar estado/asignado/prioridad, crear subtarea, enviar notificación o email, aplicar plantilla, mover de lista, llamar webhook.
- Compl. **M–A** (motor de reglas + cola de ejecución).
**Postventa:** al pasar a "Listo" → avisar al cliente; si pasa 48 h en "Esperando repuesto" → escalar al jefe de taller; al "Entregado" → crear encuesta de satisfacción.

### 2.5 Tiempo
- Cronómetro por tarea, entradas manuales, tiempo facturable, estimaciones vs. real.
- Compl. M. **Postventa:** horas de mano de obra (tiempo de tarifa). **Alta.**

### 2.6 Sprints / Agile
Sprints, puntos, burndown, velocidad. Compl. A. **Postventa:** Baja relevancia.

### 2.7 Docs, Whiteboards, Chat
- **Docs**: documentos colaborativos enlazables a tareas. Compl. M. (Manuales, procedimientos.) Baja–Media.
- **Whiteboards**: lienzo libre. Compl. A. Baja.
- **Chat / comentarios**: hilos por tarea, menciones @, asignar comentario como tarea. Compl. M. **Alta** (comunicación asesor–técnico en la OT).

### 2.8 Dashboards y reportes
Widgets: gráficos de barras/torta, totales, tablas, carga de trabajo, tiempo, filtros por lista/persona/fecha. Compl. M–A.
**Postventa:** órdenes por estado, tiempo medio de reparación, ingresos por asesor, retrabajos. **Alta.**

### 2.9 Objetivos (Goals)
Objetivos con metas numéricas, monetarias o de tareas. Compl. M. Baja–Media (metas de ventas de servicio).

### 2.10 Formularios
Formularios públicos o internos que **crean tareas** con campos mapeados. Compl. M.
**Postventa:** formulario de solicitud de cita o de recepción de vehículo. **Alta.**

### 2.11 Permisos y colaboración
- Roles: propietario, administrador, miembro, invitado (con permisos de ver / comentar / editar por elemento).
- Permisos a nivel de Space/Folder/List/Task, compartir por enlace, vistas privadas.
- Compl. **A** (modelo de autorización granular). Alta relevancia: técnicos vs. asesores vs. gerencia vs. cliente invitado.

### 2.12 Notificaciones
Bandeja de entrada, notificaciones push/email, resumen diario, recordatorios, "snooze". Compl. M. Alta.

### 2.13 Integraciones y API
- API REST (tareas, listas, campos, tiempo, webhooks), webhooks de eventos, integraciones (Slack, GitHub, Google Calendar, Zapier, etc.).
- Importación (CSV, Trello, Asana), exportación.
- Compl. M–A.

### 2.14 Búsqueda
Búsqueda global de tareas, docs y comentarios; filtros guardados. Compl. M. Alta (buscar por placa/VIN/cliente).

### 2.15 Otras funciones
Recordatorios, mi trabajo (bandeja personal), @menciones, historial de actividad, papelera, plantillas de espacio, IA (resúmenes, redacción).

---

## 3. Lo que ClickUp **no** cubre y postventa necesita (para tu sistema propio)
ClickUp es de gestión genérica. En postventa automotriz necesitarías construir:
- **Ficha de vehículo y cliente** (historial por VIN, no por tarea)
- **Cotización → aprobación del cliente → orden de trabajo → factura**
- **Inventario / repuestos** con disponibilidad y pedidos
- **Garantías** (reglas por km/tiempo, reclamo al fabricante)
- **Plan de mantenimiento programado** por modelo y kilometraje
- **Mano de obra con tarifario** (tiempos estándar por operación)
- **Comunicación con el cliente** (WhatsApp/SMS, aprobación remota)
- **Cumplimiento / facturación** local

---

## 4. Tabla de decisión (rellénala tú)

| # | Función | ¿La uso? | Prioridad | Compl. | Depende de | Notas |
|---|---|---|---|---|---|---|
| 1 | Estados personalizados por proceso | ☐ | | B | — | |
| 2 | Subtareas / operaciones | ☐ | | B | Tareas | |
| 3 | Checklists de inspección | ☐ | | B | Tareas | |
| 4 | Plantillas (paquetes de servicio) | ☐ | | B | Tareas | |
| 5 | Campos personalizados (VIN, km…) | ☐ | | M | — | |
| 6 | Dependencias entre trabajos | ☐ | | M | Tareas | |
| 7 | Vista Kanban del taller | ☐ | | M | Estados | |
| 8 | Vista Calendario / citas | ☐ | | M | Fechas | |
| 9 | Carga de trabajo (técnicos/rampas) | ☐ | | A | Tiempo, asignados | |
| 10 | Automatizaciones | ☐ | | A | Estados, notificaciones | |
| 11 | Registro de tiempo / mano de obra | ☐ | | M | Tareas | |
| 12 | Comentarios y menciones | ☐ | | M | Tareas | |
| 13 | Formularios de recepción / cita | ☐ | | M | Campos | |
| 14 | Dashboards y reportes | ☐ | | M–A | Datos | |
| 15 | Roles y permisos granulares | ☐ | | A | Usuarios | |
| 16 | Notificaciones | ☐ | | M | Eventos | |
| 17 | Webhooks / API | ☐ | | M | — | |
| 18 | Búsqueda global (placa/VIN) | ☐ | | M | Índices | |
| 19 | Adjuntos (fotos, firmas) | ☐ | | B | Almacenamiento | |
| 20 | Gantt / Sprints / Whiteboards | ☐ | Baja | A | — | Probablemente descartar |

## 4b. Evidencia observada en la app web de ClickUp (17/10/2026)

**Método:** se leyó la página pública `app.clickup.com/login` y su `importmap` (lista de módulos que la app carga bajo demanda). No se bajó ni se leyó el código de los módulos: solo se usaron sus **nombres**, que son un índice de funciones. Son 3.063 módulos; 1.804 tienen nombre de función legible (lista completa en `target/clickup-nombres-chunks.txt`). Es evidencia de que la función **existe**, no de cómo funciona por dentro.

**Áreas principales (rutas de primer nivel):** spaces, space-settings, inbox, my-space, priorities-view, docs / doc-manager, whiteboards, sheets, forms, goals, dashboards (box, board, calendar, gantt, table, timeline, workload, map, mindmap, sheet, embed, gallery, activity), reporting, time-hub, chat / syncup / meetings, workflows-hub / workflow-editor, permissions / permission-profiles, ai / ai-agent-builder / cowork / agents-audit-log, onboarding, download-hub.

**Funciones por módulo (nombres observados):**

| Módulo | Qué sugieren los nombres | Relevancia postventa |
|---|---|---|
| Tareas (80 módulos) | tipos de tarea personalizados (`custom-task-type`), IDs de tarea personalizados (`custom-task-ids-modal`), checklists y crear tarea desde ítem, asignados y grupos, seguidores, borradores | **Alta**: tipos = Cita / Orden / Garantía; ID propio = número de OT |
| Campos personalizados | gestor de campos, tipos de campo, permisos por campo, campos en vistas agrupadas, fórmulas, relaciones | **Alta**: VIN, placa, km |
| Vistas | list, board, calendar, gantt, gallery, box, workload, timeline, mindmap, table, map + controles y ajustes por vista | **Alta**: tablero, calendario, carga de técnicos |
| Dependencias | `dependencies-manager`, `dependency-of` | Alta |
| Automatizaciones | constructor visual, API de automatizaciones, etiquetas, entrada desde lista | **Alta** |
| Workflows | hub de workflows, editor, instancias, variables de lanzamiento, plantillas (blueprints) | **Alta**: flujo de OT con pasos y variables |
| Tiempo | time tracker, hoja de tiempos, aprobación de horas, estimaciones, reportes, recordatorio de aprobación | **Alta**: mano de obra |
| Sprints | backlog, puntos, convertir a lista, conflictos | Baja |
| Formularios | creación de formularios que generan tareas | **Alta**: recepción / cita |
| Metas (Goals) | dashboard de metas | Media |
| Dashboards y reportes | decenas de tipos de widget, exportación | **Alta** |
| Portfolio | portfolio con campos personalizados | Media (varias sucursales) |
| Docs / Whiteboards / Sheets | docs, historial, pizarras, hojas de cálculo | Baja a media |
| Chat / SyncUp / Meetings | chat, llamadas, reuniones, notetaker | Media |
| Bandeja de entrada | feed de notificaciones, hilos, bundles | Alta |
| Comentarios | menciones, reacciones, asignar y resolver comentario, comentario a tarea | Alta |
| Correo (mail) | bandeja, redacción y respuesta de correo dentro de la app | Media: correos al cliente |
| Integraciones | GitHub (PR, ramas, commits), webhooks, importadores (CSV, Asana, Notion, Slack) | Media; el importador CSV es útil |
| Permisos | perfiles de permisos, permisos por campo, invitados | **Alta** |
| Plantillas | centro de plantillas, aplicar plantilla | **Alta**: paquetes de mantenimiento |
| Facturación | pantalla de suscripción | No aplica |
| IA | agentes con instrucciones, memoria, disparadores (webhook y periódicos), créditos, auditoría, resúmenes | Baja a media |

**Observación para tu tesis:** ClickUp resuelve "tipo de tarea + campos propios + estados + flujo + automatización + vistas + tiempo". Eso cubre el 60 a 70 % de lo que necesita una orden de trabajo de postventa. Lo que **no** aparece y tendrás que diseñar tú: ficha de vehículo/cliente por VIN, cotización y aprobación, inventario de repuestos, garantías y facturación (sección 3).

## 4c. Detalle observado en 58 módulos (tareas, automatizaciones, workflows, tiempo)

**Método:** se descargaron 58 archivos JS públicos (3,75 MB) y se leyeron sus textos de interfaz. **Limitación honesta:** son módulos que se cargan bajo demanda; la lógica central de ClickUp está en otros archivos que no se bajaron y gran parte del texto vive en archivos de traducción. Por eso esto confirma *qué funciones existen y qué opciones ofrecen*, no sus reglas internas. Las reglas exactas conviene tomarlas de la documentación oficial y de la API pública.

**Automatizaciones**
- Reglas con nombre que se pueden duplicar, editar, borrar, activar y desactivar.
- Disparador + condiciones (p. ej. "el nombre de la tarea contiene…", condiciones sobre campos de fecha). Validación cruzada: no todas las condiciones sirven con todos los disparadores, ni todas las acciones entre sí.
- Existen acciones por **webhook**, con prueba de la llamada (pasó o falló) antes de guardar.
- Reglas en un solo lugar, con ubicación (lista, carpeta o espacio) y etiquetas para organizarlas.
- Hay una capa de IA ("Autopilot"/agentes) con consumo medido de acciones; no es necesaria para tu caso.
- **Para postventa:** replica el modelo *disparador → condición → acción*, con prueba y activar/desactivar. Las condiciones y acciones las defines tú.

**Workflows** (flujos con pasos)
- Editor de flujo con pasos con nombre y **variables** (elegir variable, guardar salida en una variable).
- Disparadores automáticos programables (por hora, día, semana o personalizado) y por webhook.
- Importar y exportar el flujo como JSON, duplicar, borrar, páginas de instancia (una ejecución concreta del flujo).
- Resultados con nombre al final del flujo.
- **Para postventa:** es el modelo de una OT: plantilla de flujo + instancia por vehículo, con variables (VIN, km) y exportación del flujo como JSON.

**Tiempo**
- Cronómetro global y por tarea, hoja de tiempos (timesheet) por persona, reportes.
- **Aprobación de hojas de tiempo:** estados No enviada, Enviada para aprobación, Parcialmente aprobada, Aprobada; retirar el envío; configurar quién envía y quién aprueba; recordatorios.
- **Para postventa:** útil si pagas o facturas mano de obra por horas (tiempo de técnico, aprobación del jefe de taller).

**Campos personalizados**
- Tipos observados: texto, número, moneda, fecha, URL (simple, compleja, archivo), correo/teléfono, dirección, texto enriquecido, etiquetas con colores, casillas (checkbox), lista numerada, **fórmula**, **progreso** (0 a 100 % o por pasos), **votos**, usuarios múltiples, privado.
- Campos agrupados por **tipo de tarea** ("Task Type Fields"): cada tipo de tarea tiene sus propios campos.
- **Para postventa:** confirma el patrón "tipo de orden → conjunto de campos propios".

**Tipos de tarea, checklists, dependencias**
- Tipos de tarea personalizados con icono, asignables a una tarea y por espacio.
- **ID de tarea personalizado** configurable por espacio (crear, editar, quitar). Ideal para tu número de OT.
- Checklists (con control de errores al crear) y administrador/selector de dependencias.

**Hallazgos de diseño aplicables a tu tesis**
1. **Estructura de campos por tipo** (no un esquema único): una Cita, una OT y una Garantía comparten el núcleo (estado, responsable, fechas) y añaden campos propios.
2. **Numeración propia por contexto** (prefijo por sucursal o tipo) en vez de un ID autoincrement global.
3. **Reglas con validación de compatibilidad** disparador/condición/acción, con modo de prueba y activación explícita.
4. **Flujos como plantilla + instancia**, con variables y exportables en JSON.
5. **Aprobación de horas como proceso propio** con estados claros.

## 4d. Tabla de decisión PROPUESTA (borrador para que la ajustes)

Criterio: **F1** = imprescindible para un primer sistema funcional de postventa; **F2** = valor alto pero se puede añadir después; **F3** = opcional; **No** = descartar.

| # | Función de ClickUp | ¿Usarla? | Fase | Compl. | Cómo se traduce en postventa | Por qué |
|---|---|---|---|---|---|---|
| 1 | Estados personalizados por proceso | Sí | F1 | B | Recibido → Diagnóstico → Esperando repuesto/aprobación → En reparación → Control de calidad → Listo → Entregado | Es el eje de la OT |
| 2 | Tipos de tarea con campos propios | Sí | F1 | M | Tipos: Cita, Orden de trabajo, Garantía, Reclamo | Patrón más valioso observado |
| 3 | Campos personalizados (texto, número, fecha, lista, moneda, archivo) | Sí | F1 | M | Placa, VIN, km, modelo, año, motivo, monto estimado | Datos propios del vehículo |
| 4 | ID personalizado por contexto | Sí | F1 | B | N.º de OT con prefijo por sucursal (ej. SUC1-000123) | Trazabilidad |
| 5 | Subtareas / operaciones | Sí | F1 | B | Cada trabajo o servicio dentro de la OT | Base de la mano de obra |
| 6 | Checklists | Sí | F1 | B | Inspección de recepción y de entrega | Requisito típico |
| 7 | Plantillas de tarea | Sí | F1 | B | Paquetes de mantenimiento por kilometraje | Ahorra captura |
| 8 | Vista tablero (Kanban) | Sí | F1 | M | Tablero del taller por estado | Visibilidad diaria |
| 9 | Vista calendario | Sí | F1 | M | Agenda de citas | Citas |
| 10 | Vista lista con filtros y agrupación | Sí | F1 | B | Listado de OT por asesor, estado, fecha | Operación diaria |
| 11 | Responsables múltiples | Sí | F1 | B | Asesor + técnico | Roles reales |
| 12 | Comentarios y menciones | Sí | F1 | M | Notas internas asesor–técnico | Comunicación |
| 13 | Adjuntos | Sí | F1 | B | Fotos de daños, firma, PDF | Evidencia |
| 14 | Registro de tiempo | Sí | F1 | M | Horas de mano de obra por operación | Facturación |
| 15 | Notificaciones / bandeja | Sí | F1 | M | Avisos de cambio de estado y asignación | Seguimiento |
| 16 | Roles y permisos | Sí | F1 | A | Asesor, técnico, jefe de taller, gerencia (empieza simple) | Seguridad |
| 17 | Búsqueda global | Sí | F1 | M | Por placa, VIN, cliente, n.º de OT | Uso diario |
| 18 | Formularios que crean tareas | Sí | F2 | M | Solicitud de cita o recepción | Se puede hacer con pantalla propia primero |
| 19 | Dependencias entre trabajos | Sí | F2 | M | Latonería antes que pintura | No bloquea el MVP |
| 20 | Automatizaciones (disparador → condición → acción) | Sí, versión simple | F2 | A | "Al pasar a Listo, avisar al cliente"; "48 h en espera, escalar" | Alto valor, motor propio |
| 21 | Aprobación de hojas de tiempo | Sí | F2 | M | El jefe de taller aprueba horas | Control de costos |
| 22 | Carga de trabajo (técnicos y rampas) | Sí | F2 | A | Ocupación de técnicos y puestos | Planificación |
| 23 | Dashboards y reportes | Sí | F2 | M–A | OT por estado, tiempo medio, retrabajos, ingresos | Gerencia y tesis |
| 24 | Workflows plantilla + instancia con variables | Sí, idea | F2 | A | Flujo estándar de OT, instanciado por vehículo | Patrón útil |
| 25 | Webhooks / API | Sí | F2 | M | Integrar con facturación o WhatsApp | Integraciones |
| 26 | Importar CSV | Sí | F2 | B | Cargar clientes, vehículos y catálogo de servicios | Arranque |
| 27 | Tareas recurrentes | Opcional | F3 | M | Recordatorio de próximo servicio | Mejor desde el plan de mantenimiento |
| 28 | Metas (Goals) | Opcional | F3 | M | Metas de ventas de servicio | No esencial |
| 29 | Portfolio | Opcional | F3 | M | Varias sucursales | Si hay multisucursal |
| 30 | Gantt | No | — | A | — | Poco uso en taller |
| 31 | Sprints / puntos | No | — | A | — | Metodología de software |
| 32 | Whiteboards | No | — | A | — | Sin necesidad |
| 33 | Docs / Sheets integrados | No | — | M | — | Usar manuales externos |
| 34 | Chat / SyncUp / reuniones | No | — | A | — | Ya existen WhatsApp, Teams |
| 35 | Correo integrado | No | — | M | — | Enviar por proveedor externo |
| 36 | IA / agentes | No (por ahora) | — | A | — | Fuera del alcance |
| 37 | Facturación de suscripción | No | — | — | — | No aplica |

### Lo que ClickUp **no** trae y es el corazón de tu tesis (nuevo, F1 y F2)

| # | Módulo propio de postventa | Fase | Compl. |
|---|---|---|---|
| A | **Ficha de cliente y vehículo** (historial por VIN, no por tarea) | F1 | M |
| B | **Cotización → aprobación del cliente → orden de trabajo** | F1 | A |
| C | **Tarifario de mano de obra** (tiempos estándar por operación) | F1 | M |
| D | **Inventario / repuestos** (disponibilidad, pedidos, costo) | F2 | A |
| E | **Garantías** (reglas por km/tiempo, reclamo al fabricante) | F2 | A |
| F | **Plan de mantenimiento por modelo y kilometraje** + recordatorios | F2 | M |
| G | **Facturación** y cumplimiento local | F2 | A |
| H | **Comunicación con el cliente** (WhatsApp/SMS, aprobación remota) | F2 | M |
| I | **Encuesta de satisfacción** al entregar | F3 | B |

## 5. Siguiente paso sugerido
1. Marca la tabla (qué usas y qué no).
2. Pásala junto con este documento al proyecto de la tesis para que se diseñen las entidades y flujos.
3. Si quieres, verifico cada módulo contra la documentación oficial actual y lo amplío con detalle de la API.
