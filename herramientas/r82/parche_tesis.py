# -*- coding: utf-8 -*-
"""Aplica la versión R8.2 a main.tex (bloques y textos puntuales). Falla si no encuentra algo."""
import re
RUTA = 'J:/Mi unidad/Trabajo RSA/Tesis sistema posventa/2_documento-tesis-overleaf/main.tex'
s = open(RUTA, encoding='utf-8').read()

def rep(viejo, nuevo, n=1):
    global s
    assert s.count(viejo) >= 1, f'No encuentro: {viejo[:90]}'
    s = s.replace(viejo, nuevo, n)

def bloque(inicio, fin, nuevo):
    global s
    i = s.index(inicio); j = s.index(fin, i)
    s = s[:i] + nuevo + s[j:]

# --- Preámbulo: listings ---------------------------------------------------
rep(r'\usepackage{pdfpages}', r'''\usepackage{pdfpages}
\usepackage{listings}
\definecolor{codfondo}{RGB}{246,248,250}
\definecolor{codclave}{RGB}{0,92,197}
\definecolor{codtexto}{RGB}{3,106,7}
\definecolor{codcoment}{RGB}{106,115,125}
\lstdefinelanguage{TypeScript}{morekeywords={const,let,await,async,if,throw,new,return,for,of,expect,it,describe,true,false,function,private,import,from,export},sensitive=true,morecomment=[l]{//},morestring=[b]',morestring=[b]",morestring=[b]`}
\lstset{basicstyle=\ttfamily\scriptsize,backgroundcolor=\color{codfondo},keywordstyle=\color{codclave}\bfseries,stringstyle=\color{codtexto},commentstyle=\color{codcoment}\itshape,numbers=left,numberstyle=\tiny\color{codcoment},frame=single,rulecolor=\color{codcoment},breaklines=true,columns=fullflexible,keepspaces=true,showstringspaces=false,captionpos=b,extendedchars=true,inputencoding=utf8,literate={á}{{\'a}}1 {é}{{\'e}}1 {í}{{\'i}}1 {ó}{{\'o}}1 {ú}{{\'u}}1 {ñ}{{\~n}}1 {Á}{{\'A}}1 {É}{{\'E}}1 {Í}{{\'I}}1 {Ó}{{\'O}}1 {Ú}{{\'U}}1 {«}{{\guillemotleft}}1 {»}{{\guillemotright}}1 {…}{{...}}3}
\renewcommand{\lstlistingname}{Código}''')

# --- Capítulo 1 ------------------------------------------------------------
rep('El sistema incluye base propia, carga masiva diaria de órdenes de servicio, planes preventivos, línea temporal, tareas, citas, cotizaciones, notas de venta internas, bancos e inventario. No incluye facturación electrónica.',
    'El sistema incluye base propia, migración inicial de los datos del sistema anterior del taller, planes preventivos, línea temporal, tareas, citas, cotizaciones, notas de venta internas, bancos e inventario. Desde la migración, el taller registra todo en el sistema. No incluye facturación electrónica: mientras tanto, el taller la emite con SUNAT o con un facturador externo.')

bloque(r'\subsection{Viabilidad técnica}', r'\subsection{Viabilidad económica}', r'''\subsection{Viabilidad técnica}
El proyecto es técnicamente viable porque usa tecnologías maduras, gratuitas y conocidas por el desarrollador, y datos que el taller ya tiene. Los clientes, vehículos y órdenes del sistema anterior se migran una sola vez con un procedimiento interno; desde entonces el taller registra todo en el sistema. La arquitectura es una aplicación web modular con base de datos propia, y las consultas de placa y de DNI se hacen por API desde el servidor.

\begin{table}[H]\centering\small\caption{Recursos tecnológicos del proyecto}\begin{tabular}{L{3cm}L{3cm}L{4.2cm}L{4.5cm}}
\toprule Recurso & Disponibilidad & Especificación & Uso en el proyecto\\\midrule
Laptop personal & Disponible & Equipo propio con Windows 10 & Programación, pruebas, documentación y ejecución local.\\
Datos del taller & Disponible de forma parcial & Clientes, vehículos y órdenes del sistema anterior & Migración inicial e historial vehicular.\\
AutoData & Disponible & Árbol de servicios con tiempos y planes de mantenimiento & Tiempos estándar de los servicios y base de los planes.\\
Repositorio y servidor de pruebas & Disponible & GitHub y un servidor con Docker Compose & Control de versiones y despliegue de pruebas.\\
APIs de consulta & Viables & Consulta vehicular por placa y de DNI & Completar datos y evitar errores al escribirlos.\\
\bottomrule\end{tabular}\end{table}

\begin{table}[H]\centering\small\caption{Software utilizado}\begin{tabular}{L{3.4cm}L{3.2cm}L{7.6cm}}
\toprule Software & Versión & Uso\\\midrule
Node.js y pnpm & 22 y 9 & Entorno de ejecución y gestor del monorepo.\\
TypeScript & 5.6 & Lenguaje de la API y de la interfaz.\\
NestJS & 10 & API modular del servidor.\\
React y Vite & 18 y 5 & Interfaz web.\\
PostgreSQL y Prisma & 18 y 5.22 & Base de datos, esquema y migraciones.\\
Jest, Supertest, Vitest y Playwright & 30, 7, 2 y 1 & Pruebas automáticas de API, interfaz y prototipo.\\
PlantUML y LaTeX & — & Diagramas UML y documento de tesis.\\
Claude Code & — & Agente de IA que construye bajo especificación y revisión (IA-ASE).\\
\bottomrule\end{tabular}\end{table}

\begin{table}[H]\centering\small\caption{Capacidades del desarrollador}\begin{tabular}{L{4.2cm}L{2.4cm}L{7.6cm}}
\toprule Capacidad & Nivel & Evidencia\\\midrule
Desarrollo web con TypeScript & Intermedio & Slices S1 a S3 del sistema real construidos y probados.\\
Bases de datos relacionales & Intermedio & Esquema con integridad, transacciones y pruebas sobre PostgreSQL.\\
Pruebas automáticas & Intermedio & 158 pruebas automáticas que pasan en la API y la interfaz.\\
Conocimiento del negocio & Alto & Trabajo en Robert Service y acceso a su operación y sus datos.\\
Uso de agentes de IA & Intermedio & Metodología Scrum e IA-ASE con revisión humana de cada cambio.\\
\bottomrule\end{tabular}\end{table}

\begin{table}[H]\centering\small\caption{Riesgos técnicos}\begin{tabular}{L{4.2cm}L{1.7cm}L{1.6cm}L{6.7cm}}
\toprule Riesgo & Probabilidad & Impacto & Mitigación\\\midrule
Datos históricos incompletos o duplicados & Alta & Alto & Limpieza y normalización en la migración; revisión del jefe técnico.\\
Reglas de mantenimiento sin validar & Media & Alto & Validación con el experto técnico antes de activar los intervalos.\\
Tiempo insuficiente para todos los slices & Media & Medio & Priorizar el núcleo (ODS, planes, reajuste, citas y posventa) y dejar el resto en beta.\\
Cambios de alcance durante el desarrollo & Alta & Medio & Registro de decisiones y matriz de trazabilidad actualizada en cada cambio.\\
Errores introducidos por la IA & Media & Medio & Pruebas automáticas como harness y revisión humana antes de aceptar.\\
Caída de las APIs de consulta & Baja & Bajo & El registro manual sigue disponible.\\
\bottomrule\end{tabular}\end{table}

''')
rep('La implementación se concentrará en prototipo web, carga de datos, planner básico y recordatorios mediante enlaces.',
    'La implementación se concentra en el sistema web, la migración inicial de datos, las citas y la posventa con recordatorios mediante enlaces.')
rep(r'Servicios & Consumo de API o IA de apoyo & Global & S/ 120 & S/ 120.00 & Uso controlado para análisis preliminar, no como núcleo del sistema.\\',
    r'Servicios & Consumo de APIs de consulta y de IA de apoyo & Global & S/ 120 & S/ 120.00 & Consulta vehicular y de DNI, y agente de IA para el desarrollo.\\')
rep('El proyecto es viable porque no intenta reemplazar el ERP ni desarrollar todos los procesos del taller. Se enfoca en consumir o importar datos mínimos,',
    'El proyecto es viable porque no intenta desarrollar todos los procesos del taller. Se enfoca en migrar los datos mínimos,')
rep('[Mitigación] Para reducir este riesgo, se diseñará un importador flexible para archivos Excel o CSV, y la arquitectura quedará preparada para conectarse por API cuando el acceso esté disponible.',
    '[Mitigación] Para reducir este riesgo, los datos del sistema anterior se migran una sola vez con un procedimiento interno que los limpia y normaliza; desde entonces el taller registra todo en el sistema y ya no depende del ERP.')

# --- Capítulo 3 ------------------------------------------------------------
rep('Mi primer hito es el recorrido mínimo: orden de servicio (ODS), importación, plan, reajuste y seguimiento;',
    'Mi primer hito es el recorrido mínimo: orden de servicio (ODS), migración inicial, plan, reajuste y seguimiento;')
rep('Su núcleo es el manejo de clientes, vehículos y ODS, que cargo cada día de forma masiva desde Excel o CSV, junto con los planes de mantenimiento, la línea de tiempo, las tareas, las citas y la agenda técnica.',
    'Su núcleo es el manejo de clientes, vehículos y ODS, que migro una sola vez desde el sistema anterior y desde entonces se registran en el sistema, junto con los planes de mantenimiento, la línea de tiempo, las tareas y las citas.')
rep(r'Primera versión & ODS, métricas, espacio de trabajo y línea temporal; clientes, proveedores, vehículos, grupos de vehículos, planes preventivos, solapamientos de servicios, marcas y series de comprobantes por sede; productos y servicios, almacenes, requerimientos, kárdex y categorías; cotizaciones, notas de venta y cuentas por cobrar; compras y cuentas por pagar; citas y bitácora; bancos por sede; reportes con filtro por sede; automatizaciones, usuarios, configuración y carga masiva. & Tienen requisitos funcionales, diagramas y trazabilidad. Hoy se demuestran en el prototipo.\\',
    r'Primera versión & ODS, métricas, espacio de trabajo con vistas de lista, tablero y calendario, y línea temporal; clientes, proveedores, vehículos, grupos de vehículos, precios por grupo, planes preventivos, solapamientos de servicios y marcas; productos y servicios, almacenes, requerimientos, kárdex y categorías; cotizaciones, notas de venta y cuentas por cobrar; compras y cuentas por pagar; citas y bitácora; bancos por sede; reportes con filtro por sede; usuarios y configuración. & Tienen 49 requisitos funcionales, diagramas y trazabilidad.\\')
rep(r'Beta & Cajas con apertura y cierre, paquetes de servicios y productos, ingreso y egreso sin comprobante, flujo de caja, comparativo, integraciones, asistente Gemini y API de integración. & Van al final del menú con la etiqueta beta, se pueden ocultar y no se implementan en esta versión. No tienen requisitos funcionales.\\',
    r'Beta & Agenda de técnicos con capacidad, jornada fina del técnico, logística de productos, decisión del cliente, conversión de citas, cajas con apertura y cierre, paquetes de servicios y productos, ingreso y egreso sin comprobante, flujo de caja, comparativo, integraciones, asistente Gemini y API de integración. & Van al final del menú con la etiqueta beta, se pueden ocultar y no se implementan en esta versión. No tienen requisitos funcionales.\\')
rep(r'Quitados & Reglas de precios, auditoría interna (queda la bitácora) y movimientos de cuentas. & No se aplican.\\',
    r'Quitados & Carga masiva diaria desde Excel (la reemplaza la migración inicial interna), configuración de automatizaciones en pantalla (quedan como reglas fijas del servidor), auditoría interna (queda la bitácora) y movimientos de cuentas. & No se aplican.\\')
rep(r'Facturación electrónica, contabilidad, planillas,', r'Facturación electrónica (hoy con SUNAT o un facturador externo), reporte de impuestos, generación de planes con IA, contabilidad, planillas,')
rep('Construir las órdenes de servicio, la importación atómica y el historial por vehículo.', 'Construir las órdenes de servicio, la migración inicial y el historial por vehículo.')
rep('La importación valida el lote completo antes de aplicar y no duplica registros.', 'La migración no duplica registros y conserva el origen de cada fila.')
rep('Construir las tareas, las citas, la agenda técnica y el seguimiento de posventa.', 'Construir las tareas con sus vistas, las citas y el seguimiento de posventa.')
rep('Una cita genera una sola ODS; no hay empalmes; el seguimiento se programa a los cinco días hábiles.', 'La cita atendida crea su ODS con un clic; el seguimiento se programa a los cinco días hábiles.')
rep(r'\section{Técnicas e instrumentos de recolección de datos}', r'''\input{secciones/r82_slices}

\section{Técnicas e instrumentos de recolección de datos}''')

bloque(r'\section{Reglas de negocio principales}', r'\section{Evolución por versión}', r'''\section{Reglas de negocio principales}
Las reglas de negocio que el sistema aplica por sí solo se listan en el Cuadro~\ref{tab:rn-r82}, junto a los requisitos funcionales. Desde la versión R8.2 las automatizaciones dejaron de configurarse en pantalla y quedaron como reglas fijas del servidor.

''')
rep(r'''R8.1 & Revisé la lista de requisitos y sumé tres que faltaban: seguimiento de posventa, reporte de posventa e impuestos y detracciones. Actualicé las dos matrices de trazabilidad. & Los 99 requisitos corresponden solo a los módulos de primera versión.\\''',
    r'''R8.1 & Revisé la lista de requisitos y sumé tres que faltaban: seguimiento de posventa, reporte de posventa e impuestos y detracciones. Actualicé las dos matrices de trazabilidad. & Los 99 requisitos corresponden solo a los módulos de primera versión.\\
R8.2 & El 5 de noviembre de 2026 reduje los requisitos de 99 a 49: uní los que eran detalle de otro, pasé 26 a segunda versión, convertí las automatizaciones en reglas del servidor y cambié la carga masiva diaria por una migración inicial. Agregué grupos de vehículos, precios por grupo, solapamiento de servicios y sugerencia de planes. Rediseñé las citas como módulo aparte, con vistas de lista, tablero y calendario. Sumé historias de usuario, casos de uso, requisitos no funcionales, plan de pruebas y anexo editable. & Los códigos no cambian hasta el cierre; entonces se renumeran una vez con tabla de equivalencias. La regla de cierre sin nota de venta (RN-06) reemplaza a la anterior y su prueba debe actualizarse.\\''')
rep('Me falta definir la regla de cambio de aceite, que debe validar el experto técnico, el calendario de feriados, los permisos finales por rol y la definición de conversión de una cita en servicio.',
    'Me falta definir la regla de cambio de aceite, que debe validar el experto técnico, el calendario de feriados, el grupo estándar para los precios y los permisos finales por rol. La conversión de citas quedó resuelta de forma simple: una cita convertida es la que creó su ODS desde el botón de la cita.')

bloque(r'\section{Requisitos funcionales finales}', r'\section{Diseño de la solución}', r'''\input{secciones/r82_requisitos}
\input{secciones/r82_hu_cu}

''')

# --- Diseño ----------------------------------------------------------------
rep('Propongo un monorepo TypeScript con React y Vite en la interfaz, NestJS como monolito modular en la API y PostgreSQL como base de datos; tomaré la decisión tecnológica final cuando acepte la decisión de arquitectura. Las ODS, los clientes y los vehículos entran desde archivos Excel o CSV. Cada fila conserva su origen, actualizo por identificador externo y no por posición, y valido el lote completo antes de aplicarlo.',
    'El sistema es un monorepo TypeScript con React y Vite en la interfaz, NestJS como monolito modular en la API y PostgreSQL como base de datos, decisión que acepté el 20 de octubre de 2026. Los clientes, vehículos y ODS del sistema anterior entran una sola vez con la migración inicial (RN-11): cada fila conserva su origen, no se duplica nada y la carga es atómica. Desde entonces todo se registra en el sistema.')
rep('La lista, el tablero y el calendario son vistas de la misma tarea; al llegar el vehículo, la cita se convierte en una ODS en recepción, y la ocupación del técnico se calcula sin contar dos veces los trabajos que se cruzan.',
    'La lista, el tablero y el calendario son vistas de las mismas tareas y citas; cada persona puede crear sus vistas y guardar sus filtros. Cuando el cliente llega, la cajera marca la cita como Atendida y el sistema ofrece crear la ODS con su encabezado y su cotización. El precio de cada servicio sale del grupo del vehículo (RN-09) y su tiempo, de AutoData.')
rep(r'facturacion/ & Reservada para la facturación electrónica.\\', r'facturacion/ & Reservada para la facturación electrónica de una versión futura.\\')

TABLA_TEC = r'''

\begin{table}[H]\centering\small\caption{Tecnologías por capa}\label{tab:tecnologias-r82}\begin{tabular}{L{2.8cm}L{3.8cm}L{7.6cm}}\toprule
Capa & Tecnología & Motivo\\\midrule
Interfaz & React 18, Vite 5 y TypeScript & Componentes reutilizables (tabla con filtros por columna y modal de dos columnas) y recarga rápida en desarrollo.\\
API & NestJS 10 & Módulos, controladores y guardias de permisos en el servidor.\\
Datos & PostgreSQL 18 y Prisma 5.22 & Integridad referencial, transacciones, decimales exactos y migraciones versionadas.\\
Pruebas & Jest, Supertest, Vitest, Testing Library y Playwright & Pruebas de API con base real, de interfaz y del prototipo.\\
Despliegue & Docker Compose & Base, API e interfaz levantadas igual en cualquier servidor.\\
Diagramas y documento & PlantUML y LaTeX & Diagramas como texto versionado y tesis compilada desde los mismos datos del anexo.\\\bottomrule
\end{tabular}\end{table}
'''
rep(r'database/prisma/ & Esquema único de la base de datos y sus migraciones.\\\bottomrule' + '\n' + r'\end{tabular}\end{table}',
    r'database/prisma/ & Esquema único de la base de datos y sus migraciones.\\\bottomrule' + '\n' + r'\end{tabular}\end{table}' + TABLA_TEC)

def fig(nombre, cap, ancho=False):
    cod = nombre.split('_')[0]
    if ancho:
        return r'\begin{landscape}\begin{figure}[H]\centering\includegraphics[width=.97\textwidth,height=.78\textheight,keepaspectratio]{imagenes/capitulo_04_diseno/diagramas/' + nombre + r'.png}\caption{' + cap + ' (' + cod + r')}\label{fig:' + cod + r'}\end{figure}\end{landscape}'
    return r'\clearpage\begin{figure}[H]\centering\includegraphics[width=.97\textwidth,height=.82\textheight,keepaspectratio]{imagenes/capitulo_04_diseno/diagramas/' + nombre + r'.png}\caption{' + cap + ' (' + cod + r')}\label{fig:' + cod + r'}\end{figure}'
FIGS = [
 ('DAS-R81-0001_arquitectura_logica_y_pila', 'Arquitectura lógica y pila tecnológica', True),
 ('DAF-R81-0001_despliegue', 'Despliegue propuesto (Docker Compose)', False),
 ('DCM-R81-0001_modulos_primera_version_y_beta', 'Módulos de la primera versión y módulos beta', True),
 ('DCU-R81-0001_casos_de_uso_taller', 'Casos de uso del taller (núcleo)', False),
 ('DCU-R81-0002_casos_de_uso_comercial_e_inventario', 'Casos de uso comerciales, de inventario y de finanzas', False),
 ('DCL-R81-0001_clases_nucleo_clientes_vehiculos_ods', 'Clases del núcleo: identidad, maestros y órdenes de servicio', False),
 ('DCL-R82-0008_clases_grupos_precios_y_solapamiento', 'Clases de grupos de vehículos, precios por grupo y solapamiento', True),
 ('DCL-R81-0003_clases_planes_y_reajuste', 'Clases de planes preventivos, línea de tiempo y reajuste', True),
 ('DCL-R82-0004_clases_tareas_citas_vistas_y_bitacora', 'Clases de tareas, citas, vistas y bitácora', False),
 ('DCL-R81-0005_clases_comercial_y_bancos', 'Clases de cotización, nota de venta, cuentas y bancos', True),
 ('DCL-R81-0006_clases_logistica_inventario_y_empresa', 'Clases de compras, requerimientos, inventario y empresa', False),
 ('DCL-R81-0007_clases_automatizaciones_km_encuesta_y_reportes', 'Clases de reglas automáticas, consulta de kilometraje, encuesta y reportes', True),
 ('DMD-R81-0001_datos_nucleo', 'Modelo de datos del núcleo: identidad, maestros, órdenes y bitácora', False),
 ('DMD-R81-0002_datos_planes_tareas_citas_e_importacion', 'Modelo de datos de planes, tareas y citas', False),
 ('DMD-R81-0003_datos_comercial_y_bancos', 'Modelo de datos comercial, de cuentas y de bancos', False),
 ('DMD-R81-0004_datos_logistica_inventario_y_automatizaciones', 'Modelo de datos de inventario y reglas automáticas', True),
 ('DSE-R82-0002_secuencia_cita_a_ods', 'Cita, cotización y creación de la ODS', False),
 ('DSE-R81-0003_secuencia_cierre_reajuste_posventa_y_encuesta', 'Cierre de ODS, reajuste del plan, consulta de km, seguimiento y encuesta', True),
 ('DSE-R81-0004_secuencia_cotizacion_nota_pago_y_bancos', 'Cotización, nota de venta, pago y movimientos de bancos', True),
 ('DSE-R81-0005_secuencia_logistica_y_requerimientos', 'Productos de una ODS y requerimiento de inventario', True),
 ('DSE-R81-0006_secuencia_reportes_y_metricas', 'Reportes operativos y métricas mensuales', True),
 ('DES-R81-0001_estados_ods_y_tarea', 'Estados de la ODS y de la tarea', False),
 ('DES-R82-0002_estados_cita_y_cotizacion', 'Estados de la cita y de la cotización', False),
 ('DES-R81-0003_estados_producto_y_requerimiento', 'Estados del producto y del requerimiento de inventario', False),
 ('DAC-R82-0001_actividad_propuesta_y_sugerencia_de_plan', 'Propuesta de plan y sugerencia a vehículos sin plan', False),
 ('DAC-R82-0004_actividad_recepcion', 'Proceso de recepción', False),
 ('DAC-R82-0005_actividad_en_proceso', 'Proceso de trabajo en el taller: En proceso', False),
 ('DAC-R82-0006_actividad_entrega_y_cierre', 'Proceso de entrega y cierre', False),
 ('DAC-R82-0007_actividad_cierre_reapertura_y_correccion', 'Cierre, reapertura y corrección de una ODS', False),
 ('DAC-R81-0002_actividad_correccion_de_ods_y_posventa', 'Seguimiento de posventa después del cierre', False),
]
bloque(r'\section{Diagramas de diseño}', r'\section{Implementación}', r'''\section{Diagramas de diseño}\label{sec:diagramas-r78}
Presento los diagramas que describen el diseño del sistema. Cada uno cubre un bloque de requisitos y se cita por su código en la matriz de trazabilidad. Los diagramas de actividad de recepción, proceso, entrega y cierre, y de cierre, reapertura y corrección usan carriles (swimlanes) para mostrar qué hace cada actor y qué hace el sistema por sí solo. Los diagramas de la carga masiva diaria y de la logística de productos quedaron fuera porque esas funciones pasaron a la migración interna y a la segunda versión.

''' + '\n'.join(fig(n, c, a) for n, c, a in FIGS) + '\n\n')

bloque(r'\section{Implementación}', r'\clearpage\section{Prototipo y estado de validación}', r'''\section{Implementación}
El sistema real está construido como un monorepo TypeScript: la API en NestJS, la interfaz en React y la base en PostgreSQL con Prisma. Cada módulo tiene su carpeta en la API y en la interfaz, con su controlador, sus pantallas y sus pruebas. Muestro dos fragmentos reales del código, tal como están en el repositorio.

El primero aplica la regla RN-07: antes de crear una ODS, bloquea el vehículo dentro de la transacción y revisa sus órdenes abiertas. Un vehículo puede tener dos ODS abiertas solo si la segunda es de garantía, y nunca dos de garantía. El bloqueo evita que dos peticiones simultáneas dejen tres órdenes abiertas.

\begin{lstlisting}[language=TypeScript,firstnumber=133,caption={Límite de ODS abiertas por vehículo (ordenServicio.controller.ts)}]
private async limiteVehiculo(vehiculoId: string, tipoAtencion: string, exceptoId?: string, db = this.prisma) {
  if (db !== this.prisma) await db.$queryRaw`SELECT id FROM "Vehiculo" WHERE id = ${vehiculoId} FOR UPDATE`;
  const abiertas = await db.ordenServicio.findMany({ where: { vehiculoId, eliminada: false, estado: { not: 'Cerrada' } } });
  if (tipoAtencion === 'Garantía' && abiertas.some((o) => o.tipoAtencion === 'Garantía')) {
    throw new ConflictException('Ya existe una orden de servicio de tipo Garantía abierta para este vehículo.');
  }
  if (abiertas.length >= 2) throw new ConflictException('El vehículo ya tiene dos órdenes de servicio abiertas.');
  if (abiertas.length === 1 && tipoAtencion !== 'Garantía' && abiertas[0].tipoAtencion !== 'Garantía') {
    throw new ConflictException(`El vehículo ya tiene abierta la ODS ${abiertas[0].codigo}.`);
  }
}
\end{lstlisting}

El segundo valida las fotos de ingreso (RF-015): solo se aceptan imágenes, son opcionales y hay un máximo de cinco por ODS.

\begin{lstlisting}[language=TypeScript,caption={Validación de las fotos de ingreso (ordenServicio.controller.ts)}]
const EVIDENCIA_MAX_POR_ODS = 5;
if (!f) throw new BadRequestException('Adjunta una foto.');
if (!/^image\//.test(f.mimetype)) throw new BadRequestException('Solo se aceptan fotos.');
if (cantidad >= EVIDENCIA_MAX_POR_ODS)
  throw new ConflictException(`La ODS ya tiene ${EVIDENCIA_MAX_POR_ODS} fotos (máximo).`);
\end{lstlisting}

''')

rep('Construí un prototipo web en HTML que reproduce el recorrido de la posventa del taller: la carga diaria de las ODS, las tareas, las citas,',
    'Construí un prototipo web en HTML que reproduce el recorrido de la posventa del taller: las ODS, las tareas, las citas,')
rep('y las órdenes de servicio: creación con número propio, edición en una sola pantalla, ítems de servicio y de producto, estados y cierre (RF-011 a RF-014, RF-016 y RF-017).',
    'y las órdenes de servicio: creación con número propio, edición en una sola pantalla, ítems de servicio y de producto, fotos de ingreso, abonos, estados y cierre (RF-011, RF-015, RF-016 y RF-089).')
for viejo in [
    r'\begin{figure}[H]\centering\includegraphics[width=0.94\textwidth,height=0.42\textheight,keepaspectratio]{imagenes/capitulo_05_validacion/capturas/CAP-R77-06_agenda_tecnicos.png}\caption{Agenda de técnicos}\end{figure}' + '\n',
    r'\begin{figure}[H]\centering\includegraphics[width=0.94\textwidth,height=0.42\textheight,keepaspectratio]{imagenes/capitulo_05_validacion/capturas/CAP-R77-08_automatizaciones.png}\caption{Automatizaciones con reglas Cuando, Y si, Entonces}\end{figure}' + '\n',
    r'\begin{figure}[H]\centering\includegraphics[width=0.94\textwidth,height=0.42\textheight,keepaspectratio]{imagenes/capitulo_05_validacion/capturas/CAP-R77-09_editor_de_regla.png}\caption{Editor de una regla de automatización}\end{figure}' + '\n',
    r'\begin{figure}[H]\centering\includegraphics[width=0.94\textwidth,height=0.42\textheight,keepaspectratio]{imagenes/capitulo_05_validacion/capturas/CAP-R77-33_carga_masiva_de_ods.png}\caption{Carga masiva de ODS con vista previa antes de aplicar}\end{figure}' + '\n',
    r'\begin{figure}[H]\centering\includegraphics[width=0.94\textwidth,height=0.42\textheight,keepaspectratio]{imagenes/capitulo_05_validacion/capturas/CAP-R77-39_inicio_finanzas.png}\caption{Rol de finanzas: bancos y pagos}\end{figure}' + '\n']:
    rep(viejo, '')
rep('Las pruebas no funcionales de carga, rendimiento y seguridad las dejo para el sistema con servidor, porque el prototipo guarda sus datos en el navegador.',
    'En el sistema real sumo pruebas de integración de la API con su base de datos, pruebas de la base y pruebas de la interfaz, descritas en el plan de pruebas (sección~\\ref{sec:plan-pruebas-r82}). Las de rendimiento, compatibilidad y respaldo quedan para el entorno de pruebas en internet.')
rep(r'Carga diaria de órdenes & Órdenes cargadas desde Excel o CSV sin duplicados ni pérdidas. & Sin duplicados\\',
    r'Migración inicial & Clientes, vehículos y órdenes migrados del sistema anterior sin duplicados ni pérdidas. & Sin duplicados\\')

bloque(r'\clearpage\section{Matriz de trazabilidad}', r'\clearpage\section{Resumen de las pruebas realizadas}', r'''\input{secciones/r82_trazabilidad}
\input{secciones/r82_pruebas}
''')
rep('Hasta el 30 de octubre de 2026 ejecuté cinco tipos de pruebas sobre lo implementado (RF-001 a RF-007 y RF-011 a RF-017). Todas pasan. Cada cuadro resume un tipo.',
    'El 5 de noviembre de 2026 ejecuté de nuevo los cinco tipos de pruebas sobre lo implementado (slices S1 a S3). Todas pasan. Cada cuadro resume un tipo por archivo de prueba.')
rep(r'\chapter*{Conclusiones}', r'''\input{secciones/r82_evidencia}

\chapter*{Conclusiones}''')
rep('Diseñé un sistema web de posventa para Robert Service Automotriz que parte de la carga diaria de órdenes de servicio y las convierte en tareas, citas, planes de mantenimiento con reajuste y seguimiento al cliente. Definí 99 requisitos funcionales para la primera versión y los vinculé con los diagramas, el modelo de datos, el prototipo y las pruebas mediante dos matrices de trazabilidad. Los módulos beta, los quitados y los que dejo para el futuro no forman parte de esa versión.',
    'Diseñé un sistema web de posventa para Robert Service Automotriz que parte del historial migrado y de las órdenes de servicio que se registran día a día, y los convierte en tareas, citas, planes de mantenimiento con reajuste y seguimiento al cliente. En la versión R8.2 reduje los requisitos funcionales de 99 a 49, separé 18 reglas de negocio y 12 requisitos no funcionales, y los vinculé con historias de usuario, casos de uso, diagramas, modelo de datos, código y 58 casos de prueba mediante dos matrices de trazabilidad y un anexo editable. Lo que pasó a segunda versión queda resumido como soluciones futuras.')
rep('El prototipo local con datos sintéticos superó las pruebas automáticas, lo que acredita su comportamiento pero no su aceptación por el taller. Todavía no existen el servidor, la base de datos ni los usuarios reales. Quedan pendientes la validación con el administrador y el personal del taller, la confirmación de las reglas de mantenimiento con el experto técnico y las decisiones abiertas sobre el cambio de aceite, la definición de conversión de una cita y el monto mínimo de detracción. Además, incluir el inventario en la primera versión modifica una exclusión anterior que debo informar al profesor.',
    'El sistema real ya tiene servidor, base de datos y los slices S1 a S3, que pasan 158 pruebas automáticas; eso acredita su comportamiento, pero no su aceptación por el taller. Quedan pendientes los slices S4 a S14, la validación con el administrador y el personal del taller, la confirmación de las reglas de mantenimiento con el experto técnico y las decisiones abiertas sobre el cambio de aceite, el grupo estándar de precios y el monto mínimo de detracción. Además, incluir el inventario en la primera versión modifica una exclusión anterior que debo informar al profesor.')
rep(r'\end{document}', r'''\input{secciones/r82_anexos}

\end{document}''')

open(RUTA, 'w', encoding='utf-8', newline='\n').write(s)
print('main.tex actualizado', len(s))
