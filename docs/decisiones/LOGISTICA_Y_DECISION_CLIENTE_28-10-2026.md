# Logística y decisión del cliente (resumen corregido, 28/10/2026)

Texto entregado por Álvaro Machaca el 28/10/2026. Corrige y reemplaza lo anterior sobre aprobación, cierre, tareas de productos y logística. Resumen en `DECISIONES_CERRADAS.md` (DEC-72). **No está en la tesis todavía.**

> Nota de nombres: el texto original llama «Archivada» al último estado de la ODS; el investigador aclaró después que en la ODS ese estado se llama **Cerrado** y «Archivada» queda para las tareas (DEC-61 y DEC-62).

## Corrección aplicada
Cuando el logístico termina de cotizar, la tarea pasa a prioridad Baja aunque la decisión siga siendo «Aprobada para cotizar». Esa decisión no cambia; solo cambia la etiqueta de los ítems a Cotizado y la prioridad.

## Decisión del cliente sobre la ODS
Es un campo separado del estado de la ODS (Recepción, En proceso, Entrega y Cerrado), con cuatro valores:
- **Pendiente de aprobación:** solo se pidió la lista de productos.
- **Aprobada para cotizar:** antes «aprobación parcial».
- **Aprobada para comprar:** antes «aprobación total».
- **No aprobada:** el cliente no aprobó y se fue.

Los estados de la ODS se pueden mover libremente, adelante o atrás.

## Cierre y facturación
- Solo una ODS «No aprobada» se puede cerrar sin comprobante. Se cierra sin nota de venta, aunque tenga servicios cotizados, y no genera comisión a los técnicos.
- Las otras tres (Pendiente de aprobación, Aprobada para cotizar y Aprobada para comprar) no se pueden cerrar (pasar a Entrega o Cerrado) sin nota de venta. La única forma de cerrarlas sin nota es cambiar antes la decisión a «No aprobada».
- La regla aplica desde cualquier estado de la ODS.
- La cotización (el cliente la pide por escrito) es distinta de la ODS (el vehículo llega al taller).

## Cuándo vuelve a «Pendiente de aprobación»
- Revierte si se agrega un servicio o producto nuevo, o si cambia el precio de venta de un producto.
- No revierte si cambia el precio de un servicio, la descripción o el costo interno.
- Con «Aprobada para comprar» no revierte por precio. Un ítem nuevo entra a la tarea del logístico.
- Cada reversión deja un título corto al pie de la ODS («hace X min») y el detalle en la bitácora (producto, de 50 a 30).

## Archivar o eliminar ítems
- La cajera elige los ítems y puede archivar (preferido) o eliminar. El sistema pregunta si es por error, equivocación o porque no se aprobó, y guarda el motivo.
- Lo archivado desaparece de la ODS y de la cotización limpia, pero el trabajo de cotización queda para la trazabilidad.
- La cotización limpia solo muestra ítems en estados abiertos (Pendiente, En proceso, Completada).

## Productos con código de referencia (mostrador)
- No pasan por logística. Van a una tarea para la cajera, que puede cambiarse a otra de la misma sede.
- Ella la marca Completada, con evidencia opcional.
- Si a un producto de logística se le asigna después un código, pasa a la tarea de la cajera.
- Si el producto no está físicamente, se crea sin código. El logístico compra una unidad en un minorista como compra externa, fuera del stock.

## Productos sin código (logística)
- Una sola tarea por ODS, llamada siempre «Productos de la ODS X». Se actualiza y no se crean tareas nuevas.
- Etiquetas por ítem: Cotizar, Cotizado y Comprar. Un ítem nuevo entra como Cotizar. Cuando el logístico termina de cotizar y pasa la tarea a En proceso, el ítem queda Cotizado. Cuando la cajera aprueba para comprar, pasa a Comprar.
- Los ítems nuevos llevan además la etiqueta «adicional».
- Si llegan ítems nuevos, la tarea retrocede a Pendiente aunque estuviera Completada. La fecha de cierre se borra **sin preguntar** y la anterior queda en el historial.
- Estados de la tarea: Pendiente (por cotizar), En proceso (cotizado y esperando aprobación; luego, comprando) y Completada (entregado).

| Situación | Prioridad |
|---|---|
| Por cotizar, ODS Pendiente de aprobación | Normal |
| Por cotizar, ODS Aprobada para cotizar | Alta |
| Ya cotizado, esperando aprobación (aunque la decisión siga siendo «Aprobada para cotizar») | Baja |
| Aprobada para comprar | Urgente |

- Al aprobar para comprar, el logístico recibe una alerta.
- Evidencia: al mover de estado sale un modal con «Guardar evidencia» o «Cambiar estado sin evidencia». Es opcional (foto, captura o PDF), pero el sistema cuenta cuántas tareas se hicieron con evidencia y cuántas sin ella. Se puede subir evidencia de compra en En proceso y de entrega al completar.
- El logístico puede delegar un ítem a otro logístico (hasta dos). Ese ítem se vuelve una subtarea independiente que no cambia el estado de la tarea principal. Queda registrado quién hizo qué.

## Qué ve cada rol
- **Logístico:** tabla con descripción, marca, costo, proveedor y precio de venta. Solo ve las ODS donde tiene productos.
- **Cajera:** «descripción - marca». Nunca ve el proveedor.
- **Cliente:** nunca ve proveedor ni costo.
- **Técnico:** nunca ve costos. Puede dar conformidad por producto (sí, no o dejarlo vacío).
- **Edición en la ODS:** el logístico edita descripción, costo, venta y margen, y los cambios suben a la ODS en tiempo real. La marca solo se asigna desde su tarea.
- Las facturas de compra externas no necesitan código de referencia; solo se vinculan a la ODS.

## Técnico rechaza productos
- La tarea se reabre a En proceso y el logístico lo resuelve por la bitácora, con sus evidencias.
- Los motivos son una lista: no es el producto, tiene fallas, no es el repuesto correspondiente, llegó en mal estado o nunca lo recibió. Se acompañan de un comentario libre.
- El reproceso formal (devolución o cambio) queda para más adelante.

## Métricas de logística
- Tareas completadas, tiempos (cotizar, comprar, entregar), pasos de Pendiente a En proceso, ítems por tarea, cantidad de compras y conformidad del técnico.
- Margen: precio final menos costo, sin ajustar por IGV. Cada precio y costo se marca «con» o «sin» IGV para que el dato sea claro.

## Qué decisiones anteriores cambian
DEC-01 (ahora cuatro valores), DEC-02, DEC-06, DEC-07 (ítem delegado como subtarea), DEC-14, DEC-29 (nota de venta obligatoria salvo en «No aprobada») y la «fecha de salida», que pasa a «fecha de cierre». DEC-04 se mantiene.
