# Decisiones cerradas (índice trazable)

Índice de lo ya decidido, con su fuente. **El texto completo y vinculante está en el original**: `docs/contexto/FUENTES_R7/DECISIONES_R7.md` (corte 12/10/2026) y `docs/contexto/03_DECISIONES_INICIALES_A_FINALES.md`. Aquí solo se resume para poder citarlas por ID desde las especificaciones.

Tipo de decisión (`03_DECISIONES` §1): **Explícita** (la confirmó el tesista), **Normalizada** (se redactó técnicamente una intención explícita), **Propuesta** (aún recortable; no está aquí). Las decisiones de las capas R7.1 a R7.6 marcadas «confirmar» **no** están aquí: siguen en `DECISIONES_ABIERTAS.md` o se listan abajo como «tomadas en el prototipo».

La columna **RF** muestra los requisitos relacionados según el texto de cada decisión; es una correspondencia del asistente, no una cita de la matriz.

## 1. ODS, tareas y aprobación

| ID | Decisión (R7 #) | RF relacionados |
|---|---|---|
| DEC-01 | La decisión del cliente pertenece a la **ODS completa**: Pendiente, Aprobada o No aprobada (#1) | RF-63 |
| DEC-02 | Solo **agregar un ítem nuevo** revierte Aprobada → Pendiente; editar descripción, cantidad o precio no (#2) | RF-64 |
| DEC-03 | Un **ítem retirado** sale de la ODS activa pero conserva antes/después en bitácora y auditoría; no se borra de la cotización histórica (#3) | RF-65 |
| DEC-04 | Una ODS **No aprobada** puede archivarse sin nota de venta; el diagnóstico cobrado se documenta aparte (#4) | RF-07 |
| DEC-05 | Estados visibles de ODS: **Recepción, En proceso, Entrega, Archivada** (#5) | RF-07 |
| DEC-06 | Tareas: solo **Pendiente, En proceso, Completada**; «Archivada» es una condición separada; Cotizando, Por comprar, Comprado, Entregado, Observado y Por cambiar son etiquetas (#6) | RF-108 |
| DEC-07 | Una **tarea raíz por ODS** y exactamente **dos contenedores**: Servicios y Productos; los ítems son listas de control (#7) | RF-61 |

## 2. Cotización y compras (extensión INC-07 y evolución)

| ID | Decisión | RF |
|---|---|---|
| DEC-08 | El módulo es **Cotización logística** y contiene solo productos (#8) | RF-72 |
| DEC-09 | Todo producto solicitado se vincula a una cotización; varias alternativas por producto (proveedor, marca, costo, margen, venta) (#9) | RF-73 |
| DEC-10 | Borrador editable; tras entregar, una modificación **crea una versión nueva** (#10) | RF-74 |
| DEC-11 | Al cargar una ODS solo entran productos activos **sin cotización** (#11) | RF-72 |
| DEC-12 | Comprobantes de compra **inmutables**; cambios, devoluciones y vínculos erróneos se corrigen con **ajustes** (#12) | RF-75, RF-77 |
| DEC-13 | Cada línea comprada se vincula a un producto de la ODS o crea uno; el **costo queda bloqueado** por la compra (#13) | RF-76 |
| DEC-14 | Evidencias **Compra** y **Entrega**, una foto/archivo por categoría, alcance individual o masivo (#14) | RF-78 |
| DEC-15 | La tarea logística no concluye hasta la **conformidad técnica** de todos los productos; la no conformidad conserva la misma tarea con Observado/Por cambiar (#15) | RF-79 |

## 3. Agenda y horas

| ID | Decisión | RF |
|---|---|---|
| DEC-16 | La **hora de llegada** de la ODS es independiente de los bloques de agenda (#16) | RF-67 |
| DEC-17 | Agenda en **15 min**; H-H en múltiplos de **0,25**; se puede dividir, postergar, extender o reasignar sin alterar la llegada (#17) | RF-66, RF-67 |
| DEC-18 | El total estimado puede distribuirse entre servicios; el esfuerzo real es la suma de segmentos (#18) | RF-66, RF-43 |
| DEC-19 | El jefe de taller **cierra la jornada** por sede y fecha; solo el administrador la reabre con motivo auditado (#19) | RF-68 |
| DEC-20 | **Horas perdidas** = huecos reales sin actividad dentro del horario; no se monetizan (#20) | RF-69 |

## 4. Bitácora, archivo y permisos

| ID | Decisión | RF |
|---|---|---|
| DEC-21 | **Bitácora única por ODS**, compartida por la tarea raíz, Servicios y Productos mediante etiquetas (#21) | RF-62 |
| DEC-22 | La exportación de bitácora prioriza autor, fecha, mensaje, menciones, etiquetas, respuestas y adjuntos; los IDs técnicos solo en el detalle (#22) | RF-62 |
| DEC-23 | Corregir una ODS archivada requiere tarea/autorización administrativa y no la reactiva; continuar el trabajo exige **reapertura auditada** (#23) | RF-28, RF-29, RF-70 |
| DEC-24 | La vista de tarea del técnico **nunca muestra costos, precios ni rentabilidad**; el administrador puede habilitar un enlace separado (#24) | RF-71 |

## 5. Cobros, cajas y bancos (evolución)

| ID | Decisión | RF |
|---|---|---|
| DEC-25 | Todo en **soles** (#25) | — |
| DEC-26 | Una caja por sede y por turno/usuario; Caja chica de administración sin sede fija (#26) | RF-82 |
| DEC-27 | La cajera ve su caja pero **no los saldos bancarios globales**; el administrador sí (#27) | RF-83 |
| DEC-28 | Un abono puede registrarse **antes** de la nota de venta; reduce el saldo, no el total (#28) | RF-80 |
| DEC-29 | Notas de venta **internas, no SUNAT**, en cualquier etapa, opcionales, total cero por garantía (#29) | RF-81 |
| DEC-30 | El reporte operativo usa valores de ODS; el reporte técnico de comisiones usa solo notas de venta (#30) | RF-93 |
| DEC-31 | Las transferencias generan movimiento de origen y de destino y un comprobante con firma del receptor (#31) | RF-84 |

## 6. Exclusiones confirmadas
Inventario/kardex completo, SUNAT y facturación electrónica, contabilidad completa, RR. HH. y planillas, SaaS multiempresa, OBD2, optimización automática de técnicos o bahías, integración bancaria automática. (`DECISIONES_R7` y `03_DECISIONES` §3.)

## 7. Estructura y método
- Alcance en **tres capas**: A núcleo de tesis, B operación ampliada, C exclusiones (`01_RESUMEN_EJECUTIVO` §5).
- Integración inicial por **XLSX exportado de Tuulapp/ToolLab** (vigente desde el 04/10/2026, 20:22); la API deja de ser requisito inicial (`01_RESUMEN` §3).
- **Monolito modular con modelo interno**; el SQL es una propuesta (`03_DECISIONES`, fila «Arquitectura»).
- Distinguir lo explícito, lo normalizado, lo propuesto y lo no afirmado (`03_DECISIONES` §1).
- Reglas del profesor para UML y LaTeX: ver `AGENTS.md`.
- Planes preventivos: no inventar intervalos; separar operaciones periódicas de autónomas; conservar fuente y versión; la primera ODS disponible no es el primer mantenimiento de toda la vida del vehículo (`01_RESUMEN` §2).

## 8. Reglas confirmadas por el tesista para la **demostración** (R5, 11/10/2026)
Límite de validez: no acreditan validación mecánica, aceptación académica ni uso productivo (`docs/DECISIONES_R5_2026-10-11.md`).
- Cada servicio tiene **un solo técnico responsable**; el apoyo va como nota.
- Las H-H se usan para capacidad y productividad; **no multiplican el precio** final.
- Baja de cliente **recuperable**, sin borrar vehículos, ODS ni historia.
- Nota de venta interna e inmutable; su anulación revierte los movimientos y conserva auditoría.
- Una actualización XLSX de ODS se diseña como reemplazo completo y atómico del detalle identificado.
- *(Las reglas de aceite, horario y simultáneos de R5 están en conflicto con otras fuentes: ver `DECISIONES_ABIERTAS.md` OPEN-20, 24 y 25.)*

## 9. Tomadas en el prototipo y pendientes de confirmar
Estas se decidieron al construir R7.2 a R7.6 y los propios documentos las marcan «confirmar». **No son vinculantes**:
- Tarea de compra al aprobar la ODS (no al confirmar la cita); tarea de cotizar con cualquier producto con logístico asignado (R7.2).
- Compras y auditoría sin opción de eliminar; luego R7.4 permitió editar y eliminar compras (R7.3 y R7.4: ver `docs/historial/R7/`).
- Grupos G1 a G8: precargados solo G2 y G3; precios de grupo referenciales (R7.4).
- Las automatizaciones corren mientras el sistema está abierto, por falta de servidor; una tarea de km por ciclo de aceite (R7.4).
- Series B001 y F001 creadas inactivas (R7.4).
- «Finalizar» se abre después de archivar la ODS (R7.5).
- Agendadas se cuentan por fecha de registro; llegadas y convertidas, por fecha de la cita; «Cajera demo 2» si solo hay una (R7.6).

## 10. Delimitación de la primera versión (19/10/2026)
Decididas por el **investigador** en un mensaje de chat del 19/10/2026 (no por el profesor ni por usuarios). Detalle y reglas: `docs/alcance/DELIMITACION_PRIMERA_VERSION_R77.md`; criterios: `specs/R7.7-delimitacion-primera-version.md`. **Modifican** la §6 (exclusiones) en lo indicado.

| ID | Decisión | Efecto |
|---|---|---|
| DEC-32 | El producto es un **software automotriz enfocado en la posventa del taller** (se vende primero así); debe ser funcional para esa área | Orienta todo el alcance |
| DEC-33 | Las **ODS se cargan a diario de forma masiva** (Excel o CSV), crean tareas y activan automatizaciones; por ahora por importación, luego por API | Carga masiva de ODS; contrato de API (`docs/api/CONTRATO_API_R77.md`) |
| DEC-34 | **Lo que no es beta es la primera versión** («todo lo demás va para la tesis») | Menú delimitado |
| DEC-35 | **Módulos beta**: Cajas, Paquetes, Ingreso y Egreso sin comprobante, Flujo de caja, Comparativo, Integraciones, Gemini y API. Van al final del menú y se pueden ocultar todos desde Configuración | No se implementan; no se eliminan del código |
| DEC-36 | **Quitados**: Reglas de precios, Auditoría interna (queda la Bitácora) y Movimientos de cuentas | Fuera del menú |
| DEC-37 | **Sin apertura ni cierre de caja**: la lógica se conserva apagada; el pago indica a qué caja o banco entró el dinero | Modifica RF-55, RF-82 (pasan a beta) |
| DEC-38 | **Bancos simple**: Movimientos, Trasladar a otra cuenta, Ingreso, Egreso (a un proveedor) y Editar; cada persona ve las cuentas de su sede y **todos ven los montos**; el pago de facturas de compra se hace en Egresos | Modifica RF-83 (los saldos ya no se restringen por rol); **precisa la exclusión «conexión bancaria»** (sigue excluida la conciliación) |
| DEC-39 | **Series por sede**: la cajera emite con la serie de su sede | Modifica RF-109 (series ya no por caja) |
| DEC-40 | **Inventario completo en la primera versión** (productos y servicios, almacenes, movimientos y requerimientos, kárdex, marcas, categorías) | **Cierra OPEN-05 (sí) y modifica la exclusión «Inventario/kardex completo» de la §6**; el profesor debe conocerla |
| DEC-41 | **Reportes**: todos con filtro por sede; el de técnicos agrupa por el técnico del servicio; se mantienen posventa, ventas, ítems, operaciones, rentabilidades, IGV y detracciones, técnicos y garantías | Modifica RF-93 |
| DEC-42 | **Métricas**: sin utilización de la capacidad productiva; «Venta de servicios» en lugar de «Ventas de mano de obra»; se conserva la satisfacción y el NPS | Modifica RF-114 |
| DEC-43 | **Encuesta con enlace**: el cliente responde en una página y la respuesta llega al sistema | Nuevo requisito; contrato en `CONTRATO_API_R77.md` §6 |
| DEC-44 | **Cuentas por cobrar y por pagar** muestran solo lo pendiente; el histórico está en Compras y Emitir comprobante | Modifica RF-97 |
| DEC-45 | **Cotización** con el diseño del sistema de referencia (pestañas Cliente y Cotización, agregar ítems, cuadros, lista, observaciones y totales) | Modifica RF-94 |
| DEC-46 | **Configuración** es el centro de todo lo configurable (estados de tarea, automatizaciones, usuarios, carga masiva, inventario, impuestos y APIs); las APIs de consulta las configura solo el superusuario | Reorganiza el menú |
| DEC-47 | **Rol nuevo «Asistente administrativo de finanzas»** (usuario de demostración «finanzas»): ve todas las cuentas y sus montos, trabaja Bancos, cuentas por cobrar y por pagar y ve flujo y reportes; no administra usuarios ni la carga masiva. El Logístico deja de entrar a Bancos | Decidido por el investigador el 19/10/2026; sustituye a la idea de usar el rol Logístico |
| DEC-48 | **Cajas en beta y apagadas, con la lógica conservada** (confirmado el 19/10/2026) | Confirma DEC-37 |
| DEC-49 | **Configuración** tiene los módulos Empresa (nombre comercial único «RMOTRIZ», logo, cuentas y formato de documentos), Gestión del espacio de trabajo (estados de tarea) e Inventario, impuestos y APIs, además de automatizaciones, usuarios y carga masiva | Decidido el 19/10/2026; sustituye los atajos |
| DEC-50 | **Documentos imprimibles en PDF o ticket** (cotización, ODS, nota de venta, requerimientos, movimientos de bancos): lista plana de productos y servicios, con los datos de la empresa y las cuentas bancarias elegidas | Decidido el 19/10/2026 |
| DEC-51 | **Movimientos de inventario = requerimientos** (el requerimiento aprobado produce el movimiento); el origen es opcional y lo asigna el logístico; se asocian facturas de compra; los productos sin código solo se registran como entrega; almacenes con local y dirección | Decidido el 19/10/2026; sustituye «Movimientos y requerimientos» |
| DEC-52 | **Impuesto por ítem** (IGV 18 % o sin impuesto) en cotizaciones, ODS y notas; reporte «Impuesto y detracciones» (referencial; alerta sobre S/ 700) | Decidido el 19/10/2026 |
| DEC-53 | **Metodología:** Scrum + IA-ASE (SDD, agentes de IA y harness) en un solo ciclo iterativo e incremental; se usa Claude Code y **no** ChatGPT | Decidido el 19/10/2026; ver `docs/plan/METODOLOGIA_SCRUM_IA_ASE.md` |
| DEC-54 | **Organización:** `github-proyecto/` (lo que sube a GitHub), `documento-tesis-overleaf/` (main.tex e `imagenes/{diagramas,graficos}`) y Drive (contexto completo); sin fichas de lectura, de deducción ni de especificación en la tesis | Decidido el 19/10/2026 |
| DEC-55 | **Estructura final numerada:** `1_github-proyecto/` y `2_documento-tesis-overleaf/` son copias generadas que no se editan; las fuentes canónicas viven en `3_contexto-drive/fuentes-proyecto/` y `3_contexto-drive/fuentes-latex/`; el contexto original continúa en solo lectura y lo antiguo se conserva en `3_contexto-drive/archivo/` | Decidido y ejecutado por el investigador el 19/10/2026; sustituye las rutas de salida de DEC-54 |
| DEC-56 | **Presentación y archivos visuales:** la tesis publica un único diagrama general vigente de casos de uso (DCU-R77-0001); los diagramas parciales anteriores quedan como respaldo técnico. Las imágenes se archivan por capítulo real, con código y nombre corto: antecedentes (cap. 1), fundamentos (cap. 2), diseño (cap. 4) y validación (cap. 5). Los `.puml` siguen siendo la fuente técnica separada de las PNG publicadas. | Decidido por el investigador el 19/10/2026; evita redundancia y mezcla de estado del arte con diseño propio |
| DEC-57 | **Pila tecnológica aceptada (ADR-001):** React + TypeScript + Vite, NestJS como monolito modular, PostgreSQL con Prisma, OpenAPI, Docker Compose y GitHub Actions; el código vive en GitHub | Decidido el 20/10/2026 por Álvaro Machaca; cierra OPEN-01 y OPEN-03 |
| DEC-58 | **Política de producto:** estándar primero y a medida después. El sistema se entrega estandarizado y se capacita al taller para usarlo como está diseñado; los desarrollos a medida llegan más adelante, según los requisitos de cada empresa, y si varios clientes piden lo mismo se evalúa volverlo función estándar | Decidido el 27/10/2026 por Álvaro Machaca |
| DEC-59 | **Roles con jerarquía y como datos:** Desarrollador (dueño de la plataforma, exclusivo: las empresas no lo ven ni lo asignan) > Superadministrador (TI de cada empresa) > Administrador > Jefe de taller > Cajera, Técnico y Logístico (mismo nivel bajo). Los roles son datos por empresa y el Superadministrador crea roles propios con módulos y niveles; un usuario puede tener varios roles (suma de permisos) y solo gestiona roles de nivel inferior al suyo. El Jefe de taller puede todo lo del Técnico y nada de Cajera ni de Logístico; el Administrador puede todo lo operativo, pero no recibe servicios ni sale en la agenda (la agenda muestra técnicos y jefes de taller). No existen los roles Finanzas ni Externo | Decidido el 27/10/2026; sustituye a los siete roles del prototipo |
| DEC-60 | **Multiempresa preparado, una empresa activa:** los datos de negocio llevan su empresa y cada empresa tiene módulos habilitados. La empresa piloto (Robert Service) tiene todos; a las empresas que arrancan se les habilita lo básico y se les van soltando más módulos según crezcan. El Superadministrador gestiona usuarios, roles, permisos por rol y los nombres visibles de estados y cajas; **no renombra módulos**. La tesis sigue siendo el caso Robert Service con 99 requisitos; el alta de empresas, la edición de permisos desde pantalla y la personalización quedan como hoja de ruta | Decidido el 27/10/2026 |

## 11. Decisiones del 28/10/2026 (revisión del sistema de referencia y correcciones al prototipo)
Decididas por **Álvaro Machaca** tras revisar `reverse-lab/REFERENCIA-SISTEMAS` (solo como referencia; manda el HTML R7.7 y lo que se decide al desarrollar). Cada una indica en qué slice se aplica; el mapa completo y lo pendiente están en `docs/plan/CAMBIOS_POR_SLICE.md`. El texto de lógística y decisión del cliente está en `docs/decisiones/LOGISTICA_Y_DECISION_CLIENTE_28-10-2026.md`. **Aún no pasaron a la tesis** (falta el informe de impacto y su aprobación).

| ID | Decisión | Efecto |
|---|---|---|
| DEC-61 | **Estados y fechas de la ODS:** Recepción, En proceso, Entrega y **Cerrado** (se pueden mover libremente, adelante o atrás). La «fecha de salida» pasa a **fecha de cierre** y se asigna solo al pasar a Cerrado (Entrega no la genera). Se borra solo si la ODS vuelve a otro estado, y antes pide confirmar | Modifica DEC-05; S3 |
| DEC-62 | **Tareas con cuatro estados:** Pendiente, En proceso, Completada y **Archivada**. La fecha de cierre se asigna al pasar a Completada o Archivada, se conserva entre ambas y se borra solo al volver a Pendiente o En proceso (con confirmación). Una tarea archivada lleva la etiqueta «Completada» si sí se completó. El tablero oculta la columna Archivada por defecto, con opción de mostrarla. Cada cambio (estado, nombre, etiquetas, quién) queda como comentario automático. Se pueden borrar tareas vacías, con registro de quién | Modifica DEC-06; S7 |
| DEC-63 | **Vistas del espacio de trabajo:** lista, tablero, calendario y agenda; el nombre de cada vista es editable y solo las distingue el ícono (como ClickUp); hay una vista global por técnico y por empresa | S7 |
| DEC-64 | **Validaciones de tareas:** si la fecha límite es anterior a la de inicio, el inicio se ajusta a la fecha límite; la fecha de creación no se edita. Completar con ítems abiertos avisa: «Completar igual» o «Eliminar» (solo botones, sin motivo) y queda en la bitácora | S7 |
| DEC-65 | **Bitácora:** una sola por tarea de nivel 1; los comentarios de todas sus subtareas (cualquier tipo) llegan a ella con la etiqueta de origen. Las respuestas se agrupan bajo el comentario original (como Telegram), con contador y lista para seguir el hilo. El autor edita su comentario durante **10 minutos** (ajustable por el Superadministrador) y se muestra «(editado)». **No** hay «marcar como resuelto». Las menciones notifican | Precisa DEC-21 y DEC-22; S9 |
| DEC-66 | **Automatizaciones:** cada regla recuerda que ya corrió para una ODS y la segunda vez se omite (queda registrado). Hay historial de ejecuciones (ok, omitida, error). Si una regla forma un bucle, se avisa al crearla; a la tercera vuelta se detiene y **ambas reglas quedan inactivas** hasta activarlas a mano | S10 |
| DEC-67 | **Número de ODS:** año, mes y día de creación + correlativo de la empresa desde `00001`, que crece sin tope (`2026102800001`). Lo genera el servidor sin repetir (gana quien presiona «Crear» primero). Un número eliminado **no se reutiliza**; la eliminación queda auditada (quién y por qué). Las ODS traídas de otro sistema conservan su número con la letra **E** delante y no consumen el correlativo | S3 y S4 |
| DEC-68 | **Carga masiva:** solo ODS con fecha de cierre y cabecera obligatoria. Si el archivo trae solo «fecha», se toma como fecha de inicio y se pregunta si se copia a la fecha de cierre (si no, queda en blanco y se cierran igual). Todas entran en **Cerrado**; solo para Tuulapp, «Finalizado» va a Cerrado y «En proceso» a un estado abierto. Se valida todo antes: si una fila falla **no se carga nada** y se muestra fila, columna y motivo (copiable). Clientes se actualizan por documento y vehículos por placa; un vehículo que llega con otro titular se reasigna | Precisa DEC-33; S4 |
| DEC-69 | **Clientes:** tipo de documento DNI, Carné de extranjería o RUC; el número de documento **no se repite** en la empresa. «Clientes varios» (documento `0000`) permite registrar vehículos sin datos del titular; al conocerlo se traspasa editando el vehículo. Campos: razón social o nombre, nombre comercial, país (con su prefijo; +51 para Perú), móvil sin prefijo, dirección fiscal, correo, ubigeo, comentario y fecha de registro automática no editable. El país predeterminado lo define el Superadministrador. Todo se enlaza por **ID interno**, no por el documento | Modifica RF-004; S2 |
| DEC-70 | **Vehículos:** cliente (se busca por documento o nombre y se ve el enlace), placa, marca, modelo, año, color, nro. de serie, VIN, nro. de motor, comentarios y fecha de registro automática. La placa es texto libre pero se compara sin guiones, espacios ni mayúsculas: si ya existe avisa y muestra al titular. Se puede corregir placa, datos y titular sin perder historial (enlace por ID) y todo queda auditado. Consulta externa de DNI/RUC y de vehículo por API: hoja de ruta | Modifica RF-005; S2 |
| DEC-71 | **ODS por vehículo:** hasta **dos abiertas** (no cerradas) y, como máximo, una de tipo **Garantía** (la otra, de cualquier otro tipo). El técnico y el jefe de taller son opcionales al crearla. Una venta de mostrador puede emitirse sin placa ni ODS | S3 |
| DEC-72 | **Decisión del cliente y logística:** campo aparte con cuatro valores (Pendiente de aprobación, Aprobada para cotizar, Aprobada para comprar, No aprobada); solo una ODS «No aprobada» se cierra sin nota de venta; reglas de reversión, de la tarea de productos y de evidencias en el documento de detalle | Modifica DEC-01, 02, 07, 14 y 29; S3 y segunda ola |
| DEC-73 | **Precios e impuestos:** el precio que se escribe es siempre el **precio de venta final**; con IGV, base = final ÷ 1,18 e IGV = final − base; sin impuesto, la base es el final. Nunca se escribe un «precio sin IGV». El IGV sale del monto final con descuentos incluidos. El comprobante muestra solo el precio final, sin el descuento. Se redondea **cada línea a 2 decimales** y el total es la suma de las líneas (diferencias menores a un céntimo). Se pueden escribir hasta **3 decimales** en precios, costos y porcentajes: se guardan con 3 y se muestran con 2 | Precisa DEC-52; S3 |
| DEC-74 | **Cobro y redondeo:** el cobro sale exacto, sin redondeo automático; la cajera cuadra céntimos bajando o subiendo el monto de un servicio. El recargo por tarjeta es un ítem de servicio «Cobro de comisión por tarjeta». Solo la **detracción** se redondea a soles enteros (desde 0,50 sube). En compras se pueden ajustar céntimos para cuadrar con la factura del proveedor | Segunda ola |
| DEC-75 | **Detracciones:** si un comprobante (boleta o factura) tiene al menos un servicio y supera S/ 700, se avisa que tiene detracción y se recomienda separar servicios y productos; el porcentaje (12 % por defecto) lo configura el Superadministrador. El comprobante muestra solo la detracción redondeada. Al emitir se crea un registro en el reporte de Detracciones (orden, comprobante, %, total exacto y redondeado) y **automáticamente** una cuenta por pagar por el monto redondeado, con botón para ir a ella | Modifica DEC-52 y DEC-44; segunda ola |
| DEC-76 | **Inventario:** el stock puede quedar **negativo**; baja solo al emitir la **nota de venta** (no por cotización ni ODS). Una compra suma stock solo si la línea lleva el **código de referencia propio** (es opcional); costo y precio del producto son referenciales y no se actualizan solos. El kárdex guarda el costo de cada entrada, el precio de cada salida, el usuario y el número de comprobante. **Ajustar stock** exige una contraseña (4 dígitos, `0000` al inicio) que solo define el Superadministrador, sin motivo; queda en el kárdex con usuario, antes y después. Cajera, Técnico y Jefe de taller solo ven | Modifica DEC-40 y DEC-51; segunda ola |
| DEC-77 | **Traslados y almacenes:** el traslado es en dos pasos (sale al crear, entra al aceptar) y solo existe con un **requerimiento** (lo puede hacer el logístico o la cajera); hay movimientos entre sedes y entre almacenes de la misma sede (general y mostrador); lo acepta cualquier usuario de la sede destino. El stock se ve por sede, por almacén o general. Un envase (balde) se fracciona con un egreso y el ingreso de las unidades | Precisa DEC-51; segunda ola |
| DEC-78 | **Log de operaciones:** tabla aparte con quién creó, editó o eliminó y qué cambió, con prioridad en lo que mueve dinero (comprobantes, pagos, abonos, notas, compras) y en las tareas. Lo que haga el superusuario sale siempre como superusuario, aunque use «Ver como» | Precisa DEC-24 y DEC-59; transversal |
| DEC-79 | **Roles:** el Superadministrador puede asignar roles hasta **su mismo nivel** (otro Superadministrador), ver como cualquier rol y editar el tiempo de comentarios, el país, la detracción, la contraseña de inventario y los términos y condiciones. Solo el superusuario define qué módulos y botones tiene el Superadministrador. Se recomienda un solo superusuario. «Ver como» permite editar y queda auditado | Modifica DEC-59; S1 (ajuste) |
| DEC-80 | **Pantalla de ODS:** lista en tarjetas verticales (consecutivo, fechas de inicio y cierre, cliente, vehículo, motivos, comentarios, técnico) con los botones a la derecha: Facturar, Editar encabezado, Estado, Bitácora, Eliminar e Imprimir (PDF, ticket o recepción con términos y condiciones). La etiqueta pasa de «No facturado» a **Sin comprobante** / **Con comprobante** y al hacer clic lista los comprobantes. La edición se abre en un modal con datos del comprobante, la cotización y, al pie, el total y los abonos (solo dentro de la ODS) | Modifica DEC-45 y DEC-50; S3 |

