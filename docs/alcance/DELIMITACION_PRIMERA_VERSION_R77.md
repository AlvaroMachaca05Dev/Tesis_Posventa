# Delimitación de la primera versión (prototipo R7.7)

> **Histórico (31/10/2026).** La delimitación sigue vigente como alcance, pero lo que dice sobre la pila sin decidir y el sistema inexistente quedó atrás: la pila se aceptó el 20/10/2026 y el sistema ya existe. El estado vigente está en `../ESTADO_ACTUAL.md`.


**Estado:** DECIDIDA por el investigador (mensaje de chat del 19/10/2026) y **demostrada en el prototipo R7.7** con datos sintéticos. **No** está aceptada por el profesor, por el experto mecánico ni por usuarios, y **no** es el sistema real (no existe servidor, base de datos operativa ni autenticación). Esta es la fuente para que el investigador delimite con los desarrolladores; lo que los desarrolladores decidan distinto debe registrarse en `docs/decisiones/DECISIONES_CERRADAS.md`.

**Fecha:** 19/10/2026 · **Prototipo:** `prototipo/R_Motriz_R7.7.html` (se reconstruye con `python prototipo/capas/aplicar_r77.py R_Motriz_R7.6.html R_Motriz_R7.7.html`).

## 1. Qué es el producto

Un software **automotriz enfocado en la posventa del taller** (se vende primero así). Debe ser **funcional** y ayudar al área de posventa:

1. Cada día se cargan **órdenes de servicio (ODS)** de forma masiva (Excel o CSV).
2. Cada ODS abierta **crea sus tareas** y activa las **automatizaciones** (consultar kilometraje, confirmar cita, llamar y enviar la encuesta, avisar deuda, comprar lo aprobado…).
3. El taller trabaja las tareas, las citas, las cotizaciones y las notas de venta; mide la posventa con reportes y métricas.

No es un ERP completo: no hay facturación electrónica SUNAT, contabilidad, planillas ni conciliación bancaria (`DECISIONES_CERRADAS.md` §6, con las precisiones de la §10).

## 2. Cómo entran los datos

| Vía | Estado | Detalle |
|---|---|---|
| **Carga masiva de ODS** (Excel `.xlsx` o CSV) | **Primera versión** | Una fila por ítem; las filas con el mismo `codigo_ods` forman una orden. Crea la ODS con sus ítems y, si no existen, el vehículo y el cliente. La ODS abierta crea su tarea de evento y dispara las automatizaciones. Vista previa antes de aplicar; modos *solo agregar*, *agregar y actualizar* y *agregar y completar vacíos*; no borra nada; volver a cargar el mismo archivo no duplica. Plantilla: `prototipo/carga_masiva/09_plantilla_ordenes_de_servicio.xlsx`. |
| Carga masiva de maestros | Primera versión | Clientes, vehículos, productos y servicios, proveedores, stock por local, solapamientos, paquetes, grupos y tarifas (plantillas 02 a 08; precarga de negocio 01). |
| **API de integración** | **Beta (contrato)** | El otro sistema entregaría y recibiría datos por API. Mientras no exista, la vía es la carga masiva. Contrato propuesto: `docs/api/CONTRATO_API_R77.md`. |

## 3. Menú de la primera versión

Seis secciones de trabajo, el resto en **Beta** al final. Todo lo que no es beta es primera versión («todo lo demás va para la tesis», investigador).

| Sección | Módulos | Nivel |
|---|---|---|
| (sueltos) | Órdenes de servicio · Métricas · Espacio de trabajo · Línea temporal | Primera versión |
| Maestros | Clientes · Proveedores · Vehículos · Grupos de vehículos (G1 a G5) · Planes preventivos · Solapamientos de servicios · Marcas de vehículo · **Series de comprobantes (por sede)** | Primera versión |
| Inventario | Productos y servicios · Almacenes (locales) · Movimientos y requerimientos · Kárdex de productos · Marcas de producto · Categorías | Primera versión |
| Ingresos | Cotizaciones · Emitir comprobante (nota de venta) · Cuentas por cobrar | Primera versión |
| Egresos | Compras y comprobantes · Cuentas por pagar | Primera versión |
| Seguimiento | Citas · Bitácora | Primera versión |
| Finanzas | **Bancos** | Primera versión |
| Reportes | Posventa · Ventas generales · Ventas por ítems · Operaciones · Rentabilidades · IGV y detracciones · Técnicos · Garantías (todos con **filtro por sede**) | Primera versión |
| Configuración | Automatizaciones · Usuarios · Configuración · Carga masiva | Primera versión |
| **Beta** (al final del menú) | Cajas (apertura y cierre) · Paquetes de servicios y productos · Ingreso (sin comprobante) · Egreso (sin comprobante) · Flujo de caja · Comparativo (estado de resultados) · Integraciones · Asistente Gemini · API de integración | **Beta** |
| Quitados | Reglas de precios · Auditoría interna (queda la Bitácora) · Movimientos de cuentas | Quitado |

**Beta** significa: visible con la etiqueta «beta», al final del menú, **no se implementa** en la primera versión (queda como demostración, simulado o apagado) y **se puede ocultar** con un interruptor en Configuración («Mostrar los módulos beta en el menú»). Los módulos beta no se eliminaron del código.

Desde **Configuración** se llega a todo lo configurable: estados de tarea (cambiar nombres), automatizaciones, usuarios, carga masiva, inventario (stock negativo, contraseña de ajuste), IGV y detracción, y las APIs de consulta de placa y de DNI/RUC (solo el superusuario).

## 4. Reglas de la delimitación

### 4.1 Bancos y dinero
- No hay **apertura ni cierre de caja**. La lógica se conserva en el código, pero está **apagada** (interruptor en Configuración, beta). El pago solo indica **a qué caja o banco entró el dinero** (los nombres de caja son cuentas: «Banco Efectivo Unión», «Interbank Prohogar»…).
- Cada cuenta de **Bancos** ofrece cinco acciones: **Movimientos** (lista con débito y crédito, recibo de caja y CSV), **Trasladar a otra cuenta** (origen ya elegido; elige el destino), **Ingreso** (cliente opcional, método, valor y concepto), **Egreso** (proveedor obligatorio, valor y concepto de pago) y **Editar**. El **pago de facturas de compra** se hace en Egresos, no en Bancos.
- Cada persona ve **solo las cuentas de su sede**; administración y finanzas ven todas. **Todos los que entran a Bancos ven los montos** (decisión de simplificar). Los selectores de «banco o cuenta» de cobros, pagos y notas de venta también se limitan a la sede.
- Un traslado entre cuentas **no es ingreso ni egreso**: el dinero solo cambia de lugar.

### 4.2 Series por sede
- Las series de comprobantes se asignan a una **sede**. La cajera de esa sede emite **todos** sus comprobantes con la serie de su sede (`N001` Unión, `N002` Prohogar). Ya no se asignan a cajas.

### 4.3 Ventas y cuentas
- **Cuentas por cobrar y por pagar** muestran solo lo **pendiente**; el histórico se ve donde se emiten los comprobantes (Emitir comprobante y Compras).
- **Cotización** con el diseño del sistema de referencia: pestañas Cliente / Cotización; «Cargar ítems desde una orden de servicio»; «Agregar ítems» con búsqueda, precio unitario, descuento %, impuesto y cantidad; cuadros de costos totales, ventas antes de impuestos, ganancias y % de rentabilidad; lista de ítems con rentabilidad editable; observaciones; subtotal, descuentos, base imponible, impuestos y total; pie **SALIR · ATRÁS · EMITIR COTIZACIÓN**.
- La **nota de venta** es interna (no SUNAT). La **detracción** se calcula por ítem (activable) con tasa y monto mínimo configurables (12 % y S/ 700; el monto lo dio el investigador y no está confirmado, ver `DECISIONES_ABIERTAS.md`).

### 4.4 Reportes y métricas
- **Todos los reportes** tienen filtro por **sede**. El reporte de **técnicos** agrupa por el técnico **de cada servicio**, no por el de la orden.
- **Métricas:** se quita la *utilización de la capacidad productiva*; «Ventas de mano de obra» pasa a llamarse **«Venta de servicios»**; se conserva la satisfacción del cliente y el NPS.
- **Encuesta con enlace:** el texto que se envía al cliente lleva un enlace; el cliente abre una página de una sola pantalla, responde las 7 preguntas y la respuesta llega al sistema (alimenta el NPS y las métricas). En el prototipo el enlace es `#encuesta=<ODS>` y se guarda en el mismo navegador; en el sistema real será una página pública con enlace firmado de un solo uso.

### 4.5 Roles y permisos
- Matriz por rol y módulo: `docs/requisitos/MATRIZ_PERMISOS_R77.md` (48 módulos, 7 roles y 17 acciones sensibles; **propuesta**). Roles: Administrador (superusuario), Jefe de taller, Cajera, Técnico, Logístico, Externo y **Asistente administrativo de finanzas** (rol nuevo del 19/10/2026; usuario de demostración «finanzas», DEC-47).
- Bancos lo usan administración, el asistente administrativo de finanzas (ambos ven todas las cuentas y sus montos) y la cajera (solo las cuentas de su sede). El Logístico ya no entra a Bancos. Las APIs y la carga masiva solo las configura el superusuario.
- El inicio de sesión es **provisional** (botones por rol); no hay autenticación real.

## 5. Lo que cambió frente al estado anterior de R7.7

| Antes | Ahora |
|---|---|
| Menú con 11 secciones y módulos mezclados | Núcleo en 9 secciones y **Beta** al final, ocultable |
| Apertura y cierre de caja obligatorios para emitir | Apagados; el pago indica caja o banco |
| Series asignadas a cajas | Series asignadas a una sede |
| Bancos: solo administración, ingreso y egreso sin proveedor, pago a proveedores en la cuenta | Bancos por sede, todos ven montos; Ingreso y Egreso (a proveedor); pago de facturas en Egresos |
| «Movimientos de cuentas» | Quitado (los traslados salen en cada cuenta) |
| Reglas de precios, Auditoría interna | Quitadas |
| Cuentas por cobrar/pagar con «Pendientes / Histórico» | Solo pendientes |
| Cotización con el detalle de la ODS | Cotización con el diseño del sistema de referencia |
| Reportes sin filtro por sede; técnicos por orden | Filtro por sede; técnicos por servicio |
| Métricas con capacidad productiva | Sin capacidad; «Venta de servicios» |
| Encuesta por texto | Encuesta con enlace y página de respuesta |
| Sin carga de ODS | Carga masiva diaria de ODS (Excel/CSV) y contrato de API |
| Estados de tarea, inventario e impuestos en módulos aparte | Atajos desde Configuración |

## 6. Cifras de la delimitación

`docs/requisitos/MAPEO_COMPLETO_R77.md` (generado): 215 requisitos mapeados (RF-01 a RF-117 de R7.6 y RF-118 a RF-215 de R7.7, estos **provisionales**): **191 de primera versión, 14 beta y 3 quitados**; 51 entradas de menú (39 de primera versión, 9 beta, 3 quitadas).

## 7. Evidencia (de hoy, 19/10/2026)

Pruebas Playwright (Chromium) del prototipo con datos sintéticos, ejecutadas con `python` y el Chromium de Playwright sobre `R_Motriz_R7.7.html` reconstruido:

| Prueba | Resultado |
|---|---|
| `e2e77.mjs` (R7.7) | 377 pasan, 0 fallan |
| `e2e77_tablet.mjs` | 6 pasan, 0 fallan |
| `e2e73_sobre_r74.mjs` | 53 pasan, 0 fallan |
| `e2e74_sobre_r76.mjs` | 71 pasan, 0 fallan |
| `e2e75.mjs` | 60 pasan, 0 fallan |
| `e2e76.mjs` | 30 pasan, 0 fallan |
| **Total** | **597 pasan, 0 fallan** |

Estas pruebas comprueban el **prototipo local**; **no** son pruebas del sistema real, ni aceptación de usuarios, ni validación mecánica. La prueba de carga de ODS usa un CSV sintético escrito en la prueba; la de flujo de caja lee, si existe en el equipo del investigador, un Excel real que **no** está en esta carpeta.

## 8. Qué no se probó
- Las **APIs reales** de placa y DNI/RUC (solo simuladas con respuestas de prueba).
- Uso en **tableta** más allá de 6 comprobaciones; uso por usuarios reales.
- La carga masiva con **archivos reales de producción** de ODS (no se tienen en esta carpeta; OPEN-07).
- Permisos **en servidor** (el prototipo solo oculta y bloquea en pantalla).
- El **rendimiento** con el volumen real de órdenes.

## 9. Decisiones y dudas que quedan

1. **Rol de finanzas:** CERRADA el 19/10/2026: es un rol aparte, «Asistente administrativo de finanzas» (DEC-47).
2. **Módulos beta:** por defecto se ven al final; ¿deben estar ocultos de fábrica? Consulta nueva del investigador (19/10/2026): ¿las **series de comprobantes** también pasan a beta (gestión oculta, numeración por sede conservada)? Ver `DECISIONES_ABIERTAS.md` OPEN-39.
3. **Inventario en la primera versión:** contradice la exclusión «Inventario/kardex completo» de `DECISIONES_CERRADAS.md` §6 y cierra OPEN-05; el profesor debe conocerla.
4. **Bancos en la primera versión** (sin conciliación bancaria): precisa OPEN-06.
5. **Todos ven los montos de Bancos:** simplificación del investigador; revisar con el contador y el dueño.
6. **API:** qué sistema la consumirá, quién la aloja y cómo se autentica (`CONTRATO_API_R77.md` §8).
7. **Pila tecnológica y lugar del código** siguen sin decidir (OPEN-01, OPEN-03): no se escribe código de aplicación hasta aceptar `ADR-001`.
8. **Detracción:** confirmar con el contador el monto mínimo (S/ 700) y el riesgo de separar una misma operación en dos notas.
9. **Datos reales:** hay material antiguo con datos reales (INC-E5); no se copió nada a esta carpeta.

## 10. Para los desarrolladores: qué leer y en qué orden

1. Este documento y `docs/requisitos/MAPEO_COMPLETO_R77.md` (qué entra).
2. `specs/R7.7-delimitacion-primera-version.md` (criterios de aceptación Dado/Cuando/Entonces).
3. `docs/api/CONTRATO_API_R77.md` y `prototipo/carga_masiva/09_plantilla_ordenes_de_servicio.xlsx` (entrada de datos).
4. `docs/requisitos/MATRIZ_PERMISOS_R77.md` (roles y módulos).
5. `diagramas/R77_delimitacion/` (casos de uso, módulos, clases, secuencias y estados; **propuesta, no validada por el profesor**).
6. `docs/decisiones/` (decisiones, inconsistencias y el ADR sin aceptar).
7. Abrir `prototipo/R_Motriz_R7.7.html` en el navegador (con `#sinlogin` para omitir el inicio de sesión) y recorrerlo.
