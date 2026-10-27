# Slices del núcleo (50 requisitos)

Desarrollo **por funcionalidad completa** (base de datos, API, pantalla y prueba de una vez), en pareja con la IA y con validación del investigador en cada paso (skill `pareja-vertical`). El comportamiento esperado sale del prototipo HTML (skill `consultar-prototipo-html`). Al cerrar cada sesión se corre `resumen-de-sesion`.

El núcleo son los 50 requisitos imprescindibles para demostrar la tesis: acceso, maestros, ODS, carga masiva, planes con línea de tiempo y reajuste, tareas, citas y agenda, bitácora, posventa y reportes básicos. Los demás RF quedan en la segunda ola o como prototipo verificado.

| # | Slice (funcionalidad) | RF | Referencia en el prototipo | Semana |
|---|---|---|---|---|
| S1 | Acceso, roles y menú por rol (incluye el esqueleto mínimo del monorepo y la base) | 001, 002, 003 | Ingreso por rol, permisos, módulos beta ocultables | 27/10 a 2/11 |
| S2 | Clientes y vehículos con lecturas de km | 004, 005, 006, 007 | Clientes, Vehículos, consulta de km | 27/10 a 2/11 |
| S3 | ODS: crear, editar, ítems de servicio y producto, estados y cierre | 011, 012, 013, 014, 016, 017 | Órdenes de servicio, tarjetas y menú ⚙ | 3 a 9/11 |
| S4 | Carga masiva diaria (vista previa, atómica, sin duplicar, trazabilidad) | 019, 020, 021, 022, 023 | Configuración › Carga masiva | 3 a 9/11 |
| S5 | Planes preventivos: plantillas, versiones, reglas, aplicabilidad y asignación | 026, 027, 028, 029, 030 | Grupos de vehículos y planes | 10 a 16/11 |
| S6 | Línea de tiempo, reajuste con servicio confirmado y recomendaciones | 031, 032, 033, 034, 035 | Línea temporal | 10 a 16/11 |
| S7 | Tareas: creación desde la ODS, asignación, estados, fecha y duración | 036, 037, 038, 039, 040 | Espacio de trabajo | 17 a 23/11 |
| S8 | Citas, llegada que crea la ODS, agenda y capacidad de dos bloques | 053, 054, 055, 056 | Citas y agenda | 17 a 23/11 |
| S9 | Bitácora: comentarios, auditoría, historial y eventos automáticos | 059, 060, 063, 064 | Bitácora | 17 a 23/11 |
| S10 | Posventa: automatizaciones, consulta de km, seguimiento, encuesta y reporte | 093, 094, 095, 097, 098 | Automatizaciones, encuesta, métricas | 24 a 30/11 |
| S11 | Reportes básicos y configuración mínima | 066, 067, 068, 071 | Reportes, Empresa y locales | 24 a 30/11 |

Cierre y demostración: 1 a 5/12. **Hito 16/11:** recorrido mínimo integrado (ODS, importación, plan, reajuste).

## Reglas del orden
- Cada slice termina funcionando de punta a punta antes de pasar al siguiente.
- S1 incluye lo mínimo de infraestructura (monorepo, base y CI); no se construye infraestructura aparte.
- Si un slice se atrasa, se recorta alcance dentro del slice, no se salta el recorrido.
- Todo cambio a requisitos, diagramas o modelo de datos pasa antes por `guardian-coherencia-tesis`.

## Demostración final (resumen)
Entrar por rol, cargar el Excel del día con una fila mala (se rechaza) y luego bueno (sin duplicados), buscar el vehículo, asignarle plan y ver la línea de tiempo, abrir la ODS con sus tareas, agendar una cita (el tercer bloque se rechaza), cerrar la ODS y ver el reajuste de las proyecciones futuras con motivo, orden y responsable, ver el seguimiento y la encuesta, y consultar los reportes.
