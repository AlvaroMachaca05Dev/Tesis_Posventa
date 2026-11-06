# Revisión de continuidad para Álvaro y Claude — 05/11/2026

## Pedido y límite de esta sesión

El investigador pidió comprender los avances de software y tesis, revisar de forma autónoma y hacer solo cambios sencillos; las correcciones complejas quedan para Claude. Esta es una revisión amplia de contexto, integridad y verificaciones automáticas, no una certificación exhaustiva de todos los flujos ni una aceptación del taller.

Se leyeron las carpetas locales F: y la copia de Drive montada en J:. No se comprobó la sincronización con el servidor de Google ni el contenido de Overleaf. No se modificaron lógica de producción, migraciones, requisitos, diagramas, LaTeX, anexo Excel ni PDF. No se ejecutó seed ni preparación de base. Las pruebas de API sí crean/borran datos sintéticos en posventa_test; no usan la base de desarrollo. No hubo commit ni push.

## Contexto que debe conservarse

- Código activo: `F:/Tesis/Tesis_Posventa`. API NestJS, interfaz React/TypeScript/Vite, Prisma/PostgreSQL, monorepo pnpm. No desarrollar sobre las copias antiguas de Drive.
- Tesis activa: `J:/Mi unidad/Trabajo RSA/Tesis sistema posventa/2_documento-tesis-overleaf/main.tex`, con secciones R8.2 e imágenes.
- Registro compartido: `3_contexto-drive/REGISTRO_CAMBIOS.md`. El último registro previo describe la primera entrega S5 (N1–N5), anterior a los últimos cambios G1–G4.
- La tesis busca convertir ODS e historial en planes preventivos, reajustes trazables y acciones de posventa. Las metas de más de 90 % de reajustes documentados y 20 % de reducción de tiempo son metas, no resultados medidos.
- R8.2 conserva 49 RF activos. El CSV contiene 103 códigos para conservar el destino de los requisitos absorbidos, beta o trasladados a reglas/migración. No renumerar ahora.
- Los estados publicados son 14 RF implementados, 5 parciales y 30 pendientes; son estados documentados, no una nueva certificación de esta revisión.
- S1 y S2 terminados según el plan; S3 en curso; S5 implementado pero la última versión requiere cerrar pruebas. S4 es migración inicial interna y va después de S5. S6–S14 siguen pendientes según el plan.
- En S3 faltan RF-018 y ajustes R8.2: cierre sin nota de venta, garantía enlazada, tipo Otro con texto y tratamiento de la decisión del cliente. No confundir funcionalidades de prototipo con implementación real.
- El alcance empresarial incorporó catálogo e inventario básico. Tener ajustes de stock no implica haber completado compras, venta y kárdex de S12, ni autorización de producción.

## Verificado en esta sesión

| Verificación | Resultado | Límite |
|---|---|---|
| Interfaz completa, `pnpm --filter @posventa/web test` | 48/48 aprobadas | Antes del ajuste menor del mock; no es prueba visual en navegador |
| API completa, `pnpm --filter @posventa/api test` | 56 aprobadas, 82 fallidas, 138 en total; 4 suites pasan y 4 fallan | Base posventa_test con esquema anterior y fixtures incompatibles |
| API, `pnpm --filter @posventa/api exec tsc --noEmit -p tsconfig.json` | Sin diagnósticos | Comprobación de tipos, no ejecución funcional |
| Web, `pnpm --filter @posventa/web exec tsc --noEmit` | Sin diagnósticos | Comprobación de tipos |
| Prueba S5 tras corregir mock, `pnpm --filter @posventa/web test -- src/maestros/S5.test.tsx` | 3/3 aprobadas; desaparece aviso de key | No se volvió a ejecutar toda la suite porque solo se completó el mock |
| `git diff --check` | Sin errores de espacios | No implica que toda la lógica sea correcta |
| Catálogo JSON S5 | 4 grupos, 135 servicios, 43 solapamientos, 159 familias | Se verificó el archivo y la semilla; no se consultaron conteos de la BD de desarrollo |
| Integridad del catálogo | Sin códigos duplicados ni referencias a servicios inexistentes; todos los servicios tienen las cuatro claves de grupo | No valida los precios con el experto |
| Trazabilidad | 49 filas; todos los IDs de diagramas referidos tienen fuente PlantUML; todos los archivos de prueba indicados en CP existen | No se comprobó cada método UML contra implementación |
| LaTeX principal y secciones | Sin referencias internas sin label, sin labels duplicados ni input/include faltantes; 83 rutas únicas de imágenes existen | Comprobación textual, sin recompilar ni inspeccionar visualmente PDF |

La salida completa de las pruebas se consultó en la sesión; este informe conserva el resumen observado. No se fabricaron JSON de Jest/Vitest ni se reemplazaron los resultados históricos de R8.2.

## Modelo S5 actual entendido

`database/seeds/precarga/s5/catalogo_g.json` contiene G1–G4, 135 servicios y 43 reglas: 39 PAR y 4 CONJUNTO; 29 AUTOMATICO, 13 OPCIONAL y 1 AVISO. Las 159 familias se reparten en G1=16, G2=54, G3=68 y G4=21. Los precios null representan No aplica: G1=13, G2=13, G3=10 y G4=19 celdas.

La semilla prepara DEM-101/102, DEM-201, DEM-301/302, DEM-401/402 y DEM-500. El último queda sin motor conocido. La implementación consulta el precio por grupo antes del estándar; No aplica impide usar ese servicio para el grupo. Las reglas posteriores de precio conservan los niveles SERVICIO, GRUPO y GLOBAL.

El solapamiento por conjunto conserva sin descuento la línea de mayor total y evalúa las restantes; por línea se conserva el mayor descuento. La ODS representa el descuento monetario dentro de Desc. (%), conservando datos de su origen. El editor real permite volver a Aplicar después de Montos mantenidos. El prototipo todavía tiene un flujo distinto en ese estado.

Documentos: el código valida DNI de 8 dígitos, RUC de 11 y CE alfanumérico de 9 a 12; teléfonos de 9 dígitos. Esta revisión no verificó la afirmación normativa sobre SUNAT del comentario: mantenerla pendiente de fuente oficial, sin cambiar por intuición.

Inventario: hay stock por local, total, confirmación de contraseña, token de autorización de 15 minutos y movimiento por ajuste. El endpoint comprueba usuario real, organización y permiso catalogo A. No se ejercitó este flujo contra la base de desarrollo.

## Hallazgos prioritarios para Claude

### 1. Restablecer una base de pruebas coherente antes de interpretar las 82 fallas

La ejecución devolvió `The column preciosGrupo does not exist in the current database`. Está presente la migración `database/prisma/migrations/20261105180000_s5_grupos_g_stock/`, pero el esquema utilizado por las pruebas no la reflejaba. `apps/api/test/base-pruebas.ts` cambia el destino a posventa_test.

Revisar primero el procedimiento de preparación. `pnpm db:test-prep` BORRA y recrea posventa_test, aplica migraciones y semillas. No usarlo durante otra ejecución; no confundirlo con la base de desarrollo. No se ejecutó en esta sesión.

### 2. Actualizar fixtures de documentos sin relajar las validaciones nuevas

`apps/api/test/maestros.spec.ts` construye DNI con prefijo PRB; `apps/api/test/s5.spec.ts` usa S5C; `base.spec.ts` tiene valores BD. Hay también pruebas antiguas de ODS. El rechazo de altas deja IDs indefinidos y produce errores 404 posteriores: no contar cada error como una regresión independiente.

Usar documentos sintéticos numéricos de longitud correcta, distintos por prueba; conservar pruebas negativas que sí pretendan verificar entradas inválidas. Comprobar el status de las altas de preparación para que un fallo de fixture no quede oculto. Reejecutar el conjunto completo después.

### 3. La evidencia publicada es de una versión anterior

`docs/requisitos/R82/ejecucion/ejecucion_api_2026-11-05.json` y `secciones/r82_pruebas.tex` dicen 135/135. Actualmente hay 138 pruebas y la ejecución falla. Los 60 CP contienen 29 Pasó y 31 Pendiente de ejecución: ese estado no fue actualizado en esta revisión. Conservar la ejecución histórica y registrar una nueva con hora/versión; no sobrescribir resultados como si hubieran correspondido al mismo código.

`herramientas/r82/gen.py` lee api.json y web.json desde una ruta temporal fija de Claude. `ejecucion.py` fija la fecha 2026-11-05. Antes de regenerar, proporcionar evidencia actual en una ubicación estable y revisar fecha/rutas. El anexo conserva un enlace de Drive pendiente en `r82_anexos.tex`.

### 4. Completar cobertura de las funciones recién añadidas

No se encontraron referencias a inventario/verificar, /ajuste o ajustarStock en las pruebas actuales de API/web. Hay unitarias de CONJUNTO y No aplica, pero eso no prueba el recorrido integrado completo. Priorizar contraseña incorrecta/caducada, permiso insuficiente, local ajeno, ajuste y movimiento, y dos ajustes simultáneos. Para ODS: mantener/aplicar, quitar y volver a agregar, guardar y reabrir, No aplica y conservación del monto al editar.

El controlador de inventario usa una transacción de lectura del stock seguida de actualización, sin aislamiento explícito ni bloqueo visible en ese método. Posible riesgo de dos movimientos calculados desde el mismo saldo: hipótesis por inspección, no fallo reproducido. La auditoría se escribe después de la transacción; revisar comportamiento si falla.

### 5. Precarga: revisar dos diferencias antes de volver a ejecutarla

`quitarPrecargaN` elimina todas las reglas de precio, asignaciones por modelo, familias y solapamientos de la organización cuando detecta grupos N. No limita esas eliminaciones a filas reconocidas como precarga. El comentario de idempotencia no garantiza conservar reglas editadas por el usuario durante esa transición. No se ejecutó ni se corrigió.

En el catálogo hay un servicio externo, X04, al que la semilla asignaría proveedor null por su condición basada en el prefijo Torneria. La API exige proveedor al crear un servicio externo. Revisar esta discrepancia sin asignarle un proveedor arbitrario. Es un hallazgo estático del JSON y la semilla, no un conteo de la BD actual.

### 6. Reconciliar el contexto antiguo sin borrar historia

AGENTS y CLAUDE conservan resúmenes viejos: R81, S3 terminado o incluso sistema inexistente. Manda ESTADO_ACTUAL y las decisiones del investigador. Los archivos generados de agentes deben corregirse desde su fuente y sincronizarse, no editarse a ciegas.

El plan exige specs por slice, pero en specs/ solo se encontró S1-base-del-sistema.md bajo el patrón S*.md. Los S2/S3/S5 tienen código/pruebas y otras referencias; revisar si faltan especificaciones explícitas o si deben enlazarse las existentes. No inventar retrospectivamente que se siguió un proceso no documentado.

`apps/api/src/maestros` y `apps/web/src/maestros` agrupan varios módulos pese a la regla de carpetas planas de AGENTS §19. Es deuda de organización para revisar con calma; no mover ahora mientras las pruebas estén fallando.

RF-005 está marcado Implementado e incluye consulta vehicular RN-10. No se halló la integración de consulta externa en los controladores de clientes/vehículos revisados. Verificar alcance y clasificación antes de afirmar cumplimiento total. La justificación de main.tex todavía menciona planner por sede/técnico/bahía, mientras el plan nuevo deja la agenda técnica en beta; requiere revisión de coherencia académica, no una sustitución automática de palabras.

### 7. Pendientes ya comunicados por el investigador

- Excepción de motores de más de 2.4 L para bujías, cadena y bomba de agua.
- Botón Aplicar después de Montos mantenidos en el prototipo.
- Capturas reales del sistema y aceptación humana. Las imágenes CP generadas desde HTML de evidencia son resúmenes de resultados automáticos; no equivalen a capturas de uso de la aplicación. El LEEME de capturas identifica imágenes del prototipo R7.7.
- Regenerar el anexo y PDF después de estabilizar las pruebas y alinear documentos.
- Cerrar S3 antes de dar por terminado el flujo ODS. Planes, reajustes, línea de tiempo y posventa siguen siendo desarrollo pendiente: son centrales para demostrar el aporte de tesis.

## Cambios menores hechos por Codex

1. README raíz: estado de S3/S5 y carpetas UML vigentes.
2. docs/README: R8.2 como fuente vigente, R81 como histórico.
3. apps/README: explicar que la preparación recrea posventa_test y que puede requerirse tras nuevas migraciones.
4. docs/ESTADO_ACTUAL: aviso de esta ejecución posterior; se conserva el resultado histórico del cuerpo.
5. apps/web/src/maestros/S5.test.tsx: agregar clave sol1:s2 al mock de alerta; coincide con el contrato y elimina el aviso de React, sin cambiar producción.
6. README de contexto Drive: mapa vigente al principio para evitar abrir fuentes obsoletas.
7. Este informe y entrada nueva en el registro compartido.

## Orden sugerido para retomar

1. Leer este informe y el diff actual; hay abundante trabajo previo sin commit que no pertenece a Codex.
2. Preparar únicamente la base de pruebas y corregir fixtures; ejecutar API completa y web, conservar JSON reales.
3. Probar los flujos nuevos y resolver los hallazgos de precarga/inventario antes de cerrar S5.
4. Aplicar el control de impacto del proyecto para alinear requisitos, trazabilidad, diagramas, tesis y anexo; no declarar aceptación humana.
5. Actualizar evidencias, capturas y PDF; después continuar S3 y el orden acordado de slices.

No se solicitó aprobación para cambios de alcance: se dejaron pendientes para Claude conforme al reparto pedido por el investigador. No se validaron precios técnicos con el taller, normativa documental, rendimiento, respaldo, seguridad integral, pantalla en dispositivos reales ni despliegue.
