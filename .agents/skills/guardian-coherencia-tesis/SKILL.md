---
name: guardian-coherencia-tesis
description: Antes de cambiar el LaTeX de la tesis, un diagrama, un requisito (RF), una especificación o la trazabilidad, analiza qué más se rompe, lo explica al investigador y espera su aprobación. Úsala siempre que un cambio toque documentos o el contrato del sistema.
---

# Guardián de coherencia de la tesis

**Por qué existe.** Los diagramas, los requisitos, la matriz de trazabilidad, las especificaciones, el código y las pruebas se consumen entre sí. Un cambio suelto en uno deja a los demás desactualizados y el desarrollo se descontrola. Esta skill obliga a **pensar el impacto antes de actuar**.

## Cuándo se activa
Cualquier cambio que toque:
- `main.tex` de la tesis (carpeta `2_documento-tesis-overleaf/`, hermana de este repositorio) en cualquier capítulo;
- un diagrama (`diagramas/R81_consolidados/*.puml`);
- un requisito funcional (RF) o la matriz de trazabilidad (`docs/requisitos/`);
- una especificación (`specs/`) o una decisión (`docs/decisiones/`);
- el modelo de datos (`database/`) o un contrato de la API (`docs/api/`).

No se activa para cambios que solo tocan código dentro de lo ya especificado y con su prueba.

## Procedimiento (no saltar pasos)
1. **Entender la petición** y resumirla en una frase.
2. **Medir el impacto** con la herramienta (no solo con la memoria):
   ```bash
   python herramientas/analizar_impacto.py RF-017
   python herramientas/analizar_impacto.py DCL-R81-0004
   python herramientas/analizar_impacto.py "Cotizacion"
   ```
   Además consulta `docs/plan/MAPA_DE_DEPENDENCIAS.md`.
3. **Redactar el informe de impacto** con este formato exacto y **mostrarlo al investigador antes de cambiar nada**:

   ```
   ## Cambio propuesto
   (una o dos frases, a grandes rasgos)

   ## Qué se vería afectado
   | Artefacto | Dónde | Qué cambia | ¿Rompe lógica? |
   |---|---|---|---|
   | Capítulo / sección de la tesis | … | … | sí / no |
   | Diagrama (código) | … | … | sí / no |
   | Matriz de trazabilidad (RF y columnas) | … | … | sí / no |
   | Especificación / decisión | … | … | sí / no |
   | Código y pruebas | … | … | sí / no |

   ## Qué sí rompe la lógica y por qué
   (reglas del taller, estados, permisos, orden de pasos, datos que dejan de cuadrar)

   ## Qué no rompe nada
   (solo texto, redacción o cambios cosméticos)

   ## Alternativas más seguras
   (si las hay)

   ## Pido tu aprobación
   ¿Procedo con esto? (sí / no / cambiar X)
   ```
4. **Esperar la respuesta del investigador.** Sin un «sí» claro, no se edita nada. Si el investigador aprueba solo una parte, se ejecuta solo esa parte.
5. **Ejecutar en bloque** lo aprobado, y en el mismo cambio:
   - actualizar la matriz de trazabilidad y las tablas de requisitos;
   - regenerar los PNG de los diagramas tocados (`java -jar plantuml.jar -charset UTF-8 -tpng -o png *.puml`) y copiarlos a la carpeta de imágenes de la tesis;
   - actualizar especificaciones, pruebas y `REGISTRO_CAMBIOS.md`;
   - compilar la tesis con XeLaTeX o Tectonic y confirmar que no hay errores ni referencias rotas.
6. **Verificar** con `analizar_impacto.py` que ningún código viejo quedó sin actualizar.

## Qué se considera «rompe lógica»
- Cambiar los estados o las transiciones de una ODS, tarea, cita, cotización o requerimiento.
- Cambiar quién puede ver o hacer algo (roles, permisos, costos y márgenes).
- Cambiar una regla de negocio (pasos de 0.25 H-H, máximo de dos bloques por técnico, carga atómica, reajuste solo con servicio confirmado).
- Añadir, quitar o fusionar un RF, o mover un módulo entre primera versión, beta y quitado.
- Cambiar el modelo de datos (tablas, relaciones, claves) o el contrato de la API.

## Reglas
- Un cambio de redacción que no altera hechos ni códigos **no rompe lógica**, pero igual se lista.
- Nunca se aprueban cambios «por silencio». Nunca se dan por aprobados los cambios de una conversación anterior.
- Si el investigador pide saltarse el informe, se hace igual un resumen de una línea de lo que se tocará.
- No se inventan RF, diagramas ni pruebas para que la trazabilidad «cuadre»: si falta algo, se reporta como hueco.
