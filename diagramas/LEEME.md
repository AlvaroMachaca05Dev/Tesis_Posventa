# Diagramas UML

| Carpeta | Estado | Contenido |
|---|---|---|
| `R82/` | **Vigente** (05/11/2026) | 9 diagramas nuevos: clases de tareas, citas y vistas; grupos, precios y solapamiento; estados de la cita; secuencia cita a ODS; propuesta de plan y cuatro actividades con carriles (recepción, en proceso, entrega y cierre, reapertura y corrección) |
| [`R81_consolidados/`](R81_consolidados/LEEME.md) | **Vigente** salvo lo reemplazado por R82 (DCL-0004, DES-0002, DSE-0002, DAC-0001) y lo retirado (DCL-0002 y DSE-0001 de carga masiva, DAC-0003 de logística) | 28 diagramas: arquitectura, despliegue, módulos, casos de uso, clases, datos, secuencias, estados y actividades |
| `R78_arquitectura/` | Histórico | Primera propuesta de pila y despliegue (reemplazada por DAS-R81-0001 y DAF-R81-0001) |
| `R77_delimitacion/` | Histórico | Diagramas de la delimitación R7.7 |
| `R8_propuesta/` | Histórico | UML del motor de referencia R8 |

Los diagramas se escriben en PlantUML (`.puml`) y se generan a PNG con `java -jar plantuml.jar -charset UTF-8 -tpng -o png *.puml`. Antes de cambiar un diagrama se usa la skill `guardian-coherencia-tesis`.
