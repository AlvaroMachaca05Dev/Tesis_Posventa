# -*- coding: utf-8 -*-
"""Datos maestros R8.2 (05/11/2026): requisitos, reglas, RNF, HU, CU, casos de prueba y trazabilidad.
Fuente única: de aquí salen el Excel del anexo, los CSV del repositorio y las tablas LaTeX."""
import csv

FECHA = '05/11/2026'
AUTOR = 'Álvaro Machaca'
VERSION = 'R8.2'

# ---------------------------------------------------------------------------
# Nombres originales (R81) de los 99 requisitos
# ---------------------------------------------------------------------------
def leer_r81(ruta_csv, extra):
    r = {}
    with open(ruta_csv, encoding='utf-8-sig') as f:
        for fila in csv.DictReader(f):
            r[fila['RF']] = fila['Requisito']
    r.update(extra)
    return r

EXTRA_R81 = {
    'RF-097': 'El sistema permite programar el seguimiento de posventa a los cinco días hábiles del cierre de la ODS y registrar su resultado.',
    'RF-098': 'El sistema permite consultar el reporte de posventa con citas agendadas, citas atendidas, citas convertidas en ODS y tareas completadas por usuario.',
    'RF-099': 'El sistema permite asignar a cada ítem su tipo de IGV (gravado con 18 %, exonerado o inafecto), calcular la detracción y consultar un reporte referencial de impuestos y detracciones con alerta sobre el monto mínimo configurable.',
}

# ---------------------------------------------------------------------------
# Requisitos que quedan (49): código, módulo, nombre corto, texto R82, actor, importancia, estado
# CA: lista de (texto, origen)
# ---------------------------------------------------------------------------
M_ACC, M_MAE, M_CAT, M_ODS, M_PLA, M_TAR, M_CIT, M_BIT, M_COM, M_INV, M_POS, M_REP, M_CFG = (
    'Acceso, usuarios y roles', 'Clientes y vehículos', 'Maestros de servicios, productos y proveedores',
    'Órdenes de servicio', 'Planes y línea de tiempo', 'Tareas y vistas', 'Citas', 'Bitácora y auditoría',
    'Comercial y finanzas', 'Compras e inventario', 'Posventa', 'Reportes y métricas', 'Configuración')

RF = [
 # código, módulo, nombre, texto, actor, importancia, estado, [CA (texto, origen)], fuente
 ('RF-001', M_ACC, 'Iniciar sesión', 'El sistema permite autenticar al usuario con su correo y contraseña antes de acceder a la información operativa.', 'Todos los usuarios', 'Alta', 'Implementado',
  [('Con credenciales válidas entra y recibe su sesión con sus roles.', 'RF-001'), ('Con contraseña incorrecta, usuario inexistente o desactivado responde «no autorizado».', 'RF-001')]),
 ('RF-002', M_ACC, 'Permisos por rol, módulo y local', 'El sistema permite aplicar permisos por rol, módulo y local, sumando los permisos cuando un usuario tiene varios roles; el Administrador ve todos los módulos de su empresa salvo los que se le quiten.', 'Superusuario, Administrador', 'Alta', 'Implementado',
  [('El servidor rechaza un módulo sin permiso aunque la pantalla lo oculte.', 'RF-002'), ('El menú muestra solo los módulos del rol; los beta van al final.', 'RF-002'), ('El Administrador ve todo lo de su empresa (bancos, cuentas y reportes de pagos incluidos).', 'RF-084')]),
 ('RF-003', M_ACC, 'Usuarios y roles propios', 'El sistema permite que el superusuario de cada empresa administre usuarios con uno o más roles y arme roles propios eligiendo sus módulos y niveles, gestionando solo roles de nivel inferior al propio y registrando cada cambio.', 'Superusuario, Superadministrador', 'Alta', 'Implementado',
  [('Se crea un usuario con rol, entra con su clave y queda auditado.', 'RF-003'), ('Se crea un rol propio con módulos y niveles; quien lo recibe ve exactamente eso.', 'RF-003'), ('Cada empresa ve solo sus usuarios y roles.', 'RF-003')]),
 ('RF-004', M_MAE, 'Clientes', 'El sistema permite registrar, editar, buscar y dar de baja recuperable clientes con documento único por empresa, conservando su historial aunque se corrija el documento.', 'Cajera, Administrador', 'Alta', 'Implementado',
  [('El documento no se repite (409).', 'RF-004'), ('Cambiar el documento no desvincula sus vehículos y queda auditado.', 'RF-004'), ('Se busca por documento, nombre parcial o placa de su vehículo.', 'RF-006')]),
 ('RF-005', M_MAE, 'Vehículos', 'El sistema permite registrar, editar, buscar y traspasar vehículos vinculados a su titular, sin perder el historial al corregir la placa; al registrar por placa, el sistema completa los datos con la consulta vehicular (RN-10).', 'Cajera, Administrador', 'Alta', 'Implementado',
  [('La misma placa con otro formato ya existe (409 con el titular).', 'RF-005'), ('Corregir la placa o traspasar al titular conserva el vehículo, su ID y sus lecturas.', 'RF-005'), ('Se busca por placa con o sin guiones, VIN, nombre o documento del titular.', 'RF-006')]),
 ('RF-007', M_MAE, 'Lecturas de kilometraje', 'El sistema permite conservar el kilometraje, la fuente, la fecha y la observación de cada lectura; el kilometraje actual es el de la última.', 'Cajera, Técnico', 'Alta', 'Implementado',
  [('Cada lectura se guarda y el kilometraje actual es el de la última.', 'RF-007'), ('Un kilometraje negativo, con decimales, gigante o con fecha futura se rechaza.', 'RF-007')]),
 ('RF-008', M_CAT, 'Proveedores', 'El sistema permite administrar proveedores y asociarlos a las compras y a los servicios externos.', 'Administrador, Logístico', 'Media', 'Implementado',
  [('Se registra, edita y busca un proveedor con documento único.', 'RF-008'), ('Un servicio externo o una compra se asocia a su proveedor.', 'RF-008')]),
 ('RF-009', M_CAT, 'Servicios con horas estándar', 'El sistema permite mantener el catálogo de servicios con su categoría técnica, sus horas estándar (de AutoData, o 1 h si no hay dato, RN-08), su precio base y la marca de servicio externo.', 'Administrador', 'Alta', 'Implementado',
  [('Cada servicio tiene categoría, horas, precio base y marca «externo».', 'RF-009'), ('Sin tiempo de AutoData, el servicio toma 1 h.', 'RF-009')]),
 ('RF-010', M_CAT, 'Productos', 'El sistema permite mantener el catálogo de productos con código, referencia, unidad, categoría, marca, precio y costo, para cotizar, vender y descontar en el kárdex.', 'Administrador, Logístico', 'Alta', 'Implementado',
  [('Cada producto tiene código, unidad, precio y costo.', 'RF-010'), ('El producto se usa en la ODS, la cotización, la nota de venta y el kárdex.', 'RF-010')]),
 ('RF-100', M_CAT, 'Grupos de vehículos', 'El sistema permite definir los grupos de vehículos (hoy cinco) y asignar cada vehículo a un grupo según su marca, modelo, motor y año.', 'Administrador, Jefe de taller', 'Alta', 'Implementado',
  [('Se crean, renombran o quitan grupos sin rehacer los datos.', 'Nuevo'), ('Cada vehículo pertenece a un grupo; se puede reasignar.', 'Nuevo')]),
 ('RF-101', M_CAT, 'Precios por grupo', 'El sistema permite fijar el precio y el tiempo estándar de cada servicio y ajustarlos por grupo con reglas acumulativas (del grupo para uno o varios servicios, generales del grupo y de todos los grupos) que fijan, suman o aplican un porcentaje, editables en pantalla.', 'Administrador', 'Alta', 'Implementado',
  [('Al agregar un servicio a una ODS, cita o cotización se ponen el precio y las horas del grupo del vehículo (RN-09).', 'Nuevo'), ('Las reglas se aplican en orden: del grupo para el servicio, generales del grupo y de todos los grupos; una regla «Fijar» funciona como excepción.', 'Nuevo'), ('Un precio cambiado en la línea queda marcado «precio modificado».', 'Nuevo')]),
 ('RF-102', M_CAT, 'Solapamiento de servicios', 'El sistema permite registrar qué servicios comparten trabajo (por par o por conjunto, como los de una misma rueda) y el descuento en soles que lleva el segundo cuando se juntan en una misma ODS: automático, opcional o solo un aviso, con un monto estándar y otro por grupo, y las horas que comparten.', 'Jefe de taller, Administrador', 'Media', 'Implementado',
  [('Se registra el par de servicios, el modo (automático u opcional), el descuento estándar y por grupo, y las horas compartidas.', 'Nuevo'), ('Al juntarlos en una ODS, el automático se descuenta solo y el opcional muestra una alerta para aplicarlo o mantener los montos; las horas descuentan lo compartido.', 'Nuevo')]),
 ('RF-011', M_ODS, 'Crear y editar la ODS', 'El sistema permite crear una ODS con cliente, vehículo, local, hora de llegada y responsable, en el estado elegido, y editar su encabezado y sus ítems de servicio y de producto mientras no esté cerrada.', 'Cajera, Jefe de taller', 'Alta', 'Implementado',
  [('El código es AAAAMMDD + correlativo y nunca se repite, aunque se creen dos a la vez.', 'RF-011'), ('Se edita el encabezado: técnico, jefe de taller, observaciones y recomendaciones.', 'RF-012'), ('Cada servicio tiene responsable y horas; la suma da el total de horas de la ODS.', 'RF-013'), ('Servicios y productos conviven en la misma ODS; cada línea se redondea a 2 decimales.', 'RF-014')]),
 ('RF-015', M_ODS, 'Tipo de atención, garantía e ingreso', 'El sistema permite registrar el tipo de atención («Otro» con texto propio), la garantía enlazada a la ODS y a los servicios de origen, hasta cinco fotos opcionales de ingreso y el estado del vehículo.', 'Cajera, Técnico', 'Alta', 'Parcial',
  [('Las fotos son opcionales, solo imágenes y como máximo 5.', 'RF-015'), ('La ODS de garantía se enlaza a la ODS y a los servicios que cubre.', 'RF-015'), ('Con tipo «Otro» se escribe un texto que se muestra en su lugar.', 'RF-073')]),
 ('RF-016', M_ODS, 'Estados y cierre de la ODS', 'El sistema permite mover la ODS entre Recepción, En proceso, En entrega y Cerrada, y cerrarla dejando la información consultable y auditable.', 'Cajera, Jefe de taller', 'Alta', 'Parcial',
  [('Los estados se mueven libremente.', 'RF-016'), ('Al cerrar se pone la fecha de cierre (RN-04); al reabrir se borra.', 'RF-017'), ('Se puede cerrar sin nota de venta y la ODS queda marcada «Sin nota de venta» (RN-06).', 'RF-017')]),
 ('RF-018', M_ODS, 'Corregir o reabrir una ODS cerrada', 'El sistema permite solicitar y autorizar correcciones o la reapertura de una ODS cerrada sin borrar el historial.', 'Jefe de taller, Administrador', 'Media', 'Pendiente',
  [('La corrección guarda el antes y el después con su responsable.', 'RF-018'), ('Reabrir devuelve la ODS a un estado activo y queda en la bitácora.', 'RF-018')]),
 ('RF-089', M_ODS, 'Abonos y saldo', 'El sistema permite registrar pagos y abonos de la ODS o de la nota de venta y mostrar el saldo pendiente.', 'Cajera', 'Alta', 'Implementado',
  [('Los abonos no superan lo pendiente y bajan el saldo, no el total.', 'RF-089'), ('Dos abonos a la vez por todo lo pendiente: solo entra uno.', 'RF-089')]),
 ('RF-026', M_PLA, 'Plantillas de mantenimiento', 'El sistema permite crear plantillas de mantenimiento por grupo o compatibilidad de vehículo y versionarlas sin reescribir los servicios ni las proyecciones históricas.', 'Jefe de taller', 'Alta', 'Pendiente',
  [('Se crea una plantilla para un grupo o una compatibilidad.', 'RF-026'), ('Una nueva versión no cambia lo ya realizado.', 'RF-027')]),
 ('RF-028', M_PLA, 'Reglas por km y tiempo', 'El sistema permite definir reglas por kilometraje, tiempo, perfil de uso y servicio, y evaluar si una regla aplica al vehículo antes de proponerla.', 'Jefe de taller', 'Alta', 'Pendiente',
  [('La regla indica km, meses o ambos, y el servicio.', 'RF-028'), ('Solo aplica si coincide la marca o el modelo y los demás datos que pida.', 'RF-029')]),
 ('RF-030', M_PLA, 'Asignar un plan al vehículo', 'El sistema permite asignar explícitamente un plan vigente a cada vehículo cuando corresponda.', 'Jefe de taller, Cajera', 'Alta', 'Pendiente',
  [('Un vehículo tiene a lo más un plan vigente.', 'RF-030'), ('Cambiar el plan queda en la bitácora.', 'RF-030')]),
 ('RF-103', M_PLA, 'Sugerir un plan a vehículos sin plan', 'El sistema permite sugerir un plan existente a los vehículos sin plan que tengan las mismas características (marca, modelo, motor y año), para no crear planes repetidos.', 'Jefe de taller', 'Media', 'Pendiente',
  [('Al crear un plan, el sistema lista los vehículos sin plan compatibles.', 'Nuevo'), ('La persona acepta o descarta cada sugerencia.', 'Nuevo')]),
 ('RF-031', M_PLA, 'Línea de tiempo del vehículo', 'El sistema permite mostrar la línea de tiempo con el historial real, las proyecciones y las evidencias, conservando la fuente y la fecha de cada evento que modifica el plan.', 'Jefe de taller, Cajera', 'Alta', 'Pendiente',
  [('Se ven los servicios realizados y los próximos.', 'RF-031'), ('Cada evento muestra de qué ODS o lectura viene y cuándo.', 'RF-033')]),
 ('RF-032', M_PLA, 'Reajuste de las proyecciones', 'El sistema permite reajustar únicamente las proyecciones futuras después de un servicio confirmado.', 'Sistema, Jefe de taller', 'Alta', 'Pendiente',
  [('Un servicio confirmado mueve solo las visitas futuras.', 'RF-032'), ('El reajuste guarda motivo, ODS de origen, fecha y responsable.', 'RF-032')]),
 ('RF-034', M_PLA, 'Recomendaciones', 'El sistema permite generar recomendaciones con fundamento visible y registrar su aceptación, postergación o rechazo por una persona.', 'Jefe de taller, Cajera', 'Alta', 'Pendiente',
  [('Cada recomendación muestra por qué se propone.', 'RF-034'), ('Se acepta, posterga o rechaza, y queda registrado.', 'RF-035')]),
 ('RF-067', M_PLA, 'Mantenimientos próximos y vencidos', 'El sistema permite listar los vehículos con mantenimientos próximos o vencidos, con filtro por local.', 'Cajera, Jefe de taller', 'Alta', 'Pendiente',
  [('La lista muestra el vehículo, el servicio y si está próximo o vencido.', 'RF-067'), ('Se filtra por local y se descarga.', 'RF-067')]),
 ('RF-036', M_TAR, 'Tareas preventivas', 'El sistema permite mantener tareas preventivas vinculadas a un plan y a un vehículo.', 'Sistema, Cajera', 'Alta', 'Pendiente',
  [('Un mantenimiento próximo crea su tarea «Llamar para agendar».', 'RF-036')]),
 ('RF-037', M_TAR, 'Tareas desde la ODS', 'El sistema permite crear las tareas de servicio y de producto desde la ODS y asignarlas al técnico, al jefe de taller, a la cajera o al logístico.', 'Sistema, Jefe de taller', 'Alta', 'Pendiente',
  [('Al crear la ODS se crea una tarea por ítem para su responsable.', 'RF-037'), ('El responsable por defecto es el técnico de la ODS (servicio) o la cajera (producto).', 'RF-038')]),
 ('RF-039', M_TAR, 'Estados y tiempos de la tarea', 'El sistema permite usar los estados Pendiente, En proceso, En espera y Completada, y registrar la fecha, la hora y la duración estimada y real.', 'Técnico, Cajera', 'Alta', 'Pendiente',
  [('La tarea pasa por sus estados y queda en la bitácora.', 'RF-039'), ('Guarda fecha, hora y duración estimada y real.', 'RF-040')]),
 ('RF-055', M_TAR, 'Vistas de lista, tablero y calendario', 'El sistema permite ver las tareas y las citas en vistas de lista, tablero y calendario, crear vistas propias de cada tipo, nombrarlas, duplicarlas y guardar sus filtros por persona; el calendario muestra día, cuatro días, semana y mes y mueve o estira los bloques de 15 en 15 minutos.', 'Todos los usuarios', 'Alta', 'Pendiente',
  [('Se crea una vista eligiendo lista, tablero o calendario.', 'RF-055'), ('Los filtros de cada vista se guardan por persona.', 'RF-055'), ('En el calendario se arrastra o estira un bloque de 15 en 15 minutos.', 'RF-057')]),
 ('RF-053', M_CIT, 'Citas', 'El sistema permite crear citas con el encabezado de una ODS (cliente, vehículo, tipo de atención, km, técnico, jefe de taller, fecha y hora, observaciones y recomendaciones), asignar o crear su cotización, en cualquier sede y sin límite por día, guardando quién la creó.', 'Cajera', 'Alta', 'Pendiente',
  [('Estados: Pendiente, Confirmada, Reprogramada, Atendida y No concretada, cada uno con su color.', 'RF-053'), ('Las observaciones son el título de la cita en el calendario.', 'RF-053'), ('Se guarda el usuario que creó la cita.', 'RF-053')]),
 ('RF-054', M_CIT, 'Atender la cita y crear la ODS', 'El sistema permite marcar la cita como Atendida y ofrecer crear la ODS con su encabezado y su cotización, guardando el origen.', 'Cajera', 'Alta', 'Pendiente',
  [('Al marcar Atendida pregunta «¿Deseas crear la orden de servicio?».', 'RF-054'), ('La ODS creada así guarda de qué cita viene.', 'RF-054')]),
 ('RF-059', M_BIT, 'Comentarios de bitácora', 'El sistema permite crear comentarios de bitácora en la ODS, la tarea o el producto, con fotos o archivos adjuntos y menciones a usuarios.', 'Todos los usuarios', 'Media', 'Pendiente',
  [('El comentario se guarda con autor y fecha.', 'RF-059'), ('Admite adjuntos.', 'RF-061'), ('Mencionar a un usuario le avisa (RN-01).', 'RF-062')]),
 ('RF-060', M_BIT, 'Auditoría de cambios', 'El sistema permite registrar el actor, la fecha, el valor anterior, el nuevo y el motivo cuando aplique.', 'Sistema', 'Alta', 'Parcial',
  [('Cada cambio de cliente, vehículo, usuario u ODS guarda quién, cuándo, antes y después.', 'RF-060')]),
 ('RF-063', M_BIT, 'Historial cronológico', 'El sistema permite mostrar el historial cronológico de la ODS, del vehículo y de sus tareas.', 'Todos los usuarios', 'Media', 'Parcial',
  [('La bitácora de la ODS se lee en orden de fecha.', 'RF-063')]),
 ('RF-087', M_COM, 'Cotización', 'El sistema permite emitir una cotización con kilometraje, ítems, descuento y observaciones, enlazarla a una cita o a una ODS y registrarla en la bitácora.', 'Cajera', 'Alta', 'Pendiente',
  [('La cotización toma el precio del grupo del vehículo.', 'RF-087'), ('Se enlaza a una cita o a una ODS y carga sus ítems.', 'RF-087')]),
 ('RF-088', M_COM, 'Nota de venta', 'El sistema permite emitir la nota de venta interna desde la ODS, con tipo de IGV por ítem (gravado, exonerado o inafecto) y cálculo de la detracción, en PDF o ticket, como molde de la boleta y la factura.', 'Cajera', 'Alta', 'Pendiente',
  [('La serie es la del local y el número es automático (RN-03).', 'RF-088'), ('Cada ítem tiene su tipo de IGV y se propone la detracción (RN-15).', 'RF-099')]),
 ('RF-090', M_COM, 'Cuentas por cobrar y por pagar', 'El sistema permite consultar las cuentas por cobrar de las notas de venta a crédito y las cuentas por pagar de las compras a crédito.', 'Administrador, Cajera', 'Media', 'Pendiente',
  [('Una venta a crédito aparece en cuentas por cobrar hasta pagarse.', 'RF-090'), ('Una compra a crédito aparece en cuentas por pagar.', 'RF-090')]),
 ('RF-091', M_COM, 'Bancos y movimientos', 'El sistema permite registrar ingresos, egresos y traslados entre cuentas bancarias por local.', 'Administrador, Cajera', 'Media', 'Pendiente',
  [('Cada pago entra a una cuenta del local.', 'RF-091'), ('Un traslado entre cuentas mueve el saldo de ambas.', 'RF-091')]),
 ('RF-078', M_INV, 'Compras', 'El sistema permite registrar la compra de productos o servicios externos con su comprobante y proveedor, enlazarla a una ODS y llevarla al kárdex y a los egresos.', 'Logístico, Cajera', 'Media', 'Pendiente',
  [('La compra suma al kárdex del local.', 'RF-078'), ('Se puede enlazar a la ODS para su trazabilidad.', 'RF-078')]),
 ('RF-092', M_INV, 'Inventario y kárdex', 'El sistema permite registrar requerimientos, consumo y traslado de inventario entre locales, con cada entrada y salida en el kárdex.', 'Logístico, Cajera', 'Media', 'Pendiente',
  [('La nota de venta descuenta lo vendido (RN-16).', 'RF-092'), ('Un traslado registra la salida y el ingreso en ambos locales.', 'RF-092')]),
 ('RF-094', M_POS, 'Consulta de kilometraje', 'El sistema permite consultar el kilometraje al cliente para agendar la cita según su plan de mantenimiento y registrar la respuesta.', 'Cajera', 'Alta', 'Pendiente',
  [('La respuesta del cliente se guarda como lectura de km.', 'RF-094'), ('El nuevo km recalcula las proyecciones (RN-04).', 'RF-094')]),
 ('RF-095', M_POS, 'Encuesta con enlace', 'El sistema permite enviar la encuesta con un enlace y registrar las respuestas del cliente para la satisfacción y el NPS.', 'Cajera, Cliente', 'Media', 'Pendiente',
  [('El cliente responde desde el enlace sin entrar al sistema.', 'RF-095'), ('La respuesta queda en la ODS.', 'RF-095')]),
 ('RF-097', M_POS, 'Seguimiento a los cinco días', 'El sistema permite registrar el resultado del seguimiento de posventa que se programa a los cinco días hábiles del cierre de la ODS.', 'Cajera', 'Alta', 'Pendiente',
  [('Al cerrar la ODS se programa la tarea de seguimiento (RN-04).', 'RF-097'), ('La cajera registra el resultado.', 'RF-097')]),
 ('RF-065', M_REP, 'Reporte de técnicos', 'El sistema permite reportar por técnico del servicio las horas hombre y el valor vendido.', 'Administrador, Jefe de taller', 'Media', 'Pendiente',
  [('Se calcula por horas o por monto.', 'RF-065'), ('Cuenta al técnico del servicio, no al de la ODS.', 'RF-065')]),
 ('RF-066', M_REP, 'Reporte de ODS', 'El sistema permite reportar las ODS por estado, local, responsable y periodo, con filtros y descarga.', 'Administrador', 'Media', 'Pendiente',
  [('Se filtra por local, fecha, técnico, vehículo y estado.', 'RF-068'), ('El resultado se descarga en Excel.', 'RF-069')]),
 ('RF-096', M_REP, 'Métricas', 'El sistema permite consultar las métricas de taller, ventas y satisfacción con filtro por local.', 'Administrador', 'Media', 'Pendiente',
  [('16 métricas: vehículos atendidos, horas vendidas, ticket promedio, garantías, permanencia, ventas, utilidades, rentabilidad, NPS y citas.', 'RF-096')]),
 ('RF-098', M_REP, 'Reporte de posventa', 'El sistema permite consultar la cantidad de citas, de ODS y de citas que crearon una ODS, la tasa de conversión y las citas por usuario que las creó.', 'Administrador', 'Media', 'Pendiente',
  [('La tasa es citas que crearon una ODS entre citas.', 'RF-098')]),
 ('RF-071', M_CFG, 'Organización y locales', 'El sistema permite configurar la organización, sus locales y el alcance de cada usuario por local.', 'Superusuario', 'Alta', 'Parcial',
  [('Cada usuario tiene su local.', 'RF-071'), ('Una empresa puede tener varios talleres.', 'RF-071')]),
 ('RF-085', M_CFG, 'Empresa, logotipos y formatos', 'El sistema permite configurar los datos de la empresa, dos logotipos y los formatos de los documentos.', 'Superusuario', 'Media', 'Pendiente',
  [('La nota de venta y la cotización usan los datos y el logotipo de la empresa.', 'RF-085')]),
]

# Absorbidos (código -> en qué requisito quedan)
ABSORBIDOS = {
 'RF-006': 'RF-004 y RF-005', 'RF-012': 'RF-011', 'RF-013': 'RF-011', 'RF-014': 'RF-011', 'RF-017': 'RF-016',
 'RF-027': 'RF-026', 'RF-029': 'RF-028', 'RF-033': 'RF-031', 'RF-035': 'RF-034', 'RF-038': 'RF-037', 'RF-040': 'RF-039',
 'RF-061': 'RF-059', 'RF-062': 'RF-059', 'RF-068': 'RF-066', 'RF-069': 'RF-066', 'RF-084': 'RF-002', 'RF-099': 'RF-088',
}
BETA = ['RF-025', 'RF-041', 'RF-042', 'RF-043', 'RF-044', 'RF-045', 'RF-046', 'RF-047', 'RF-048', 'RF-049', 'RF-050', 'RF-051',
        'RF-056', 'RF-057', 'RF-058', 'RF-070', 'RF-072', 'RF-074', 'RF-075', 'RF-076', 'RF-077', 'RF-079', 'RF-080', 'RF-081',
        'RF-082', 'RF-083']
A_RN = {'RF-052': 'RN-01', 'RF-064': 'RN-02', 'RF-086': 'RN-03', 'RF-093': 'RN-04', 'RF-073': 'RN-05'}
MIGRACION = ['RF-019', 'RF-020', 'RF-021', 'RF-022', 'RF-023', 'RF-024']
NOTA_ABS = {
 'RF-057': 'Lo cubre el calendario de RF-055', 'RF-041': 'Mover en el calendario de RF-055 lo cubre', 'RF-044': 'Estirar en el calendario de RF-055 lo cubre',
 # 05/11/2026: aprobación por ítem (no por toda la ODS), hallazgo de la referencia de Tuulapp (update_item_approval). Segunda fase, después de la tesis.
 'RF-076': 'Segunda fase: la decisión pasa a pendiente de aprobación por ítem, solo en el ítem nuevo (no en toda la ODS)',
 'RF-077': 'Segunda fase: se aprueba o no cada ítem; la ODS ya no tiene una sola decisión a nivel de orden',
}

# ---------------------------------------------------------------------------
# Reglas de negocio
# ---------------------------------------------------------------------------
RN = [
 ('RN-01', 'Avisos', 'El sistema avisa al responsable cuando lo asignan a una tarea o lo mencionan en un comentario.', 'RF-052', 'RF-037, RF-059'),
 ('RN-02', 'Eventos automáticos', 'El sistema registra en la bitácora los eventos relevantes (creación, cambio de estado, abonos, fotos) sin impedir los comentarios humanos.', 'RF-064', 'RF-016, RF-060'),
 ('RN-03', 'Serie y número', 'Cada local tiene una serie de comprobante (N001 Unión, N002 Prohogar) y el número es consecutivo y automático, sin saltos ni repetidos; no se muestra ni se edita.', 'RF-086', 'RF-088'),
 ('RN-04', 'Automatizaciones fijas', 'Las automatizaciones viven en el servidor y no se configuran en pantalla: fecha de cierre al pasar a Cerrada, tarea de seguimiento a los cinco días hábiles del cierre y recálculo de proyecciones al registrar un kilometraje.', 'RF-093', 'RF-016, RF-094, RF-097'),
 ('RN-05', 'Tipos de atención y estados fijos', 'Los tipos de atención y los estados de la ODS, la tarea y la cita son fijos; con el tipo «Otro» se escribe un texto que se muestra en su lugar.', 'RF-073', 'RF-015, RF-016, RF-039, RF-053'),
 ('RN-06', 'Cierre sin nota de venta', 'Una ODS se puede cerrar sin nota de venta; queda marcada «Sin nota de venta» a la vista. Reemplaza a DEC-72.', 'DEC-72', 'RF-016'),
 ('RN-07', 'Dos ODS abiertas', 'Un vehículo tiene como máximo dos ODS abiertas, y la segunda debe ser de garantía enlazada a su ODS de origen.', 'DEC-67', 'RF-011, RF-015'),
 ('RN-08', 'Tiempo del servicio', 'El tiempo de cada servicio sale de AutoData; si AutoData no tiene dato, se usa 1 h.', 'Nuevo', 'RF-009'),
 ('RN-09', 'Precio por grupo', 'El precio y las horas de un servicio parten de su estándar y se ajustan, en este orden, con las reglas del grupo para ese servicio, las generales del grupo y las de todos los grupos; una regla «Fijar» es una excepción. Los montos van en múltiplos de 5, el porcentaje redondea a 10 céntimos a favor de la empresa y las horas suben a la rejilla de 0,25 h. El precio se copia en la línea al agregarlo.', 'Nuevo', 'RF-101, RF-011, RF-053, RF-087'),
 ('RN-10', 'Consulta vehicular y de DNI', 'Al registrar un vehículo por placa, el servidor consulta la API vehicular y completa VIN, código de motor, marca y modelo; con el DNI completa el nombre del cliente. La clave de la API no aparece en pantalla.', 'Nuevo', 'RF-004, RF-005'),
 ('RN-11', 'Migración inicial', 'Los datos del sistema anterior del taller se migran una sola vez por un procedimiento interno: atómico, sin duplicar, conservando la fila de origen y normalizando la descripción del servicio.', 'RF-019 a RF-024', 'RF-004, RF-005, RF-011'),
 ('RN-12', 'Identificador interno', 'Cada registro tiene un identificador interno; la placa o el documento no lo reemplazan.', 'R8.1', 'RF-004, RF-005'),
 ('RN-13', 'ODS cerrada', 'La ODS cerrada no se edita de forma ordinaria; las correcciones quedan registradas con el antes y el después.', 'R8.1', 'RF-016, RF-018'),
 ('RN-14', 'Reajuste confirmado', 'Los planes se versionan sin alterar lo realizado y el reajuste solo se hace con un servicio confirmado.', 'R8.1', 'RF-026, RF-032'),
 ('RN-15', 'IGV y detracción', 'Cada ítem es Gravado (el precio incluye el IGV), Exonerado o Inafecto. La detracción de 12 % se propone cuando hay servicios y el total supera S/ 700; la deposita la empresa.', 'R8.1', 'RF-088'),
 ('RN-16', 'Kárdex', 'Cada entrada y salida de un producto por local queda en el kárdex con su usuario; la nota de venta descuenta lo vendido.', 'R8.1', 'RF-078, RF-092'),
 ('RN-17', 'Responsables por defecto', 'El responsable de un servicio es un técnico o el jefe de taller (por defecto, el técnico de la ODS) y el de un producto, una cajera o un logístico (por defecto, la cajera).', 'R8.1', 'RF-011, RF-037'),
 ('RN-18', 'Lo que ve el técnico', 'El técnico ve solo las ODS donde está asignado y las carpetas del espacio de trabajo compartidas con él; sí ve todo el módulo de citas.', 'R8.1', 'RF-002, RF-053'),
]

# ---------------------------------------------------------------------------
# Requisitos no funcionales
# ---------------------------------------------------------------------------
RNF = [
 ('RNF-01', 'Seguridad', 'Las contraseñas se guardan cifradas con bcrypt y la sesión vence a las 8 horas.', 'Revisión de código y prueba de ingreso', 'Cumplido', 'sesion.spec'),
 ('RNF-02', 'Seguridad', 'Cada petición se autoriza en el servidor por rol, módulo y local, aunque la pantalla oculte la opción.', 'Prueba: un módulo sin permiso responde 403', 'Cumplido', 'sesion.spec'),
 ('RNF-03', 'Seguridad', 'Los cambios de clientes, vehículos, usuarios y ODS quedan en una auditoría que no se edita.', 'Prueba: cada cambio guarda actor, antes y después', 'Cumplido', 'maestros.spec, usuario.spec'),
 ('RNF-04', 'Seguridad', 'Las claves y los tokens viven fuera del repositorio (.env) y el repositorio solo tiene datos sintéticos.', 'Revisión del repositorio', 'Cumplido', 'Revisión manual'),
 ('RNF-05', 'Integridad', 'Los guardados son atómicos y los correlativos no se repiten aunque haya peticiones simultáneas.', 'Prueba de concurrencia: ODS, abonos y números', 'Cumplido', 'base.spec, ordenServicio.spec'),
 ('RNF-06', 'Exactitud', 'Los importes usan decimales exactos y redondeo a 2 decimales por línea; los textos se guardan en UTF-8 y las fechas en la zona America/Lima.', 'Prueba: 3 × 0,1 = 0,3 y texto con tildes y emojis', 'Cumplido', 'base.spec'),
 ('RNF-07', 'Rendimiento', 'Las listas y búsquedas responden en menos de 2 s con 50 000 ODS.', 'Prueba de carga en el entorno de pruebas', 'Pendiente', '—'),
 ('RNF-08', 'Usabilidad', 'Todas las tablas usan el mismo patrón: filtros por columna y modal centrado de dos columnas, sin textos de ayuda en la interfaz.', 'Prueba de pantalla y revisión con usuarios', 'Cumplido', 'Maestros.test'),
 ('RNF-09', 'Portabilidad', 'La interfaz funciona en computadora, tablet y celular; en celular el menú es un cajón y la cámara se abre para las fotos.', 'Prueba de pantalla a 375 px y revisión en tablet', 'Parcial', 'App.test, Ordenes.test'),
 ('RNF-10', 'Compatibilidad', 'El sistema funciona en las dos últimas versiones de Chrome, Edge y Firefox.', 'Revisión manual en los tres navegadores', 'Pendiente', '—'),
 ('RNF-11', 'Disponibilidad', 'La base de datos tiene copia de seguridad diaria y el sistema se despliega con Docker Compose.', 'Restauración de una copia en el entorno de pruebas', 'Pendiente', '—'),
 ('RNF-12', 'Mantenibilidad', 'El código es un monorepo TypeScript ordenado por módulo, igual en la API y en la interfaz, y cada módulo tiene sus pruebas automáticas.', 'Revisión del repositorio y ejecución de pruebas', 'Cumplido', 'pnpm test'),
]

# ---------------------------------------------------------------------------
# Casos de uso
# ---------------------------------------------------------------------------
ACTORES = [
 ('Superusuario (Superadministrador)', 'Configura su empresa: usuarios, roles propios, locales, datos y formatos.'),
 ('Administrador', 'Ve todos los módulos de su empresa salvo los que se le quiten; revisa reportes, métricas, bancos y cuentas.'),
 ('Jefe de taller', 'Asigna el trabajo, revisa planes, reglas y reajustes y corrige ODS cerradas.'),
 ('Técnico', 'Ve sus ODS y tareas, registra su avance y consulta las citas.'),
 ('Cajera', 'Registra clientes, vehículos, citas y ODS; cobra, emite la nota de venta y hace la posventa.'),
 ('Logístico', 'Registra compras, requerimientos y movimientos de inventario.'),
 ('Cliente', 'Responde la encuesta desde un enlace, sin entrar al sistema.'),
 ('Sistema', 'Aplica las reglas de negocio: correlativos, fechas de cierre, seguimiento, avisos y recálculos.'),
]

CU = [
 ('CU-01', 'Ingresar y ver el menú por rol', 'Todos los usuarios', ['RF-001', 'RF-002'], 'HU-01', 'Que cada persona entre con su cuenta y vea solo lo que le corresponde.', 'DCU-R81-0001'),
 ('CU-02', 'Gestionar usuarios, roles y locales', 'Superusuario', ['RF-003', 'RF-071'], 'HU-02', 'Que cada empresa arme sus roles y sus locales sin depender del desarrollador.', 'DCU-R81-0001'),
 ('CU-03', 'Gestionar clientes y vehículos', 'Cajera', ['RF-004', 'RF-005', 'RF-007'], 'HU-03', 'Tener un solo registro por cliente y por vehículo, con su kilometraje.', 'DCU-R81-0001'),
 ('CU-04', 'Gestionar servicios, productos, grupos y precios', 'Administrador', ['RF-008', 'RF-009', 'RF-010', 'RF-100', 'RF-101', 'RF-102'], 'HU-04', 'Que cada servicio tenga su tiempo y su precio según el grupo del vehículo.', 'DCU-R81-0002'),
 ('CU-05', 'Registrar y atender la ODS', 'Cajera, Jefe de taller', ['RF-011', 'RF-015', 'RF-016', 'RF-018', 'RF-089'], 'HU-05', 'Registrar el trabajo del vehículo desde la recepción hasta el cierre.', 'DCU-R81-0001'),
 ('CU-06', 'Gestionar planes preventivos', 'Jefe de taller', ['RF-026', 'RF-028', 'RF-030', 'RF-103'], 'HU-06', 'Asignar a cada vehículo el plan que le corresponde.', 'DCU-R81-0001'),
 ('CU-07', 'Revisar la línea de tiempo y los reajustes', 'Jefe de taller, Cajera', ['RF-031', 'RF-032', 'RF-034', 'RF-067'], 'HU-07', 'Ver qué le toca a cada vehículo y reajustar con servicios reales.', 'DCU-R81-0001'),
 ('CU-08', 'Trabajar las tareas en sus vistas', 'Técnico, Cajera', ['RF-036', 'RF-037', 'RF-039', 'RF-055'], 'HU-08', 'Organizar el trabajo del día en lista, tablero o calendario.', 'DCU-R81-0001'),
 ('CU-09', 'Agendar y atender citas', 'Cajera', ['RF-053', 'RF-054', 'RF-055'], 'HU-09', 'Agendar al cliente y, cuando llega, crear su ODS sin volver a escribir.', 'DCU-R81-0001'),
 ('CU-10', 'Registrar la bitácora y auditar', 'Todos los usuarios', ['RF-059', 'RF-060', 'RF-063'], 'HU-10', 'Dejar constancia de lo hecho y de quién lo cambió.', 'DCU-R81-0001'),
 ('CU-11', 'Cotizar, vender y cobrar', 'Cajera, Administrador', ['RF-087', 'RF-088', 'RF-090', 'RF-091'], 'HU-11', 'Cotizar, emitir la nota de venta y llevar lo cobrado a bancos.', 'DCU-R81-0002'),
 ('CU-12', 'Comprar y mover inventario', 'Logístico', ['RF-078', 'RF-092'], 'HU-12', 'Que el kárdex refleje lo comprado, vendido y trasladado.', 'DCU-R81-0002'),
 ('CU-13', 'Hacer la posventa', 'Cajera, Cliente', ['RF-094', 'RF-095', 'RF-097'], 'HU-13', 'Contactar al cliente después del servicio y antes del próximo mantenimiento.', 'DCU-R81-0001'),
 ('CU-14', 'Consultar reportes y métricas', 'Administrador', ['RF-065', 'RF-066', 'RF-096', 'RF-098'], 'HU-14', 'Medir la operación, las ventas y la posventa por local.', 'DCU-R81-0002'),
 ('CU-15', 'Configurar la empresa', 'Superusuario', ['RF-085'], 'HU-15', 'Que los documentos salgan con los datos y el logotipo de la empresa.', 'DCU-R81-0002'),
]
CU_CONTEXTO = {
 'CU-05': ('La cajera recibe el vehículo, con o sin cita.', ['La cajera crea la ODS con cliente, vehículo, tipo de atención y servicios.', 'El sistema pone el código, el precio del grupo y el responsable por defecto.', 'El técnico trabaja; la ODS pasa a En proceso y a En entrega.', 'La cajera cobra y cierra; el sistema pone la fecha de cierre y programa el seguimiento.'], 'Si el vehículo ya tiene una ODS abierta, la nueva solo puede ser de garantía (RN-07).'),
 'CU-09': ('El cliente llama o la posventa le propone un mantenimiento.', ['La cajera crea la cita con el encabezado y, si quiere, una cotización.', 'La cita aparece en el calendario con su color de estado.', 'Al llegar el cliente, la cajera la marca Atendida.', 'El sistema pregunta si crea la ODS y la llena con el encabezado y la cotización.'], 'Si el cliente no llega, la cita queda Reprogramada o No concretada.'),
 'CU-07': ('Hay un vehículo con plan y servicios registrados.', ['El jefe de taller abre la línea de tiempo del vehículo.', 'El sistema muestra lo hecho y lo próximo, con su origen.', 'Un servicio confirmado reajusta solo lo futuro.', 'La persona acepta, posterga o rechaza cada recomendación.'], 'Sin servicio confirmado no se reajusta nada (RN-14).'),
 'CU-13': ('Se cerró una ODS o se acerca un mantenimiento.', ['El sistema programa el seguimiento a los cinco días hábiles.', 'La cajera llama, registra el resultado y envía la encuesta.', 'El cliente responde desde el enlace.', 'La consulta de km recalcula las proyecciones.'], 'Si el cliente no responde, la tarea queda pendiente.'),
 'CU-11': ('La ODS tiene ítems.', ['La cajera emite la cotización o la nota de venta.', 'El sistema pone la serie del local y el número.', 'La cajera registra el pago y el banco.', 'Si es a crédito, queda en cuentas por cobrar.'], 'La nota de venta es interna; la factura electrónica se emite aparte.'),
}

# ---------------------------------------------------------------------------
# Historias de usuario (15)
# ---------------------------------------------------------------------------
HU = [
 ('HU-01', 'Ingresar con mi cuenta', 'Todos los usuarios', 'Como usuario del taller quiero ingresar con mi correo y contraseña para ver solo los módulos de mi rol.', ['RF-001', 'RF-002'], 'CU-01', 'Dado un usuario activo, cuando ingresa con su clave, entonces ve su menú; dado un módulo sin permiso, cuando lo pide, entonces el servidor lo rechaza.', ['CP-01', 'CP-02', 'CP-03'], 'Terminada'),
 ('HU-02', 'Armar roles y usuarios', 'Superusuario', 'Como superusuario de la empresa quiero crear usuarios y roles propios con sus módulos para que cada persona tenga lo justo.', ['RF-003', 'RF-071'], 'CU-02', 'Dado un rol con módulos elegidos, cuando se asigna, entonces el usuario ve exactamente eso; dado un rol de mayor nivel, cuando lo intento gestionar, entonces se rechaza.', ['CP-04', 'CP-05', 'CP-45'], 'Terminada'),
 ('HU-03', 'Registrar clientes y vehículos', 'Cajera', 'Como cajera quiero registrar al cliente y su vehículo una sola vez para no duplicar datos ni perder su historial.', ['RF-004', 'RF-005', 'RF-007'], 'CU-03', 'Dado un documento o una placa existente, cuando lo registro, entonces el sistema avisa; dado un traspaso, cuando lo guardo, entonces el vehículo conserva su historial.', ['CP-06', 'CP-07', 'CP-08', 'CP-09', 'CP-10'], 'Terminada'),
 ('HU-04', 'Precio según el grupo', 'Administrador', 'Como administrador quiero fijar el precio base y las reglas por grupo para que cada servicio salga con su precio sin calcularlo a mano.', ['RF-008', 'RF-009', 'RF-010', 'RF-100', 'RF-101', 'RF-102'], 'CU-04', 'Dado un vehículo del grupo G3 y una regla «+S/ 20» para el servicio, cuando lo agrego a la ODS, entonces sale el precio estándar más 20.', ['CP-19', 'CP-20', 'CP-21', 'CP-22', 'CP-23', 'CP-24', 'CP-59', 'CP-60'], 'Terminada'),
 ('HU-05', 'Atender la ODS', 'Cajera, Jefe de taller', 'Como cajera quiero crear la ODS con sus servicios, fotos y estado del vehículo y moverla hasta el cierre para registrar todo el trabajo.', ['RF-011', 'RF-015', 'RF-016', 'RF-018', 'RF-089'], 'CU-05', 'Dada una ODS nueva, cuando la guardo, entonces recibe su código sin repetir; dada una ODS cerrada sin nota de venta, entonces queda marcada.', ['CP-11', 'CP-12', 'CP-13', 'CP-14', 'CP-15', 'CP-16', 'CP-17', 'CP-18', 'CP-25', 'CP-58'], 'En curso'),
 ('HU-06', 'Asignar el plan', 'Jefe de taller', 'Como jefe de taller quiero asignar a cada vehículo el plan de su grupo para planificar sus mantenimientos.', ['RF-026', 'RF-028', 'RF-030', 'RF-103'], 'CU-06', 'Dado un vehículo sin plan con las mismas características de otro, cuando creo un plan, entonces el sistema me lo sugiere.', ['CP-26', 'CP-27', 'CP-28', 'CP-29'], 'Pendiente'),
 ('HU-07', 'Ver la línea de tiempo y reajustar', 'Jefe de taller', 'Como jefe de taller quiero ver la línea de tiempo del vehículo y que el plan se reajuste con los servicios reales para no repetir trabajos.', ['RF-031', 'RF-032', 'RF-034', 'RF-067'], 'CU-07', 'Dado un correctivo que cubrió un preventivo, cuando se confirma, entonces solo cambian las visitas futuras y queda el motivo.', ['CP-30', 'CP-31', 'CP-32', 'CP-33'], 'Pendiente'),
 ('HU-08', 'Organizar mis tareas', 'Técnico, Cajera', 'Como técnico quiero ver mis tareas en lista, tablero o calendario para saber qué me toca hoy y mañana.', ['RF-036', 'RF-037', 'RF-039', 'RF-055'], 'CU-08', 'Dada una ODS nueva, cuando se crea, entonces aparece una tarea por ítem para su responsable; dada una vista con filtros, entonces se guarda para mí.', ['CP-34', 'CP-35', 'CP-36', 'CP-37'], 'Pendiente'),
 ('HU-09', 'Agendar y atender citas', 'Cajera', 'Como cajera quiero agendar citas con el encabezado de la ODS y, cuando llegue el cliente, crear su ODS con un clic.', ['RF-053', 'RF-054', 'RF-055'], 'CU-09', 'Dada una cita con cotización, cuando la marco Atendida y acepto, entonces se crea la ODS con su encabezado y su cotización.', ['CP-38', 'CP-39'], 'Pendiente'),
 ('HU-10', 'Dejar constancia', 'Todos los usuarios', 'Como usuario quiero comentar, adjuntar y mencionar en la bitácora y que los cambios queden auditados para saber qué pasó.', ['RF-059', 'RF-060', 'RF-063'], 'CU-10', 'Dado un cambio en la ODS, cuando se guarda, entonces queda quién, cuándo, antes y después.', ['CP-40', 'CP-41', 'CP-42'], 'En curso'),
 ('HU-11', 'Cotizar y vender', 'Cajera', 'Como cajera quiero cotizar y emitir la nota de venta con su IGV para cobrar y registrar el pago en el banco del local.', ['RF-087', 'RF-088', 'RF-090', 'RF-091'], 'CU-11', 'Dada una nota de venta con servicios por más de S/ 700, cuando la emito, entonces se propone la detracción.', ['CP-43', 'CP-44', 'CP-46', 'CP-47'], 'Pendiente'),
 ('HU-12', 'Llevar el kárdex', 'Logístico', 'Como logístico quiero registrar compras y traslados para que el kárdex refleje el stock de cada local.', ['RF-078', 'RF-092'], 'CU-12', 'Dada una compra, cuando la registro, entonces suma al kárdex del local.', ['CP-48', 'CP-49'], 'Pendiente'),
 ('HU-13', 'Hacer la posventa', 'Cajera', 'Como cajera quiero que el sistema me programe el seguimiento y me deje enviar la encuesta para recuperar clientes.', ['RF-094', 'RF-095', 'RF-097'], 'CU-13', 'Dada una ODS cerrada, entonces a los cinco días hábiles tengo la tarea de seguimiento.', ['CP-50', 'CP-51', 'CP-52'], 'Pendiente'),
 ('HU-14', 'Medir el taller', 'Administrador', 'Como administrador quiero ver reportes y métricas por local para tomar decisiones.', ['RF-065', 'RF-066', 'RF-096', 'RF-098'], 'CU-14', 'Dado un periodo y un local, cuando filtro, entonces veo las ODS, las horas por técnico, las métricas y la conversión de citas.', ['CP-53', 'CP-54', 'CP-55', 'CP-56'], 'Pendiente'),
 ('HU-15', 'Documentos con mi marca', 'Superusuario', 'Como superusuario quiero configurar los datos y logotipos de la empresa para que los documentos salgan con su marca.', ['RF-085'], 'CU-15', 'Dados los logotipos cargados, cuando emito una nota de venta, entonces sale con ellos.', ['CP-57'], 'Pendiente'),
]

# ---------------------------------------------------------------------------
# Casos de prueba: ejecutados (con prueba automática real) y diseñados
# (código, RF, HU, nombre, precondición, pasos, resultado esperado, tipo, archivo, nombre del test, nivel)
# ---------------------------------------------------------------------------
API, WEB = 'API (Jest y Supertest)', 'Interfaz (Vitest)'
CP_EJEC = [
 ('CP-01', 'RF-001', 'HU-01', 'Ingreso con credenciales válidas e inválidas', 'Usuario de demostración activo', 'Enviar correo y clave correctos; luego una clave incorrecta y un usuario inexistente.', 'Con datos válidos devuelve la sesión con sus roles; con datos inválidos responde 401.', API, 'apps/api/src/sesion/sesion.spec.ts', ['credenciales válidas devuelven sesión con sus roles', 'contraseña incorrecta o usuario inexistente responden 401']),
 ('CP-02', 'RF-002', 'HU-01', 'Permiso verificado en el servidor', 'Sesión de un Técnico', 'Pedir el módulo de bancos con la sesión del Técnico.', 'Responde 403 aunque la pantalla oculte la opción.', API, 'apps/api/src/sesion/sesion.spec.ts', ['un Técnico recibe 403 en bancos aunque la pantalla lo oculte']),
 ('CP-03', 'RF-002', 'HU-01', 'Menú según el rol', 'Sesión iniciada', 'Ingresar y leer el menú.', 'El menú muestra solo los módulos del rol, el nombre y la etiqueta del rol.', WEB, 'apps/web/src/App.test.tsx', ['al ingresar, el menú muestra solo los módulos del rol, el nombre y la etiqueta del rol']),
 ('CP-04', 'RF-003', 'HU-02', 'Rol propio con módulos elegidos', 'Sesión del Superadministrador', 'Crear un rol con dos módulos y niveles y asignarlo a un usuario.', 'Quien recibe el rol ve exactamente esos módulos.', API, 'apps/api/src/usuario/usuario.spec.ts', ['el Superadministrador crea un rol con módulos y niveles, y quien lo recibe ve exactamente eso']),
 ('CP-05', 'RF-003', 'HU-02', 'Alta de usuario auditada', 'Sesión del Superadministrador', 'Crear un usuario con rol Cajera e ingresar con su clave.', 'El usuario entra y el alta queda en la auditoría.', API, 'apps/api/src/usuario/usuario.spec.ts', ['el Superadministrador crea un usuario con rol Cajera, entra con su clave y queda auditado']),
 ('CP-06', 'RF-004', 'HU-03', 'Documento único del cliente', 'Cliente con DNI registrado', 'Crear otro cliente con el mismo número; un RUC del mismo valor se rechaza por el formato antes de llegar a la unicidad.', 'Responde 409 por el documento repetido, o 400 si el formato no corresponde al tipo.', API, 'apps/api/test/maestros.spec.ts', ['el número de documento no se repite']),
 ('CP-07', 'RF-005', 'HU-03', 'Búsqueda por placa, VIN, nombre o documento', 'Vehículos precargados', 'Buscar por placa sin guion, en minúsculas, por VIN, por nombre y por documento del titular.', 'Siempre se encuentra el mismo vehículo.', API, 'apps/api/test/maestros.spec.ts', ['los vehículos se encuentran por placa sin importar guiones ni mayúsculas, VIN, nombre y documento del titular']),
 ('CP-08', 'RF-005', 'HU-03', 'Placa repetida con otro formato', 'Vehículo con placa registrada', 'Registrar la misma placa sin guion, en minúsculas o con espacios.', 'Responde 409 indicando el titular.', API, 'apps/api/test/maestros.spec.ts', ['la misma placa con otro formato (sin guion, minúsculas, con espacios) ya existe: 409 con el titular']),
 ('CP-09', 'RF-005', 'HU-03', 'Traspaso sin perder el historial', 'Vehículo con lecturas de km', 'Cambiar el titular del vehículo.', 'El vehículo conserva su ID y sus lecturas, y el cambio queda auditado.', API, 'apps/api/test/maestros.spec.ts', ['traspasar el vehículo a otro titular es editar el vehículo y queda auditado']),
 ('CP-10', 'RF-007', 'HU-03', 'Lecturas de kilometraje', 'Vehículo registrado', 'Registrar dos lecturas y consultar el vehículo.', 'Se guardan ambas y el kilometraje actual es el de la última.', API, 'apps/api/test/maestros.spec.ts', ['cada lectura se guarda y el kilometraje actual es el de la última']),
 ('CP-11', 'RF-011', 'HU-05', 'Código de la ODS', 'Cliente y vehículo registrados', 'Crear una ODS sin técnico.', 'El código es AAAAMMDD + correlativo de 5 dígitos.', API, 'apps/api/src/ordenServicio/ordenServicio.spec.ts', ['el código es AAAAMMDD + correlativo de 5 dígitos y el técnico es opcional']),
 ('CP-12', 'RF-011', 'HU-05', 'Correlativo sin repetir en paralelo', 'Cliente y vehículos registrados', 'Crear dos ODS al mismo tiempo.', 'Reciben números distintos.', API, 'apps/api/src/ordenServicio/ordenServicio.spec.ts', ['dos ODS que se crean a la vez reciben números distintos']),
 ('CP-13', 'RF-011', 'HU-05', 'Ítems de servicio y de producto', 'ODS creada', 'Agregar servicios y productos con referencia y decimales.', 'Cada línea se redondea a 2 decimales y el total es la suma.', API, 'apps/api/src/ordenServicio/ordenServicio.spec.ts', ['servicios y productos con referencia; cada línea se redondea a 2 decimales y el total es la suma']),
 ('CP-14', 'RF-011', 'HU-05', 'Dos ODS abiertas solo con garantía (RN-07)', 'Vehículo con una ODS abierta', 'Crear otra ODS normal y luego una de garantía; después otra de garantía.', 'Solo se acepta la de garantía y nunca dos de garantía.', API, 'apps/api/src/ordenServicio/ordenServicio.spec.ts', ['un vehículo puede tener dos ODS abiertas solo si una es de Garantía, y nunca dos de Garantía']),
 ('CP-15', 'RF-015', 'HU-05', 'Fotos de ingreso: opcionales y máximo 5', 'ODS creada', 'Subir cinco fotos y luego una sexta; subir un video.', 'Se aceptan cinco; la sexta responde 409 y el video 400.', API, 'apps/api/src/ordenServicio/ordenServicio.spec.ts', ['evidencias: son opcionales y como máximo 5 fotos por ODS']),
 ('CP-16', 'RF-016', 'HU-05', 'Estados y fecha de cierre', 'ODS en Recepción', 'Mover a En proceso, a En entrega y a Cerrada; reabrir.', 'Al cerrar se pone la fecha de cierre y al reabrir se borra.', API, 'apps/api/src/ordenServicio/ordenServicio.spec.ts', ['los estados se mueven libremente, incluso de Recepción a Entrega', 'sin nota de venta solo se cierra una ODS «No aprobada»; al cerrar se pone la fecha de cierre y al reabrir se borra']),
 ('CP-17', 'RF-089', 'HU-05', 'Abonos y saldo', 'ODS con ítems', 'Registrar abonos y uno mayor a lo pendiente.', 'Bajan el saldo, no el total; el que excede se rechaza.', API, 'apps/api/src/ordenServicio/ordenServicio.spec.ts', ['los abonos no superan lo pendiente y bajan el saldo, no el total']),
 ('CP-18', 'RF-089', 'HU-05', 'Abonos simultáneos (RNF-05)', 'ODS con saldo', 'Enviar tres abonos a la vez por todo lo pendiente.', 'Solo entra uno.', API, 'apps/api/src/ordenServicio/ordenServicio.spec.ts', ['tres abonos a la vez por todo lo pendiente: solo entra uno']),
 ('CP-19', 'RF-008', 'HU-04', 'Proveedores', 'Sesión del Administrador', 'Crear, editar y listar un proveedor; repetir su documento; crear un servicio externo sin proveedor y con proveedor.', 'El documento no se repite (409) y el servicio externo exige su proveedor.', API, 'apps/api/test/s5.spec.ts', ['crea, edita y lista un proveedor; el documento no se repite', 'un servicio externo necesita su proveedor']),
 ('CP-20', 'RF-009', 'HU-04', 'Servicios con horas estándar (RN-08)', 'Sesión del Administrador', 'Crear un servicio con horas y precio, otro sin horas y otro con 0,3 h.', 'Guarda categoría, horas, precio y externo; sin horas toma 1 h; 0,3 h se rechaza.', API, 'apps/api/test/s5.spec.ts', ['un servicio guarda categoría, horas, precio base y marca externo', 'sin horas de AutoData el servicio toma 1 h (RN-08)']),
 ('CP-21', 'RF-010', 'HU-04', 'Productos', 'Sesión del Administrador', 'Crear un producto, repetir su código y usarlo como ítem de una ODS.', 'Guarda código, unidad, precio y costo; el código no se repite; el ítem de la ODS queda enlazado al producto.', API, 'apps/api/test/s5.spec.ts', ['un producto guarda código, unidad, precio y costo; el código no se repite', 'el producto del catálogo se usa como ítem de la ODS']),
 ('CP-22', 'RF-100', 'HU-04', 'Grupos de vehículos', 'Grupo de prueba y familia de motor', 'Crear, renombrar y quitar un grupo con un vehículo; registrar un vehículo con un código de motor conocido y reasignarlo.', 'El grupo quitado conserva su vehículo; el vehículo toma el grupo de su familia de motor y se puede reasignar.', API, 'apps/api/test/s5.spec.ts', ['se crea, renombra y quita un grupo sin perder sus vehículos', 'el vehículo toma su grupo por la familia del motor y se puede reasignar']),
 ('CP-23', 'RF-101', 'HU-04', 'Precios por grupo (RN-09)', 'Regla «+S/ 20 y +0,5 h» del grupo para un servicio', 'Pedir el precio con y sin vehículo del grupo, agregarlo a la ODS y cambiar el precio en la línea.', 'Toma 4 h y S/ 100 del grupo (3,5 h y S/ 80 sin grupo); el precio cambiado queda marcado.', API, 'apps/api/test/s5.spec.ts', ['el servicio agregado a la ODS toma el precio y las horas del grupo del vehículo (RN-09)', 'un precio cambiado en la línea queda marcado como modificado']),
 ('CP-24', 'RF-102', 'HU-04', 'Solapamiento de servicios', 'Una regla automática y otra opcional', 'Juntar en la ODS los servicios de cada regla; aceptar la opcional y luego mantener los montos.', 'El automático descuenta S/ 10 y lo anota en la bitácora; el opcional solo se aplica si la cajera lo acepta.', API, 'apps/api/test/s5.spec.ts', ['con dos servicios que se solapan, el automático aplica el descuento y avisa en la bitácora', 'el opcional se aplica solo si la cajera lo acepta y se puede mantener el monto']),
]
CP_EXTRA_WEB = [
 ('CP-25', 'RF-011', 'HU-05', 'Nueva orden desde la pantalla', 'Sesión de la Cajera', 'Abrir «Nueva orden», elegir cliente, vehículo y tipo de atención y crearla.', 'La orden se crea con la misma pantalla de edición.', WEB, 'apps/web/src/ordenServicio/Ordenes.test.tsx', ['Nueva orden: pide cliente, vehículo y tipo de atención y la crea']),
 ('CP-40', 'RF-060', 'HU-10', 'Auditoría de maestros', 'Sesión de la Cajera', 'Crear y editar un cliente.', 'Queda quién lo hizo, el antes y el después.', API, 'apps/api/test/maestros.spec.ts', ['crear y editar un cliente guarda quién lo hizo, antes y después']),
 ('CP-59', 'RF-101', 'HU-04', 'Reglas de tiempo y precio (unitarias)', 'Reglas de ejemplo del taller', 'Calcular la rejilla de tiempos, el precio por grupo acumulado y el descuento por solapamiento.', 'Coinciden con los casos de referencia: 130 → 123,50; 125 → 118,80; un solo descuento por línea.', 'Unitaria (Jest)', 'apps/api/src/maestros/maestros.reglas.spec.ts', ['las reglas del grupo se acumulan en orden: servicio, grupo y todos los grupos (RN-09)', 'el solapamiento da un solo descuento por línea, el del grupo o el estándar, sin pasar el total']),
 ('CP-60', 'RF-102', 'HU-04', 'Pantallas de maestros y ODS con catálogo', 'Sesión del Administrador', 'Abrir Grupos y la tabla de precios; en la ODS elegir un servicio del catálogo y aplicar la alerta de solapamiento.', 'Se ve el precio de cada grupo; el servicio toma el precio del grupo y el descuento se envía con su regla.', WEB, 'apps/web/src/maestros/S5.test.tsx', ['Grupos: pestañas de grupos, reglas, precios por grupo y familias; la tabla muestra el precio de cada grupo', 'ODS: el servicio del catálogo toma el precio del grupo y el solapamiento opcional se aplica desde la alerta']),
 ('CP-45', 'RF-071', 'HU-02', 'Locales de la empresa', 'Sesión del Superadministrador', 'Listar los usuarios y los locales.', 'Cada usuario indica su local y se listan los locales de la empresa.', API, 'apps/api/src/usuario/usuario.spec.ts', ['la lista de usuarios indica el local de cada persona', 'el Superadministrador lista los locales de su empresa']),
]

def cp_disenados():
    """Un caso diseñado por cada requisito que no tiene caso ejecutado."""
    cubiertos = {c[1] for c in CP_EJEC + CP_EXTRA_WEB}
    hu_de = {}
    for h in HU:
        for r in h[4]:
            hu_de[r] = h[0]
    usados = {c[0] for c in CP_EJEC + CP_EXTRA_WEB}
    libres = [f'CP-{n:02d}' for n in range(19, 80) if f'CP-{n:02d}' not in usados]
    # mantener la numeración de las HU
    pref = {
     'RF-008': 'CP-19', 'RF-009': 'CP-20', 'RF-010': 'CP-21', 'RF-100': 'CP-22', 'RF-101': 'CP-23', 'RF-102': 'CP-24',
     'RF-026': 'CP-26', 'RF-028': 'CP-27', 'RF-030': 'CP-28', 'RF-103': 'CP-29', 'RF-031': 'CP-30', 'RF-032': 'CP-31',
     'RF-034': 'CP-32', 'RF-067': 'CP-33', 'RF-036': 'CP-34', 'RF-037': 'CP-35', 'RF-039': 'CP-36', 'RF-055': 'CP-37',
     'RF-053': 'CP-38', 'RF-054': 'CP-39', 'RF-059': 'CP-41', 'RF-063': 'CP-42', 'RF-087': 'CP-43', 'RF-088': 'CP-44',
     'RF-090': 'CP-46', 'RF-091': 'CP-47', 'RF-078': 'CP-48', 'RF-092': 'CP-49', 'RF-094': 'CP-50', 'RF-095': 'CP-51',
     'RF-097': 'CP-52', 'RF-065': 'CP-53', 'RF-066': 'CP-54', 'RF-096': 'CP-55', 'RF-098': 'CP-56', 'RF-085': 'CP-57',
     'RF-018': 'CP-58',
    }
    out = []
    for r in RF:
        cod = r[0]
        if cod in cubiertos and cod not in ('RF-015', 'RF-016'):
            continue
        if cod in cubiertos:
            continue
        cp = pref.get(cod) or libres.pop(0)
        ca = r[7]
        pasos = 'Preparar los datos de la precondición y ejecutar: ' + ' '.join(c[0] for c in ca[:1])
        esperado = ' '.join(c[0] for c in ca)
        out.append((cp, cod, hu_de.get(cod, '—'), r[2], 'Datos sintéticos de demostración', pasos, esperado,
                    'Funcional de caja negra', '—', []))
    return out

CP_DIS = cp_disenados()
CP_TODOS = sorted(CP_EJEC + CP_EXTRA_WEB + CP_DIS, key=lambda c: c[0])

# Casos ya ejecutados que deben actualizarse por R8.2
CP_A_ACTUALIZAR = {'CP-16': 'La prueba aún exige «No aprobada» para cerrar sin nota de venta; con RN-06 cambia a «cerrar marcado Sin nota de venta».'}

# ---------------------------------------------------------------------------
# Trazabilidad de diseño (por requisito)
# ---------------------------------------------------------------------------
DIS = {  # modulo -> (DCU, DCL, DMD, DSE, DES, DAC)
 M_ACC: ('DCU-R81-0001', 'DCL-R81-0001', 'DMD-R81-0001', '—', '—', '—'),
 M_MAE: ('DCU-R81-0001', 'DCL-R81-0001', 'DMD-R81-0001', '—', '—', 'DAC-R82-0004'),
 M_CAT: ('DCU-R81-0002', 'DCL-R82-0008', 'DMD-R81-0002', '—', '—', '—'),
 M_ODS: ('DCU-R81-0001', 'DCL-R81-0001', 'DMD-R81-0001', 'DSE-R82-0002', 'DES-R81-0001', 'DAC-R82-0004 a 0007'),
 M_PLA: ('DCU-R81-0001', 'DCL-R81-0003', 'DMD-R81-0002', 'DSE-R81-0003', '—', 'DAC-R82-0001'),
 M_TAR: ('DCU-R81-0001', 'DCL-R82-0004', 'DMD-R81-0002', 'DSE-R82-0002', 'DES-R81-0001', 'DAC-R82-0005'),
 M_CIT: ('DCU-R81-0001', 'DCL-R82-0004', 'DMD-R81-0002', 'DSE-R82-0002', 'DES-R82-0002', 'DAC-R82-0004'),
 M_BIT: ('DCU-R81-0001', 'DCL-R82-0004', 'DMD-R81-0001', '—', '—', 'DAC-R82-0007'),
 M_COM: ('DCU-R81-0002', 'DCL-R81-0005', 'DMD-R81-0003', 'DSE-R81-0004', 'DES-R82-0002', 'DAC-R82-0006'),
 M_INV: ('DCU-R81-0002', 'DCL-R81-0006', 'DMD-R81-0004', 'DSE-R81-0005', 'DES-R81-0003', '—'),
 M_POS: ('DCU-R81-0001', 'DCL-R81-0007', 'DMD-R81-0004', 'DSE-R81-0003', '—', 'DAC-R81-0002'),
 M_REP: ('DCU-R81-0002', 'DCL-R81-0007', 'DMD-R81-0004', 'DSE-R81-0006', '—', '—'),
 M_CFG: ('DCU-R81-0001', 'DCL-R81-0006', 'DMD-R81-0001', '—', '—', '—'),
}

# Trazabilidad de desarrollo de lo implementado (BD, back, front, prueba)
DEV = {
 'RF-001': ('Usuario (contraseña con bcrypt)', 'sesion/ AuthController, AutenticacionGuard', 'sesion/ Login; App', 'sesion.spec; App.test'),
 'RF-002': ('Rol, Permiso, RolPermiso, UsuarioRol, ModuloHabilitado', 'comun/ PermisosGuard; sesion/ GET /me', 'comun/ Shell (menú por rol)', 'sesion.spec; App.test'),
 'RF-003': ('Usuario, Rol, UsuarioRol, Auditoria', 'usuario/ UsuariosController', 'usuario/ Usuarios y Roles', 'usuario.spec; Usuarios.test'),
 'RF-004': ('Cliente (documento único por empresa)', 'cliente/ ClienteController', 'cliente/ Clientes', 'maestros.spec; Maestros.test'),
 'RF-005': ('Vehiculo (placa normalizada única), MarcaVehiculo', 'vehiculo/ VehiculoController', 'vehiculo/ Vehículos', 'maestros.spec; precarga.spec; Maestros.test'),
 'RF-007': ('LecturaKm', 'vehiculo/ VehiculoController (lecturas)', 'vehiculo/ Registrar km', 'maestros.spec; Maestros.test'),
 'RF-011': ('OrdenServicio, CorrelativoODS, DetalleODS', 'ordenServicio/ OrdenesController (crear, editar, ítems)', 'ordenServicio/ Ordenes, EditorOrden', 'ordenServicio.spec; base.spec; Ordenes.test'),
 'RF-015': ('OrdenServicio (tipoAtencion, estadoVehiculo), EvidenciaIngreso', 'ordenServicio/ OrdenesController (evidencias)', 'ordenServicio/ Ingreso, Camara', 'ordenServicio.spec; Ordenes.test'),
 'RF-016': ('OrdenServicio (estado, fechaCierre)', 'ordenServicio/ OrdenesController (estado)', 'ordenServicio/ Estado de la orden', 'ordenServicio.spec; Ordenes.test'),
 'RF-089': ('Abono', 'ordenServicio/ OrdenesController (abonos)', 'ordenServicio/ Abonos', 'ordenServicio.spec; base.spec'),
 'RF-008': ('Proveedor (documento único por empresa)', 'maestros/ MaestrosController (proveedores)', 'maestros/ Proveedores', 's5.spec'),
 'RF-009': ('Servicio (horas y precio estándar, horasFuente)', 'maestros/ MaestrosController (servicios)', 'maestros/ Catálogo (servicios)', 's5.spec'),
 'RF-010': ('Producto; DetalleODS.productoId', 'maestros/ MaestrosController (productos)', 'maestros/ Catálogo (productos); EditorOrden', 's5.spec'),
 'RF-100': ('GrupoVehicular, FamiliaMotor, ReglaAsignacionModelo; Vehiculo.grupoId', 'maestros/ asignarGrupo; vehiculo/ VehiculoController', 'maestros/ Grupos; vehiculo/ Vehículos (grupo)', 's5.spec; maestros.reglas.spec'),
 'RF-101': ('ReglaPrecio; DetalleODS (horas, precioGrupo, trazaPrecio)', 'maestros/ calcularServicio; ordenServicio/ ítems', 'maestros/ Grupos (reglas y precios); EditorOrden', 's5.spec; maestros.reglas.spec; S5.test'),
 'RF-102': ('Solapamiento; DetalleODS (descuentoMonto, solapamientoId)', 'maestros/ evaluarSolapamientos; ordenServicio/ ítems', 'maestros/ Solapamientos; EditorOrden (alerta)', 's5.spec; maestros.reglas.spec; S5.test'),
 'RF-060': ('Auditoria', 'comun/ auditoría en cada controlador', '—', 'maestros.spec; usuario.spec'),
 'RF-063': ('Bitacora', 'ordenServicio/ OrdenesController (bitácora)', 'ordenServicio/ Bitácora de la ODS', 'ordenServicio.spec'),
 'RF-071': ('Organizacion, Local', 'usuario/ UsuariosController (locales)', 'usuario/ Usuarios (local)', 'usuario.spec'),
}

# Slices R8.2
SLICES = [
 ('S1', 'Acceso, usuarios y roles', ['RF-001', 'RF-002', 'RF-003'], 'RNF-01 a 04', 'Terminado'),
 ('S2', 'Clientes y vehículos', ['RF-004', 'RF-005', 'RF-007'], 'RNF-03, 06, 08', 'Terminado'),
 ('S3', 'Órdenes de servicio', ['RF-011', 'RF-015', 'RF-016', 'RF-018', 'RF-089'], 'RNF-05, 06, 09', 'En curso: falta RF-018 y los ajustes R8.2 (RN-05, RN-06, garantía enlazada)'),
 ('S4', 'Migración inicial (procedimiento interno RN-11)', [], '—', 'Pendiente, sin requisitos funcionales: se hace después del S5 porque también carga los maestros'),
 ('S5', 'Maestros de servicios, productos, grupos y precios', ['RF-008', 'RF-009', 'RF-010', 'RF-100', 'RF-101', 'RF-102'], 'RNF-03, 06, 08', 'Terminado'),
 ('S6', 'Planes preventivos', ['RF-026', 'RF-028', 'RF-030', 'RF-103'], '—', 'Pendiente'),
 ('S7', 'Línea de tiempo y reajuste', ['RF-031', 'RF-032', 'RF-034', 'RF-067'], '—', 'Pendiente'),
 ('S8', 'Tareas y vistas', ['RF-036', 'RF-037', 'RF-039', 'RF-055'], 'RNF-09', 'Pendiente'),
 ('S9', 'Citas', ['RF-053', 'RF-054'], '—', 'Pendiente'),
 ('S10', 'Bitácora y auditoría', ['RF-059', 'RF-060', 'RF-063'], 'RNF-03', 'Pendiente (la auditoría y la bitácora de la ODS ya existen)'),
 ('S11', 'Cotización, nota de venta, cuentas y bancos', ['RF-087', 'RF-088', 'RF-090', 'RF-091'], 'RNF-05, 06', 'Pendiente'),
 ('S12', 'Compras e inventario', ['RF-078', 'RF-092'], 'RNF-05', 'Pendiente'),
 ('S13', 'Posventa', ['RF-094', 'RF-095', 'RF-097'], '—', 'Pendiente'),
 ('S14', 'Reportes, métricas y configuración', ['RF-065', 'RF-066', 'RF-096', 'RF-098', 'RF-071', 'RF-085'], 'RNF-07', 'Pendiente'),
]

BETA_RESUMEN = [
 ('Jornada fina del técnico', 'Dividir, continuar y extender tareas con motivo, redistribuir en 0,25 H-H, consolidar y corregir la jornada, y recalcular horas con el tiempo real.'),
 ('Agenda con capacidad', 'Horarios, almuerzo y capacidad por técnico, con aviso de empalmes; hoy se agenda sin límite.'),
 ('Logística de productos', 'Solicitud y cotización a proveedores, entrega al técnico, conformidad y tiempos de compra.'),
 ('Decisión del cliente, por ítem', 'Aprobar o no aprobar cada ítem de la ODS (no toda la orden junta) y volver ese ítem a pendiente de aprobación al agregarlo o cambiarlo; RF-076 y RF-077.'),
 ('Conversión de citas', 'Enlace formal cita–ODS, alerta obligatoria al crear una ODS con cita, reglas contra registros tardíos, confirmación del cliente por enlace y cierre automático del día.'),
 ('Facturación electrónica e impuestos', 'Boleta y factura electrónicas y reporte de impuestos y detracciones; hoy se emiten con SUNAT o un facturador externo.'),
 ('Generación de planes con IA', 'Un modelo que aprende de los planes de AutoData y crea planes para vehículos sin grupo.'),
]
