# Slices de desarrollo (R8.2, 05/11/2026: 49 requisitos)

Desarrollo **por funcionalidad completa** (base de datos, API, pantalla y prueba de una vez), en pareja con la IA y con validación del investigador en cada paso (skill `pareja-vertical`). El comportamiento esperado sale del prototipo HTML (skill `consultar-prototipo-html`). Al cerrar cada sesión se corre `resumen-de-sesion`.

El 05/11/2026 los requisitos bajaron de 99 a 49 (fuente: `docs/requisitos/R82/`). Los códigos no cambian hasta el cierre de la tesis; entonces se renumeran una sola vez con tabla de equivalencias. La carga masiva diaria se reemplazó por una **migración inicial** interna (RN-11) y las automatizaciones pasaron a **reglas fijas del servidor** (RN-01 a RN-18).

| # | Slice (funcionalidad) | RF | RNF | Estado |
|---|---|---|---|---|
| S1 | Acceso, usuarios y roles | 001, 002, 003 | 01 a 04 | Terminado |
| S2 | Clientes y vehículos con lecturas de km | 004, 005, 007 | 03, 06, 08 | Terminado |
| S3 | Órdenes de servicio: crear y editar con ítems, tipo de atención, garantía, fotos, estados, cierre, corrección y abonos | 011, 015, 016, 018, 089 | 05, 06, 09 | En curso: cierre con cuadre (RN-06), garantía enlazada, RF-018, decisión del cliente y tipo «Otro» ocultos, hechos; falta la aprobación por ítem (opcional, desactivada por defecto, DEC por registrar; en desarrollo el 19/11/2026) |
| S4 | Migración inicial (procedimiento interno RN-11) | — | — | Terminado (19/11/2026, DEC-120): datos de Tuulapp cargados en prueba y desarrollo sin rechazos (14 074 ODS, 4 160 clientes, 4 704 vehículos, 13 228 notas, 50 usuarios) con la tabla ClaveOrigen |
| S5 | Maestros: proveedores, servicios, productos, grupos, precios por grupo y solapamiento | 008, 009, 010, 100, 101, 102 | 03, 06, 08 | Terminado (05/11/2026): 22 pruebas de API y 3 de interfaz |
| S6 | Planes preventivos y sugerencia a vehículos sin plan | 026, 028, 030, 103 | — | En curso (DEC-118 y DEC-119): 8 planes por código (GP-M, GP-S, GR-M, GR-S, DP-M, DP-S, DR-M, DR-S), vehículo con uso y tipo de aceite, plan derivado del combustible, el uso y el aceite, catálogo de 99 servicios con ficha y asignación con sugerencia; falta enlazar la visita con la orden |
| S7 | Línea de tiempo, reajuste, recomendaciones y lista de próximos y vencidos | 031, 032, 034, 067 | — | En curso (19/11/2026, hecha en localhost): línea de tiempo del vehículo y genérica por plan, tramos por cambio de plan (tabla CambioPlanVehiculo), vencido y por vencer (DEC-119), cotización por paquete con descuento, recordatorio por WhatsApp e impresión; faltan las reglas de reinicio por servicio (propuesta por aprobar), las recomendaciones y la lista masiva de próximos y vencidos |
| S8 | Tareas y vistas (lista, tablero y calendario como Google Calendar) | 036, 037, 039, 055 | 09 | Pendiente |
| S9 | Citas y creación de la ODS desde la cita | 053, 054 | — | Pendiente |
| S10 | Bitácora y auditoría | 059, 060, 063 | 03 | Pendiente, a propósito: primero se termina lo demás (la auditoría y la bitácora de la ODS ya existen). Para después: la columna «log» de las ODS de Tuulapp tiene la trazabilidad detallada |
| S11 | Cotización, nota de venta, cuentas y bancos | 087, 088, 090, 091 | 05, 06 | En curso: cotizaciones, nota de venta (venta directa y desde la ODS), cuentas por cobrar y por pagar hechas; faltan bancos y caja (RF-091) |
| S12 | Compras e inventario (kárdex) | 078, 092 | 05 | En curso: compras con entrada de stock y kárdex hechas; faltan almacenes por local y vistas de inventario |
| S13 | Posventa: consulta de km, encuesta y seguimiento | 094, 095, 097 | — | Pendiente |
| S14 | Reportes, métricas y configuración | 065, 066, 096, 098, 071, 085 | 07 | Pendiente |

## Pruebas por sprint
Cada sprint cierra solo cuando pasan todas sus pruebas. La tesis las presenta por sprint (S1, S2, S3 y S5) con sus casos, su resumen y su evidencia; el reparto por archivo está en `herramientas/r82/gen.py` (`SPRINT_ARCHIVO`).

## Reglas del orden
- Cada slice termina funcionando de punta a punta antes de pasar al siguiente.
- Si un slice se atrasa, se recorta alcance dentro del slice, no se salta el recorrido.
- Todo cambio a requisitos, diagramas o modelo de datos pasa antes por `guardian-coherencia-tesis`, y se regenera el anexo (`docs/requisitos/R82/`) y la tesis.

## Demostración final (resumen)
Entrar por rol, buscar un vehículo migrado, asignarle el plan de su grupo y ver la línea de tiempo, agendar una cita con su cotización y, al marcarla Atendida, crear la ODS; trabajar las tareas en el calendario, cerrar la ODS con su nota de venta y ver el reajuste de las proyecciones futuras con motivo, orden y responsable, el seguimiento a los cinco días, la encuesta y los reportes.
