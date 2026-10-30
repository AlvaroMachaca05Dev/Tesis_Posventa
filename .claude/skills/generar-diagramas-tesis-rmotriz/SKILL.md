---
name: generar-diagramas-tesis-rmotriz
description: Crear, corregir o verificar diagramas PlantUML trazables al diseño de la tesis R Motriz, respetando las reglas del profesor.
---

**Entrada:** requisito/CU/spec y la vista solicitada. Lee `AGENTS.md`, `docs/historial/R7/DIAGNOSTICO_UML.md` y los diagramas existentes: los de R7.6 en `../fuentes-latex/diagramas/` y `../archivo/tesis-restante/uml_R76/`, y la **propuesta R8** en `diagramas/R8_propuesta/` (clases `DCL-R8-0001A/B/C`, estados `DES-R8-0001..0003`, secuencias `DSE-R8-0001..0006`). Busca la fuente original antes de reconstruir; si reconstruyes, indícalo.

**Reglas del profesor (obligatorias)**
1. **Primero clases, después estados.**
2. Casos de uso **sin cruces** de asociación.
3. Mensajes de secuencia **numerados** (1, 1.1, 1.1.1).
4. El **receptor** de cada mensaje es una clase del diagrama de clases y el **método existe** en ella.

**IDs que se conservan:** DAM metodología, DAS arquitectura, DCU casos de uso, DES estados, DCM componentes, DCL clases/datos, DAC actividades, DSE secuencias, DMD modelo de datos. Los nuevos de R8 llevan `R8` en el ID.

**Herramientas:** PlantUML en `herramientas/bin/plantuml.jar` (Java 21 instalado): `java -jar herramientas\bin\plantuml.jar -tpng <archivo.puml>`; para diagramas grandes usa `PLANTUML_LIMIT_SIZE=16384`. Verificadores en Python (usa `python`, no `python3`): `diagramas/R8_propuesta/verificar_uml.py` y `../archivo/tesis-restante/uml_R76/verificar_uml76.py`. **No subas datos del taller a un renderizador externo.**

**Verificación:** renderiza sin errores de sintaxis y ejecuta el verificador; el verificador solo comprueba consistencia secuencia↔clases, **no** la semántica del dominio ni sustituye al profesor. Los diagramas de actividades y de casos de uso **no tienen verificador**: dilo.

**Salida:** fuente `.puml` y render con el mismo ID, vínculos a RF/CU/spec y evidencia de compilación y verificación. Los diagramas nuevos son una **propuesta hasta que el profesor los valide**. No inventes capturas de una interfaz implementada ni representes como existente lo que solo es diseño.
