# Prototipo HTML R7.7

`R_Motriz_R7.7.html` es un solo archivo: se abre con el navegador, sin servidor. Guarda sus datos en el navegador (`localStorage`) y sirve como referencia del comportamiento del sistema.

## Cómo usarlo
1. Abrir el archivo. En la pantalla de ingreso elegir un rol: Superusuario, Jefe de taller, Cajera, Técnico, Logístico, Técnico externo o Asistente administrativo de finanzas.
2. Los módulos **beta** salen al final del menú con la etiqueta «beta». Para ocultarlos: **Configuración › Empresa › Mostrar módulos beta en el menú** (solo el superusuario).
3. La apertura y cierre de caja está apagada por defecto y se activa en el mismo lugar.
4. Los datos de ejemplo son inventados.

## Dónde está cada cosa
| Carpeta | Contenido |
|---|---|
| `capas/` | Código fuente del prototipo, por capas (`r72` a `r77`); `aplicar_r77.py` arma el HTML |
| `pruebas/` | Pruebas automáticas con Playwright |
| `carga_masiva/` | Plantillas Excel para clientes, vehículos, productos, proveedores, stock, solapamientos, paquetes y órdenes de servicio |

## Reconstruir y probar
```bash
python capas/aplicar_r77.py R_Motriz_R7.6.html R_Motriz_R7.7.html
```
Las pruebas se ejecutan con Node y Playwright (`pruebas/e2e77.mjs` y las demás). En la última ejecución pasaron 602 comprobaciones sin fallos.

## Qué incluye (primera versión)
Clientes, vehículos, grupos y planes preventivos; órdenes de servicio con carga masiva diaria; línea temporal, tareas, citas, agenda y bitácora; cotizaciones, notas de venta, cuentas por cobrar y por pagar; bancos por local; productos, almacenes, requerimientos y kárdex; reportes con filtro por local; automatizaciones, usuarios, empresa y carga masiva.

## R7.8 (28/10/2026)
`R_Motriz_R7.8.html` es la R7.7 más la capa `capas/r78`: clientes y vehículos según las decisiones DEC-69 y DEC-70 (documento único, «Clientes varios», país con prefijo, ubigeo, fecha de registro, placa comparada sin guiones con aviso del titular, comentarios y búsqueda del cliente por documento o nombre) y los nombres «fecha de inicio» y «fecha de cierre» de la ODS. No cambian los demás módulos: lo decidido para ODS, tareas, bitácora, inventario y detracciones (DEC-61 a DEC-80) se refleja en el prototipo a medida que se desarrolla cada slice.
```bash
python capas/aplicar_r78.py R_Motriz_R7.7.html R_Motriz_R7.8.html
node pruebas/e2e78.mjs R_Motriz_R7.8.html   # 17 comprobaciones; necesita el paquete playwright
```

## R8.3 (16/11/2026)
`R_Motriz_R8.3.html` es la R7.8 más la capa `capas/r83`: la pantalla **Maestros › Planes preventivos** pasa a dos plantillas (gasolina y diésel), cada una en uso particular y uso severo. Cada línea pertenece a una categoría y a un tipo de visita (express, menor, mayor, afinamiento o por kilometraje). Las categorías se pliegan, «Ver todos» muestra también las líneas que no corresponden a la selección para agregarlas a mano, y la tira de visitas filtra lo que toca en cada kilometraje. La línea temporal y los planes anteriores (`db.plans`) no cambian: siguen como en R7.8 hasta que se decida el modelo en el slice S6. Los intervalos son una propuesta de trabajo, pendiente de registrarse como decisión.
```bash
python capas/aplicar_r83.py R_Motriz_R7.8.html R_Motriz_R8.3.html
node pruebas/e2e83.mjs <ruta absoluta de R_Motriz_R8.3.html>   # 25 comprobaciones; necesita el paquete playwright
```

## R8.4 (17/11/2026)
`R_Motriz_R8.4.html` es la R8.3 más la capa `capas/r84`, con el modelo del sistema: **Planes preventivos** pasa a cuatro planes (combustible por uso). Cada uno es un ciclo de visitas (express, menor, mayor) con el afinamiento y la revisión completa dentro del ciclo; cada visita se despliega para ver sus servicios con su tiempo, sin precios. El plan se puede modificar, duplicar y eliminar (no si lo usa un vehículo). La **línea temporal** proyecta las visitas del plan del vehículo desde su último registro, con el historial de ODS, y sigue el combustible y el uso elegidos. El catálogo recibe los 99 servicios con el precio y las horas del grupo G1 (los demás grupos están en el sistema web).
```bash
python capas/aplicar_r84.py R_Motriz_R8.3.html R_Motriz_R8.4.html
node pruebas/e2e84.mjs <ruta absoluta de R_Motriz_R8.4.html>   # 21 comprobaciones; necesita el paquete playwright
```

## R8.5 (17/11/2026)
`R_Motriz_R8.5.html` es la R8.4 más la capa `capas/r85`: en **Planes preventivos**, la pestaña «Líneas del plan · propuestas» muestra tres formas de ver las líneas de cada visita en una sola pantalla horizontal (A matriz por categoría, B escalera con solo lo que agrega cada paquete, C tarjetas por categoría). Son propuestas para decidir antes de desarrollarlas en el sistema.
```bash
python capas/aplicar_r85.py R_Motriz_R8.4.html R_Motriz_R8.5.html
```


## R8.6 · Línea temporal por categorías y visitas (R_Motriz_R8.6.html)
Capa `capas/r86` + `aplicar_r86.py` (R8.5 → R8.6). Se respeta la matriz de la línea temporal de R8.3 (cabeceras de resumen, filtros, línea roja de última visita) y se reemplaza solo su contenido:
- **Comprimido:** filas = categorías; el cruce con cada visita muestra seleccionados/que le tocan (0/6). Clic en el número abre una nota sin difuminar la pantalla con los servicios de esa categoría y esa visita como lista de checks (con «seleccionar toda la categoría»). El check del cruce marca la categoría y el de la cabecera marca toda la visita; los paquetes solo agrupan. Lo seleccionado alimenta el recordatorio y la cotización.
- **Detalle:** una fila por servicio con una etiqueta de color casi transparente según su categoría (sin agrupar).
- **Historial** al final: las ODS por visita; clic en una ODS permite elegir la visita del plan y marcar qué servicios del plan sí se cumplieron (visitas pasadas muestran hechos/esperados, p. ej. 3/6).
- **Proyección** de 2 ciclos completos; aceite mineral/semisintético/sin definir = 5.000 km por visita, sintético y full sintético = 7.500 km.
- **Datos de ejemplo** (se siembran al abrir la línea): DEM-701 Kia Rio (gasolina, sintético, 3 ODS) y DEM-702 Toyota Hilux (diésel, full sintético, 2 ODS) con sus clientes.
- **Pendiente:** hasta 8 planes (combustible × uso × tipo de aceite) y el caso de clientes que cambian de aceite; pasar los datos de ejemplo al sistema (localhost) cuando se apruebe la vista.
- Corrección en R8.5: la categoría «Motor y lubricación» ya no sale duplicada.
- Pruebas: `pruebas/e2e86.mjs` (19 comprobaciones). Las R8.4 y R8.5 se reconstruyeron para guardar la vista anterior de la línea temporal.

- R8.6: se agregaron al DEM-679 las ODS 13325 (2026-09-07, 291.044 km, revisión de amortiguador posterior) y 13442 (2026-09-16, 291.152 km, cambio de aceite con filtro y 3 aceites); sin datos personales (técnicos «Técnico demo»). La última visita del DEM-679 pasa a 291.152 km.
- R8.6: orden por paquetes (afinamiento entre menor y mayor), detalle compacto (una fila estrecha por servicio, categoría en tira lateral rotada, servicio ensanchado) y botón «Pantalla completa» desde los filtros (Vehículo/Uso/Aceite) en comprimido y detalle; se mantiene al seleccionar y se sale con el botón o Esc.
- R8.6: la matriz solo se desplaza de izquierda a derecha (el scroll vertical es el de todo el módulo); en el detalle la categoría es una etiqueta horizontal por fila y cada servicio cabe en una línea; botón «Solo la línea» (oculta todo menos la línea del tiempo, con Salir flotante); buscador de vehículo por placa con «＋» que abre el alta de vehículo, con «＋ Nuevo cliente» dentro del mismo formulario.
- R8.6: afinamiento como bloque final (lo demás queda apiñado arriba); cabecera compacta con ⓘ (al pasar el mouse dice el tipo de visita) y contador visible también en el detalle; abre desplazado a la derecha; servicio al ras del nombre; chip de ODS con «sin km» en una línea.
- R8.6: en pantalla completa nada se desborda hacia los lados (categoría y servicio quedan fijos al desplazar); el servicio «Revisión de bujías (tipo y estado)» pasa a «Limpieza o cambio de bujías (tipo y estado)» (precarga S6 y prototipo).
- R8.6 (catálogo): se unificaron «mangueras y fugas (motor / refrigerante / caja)» y «embrague y su líquido»; los soportes de motor y de caja quedan por separado (caja en Embrague y caja); «neumáticos (desgaste / presión)» sin espárragos; se quitó «nivel y estado del aceite (sin cambio)» porque va dentro del cambio de aceite y filtro. Paquetes: menor 18, mayor 27, revisión completa 34.
- R8.6: la proyección arranca siempre con el servicio express, dura ciclo y medio como máximo y no pasa del fin del año actual + 2 (hoy, 2028); las esquinas Categoría/Servicio quedan fijas en pantalla completa y «solo la línea».
- R8.6: línea amarilla (hoy o simulación) a la derecha de la última visita vencida; las columnas vencidas, entre la roja y la amarilla, se tiñen suave. Leyenda: roja = última visita, amarilla = hoy.
- R8.6: el historial de ODS se unifica por meses (una columna por mes con todas sus ODS; el km y la fecha salen de la ODS del cambio de aceite); lo pasado (antes de la línea roja) se tiñe rojizo y lo vencido (entre la roja y la amarilla) amarillento, en comprimido y en detalle.
- R8.6 (catálogo): también se unificaron bobinas («Revisión de bobinas»), rótulas («Revisión de rótulas, bujes y trapecios») y bujías («Limpieza o cambio de bujías (tipo y estado)», sin «Cambio de bujías» aparte). 39 servicios distintos en todos los paquetes y afinamientos.
- R8.6 (catálogo): se unieron pastillas y discos, zapatas y tambores, filtros de aire y cabina, escaneo de fallas y prueba de ruta, bobinas y chicotes, inyectores y obturador / IAC. Regla: solo se unen servicios de la misma categoría que van en los mismos paquetes, y el tiempo unificado es la suma de los tiempos (también en mangueras y fugas, y en embrague y su líquido). 33 servicios distintos; menor 15, mayor 24, revisión completa 29.
- R8.6: la selección cuenta solo servicios distintos; si lo seleccionado completa uno o más paquetes del plan (el mayor consume a los menores) se pregunta si cotizar «por ítem» o «por paquete del plan» (el paquete va como una línea con su ficha al pie: servicios y tiempos); si no completa ningún paquete, va directo por ítem. La visita con afinamiento usa el paquete real «menor/mayor + afinamiento».
- R8.6 / sistema real: la ficha del servicio sale justo bajo la línea, en letra pequeña, con un ojito para verla u ocultarla (cotización, nota de venta y ODS). Contenido: «Servicios:» con sus tiempos y, debajo, «Acciones a realizar:» (descripción y pasos) cuando existen. Sin título con el nombre del paquete ni etiqueta.
- R8.6: en la cotización el ojito va entre «Tipo» e «Ítem» y se quitaron los textos H-H / precio final; la orden de servicio del prototipo ahora tiene el buscador del catálogo en el detalle (antes era un campo de texto libre), el ojito entre «Tipo» y «Detalle» y la ficha bajo la línea.
- R8.6: al cotizar desde la línea, cada visita completa seleccionada es su propio paquete (dos visitas distintas = dos ítems; solo se descarta un paquete contenido en otro, como el express dentro del menor); la pregunta es «Agrupar por paquete» o «Separar por ítem». «Guardar cambios» de la cotización guarda y cierra el modal.
- R8.6: una visita con afinamiento se cotiza como dos paquetes: el mantenimiento (menor o mayor) y el «Afinamiento completo de motor» (inyección por defecto; carburado si el vehículo lo indica), cada uno con su código, precio y ficha; ya no se usa el paquete combinado «menor + afinamiento».
- R8.6: el detalle de la línea del tiempo se ve un 20 % más grande; la revisión completa ya no lleva «Limpieza o cambio de bujías (tipo y estado)» (queda en el afinamiento completo y en los paquetes con afinamiento); en la precarga y el prototipo.
- R8.6: nueva pestaña «Panorama de ciclos» en Planes preventivos: por cada plan, visita por visita (2 ciclos) con aceite de 5.000 km, con 7.500 km y meses ×1,5 y con 7.500 km y meses iguales; muestra duración del ciclo (km, meses, años) y dónde caen el afinamiento y la revisión completa.

## R8.7 · Ocho planes con código (19-nov-2026)

Archivo: `R_Motriz_R8.7.html` = R8.6 + capa `capas/r87/` (`aplicar_r87.py`). Prueba: `pruebas/e2e87.mjs` (93 comprobaciones).

- **Planes**: GP-M, GP-S, GR-M, GR-S, DP-M, DP-S, DR-M, DR-S (combustible G/D, uso P particular / R profesional, aceite M mineral o semisintético / S sintético o full sintético). Filtro «Plan» arriba; cabecera como tabla (Acciones a la izquierda con ⋯: editar plan, editar reglas, eliminar; plan, combustible, uso, aceite, código, visita, ciclo, afinamiento, vehículos, estado); debajo, el ciclo del plan (un solo botón Desplegar todo / Plegar todo) y el panel «Reglas del plan». No hay panorama, ni propuestas de líneas, ni revisión completa: solo cuatro paquetes (express, menor, mayor y afinamiento).
- **Servicios a elegir (*)**: en el afinamiento, «limpieza y mantenimiento de carburador» y «limpieza de inyectores y obturador / IAC» son excluyentes; sin marcar = pendiente de escoger. En la línea de tiempo, marcar una bloquea la otra; marcar toda la visita no elige ninguna; el paquete cotizado usa SV071 (carburado) o SV072 (inyección) según lo elegido. El mecanismo admite más grupos (`R87_ALT`); hoy solo existe el del afinamiento.
- **Aceite**: se detecta en el nombre («semi» primero, luego «sintético»/«full»/«100 %», luego «mineral»); sin dato, plan provisional (mineral o semisintético) «Por confirmar». Solo aceites de motor.
- **Línea de tiempo**: el plan sale del combustible y del uso; el paso es el intervalo del aceite; 1 ciclo en particular y 2 en profesional (≤ 24 meses y ≤ 31-dic del año actual + 2). La secuencia continúa después del último menor/mayor hecho; si no hay, empieza por express. Etiqueta **por vencer** (5 días o 100 km particular / 500 km profesional) a la derecha de la línea amarilla.
- **Plan en la línea de tiempo**: fila «Plan» sobre las columnas que agrupa las visitas por tramo (código, desde cuándo y km, quién lo hizo y, si el plan se cerró, hasta qué ODS; ⓘ con el detalle; el texto acompaña al desplazamiento hasta la división). Uso y aceite sin asignar en el vehículo: la línea muestra selectores como borrador («Sin guardar») y un botón Guardar al final de la barra, con alerta; al guardar quedan congelados en el vehículo. La primera asignación vale para todo el historial. Cambiar un plan ya asignado (solo con «Editar vehículo») pide confirmar y parte la línea en la última visita: lo anterior queda congelado con el plan anterior. Todas las fechas del modelo usan la fecha de salida de la ODS, no la de ingreso.
- **Encabezado de la línea**: resumen en dos filas de cuadros de dos líneas (última visita con fecha de salida, hoy estimado, última consulta, simulación con monto; plan, combustible y uso, visita, próxima visita); sin «Km y proyección», sin «Solo la línea» y sin textos explicativos; la simulación se escribe como monto.
- **Cotización**: precio por combustible y **descuento en soles** por servicios ya hechos después de la última visita (tiempo × hora hombre S/ 50 gasolina, S/ 80 diésel; revisiones al 50 %; múltiplos de 5 hacia abajo; nunca deja el paquete en cero).
- **Vehículos**: el grupo ya no se relaciona con el plan; la lista muestra combustible, uso, aceite y el código del plan.
- **Nombres**: «severo» pasa a «profesional» y «normal» a «particular».
- **Pendiente para el sistema real**: pasar todo a localhost (el módulo `Planes.tsx` y la API `plan` siguen con el modelo de 4 planes; la lista de vehículos real aún tiene las columnas Grupo y Plan), alerta al facturar por cambio de aceite, reporte de «por vencer» en Excel, datos obligatorios del vehículo.
- **Imprimir / PDF**: hoja A4 horizontal con formato de tabla (datos del vehículo y plan, y una columna por visita desde la línea roja hacia la derecha, servicios en filas con ●); sin historial ni controles.
- **Vista genérica (sin vehículo)**: la Línea temporal abre sin vehículo con Combustible, Uso y Aceite arriba; el ciclo arranca en 0 km con el plan que corresponde. «Consulta de km» simula el km actual y el último cambio de aceite, y la línea sigue desde ahí. «Guardar» crea el vehículo (placa obligatoria, marca/modelo y cliente opcionales, o un cliente nuevo) con su plan y su último cambio de aceite. Se puede imprimir. «Vista genérica» vuelve a ella desde un vehículo. Vista en lista (Comprimido/Detalle); el resumen del vehículo muestra «Último cambio de aceite» y «Última consulta» (la más reciente entre visita y consulta). Prueba: 99 comprobaciones.
