# Nota de venta (RF-088) — diseño y avance

Diseño corto, previo al desarrollo (DEC-87). Se apoya en DEC-74, DEC-75, DEC-76, DEC-81, DEC-82, DEC-101, RN-03 y RN-15.

## Avance (actualizar al cerrar cada etapa)

| Etapa | Qué incluye | Estado |
|---|---|---|
| 1 | Este diseño | Hecho (16/11/2026) |
| 2 | Base de datos y API con pruebas (`notaVenta.spec.ts`; API 182/182) | Hecho (16/11/2026) |
| 3 | Pantalla: «Facturar» desde la orden, en una sola pantalla (`facturacion/FormNota.tsx`) | Hecho (16/11/2026) |
| 4 | PDF y ticket de la nota (`facturacion/pdfNota.ts`; pantalla 82/82) | Hecho (16/11/2026) |
| 5 | Cierre de la orden con nota, decisiones (DEC-105), tesis y registro | Hecho (16/11/2026) |

**Si el trabajo se corta:** mirar la última etapa «Hecho» y seguir con la siguiente; cada etapa termina con pruebas pasando y commit.

## Alcance de esta primera versión

- La nota de venta se **emite desde una ODS** y toma sus ítems. Una ODS tiene como máximo una nota vigente.
- Es **interna** (no va a SUNAT): es el molde de la boleta y la factura, que llegan después.
- Fuera de alcance por ahora: boleta, factura, nota de crédito, cuentas por cobrar (RF-090), cuenta por pagar automática de la detracción (DEC-75), kárdex con formato AIM (DEC-82) y reporte de detracciones.

## Datos

- `NotaVenta`: empresa, local, orden, cliente, **serie y número** (código `NV01-000001`), fecha de emisión, vencimiento (solo a crédito), condición (`CONTADO` o `CREDITO`), observaciones, comentario, estado (`EMITIDA` o `ANULADA`), totales (exonerada, inafecta, gravada, IGV, total), detracción (porcentaje, monto exacto y monto redondeado), quién la emitió, y quién y por qué la anuló.
- `DetalleNota`: copia de cada ítem de la ODS al emitir (tipo, descripción, referencia, cantidad, precio, descuento, **tipo de IGV**, total, producto o servicio de origen). La nota no cambia si después cambia la orden.
- `CorrelativoSerie`: último número por empresa y serie.

## Reglas

1. **Serie y número (RN-03):** la serie es la de nota de venta del local elegido (por defecto, el de la cajera). El número es consecutivo por serie, lo da el servidor dentro de una transacción y no se edita. Si el local no tiene serie, no se emite (409).
2. **Cuándo se emite:** la ODS no está cerrada ni eliminada, tiene al menos un ítem, su total es mayor que cero, su decisión no es «No aprobada» y no tiene otra nota vigente.
3. **Tipo de IGV por ítem (RN-15):** Gravado (el precio incluye el IGV de 18 %; base = total / 1,18), Exonerado o Inafecto. Por defecto sale del impuesto del ítem de la ODS (`IGV` → Gravado, `NINGUNO` → Inafecto) y la cajera lo puede cambiar al emitir.
4. **Totales:** exonerada, inafecta, gravada (sin IGV), IGV y total. El total es la suma de los ítems, sin redondeo (DEC-74).
5. **Detracción (DEC-75, DEC-82):** 12 %. Se propone si hay al menos un servicio y el total supera S/ 700; la cajera puede quitarla o ponerla. Se guarda el monto exacto y el redondeado a soles (desde 0,50 sube). La deposita la empresa: no reduce lo cobrado ni el saldo.
6. **Inventario (DEC-76):** al emitir, cada producto del catálogo descuenta su cantidad del stock del local de la nota (puede quedar negativo) con un movimiento «Venta» que lleva el código de la nota. Al anular, se devuelve con un movimiento «Anulación de venta».
7. **Pagos:** siguen siendo los abonos de la ODS (RF-089). Saldo = total de la nota − abonos.
8. **Cierre de la ODS:** con una nota vigente, la ODS se puede cerrar aunque la decisión no sea «No aprobada» (reemplaza la regla provisional de DEC-72). La orden muestra «Con comprobante» y el código.
9. **Anulación:** solo con nivel «todo» en órdenes y con motivo. No se anula si la ODS está cerrada (primero se reabre, RF-018). La nota no se borra: queda `ANULADA`, y la ODS puede emitir otra, que toma el número siguiente.
10. Todo queda en la bitácora de la ODS y en la auditoría.

## API

- `POST /ordenes/:id/nota-venta` — emite. Cuerpo: `localId?`, `condicion`, `fechaVencimiento?`, `observaciones?`, `comentario?`, `conDetraccion?`, `tiposIgv?` (por id de ítem).
- `GET /notas-venta` — lista (filtros: estado, desde, hasta, texto).
- `GET /notas-venta/:id` — una nota con sus ítems.
- `POST /notas-venta/:id/anular` — anula con motivo.
- `GET /ordenes/:id` y la lista de órdenes devuelven `comprobantes` y `conComprobante` reales, y `notaVenta` (la vigente) para el PDF.

## Pantalla

- El botón «Facturar» (`$`) de la tarjeta de la orden abre la nota en **una sola pantalla**, sin pestañas (DEC-81): local, condición, vencimiento, cliente y placa (solo lectura), observaciones y comentario; la tabla de ítems con su tipo de IGV; los totales (exonerada, inafecta, gravada, IGV, total, detracción, pagado en verde y saldo en rojo) y el botón «Emitir».
- Si la orden ya tiene nota, el mismo botón la muestra, con «Imprimir» (PDF o ticket) y «Anular».

## PDF y ticket

Mismo escritor de PDF y mismos datos de empresa que la ODS (DEC-98, DEC-101). Título «NOTA DE VENTA», código de serie y número, tabla de ítems, totales con IGV y detracción, y el pie configurado.
