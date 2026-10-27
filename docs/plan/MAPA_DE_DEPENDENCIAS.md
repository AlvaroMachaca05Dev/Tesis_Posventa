# Mapa de dependencias

Qué artefacto alimenta a cuál. Sirve para saber qué revisar cuando algo cambia (la skill `guardian-coherencia-tesis` lo usa).

## Cadena principal
```
Necesidad del taller
   → Requisito funcional (RF-001 a RF-099)             docs/requisitos/ · tabla de requisitos de la tesis
   → Matriz de trazabilidad (una fila por RF)          tesis (capítulo 3) · docs/requisitos/MATRIZ_TRAZABILIDAD_R81.*
   → Diagramas (DAS, DCM, DCU, DCL, DMD, DSE, DES, DAC)  diagramas/R81_consolidados/*.puml
   → Especificación SDD (Dado, Cuando, Entonces)       specs/
   → Modelo de datos y contrato de la API              database/ · docs/api/
   → Código (backend y front) y pruebas                apps/ · packages/ · prototipo/pruebas/
```
Un cambio en un eslabón obliga a revisar los siguientes y, a veces, los anteriores.

## Qué diagrama sostiene qué parte de la tesis
| Diagrama | Contenido | Lo consumen |
|---|---|---|
| DAS-R81-0001 | Arquitectura lógica y pila | Matriz (columna DAS: bloques), ADR-001, `apps/` y `packages/` |
| DAF-R81-0001 | Despliegue | `infra/` (Docker Compose), CI |
| DCM-R81-0001 | Módulos de primera versión y beta | Delimitación, nombres de módulos de la API y la web |
| DCU-R81-0001, 0002 | Casos de uso por actor | Roles y permisos, historias del Sprint |
| DCL-R81-0001 a 0007 | Clases por bloque | Entidades del dominio (`packages/domain`), servicios de la API |
| DMD-R81-0001 a 0004 | Modelo de datos | `database/prisma/schema.prisma`, migraciones, semillas |
| DSE-R81-0001 a 0006 | Secuencias de los flujos principales | Casos de uso de la API, pruebas de integración |
| DES-R81-0001 a 0003 | Estados | Máquinas de estado del dominio y pruebas |
| DAC-R81-0001 a 0003 | Actividades | Flujos de pantalla y reglas de negocio |

## Partes de la tesis que dependen entre sí
- Capítulo 1: problema, objetivos, viabilidad. Los objetivos se vinculan con el capítulo 3 («Vínculo con los objetivos»).
- Capítulo 3: metodología, plan de sprints, reglas de negocio, requisitos, diseño, implementación, criterios de validación y matriz.
- Las **reglas de negocio** (capítulo 3) se reflejan en DES, DSE, DAC y en las especificaciones.
- Los **criterios de validación** dependen de los RF y de las pruebas.
- La **delimitación** (primera versión, beta, quitado) decide qué RF existen.

## Cambios típicos y su efecto
| Si cambias… | Revisa… |
|---|---|
| Un RF (texto) | Su fila en la matriz, su especificación, sus pruebas |
| Añadir o quitar un RF | Todas las tablas de requisitos, la matriz, la numeración y la conclusión |
| Un estado de ODS, tarea, cita, cotización o requerimiento | DES, DSE y DAC que lo usan, el modelo de datos (valores permitidos), las pruebas |
| Una tabla o columna | DMD, DCL, el esquema Prisma, las migraciones, los diagramas de secuencia que la tocan |
| Un rol o permiso | DCU, DAS (permisos en el servidor), pruebas de acceso y la matriz de roles |
| Un módulo (primera versión, beta, quitado) | DCM, la delimitación, el capítulo 3, los RF afectados |
| Un contrato de la API | `docs/api/`, DSE, el cliente tipado de la web y sus pruebas |
| La pila tecnológica | ADR-001, DAS, DAF, `infra/` y la CI |

Herramienta para medir el impacto exacto: `python herramientas/analizar_impacto.py <código o término>`.
