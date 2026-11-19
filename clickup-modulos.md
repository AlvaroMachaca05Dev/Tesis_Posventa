# ClickUp: módulos y funciones

Inventario descriptivo de lo que ofrece ClickUp, sin valoraciones ni recomendaciones.

**Fuentes y alcance**
- Páginas y módulos públicos de la app web (`app.clickup.com`), observados el 17/10/2026: lista de 3.063 módulos cargables, de los cuales 1.804 tienen nombre legible, y 58 módulos descargados (tareas, automatizaciones, workflows, tiempo, campos).
- Conocimiento general del producto y de su API pública.
- Lo observado confirma que una función **existe** y qué opciones muestra. No se conocen sus reglas internas. Las reglas exactas deben verificarse en la documentación oficial (help.clickup.com, developer.clickup.com).
- Marcas: **[obs]** = visto en la app web; **[doc]** = conocimiento general del producto, no verificado en esta revisión.

---

## 1. Jerarquía y modelo de datos

```
Workspace
 └─ Space
     └─ Folder (opcional)
         └─ List
             └─ Task
                 ├─ Subtask (varios niveles)
                 ├─ Checklist (ítems con asignado)
                 └─ Comentarios, adjuntos, relaciones, tiempo
```

- Estados configurables por Space / Folder / List, agrupados por tipo (sin iniciar, activo, hecho, cerrado). [doc]
- Una tarea puede pertenecer a varias listas. [doc]
- Registro de actividad por tarea. [doc]
- Portfolio (agrupa listas o carpetas con campos propios). [obs]

## 2. Tareas

| Función | Detalle | Fuente |
|---|---|---|
| Campos básicos | Título, descripción con texto enriquecido, estado, prioridad (Urgente / Alta / Normal / Baja), fechas de inicio y vencimiento, etiquetas | [doc] |
| Asignados | Varios responsables, grupos de asignados, observadores / seguidores | [obs] |
| Subtareas | Jerarquía anidable | [doc] |
| Checklists | Ítems con asignado, crear tarea desde un ítem | [obs] |
| Dependencias | Administrador y selector de dependencias; "bloquea a / espera a" | [obs] |
| Tareas relacionadas | Enlace entre tareas sin bloqueo | [doc] |
| Tipos de tarea personalizados | Con icono, asignables por tarea y por espacio | [obs] |
| ID de tarea personalizado | Configurable por espacio: crear, editar y quitar | [obs] |
| Borradores de tarea | Creación diferida | [obs] |
| Plantillas de tarea | Centro de plantillas, aplicar plantilla | [obs] |
| Tareas recurrentes | Repetición por calendario o al completar | [doc] |
| Adjuntos | Archivos e imágenes | [obs] |
| Estimación de tiempo | Campo de estimación por tarea | [obs] |
| Acciones masivas | Edición múltiple de tareas | [obs] |
| Comentarios | Menciones, reacciones, asignar un comentario, marcarlo como resuelto, crear tarea desde un comentario | [obs] |

## 3. Campos personalizados

- Gestor de campos, consulta/filtrado por campo, permisos por campo, campos agrupados en vistas. [obs]
- **Campos por tipo de tarea** ("Task Type Fields"): cada tipo de tarea tiene su conjunto de campos. [obs]
- Tipos observados: texto, número, decimal, moneda, fecha, URL (simple, compleja, de archivo), dirección, texto enriquecido, etiquetas con colores personalizados, casillas (checkbox), lista numerada, usuarios múltiples (incluye privado), votos, fórmula, progreso (porcentaje o por pasos), relación con otra tarea, archivo. [obs]
- Edición de valores JSON. [obs]

## 4. Vistas

| Vista | Fuente |
|---|---|
| Lista | [obs] |
| Tablero (Board) | [obs] |
| Calendario | [obs] |
| Gantt (con ajustes de visibilidad y exportación) | [obs] |
| Línea de tiempo (Timeline) | [obs] |
| Carga de trabajo (Workload) | [obs] |
| Tabla | [obs] |
| Galería | [obs] |
| Mapa mental (Mindmap) | [obs] |
| Mapa | [obs] |
| Caja (Box) | [obs] |
| Actividad | [obs] |
| Hoja (Sheet) | [obs] |
| Embebida | [obs] |

Además: vistas por defecto por espacio, barra lateral de vistas, controles y ajustes por vista, agrupación, filtros, ordenación y vistas guardadas. [obs]

## 5. Automatizaciones

- Constructor visual de reglas **disparador → condiciones → acciones**. [obs]
- Reglas con nombre: crear, editar, duplicar (en la ubicación actual u otra), eliminar, activar y desactivar. [obs]
- Condiciones sobre el nombre de la tarea y sobre campos de fecha; validación de compatibilidad entre disparador, condición y acción. [obs]
- Acción por **webhook** con prueba de llamada (pasó / falló) antes de guardar. [obs]
- Organización por ubicación y etiquetas; punto de entrada desde la lista. [obs]
- Integración con HubSpot en el flujo de reglas. [obs]
- Capa de IA / agentes asociada, con consumo medido de acciones. [obs]

## 6. Workflows (flujos con pasos)

- Hub de workflows y editor de flujo con pasos con nombre. [obs]
- Variables de flujo (elegir variable, guardar salida en variable) y variables de lanzamiento. [obs]
- Disparadores automáticos: por hora, día, semana o personalizado; por webhook. [obs]
- Importar y exportar el flujo como JSON; duplicar; eliminar. [obs]
- Página de **instancia** (ejecución concreta del flujo). [obs]
- Plantillas (blueprints) del hub. [obs]
- Resultados con nombre al final del flujo. [obs]

## 7. Tiempo

- Cronómetro global y por tarea; entradas manuales. [obs]
- Hoja de tiempos (timesheet) por persona; reportes de tiempo; estimación de tiempo. [obs]
- **Aprobación de hojas de tiempo**: estados No enviada, Enviada para aprobación, Parcialmente aprobada, Aprobada; retirar envío; configuración de quién envía y quién aprueba; recordatorios; activar y desactivar. [obs]
- Centro de tiempo (Time hub). [obs]
- Tiempo facturable. [doc]

## 8. Sprints

Backlog, puntos, crear / editar, convertir sprint a lista, resolución de conflictos, ajustes. [obs]

## 9. Formularios

Creación de formularios que generan tareas. [obs]

## 10. Metas (Goals)

Metas con tablero de metas. [obs]

## 11. Dashboards y reportes

- Dashboards con tarjetas de distintos tipos, galería de dashboards y reportes de tareas. [obs]
- Tipos de vista de dashboard observados: caja, tablero, calendario, Gantt, tabla, línea de tiempo, carga de trabajo, mapa, mapa mental, hoja, embebido, galería, actividad. [obs]
- Exportación de datos. [obs]

## 12. Docs, Whiteboards, Sheets

- **Docs**: documentos colaborativos, gestor, historial, enlace a tareas. [obs]
- **Whiteboards**: pizarras, miniaturas, historial, exportación, hub. [obs]
- **Sheets**: hojas de cálculo, incluido un editor de hoja (Univer). [obs]
- Diagramas. [obs]

## 13. Comunicación

- **Chat** (canales y mensajes directos, hilos, comentarios incrustados). [obs]
- **SyncUp** (llamadas) y **Meetings**; Notetaker. [obs]
- **Bandeja de entrada** (feed de notificaciones, hilos, paquetes de actividad). [obs]
- **Correo integrado** (bandeja, carpetas, redactar, responder, hilos). [obs]
- Notificaciones push y por correo, resumen, recordatorios. [obs / doc]

## 14. Inteligencia artificial

Agentes con instrucciones, memoria, disparadores (webhook y periódicos), historial de instrucciones, auditoría, créditos de uso, conversación con asistente, resúmenes, relleno automático de campos, sugerencias, constructor de listas, tareas programadas. [obs]

## 15. Permisos y colaboración

- Perfiles de permisos y permisos v2; permisos por campo. [obs]
- Roles: propietario, administrador, miembro, invitado, con permisos por elemento. [doc]
- Invitaciones, solicitudes de acceso, compartir por enlace. [obs / doc]
- Equipos / grupos. [obs]

## 16. Integraciones, importación y API

- **GitHub**: ramas, commits, pull requests (vista de PR, archivos, conversación, checks). [obs]
- Integraciones configurables, integraciones respaldadas por webhooks. [obs]
- **Importadores**: CSV, Asana, Notion, Slack. [obs]
- Exportación de datos. [obs]
- API REST pública y webhooks de eventos. [doc]
- Unidad de nube (Drive) y adjuntos desde almacenamiento. [obs]

## 17. Otras funciones observadas

- Plantillas: centro de plantillas, aplicar plantilla. [obs]
- Búsqueda global. [obs]
- Mi espacio (My space), prioridades personales, vista de prioridades. [obs]
- Onboarding, centro de descargas, Launchpad. [obs]
- Facturación y ajustes de suscripción, planes y paywalls por funcionalidad. [obs]
- Zona horaria, idiomas (más de 1.200 módulos de localización). [obs]
- Eliminación de cuenta, ajustes de interfaz, iconos personalizados. [obs]

---

## Apéndice: archivos de apoyo (en `F:\Tesis\reverse-lab\target\`)
- `clickup-nombres-chunks.txt`: los 1.804 nombres de módulos con nombre legible.
- `clickup-web\`: los 58 archivos JS descargados y el HTML de inicio.
