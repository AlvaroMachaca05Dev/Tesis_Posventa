# Contrato de API previsto (R7.7) — PROPUESTA

> **Histórico (31/10/2026).** Contrato propuesto antes de la API real; la API vigente está en `apps/api`. El estado vigente está en `../ESTADO_ACTUAL.md`.


**Estado:** PROPUESTA del asistente a partir de la delimitación del 19/10/2026. **No existe servidor ni API.** La pila tecnológica está sin decidir (`docs/decisiones/ADR-001-pila-tecnologica.md`, PROPUESTO); este contrato no la presupone. Todos los ejemplos usan **datos sintéticos**. Nada de esto está implementado ni probado: lo que hoy existe es la **carga masiva** por Excel o CSV (sección 2), que define la forma de los datos.

## 1. Para qué sirve
El taller usa otro sistema (por ejemplo, el sistema de gestión actual) donde se registran las órdenes de servicio. Este software de posventa necesita:
- **Recibir** cada día las órdenes (con sus ítems, el vehículo y el cliente) para crear tareas y activar automatizaciones.
- **Entregar** al otro sistema, si lo pide, las tareas, el estado de las órdenes y las respuestas de las encuestas.

Mientras la API no exista, los datos entran por **carga masiva**; la API debe producir exactamente el mismo resultado que la carga masiva (mismas reglas, mismos errores por fila).

## 2. Vía actual: carga masiva de órdenes (formato de referencia)
Plantilla: `prototipo/carga_masiva/09_plantilla_ordenes_de_servicio.xlsx` (hoja `Ordenes`). Una fila por ítem; las filas con el mismo `codigo_ods` forman una orden.

| Columna | Obligatoria | Regla |
|---|---|---|
| `codigo_ods` | Sí | Código de la orden en el sistema de origen. **Llave de idempotencia** (`externalId`). |
| `fecha` | Sí | `AAAA-MM-DD` o `DD/MM/AAAA` (también número de serie de Excel). |
| `hora` | No | `HH:MM`. |
| `placa` | Sí | Se compara sin guiones ni espacios y en mayúsculas. Si no existe, se crea el vehículo. |
| `kilometraje` | No | Número; actualiza el kilometraje del vehículo si es mayor. |
| `estado` | No | *Recepción*, *En proceso*, *Entrega* o *Cerrada* (también «finalizada», «archivada», «entregada»). Por defecto, Recepción. |
| `tipo_atencion`, `motivo` | No | Texto libre. |
| `sede` | No | `union` o `prohogar`. Por defecto, `union`. |
| `tecnico_orden`, `asesor` | No | Nombre de un usuario activo; si no coincide, queda sin asignar. |
| `tipo_item` | No | `servicio` o `producto` (por defecto `servicio`; si el código existe en el catálogo, usa su tipo). |
| `codigo_item`, `item` | Una de las dos | Si el código está en el catálogo, trae nombre, precio y costo. Un ítem sin código es **externo**. |
| `cantidad` | No | En servicios son **H-H** (no multiplican el precio); en productos, unidades. |
| `precio_unitario`, `costo`, `descuento` | No | Soles. |
| `tecnico_servicio` | No | Técnico **del servicio** (no el de la orden). |
| `documento_cliente`, `nombre_cliente`, `marca`, `modelo`, `anio` | No | Solo se usan para **crear** el vehículo y el cliente cuando la placa no existe. |

Reglas: una ODS **nueva y abierta** crea su tarea de evento y activa las automatizaciones; una **cerrada** no crea tareas. Una ODS que ya existe se **omite** en el modo *solo agregar*, y en *agregar y actualizar* se actualizan el estado, el kilometraje, la sede, el tipo de atención y el motivo (sus ítems solo se cargan si la orden no tenía). Filas inválidas se reportan por fila y **no detienen** el resto; no se borra nada.

## 3. Convenciones de la API propuesta
- Base: `/api/v1`. JSON en UTF-8. Fechas `AAAA-MM-DD`; fechas y horas con zona (`America/Lima`). Dinero en soles con dos decimales.
- **Idempotencia:** `POST` con la misma llave (`codigoOds`) no duplica; devuelve `200` con `accion: "sin_cambios"` o `"actualizado"`; la primera vez `201` y `accion: "creado"`.
- **Atomicidad por orden**, no por lote: cada orden se aplica o se rechaza completa; la respuesta lista el resultado de cada una.
- **Errores:** `400` validación (con `fila` y `campo`), `401`/`403` autenticación y permiso, `404` no existe, `409` conflicto, `422` regla de negocio, `429` demasiadas solicitudes.
- Versionado en la ruta. Los cambios compatibles no suben la versión.
- **Auditoría:** cada llamada queda en la bitácora con el origen (`origen: "api"`).

## 4. Rutas
| Método | Ruta | Qué hace | Hoy |
|---|---|---|---|
| POST | `/api/v1/ordenes` | Crea o actualiza una o varias órdenes con sus ítems | Carga masiva › Órdenes de servicio |
| GET | `/api/v1/ordenes/{codigo}` | Devuelve la orden con ítems, estado y tareas | — |
| POST | `/api/v1/clientes` | Crea o actualiza un cliente (llave: documento) | Carga masiva › Clientes |
| POST | `/api/v1/vehiculos` | Crea o actualiza un vehículo (llave: placa) | Carga masiva › Vehículos |
| GET | `/api/v1/tareas?estado=&desde=` | Lista tareas | — |
| POST | `/api/v1/encuestas/{token}` | Recibe la respuesta de la encuesta del cliente | Enlace `#encuesta=` del prototipo |
| POST | `/api/v1/webhooks` | Registra una URL que recibe avisos (ODS cerrada, tarea creada) | — |

## 5. Ejemplo: `POST /api/v1/ordenes` (datos sintéticos)
```json
{
  "ordenes": [
    {
      "codigoOds": "100001",
      "fecha": "2026-10-01",
      "hora": "09:30",
      "placa": "AAA-000",
      "kilometraje": 50000,
      "estado": "En proceso",
      "tipoAtencion": "Mantenimiento",
      "motivo": "Cambio de aceite y filtros",
      "sede": "union",
      "cliente": { "documento": "00000000", "nombre": "NOMBRE DE EJEMPLO" },
      "vehiculo": { "marca": "KIA", "modelo": "PICANTO", "anio": 2019 },
      "items": [
        { "tipo": "servicio", "codigo": "ACE", "descripcion": "CAMBIO DE ACEITE DE MOTOR", "cantidad": 0.75, "precioUnitario": 30, "tecnicoServicio": "Técnico demo" },
        { "tipo": "producto", "codigo": "P0201", "descripcion": "ACEITE 20W-50", "cantidad": 4, "precioUnitario": 40, "costo": 30 }
      ]
    }
  ]
}
```
Respuesta `201`:
```json
{ "resultados": [ { "codigoOds": "100001", "accion": "creado", "tareasCreadas": 1 } ], "errores": [] }
```

## 6. Encuesta con enlace
1. El sistema genera para cada ODS cerrada un **token firmado de un solo uso** y arma el enlace `https://<dominio>/encuesta/<token>`.
2. El texto que se envía al cliente (WhatsApp, SMS o correo) incluye ese enlace.
3. El cliente abre una página de una sola pantalla con las 7 preguntas (cómo conoció la empresa, atención, instalaciones, tiempos, calidad, precios y recomendación de 1 a 10) y un comentario opcional.
4. `POST /api/v1/encuestas/{token}` guarda la respuesta (canal «Enlace»), completa la tarea de posventa de esa ODS y alimenta el NPS y las métricas.
En el prototipo el enlace es `…R_Motriz_R7.7.html#encuesta=<ODS>` y la respuesta se guarda en el mismo navegador (sin servidor).

## 7. Seguridad (propuesta)
Autenticación por **clave de API** por integración (no compartida), guardada en el servidor y **nunca** en el repositorio ni en el navegador; HTTPS obligatorio; límite de solicitudes; permisos por ruta; registro de cada llamada. Los tokens de encuesta caducan y no revelan datos personales. **No** se guardan claves ni datos reales en esta carpeta.

## 8. Dudas abiertas (las decide el investigador con los desarrolladores)
1. ¿Qué sistema consumirá o llamará a la API, y quién la aloja? (OPEN-01 y OPEN-03).
2. ¿Autenticación por clave de API, OAuth u otra?
3. ¿Volumen diario esperado de órdenes y tamaño máximo por solicitud?
4. ¿La API también **entrega** tareas, o solo recibe órdenes?
5. ¿Se mantiene la carga masiva cuando exista la API, como respaldo?
6. ¿Webhooks desde la primera versión o después?
