export interface ItemMenu { id: string; label: string; grupo: string; nivel: 'A' | 'E' | 'V' }
export interface Me {
  usuario: { id: string; nombre: string; correo: string; organizacionId: string | null };
  roles: string[];
  empresa?: { nombre: string; logoPng: string | null } | null;
  permisos: Record<string, 'A' | 'E' | 'V'>;
  menu: ItemMenu[];
  actuandoComo: boolean;
  esPlataforma: boolean;
  real: { id: string; nombre: string };
}
export interface UsuarioLista { id: string; nombre: string; correo: string; activo: boolean; localId?: string | null; roles: string[] }
export interface Rol { id: string; nombre: string; ambito: string; nivel: number; esBase: boolean; asignable: boolean; permisos: { modulo: string; nivel: 'A' | 'E' | 'V' }[] }
export interface Local { id: string; nombre: string; organizacionId: string }
export type TipoDocumento = 'DNI' | 'CARNET_EXTRANJERIA' | 'RUC';
export interface Pais { codigo: string; nombre: string; prefijo: string }
export interface Cliente {
  id: string; tipoDocumento: TipoDocumento; documento: string; nombre: string; nombreComercial: string | null; pais: string; movil: string | null;
  direccionFiscal: string | null; email: string | null; contacto: string | null; ubigeo: string | null; comentario: string | null; esGenerico: boolean; activo: boolean; creadoEn: string; vehiculos?: number;
}
export interface Vehiculo {
  id: string; placa: string; marca: string | null; modelo: string | null; anio: number | null; color: string | null; nroSerie: string | null; nroVin: string | null; nroMotor: string | null;
  comentario: string | null; grupo: string | null; grupoId?: string | null; grupoFuente?: string | null; codigoMotor?: string | null; uso?: string | null; aceite?: string | null; planId?: string | null; plan?: string | null; planCodigo?: string | null; creadoEn: string; kmActual: number | null; cliente: { id: string; nombre: string; documento: string; tipoDocumento: TipoDocumento };
}
/** Respuesta de la consulta vehicular por placa. */
export interface ConsultaVehicular { placa: string; marca: string | null; modelo: string | null; anio: number | null; color: string | null; nroSerie: string | null; nroVin: string | null; nroMotor: string | null; codigoMotor: string | null }
/** Respuesta de la consulta de DNI (RENIEC) o RUC (SUNAT). */
export interface ConsultaDocumento { tipoDocumento: 'DNI' | 'RUC'; documento: string; nombre: string; direccion: string | null; estado: string | null; condicion: string | null }
export interface Marca { id: string; nombre: string; modelos: string[] }
export interface Persona { id: string; nombre: string }
export interface DetalleOds {
  aprobado?: boolean;
  id?: string; tipo: 'servicio' | 'producto'; descripcion: string; referencia: string | null; cantidad: number; costo: number | null; rentabilidadPct: number | null;
  precio: number; descuentoPct: number; impuesto: 'IGV' | 'NINGUNO'; total: number; tecnicoId?: string | null;
  servicioId?: string | null; productoId?: string | null; horas?: number | null; precioGrupo?: number | null; precioModificado?: boolean;
  trazaPrecio?: string[] | null; descuentoMonto?: number; solapamientoId?: string | null;
}
export interface Abono { id: string; fecha: string; metodo: string; concepto: string | null; valor: number }
export interface Orden {
  id: string; codigo: string; externa: boolean; estado: string; decision: string; tipoAtencion: string; tipoAtencionDetalle: string | null; fechaInicio: string; fechaCierre: string | null; km: number | null;
  observaciones: string | null; recomendaciones: string | null;
  cliente: { id: string; nombre: string; documento: string; tipoDocumento: TipoDocumento; movil?: string | null; direccionFiscal?: string | null; pais?: string };
  vehiculo: { id: string; grupo?: string | null; placa: string; marca: string | null; modelo: string | null; anio: number | null; color: string | null; nroSerie: string | null; nroVin: string | null; nroMotor: string | null };
  tecnico: Persona | null; jefeTaller: Persona | null; creadoPor: Persona | null;
  detalles: DetalleOds[]; total: number; totalAprobado?: number; abonos: Abono[]; totalAbonos: number; pendiente: number; solapamientosMantenidos?: string[]; horas?: number;
  estadoVehiculo?: EstadoVehiculo | null; evidencias?: EvidenciaOds[]; solicitudes?: SolicitudOds[]; notaVenta?: NotaOrden | null;
  // Garantía enlazada: la orden de origen y los servicios que la originaron.
  garantia?: { ordenId: string; codigo: string; tipoAtencion: string; servicios: { id: string; descripcion: string; total: number; tecnico: { id: string; nombre: string } | null }[] } | null;
  comprobantes: string[]; conComprobante: boolean; ultimaBitacora: { texto: string; fecha: string; actor: string } | null; bitacora: { texto: string; fecha: string; actor: string }[];
}
/** RF-088: nota de venta. `NotaOrden` es la vigente que viaja con la orden; `NotaVenta`, la completa. */
export type TipoIgv = 'GRAVADO' | 'EXONERADO' | 'INAFECTO';
export interface DetalleNota { id: string; tipo: string; descripcion: string; referencia: string | null; cantidad: number; precio: number; descuentoPct: number; tipoIgv: TipoIgv; total: number }
export interface NotaOrden { id: string; codigo: string; condicion: 'CONTADO' | 'CREDITO'; fechaEmision: string; fechaVencimiento: string | null; local: string; observaciones: string | null; comentario: string | null; detalles: DetalleNota[]; exonerada: number; inafecta: number; gravada: number; igv: number; total: number; conDetraccion: boolean; detraccionPct: number; detraccion: number }
/** Cotización: sin pagos ni caja; el vehículo es opcional y «válida hasta» marca su vigencia. */
export interface Cotizacion { id: string; codigo: string; estado: 'VIGENTE' | 'VENCIDA' | 'ANULADA'; fechaEmision: string; validaHasta: string; condicion: 'CONTADO' | 'CREDITO'; formaPago: string | null; conIgv: boolean; conDetraccion: boolean; observaciones: string | null; comentario: string | null; local: { id: string; nombre: string }; cliente: { id: string; nombre: string; documento: string; tipoDocumento: TipoDocumento; direccionFiscal: string | null; movil: string | null }; vehiculo: { id: string; placa: string; marca: string | null; modelo: string | null } | null; detalles: (DetalleNota & { servicioId: string | null; productoId: string | null })[]; exonerada: number; inafecta: number; gravada: number; igv: number; total: number; creadaPor: string; anuladaPor: string | null; motivoAnulacion: string | null }
export interface NotaVenta extends Omit<NotaOrden, 'local' | 'detalles'> { detalles: (DetalleNota & { servicioId?: string | null; productoId?: string | null })[]; serie: string; numero: number; estado: 'EMITIDA' | 'ANULADA'; local: { id: string; nombre: string }; pagado: number; saldo: number; emitidaPor: string; anuladaPor: string | null; motivoAnulacion: string | null; orden: { id: string; codigo: string; km: number | null } | null; pagos: Abono[]; cliente: { id: string; nombre: string; documento: string; tipoDocumento: TipoDocumento; direccionFiscal: string | null; movil: string | null }; vehiculo: { id?: string; placa: string; marca: string | null; modelo: string | null } | null }
/** RF-018: solicitud de corrección o reapertura de una ODS cerrada. */
export interface SolicitudOds { id: string; tipo: 'REAPERTURA' | 'CORRECCION'; motivo: string; estadoDestino: string | null; cambios: Record<string, unknown> | null; estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'; solicitadaPor: string; resueltaPor: string | null; respuesta: string | null; fecha: string; resuelta: string | null }
export type EstadoVehiculo = Record<string, string | string[]>;
export interface EvidenciaOds { id: string; nombre: string; tipo: string; tamano: number; fecha: string }
/** Datos de la empresa que salen en la cabecera y el pie de los PDF de la orden. */
export interface Empresa { nombre: string; ruc: string | null; direccion: string | null; telefono: string | null; correo: string | null; lema: string | null; cuentasBancarias: string | null; terminosRecepcion: string | null; razonSocial?: string | null; pieTicket?: string | null; anchoTicketMm?: number; aprobacionPorItem?: boolean; logo?: { base64: string; ancho: number; alto: number; png?: string | null } | null }
export interface LocalEmpresa { id: string; nombre: string; direccion: string | null; telefono: string | null; serieNotaVenta: string | null; serieBoleta: string | null; serieFactura: string | null }
export interface ConfigEmpresa extends Empresa { locales: LocalEmpresa[] }
export interface CatalogosOds { tiposAtencion: string[]; decisiones: string[]; estados: { id: string; nombre: string }[]; metodosPago: string[]; tecnicos: Persona[]; jefes: Persona[]; logisticos?: Persona[]; cajeras?: Persona[]; empresa?: Empresa; locales?: { id: string; nombre: string; serieNotaVenta: string | null }[]; localId?: string | null }

// ───── Slice S5: maestros ─────
export interface Eliminado { ok: boolean; eliminado: boolean }
/** Compras a proveedores y sus pagos (Cuentas por pagar). */
export interface PagoCompra { id: string; fecha: string; metodo: string; concepto: string | null; valor: number; registradoPor: string }
export interface Compra { id: string; tipoDocumento: 'FACTURA' | 'BOLETA' | 'NOTA_COMPRA'; serie: string; numero: string; codigo: string; fecha: string; condicion: 'CONTADO' | 'CREDITO'; fechaVencimiento: string | null; observaciones: string | null; estado: 'REGISTRADA' | 'ANULADA'; total: number; pagado: number; saldo: number; local: { id: string; nombre: string }; proveedor: { id: string; nombre: string; documento: string; tipoDocumento: TipoDocumento }; detalles: { id: string; productoId: string | null; descripcion: string; cantidad: number; costo: number; descuento: number; total: number }[]; pagos: PagoCompra[]; registradaPor: string; anuladaPor: string | null; motivoAnulacion: string | null }
export interface CatalogosCompra { proveedores: { id: string; nombre: string; documento: string }[]; productos: { id: string; codigo: string; nombre: string; costo: number | null; unidad: string }[]; locales: { id: string; nombre: string }[]; localId: string | null; metodos: string[] }
export interface Proveedor { id: string; tipoDocumento: TipoDocumento; documento: string; nombre: string; nombreComercial: string | null; pais: string; movil: string | null; direccionFiscal: string | null; email: string | null; contacto: string | null; comentario: string | null; rubro: string | null; activo: boolean; creadoEn: string }
export interface Producto { id: string; codigo: string; nombre: string; referencia: string | null; unidad: string; categoria: string | null; marca: string | null; precio: number; costo: number | null; proveedorId: string | null; proveedor: string | null; activo: boolean; stock: Record<string, number>; stockTotal: number }
export interface Servicio { id: string; codigo: string; nombre: string; categoria: string; descripcion: string | null; trabajoMayor: boolean; externo: boolean; proveedorId: string | null; proveedor: string | null; horasEstandar: number; horasFuente: string; precioEstandar: number; repuestos: string[]; activo: boolean; preciosGrupo: Record<string, number | null>; horasGrupo: Record<string, number>; etiqueta: string | null; lineaPlan: string | null; visita: string | null; eligeSistema: string | null; subservicios: { nombre: string; horas: number; servicioId?: string }[]; pasos: { operacion: string; incluye: { paso: string; accion: string; pct: number }[] }[] }
export interface LineaLT { n: string; h: number; c: string; alt?: string }
export interface LineaTemporal {
  vehiculo: { id: string; placa: string; marca: string | null; modelo: string | null; anio: number | null; uso: string | null; aceite: string | null; grupo: string | null; cliente: { id: string; nombre: string; telefono: string | null } } | null;
  plan: { id: string; codigo: string; nombre: string; combustible: string; uso: string; aceite: string; km: number; meses: number; visitas: number; horizonte: number } | null;
  porConfirmar: boolean;
  resumen: { ultimaVisita: { km: number | null; fecha: string; codigo: string } | null; ultimoAceite?: { km: number; fecha: string }; kmHoy: number; rate: number; hoy: string; simulado?: boolean };
  pasadas: { clave: string; mes: string; km: number | null; fecha: string; paquete: string | null; ordenes: { id: string; codigo: string; fecha: string; km: number | null; servicios: string[] }[]; esperadas: LineaLT[]; hechos: string[] }[];
  futuras: { clave: string; k: number; paquete: string; nombre: string; afinamiento: boolean; km: number; fecha: string; vencido: boolean; porVencer: boolean; lineas: LineaLT[] }[];
  tramos: { codigo: string | null; desde: { fecha: string; km: number | null } | null; corte: string | null; por: string | null; hasta: string | null }[];
  asignado: boolean;
  precios: Record<string, { id: string; codigo: string; nombre: string; horas: number; precio: number } | null>;
  categorias: string[];
}
export interface CicloPlan { km: number; meses: number; secuencia: string[]; horizonte: number; patron: string }
export interface PlanPreventivo { id: string; codigo: string; nombre: string; combustible: string; uso: string; aceite: string; activo: boolean; vehiculos: number; km: number; meses: number; horizonte: number; patron: string; ciclo: CicloPlan; visitas: { codigo: string; nombre: string; afinamiento: boolean }[] }
export interface VehiculoSinPlan { vehiculoId: string; placa: string; marca: string | null; modelo: string | null; anio: number | null; grupo: string | null; cliente: string; sugerencia: { planId: string; codigo: string; nombre: string } | null }
export interface Categoria { id: string; tipo: 'producto' | 'servicio' | 'ambos'; nombre: string; activo: boolean; usos: number }
export interface Grupo { id: string; codigo: string; nombre: string; descripcion: string | null; activo: boolean; vehiculos: number; reglas: number; familias: number }
export interface ReglaPrecio { id: string; codigo: string; nivel: 'SERVICIO' | 'GRUPO' | 'GLOBAL'; tipo: 'FIJAR' | 'SUMAR' | 'PORCENTAJE'; grupoId: string | null; grupo: string | null; servicios: string[]; horas: number | null; precio: number | null; porcentaje: number | null; precioDesde: number | null; precioHasta: number | null; orden: number; activa: boolean; nota: string | null }
export interface Solape { id: string; codigo: string; tipo: 'PAR' | 'CONJUNTO'; minimo: number; serviciosBase: string[]; serviciosReducidos: string[]; base: string[]; reducidos: string[]; modo: 'AUTOMATICO' | 'OPCIONAL' | 'AVISO'; descuentoEstandar: number; porcentaje: number | null; porcentajeDiesel: number | null; descuentos: Record<string, number>; horasCompartidas: number | null; alerta: string | null; nota: string | null; estado: string; activo: boolean }
export interface FamiliaMotor { id: string; codigo: string; codigos: string[]; combustible: string | null; litros: string | null; turbo: boolean; grupoId: string | null; grupo: string | null }
export interface TablaPrecios { grupos: string[]; filas: { servicioId: string; codigo: string; nombre: string; categoria?: string; estandar: { horas: number; precio: number }; porGrupo: Record<string, { horas: number; precio: number } | null> }[] }
export interface CatalogoOds { servicios: { id: string; codigo: string; nombre: string; categoria: string | null; horas: number; precio: number; grupo: string | null; repuestos: string[]; etiqueta?: string | null; descripcion?: string | null; subservicios?: { nombre: string; horas: number }[]; pasos?: { operacion: string; incluye: { paso: string; accion: string; pct: number }[] }[] }[]; productos: { id: string; codigo: string; nombre: string; referencia: string | null; unidad: string; marca: string | null; precio: number; costo: number | null; stockTotal: number }[] }
export interface PrecioServicio { servicioId: string; codigo: string; nombre: string; grupo: string | null; horas: number; precio: number; traza: string[]; disponible?: boolean }
export interface AlertaSolape { solapamientoId: string; codigo: string; modo: 'AUTOMATICO' | 'OPCIONAL' | 'AVISO'; indiceBase: number; indiceReducido: number; monto: number; alerta: string; clave: string }

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
const K_TOKEN = 'posventa-token';
const K_COMO = 'posventa-ver-como';

export const sesion = {
  token: () => sessionStorage.getItem(K_TOKEN),
  como: () => sessionStorage.getItem(K_COMO),
  guardar: (t: string) => sessionStorage.setItem(K_TOKEN, t),
  ponerComo: (id: string | null) => (id ? sessionStorage.setItem(K_COMO, id) : sessionStorage.removeItem(K_COMO)),
  limpiar: () => {
    sessionStorage.removeItem(K_TOKEN);
    sessionStorage.removeItem(K_COMO);
  },
};

async function pedir<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = sesion.token();
  if (t) headers.Authorization = `Bearer ${t}`;
  const c = sesion.como();
  if (c) headers['X-Ver-Como'] = c;
  if (init.body instanceof FormData) delete headers['Content-Type']; // el navegador pone el límite multipart
  const r = await fetch(BASE + ruta, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
  if (!r.ok) {
    let mensaje = r.status === 401 ? (ruta === '/auth/login' ? 'Credenciales inválidas.' : 'Tu sesión terminó. Vuelve a ingresar.') : 'No se pudo completar la acción.';
    try {
      const j = (await r.json()) as { message?: string | string[] };
      if (j?.message && r.status !== 401) mensaje = Array.isArray(j.message) ? j.message.join(' ') : j.message;
    } catch {
      /* sin cuerpo */
    }
    throw Object.assign(new Error(mensaje), { status: r.status });
  }
  return (await r.json()) as T;
}

export const api = {
  login: (correo: string, password: string) =>
    pedir<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ correo, password }) }),
  me: () => pedir<Me>('/me'),
  usuarios: () => pedir<UsuarioLista[]>('/usuarios'),
  roles: () => pedir<Rol[]>('/roles'),
  crearLocal: (d: Record<string, unknown>) => pedir<LocalEmpresa[]>('/locales-series', { method: 'POST', body: JSON.stringify(d) }),
  eliminarLocal: (id: string) => pedir<LocalEmpresa[]>('/locales-series/' + id, { method: 'DELETE' }),
  localesSeries: () => pedir<LocalEmpresa[]>('/locales-series'),
  asignarSeries: (id: string, d: Record<string, string>) => pedir<LocalEmpresa[]>('/locales-series/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  locales: () => pedir<Local[]>('/locales'),
  crearUsuario: (d: { nombre: string; correo: string; password: string; rolIds: string[]; localId?: string }) =>
    pedir<UsuarioLista>('/usuarios', { method: 'POST', body: JSON.stringify(d) }),
  editarUsuario: (id: string, d: { nombre?: string; activo?: boolean; rolIds?: string[]; password?: string; localId?: string }) =>
    pedir<UsuarioLista>('/usuarios/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  editarRol: (id: string, d: { nombre?: string; permisos?: { modulo: string; nivel: string }[] }) => pedir<{ id: string }>('/roles/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  eliminarRol: (id: string) => pedir<{ ok: boolean }>('/roles/' + id, { method: 'DELETE' }),
  crearRol: (d: { nombre: string; permisos: { modulo: string; nivel: string }[] }) => pedir<Rol>('/roles', { method: 'POST', body: JSON.stringify(d) }),
  config: () => pedir<{ paisPredeterminado: string; paises: Pais[] }>('/maestros/config'),
  clientes: (q = '') => pedir<Cliente[]>('/clientes' + (q ? '?q=' + encodeURIComponent(q) : '')),
  cliente: (id: string) => pedir<Cliente & { vehiculos: { id: string; placa: string }[] }>('/clientes/' + id),
  empresa: () => pedir<ConfigEmpresa>('/empresa'),
  editarEmpresa: (d: Record<string, unknown>) => pedir<ConfigEmpresa>('/empresa', { method: 'PATCH', body: JSON.stringify(d) }),
  editarLocalEmpresa: (id: string, d: Record<string, unknown>) => pedir<ConfigEmpresa>('/empresa/locales/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  consultarPlaca: (placa: string) => pedir<ConsultaVehicular>(`/consulta-vehicular?placa=${encodeURIComponent(placa)}`),
  consultarDocumento: (tipo: string, numero: string) => pedir<ConsultaDocumento>(`/consulta-documento?tipo=${encodeURIComponent(tipo)}&numero=${encodeURIComponent(numero)}`),
  crearCliente: (d: Record<string, unknown>) => pedir<Cliente>('/clientes', { method: 'POST', body: JSON.stringify(d) }),
  editarCliente: (id: string, d: Record<string, unknown>) => pedir<Cliente>('/clientes/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  vehiculo: (id: string) => pedir<Vehiculo>('/vehiculos/' + encodeURIComponent(id)),
  vehiculos: (q = '') => pedir<Vehiculo[]>('/vehiculos' + (q ? '?q=' + encodeURIComponent(q) : '')),
  crearVehiculo: (d: Record<string, unknown>) => pedir<Vehiculo>('/vehiculos', { method: 'POST', body: JSON.stringify(d) }),
  editarVehiculo: (id: string, d: Record<string, unknown>) => pedir<Vehiculo>('/vehiculos/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  registrarKm: (id: string, km: number, observacion = '', fecha?: string, fuente?: string) =>
    pedir<{ id: string; km: number }>(`/vehiculos/${id}/lecturas`, { method: 'POST', body: JSON.stringify({ km, ...(observacion ? { observacion } : {}), ...(fecha ? { fecha } : {}), ...(fuente ? { fuente } : {}) }) }),
  marcasVehiculo: () => pedir<Marca[]>('/marcas-vehiculo'),
  crearMarcaVehiculo: (nombre: string) => pedir<Marca>('/marcas-vehiculo', { method: 'POST', body: JSON.stringify({ nombre }) }),
  editarMarcaVehiculo: (id: string, d: Record<string, unknown>) => pedir<Marca>(`/marcas-vehiculo/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  eliminarMarcaVehiculo: (id: string) => pedir<{ ok: boolean }>(`/marcas-vehiculo/${id}`, { method: 'DELETE' }),
  // Eliminar de los maestros: `eliminado` falso = tenía historial y salió de la lista activa.
  eliminarCliente: (id: string) => pedir<Eliminado>(`/clientes/${id}`, { method: 'DELETE' }),
  eliminarVehiculo: (id: string) => pedir<Eliminado>(`/vehiculos/${id}`, { method: 'DELETE' }),
  eliminarUsuario: (id: string) => pedir<Eliminado>(`/usuarios/${id}`, { method: 'DELETE' }),
  eliminarProveedor: (id: string) => pedir<Eliminado>(`/proveedores/${id}`, { method: 'DELETE' }),
  eliminarProducto: (id: string) => pedir<Eliminado>(`/productos/${id}`, { method: 'DELETE' }),
  eliminarServicio: (id: string) => pedir<Eliminado>(`/servicios/${id}`, { method: 'DELETE' }),
  crearFamilia: (d: Record<string, unknown>) => pedir<{ id: string }>('/familias-motor', { method: 'POST', body: JSON.stringify(d) }),
  editarFamilia: (id: string, d: Record<string, unknown>) => pedir<{ id: string }>('/familias-motor/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  eliminarFamilia: (id: string) => pedir<Eliminado>('/familias-motor/' + id, { method: 'DELETE' }),
  editarPlan: (id: string, d: Record<string, unknown>) => pedir<{ id: string }>('/planes-preventivos/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  duplicarPlan: (id: string) => pedir<{ id: string; codigo: string }>(`/planes-preventivos/${id}/duplicar`, { method: 'POST' }),
  eliminarPlan: (id: string) => pedir<Eliminado>('/planes-preventivos/' + id, { method: 'DELETE' }),
  eliminarGrupo: (id: string) => pedir<Eliminado>(`/grupos/${id}`, { method: 'DELETE' }),
  catalogosOds: () => pedir<CatalogosOds>('/ordenes/catalogos'),
  ordenes: (f: Record<string, string>) => pedir<Orden[]>('/ordenes?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString()),
  orden: (id: string) => pedir<Orden>('/ordenes/' + id),
  crearOrden: (d: Record<string, unknown>) => pedir<Orden>('/ordenes', { method: 'POST', body: JSON.stringify(d) }),
  editarOrden: (id: string, d: Record<string, unknown>) => pedir<Orden>('/ordenes/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  guardarDetalles: (id: string, detalles: DetalleOds[], solapamientosMantenidos?: string[]) => pedir<Orden>(`/ordenes/${id}/detalles`, { method: 'PUT', body: JSON.stringify({ detalles, ...(solapamientosMantenidos ? { solapamientosMantenidos } : {}) }) }),
  descuentoOrden: (id: string, porcentaje: number) => pedir<Orden>(`/ordenes/${id}/descuento`, { method: 'POST', body: JSON.stringify({ porcentaje }) }),
  emitirNotaVenta: (ordenId: string, d: Record<string, unknown>) => pedir<NotaVenta>(`/ordenes/${ordenId}/nota-venta`, { method: 'POST', body: JSON.stringify(d) }),
  emitirNotaDirecta: (d: Record<string, unknown>) => pedir<NotaVenta>('/notas-venta', { method: 'POST', body: JSON.stringify(d) }),
  cotizaciones: () => pedir<Cotizacion[]>('/cotizaciones'),
  crearCotizacion: (d: Record<string, unknown>) => pedir<Cotizacion>('/cotizaciones', { method: 'POST', body: JSON.stringify(d) }),
  editarCotizacion: (id: string, d: Record<string, unknown>) => pedir<Cotizacion>(`/cotizaciones/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  eliminarCotizacion: (id: string) => pedir<{ ok: boolean }>(`/cotizaciones/${id}`, { method: 'DELETE' }),
  anularCotizacion: (id: string, motivo: string) => pedir<Cotizacion>(`/cotizaciones/${id}/anular`, { method: 'POST', body: JSON.stringify({ motivo }) }),
  notasVenta: () => pedir<NotaVenta[]>('/notas-venta'),
  anularNotaVenta: (id: string, motivo: string) => pedir<NotaVenta>(`/notas-venta/${id}/anular`, { method: 'POST', body: JSON.stringify({ motivo }) }),
  cuentasCobrar: () => pedir<NotaVenta[]>('/cuentas-cobrar'),
  cobrarNota: (id: string, d: { metodo: string; valor: number; concepto?: string }) => pedir<NotaVenta>(`/notas-venta/${id}/cobros`, { method: 'POST', body: JSON.stringify(d) }),
  compras: () => pedir<Compra[]>('/compras'),
  catalogosCompra: () => pedir<CatalogosCompra>('/compras/catalogos'),
  crearCompra: (d: Record<string, unknown>) => pedir<Compra>('/compras', { method: 'POST', body: JSON.stringify(d) }),
  anularCompra: (id: string, motivo: string) => pedir<Compra>(`/compras/${id}/anular`, { method: 'POST', body: JSON.stringify({ motivo }) }),
  cuentasPagar: () => pedir<Compra[]>('/cuentas-pagar'),
  pagarCompra: (id: string, d: { metodo: string; valor: number; concepto?: string }) => pedir<Compra>(`/compras/${id}/pagos`, { method: 'POST', body: JSON.stringify(d) }),
  solicitarOds: (id: string, d: Record<string, unknown>) => pedir<Orden>(`/ordenes/${id}/solicitudes`, { method: 'POST', body: JSON.stringify(d) }),
  resolverSolicitudOds: (id: string, sid: string, d: Record<string, unknown>) => pedir<Orden>(`/ordenes/${id}/solicitudes/${sid}/resolver`, { method: 'POST', body: JSON.stringify(d) }),
  abonar: (id: string, d: { metodo: string; concepto: string; valor: number }) => pedir<Orden>(`/ordenes/${id}/abonos`, { method: 'POST', body: JSON.stringify(d) }),
  subirEvidencia: async (id: string, archivo: File) => {
    const fd = new FormData();
    fd.append('archivo', archivo);
    return pedir<Orden>(`/ordenes/${id}/evidencias`, { method: 'POST', body: fd });
  },
  verEvidencia: async (id: string, eid: string) => {
    const headers: Record<string, string> = {};
    const t = sesion.token();
    if (t) headers.Authorization = `Bearer ${t}`;
    const c = sesion.como();
    if (c) headers['X-Ver-Como'] = c;
    const r = await fetch(`${BASE}/ordenes/${id}/evidencias/${eid}`, { headers });
    if (!r.ok) throw new Error('No se pudo abrir la evidencia.');
    return URL.createObjectURL(await r.blob());
  },
  quitarEvidencia: (id: string, eid: string) => pedir<Orden>(`/ordenes/${id}/evidencias/${eid}`, { method: 'DELETE' }),
  eliminarOrden: (id: string, motivo: string) => pedir<{ ok: boolean }>('/ordenes/' + id, { method: 'DELETE', body: JSON.stringify({ motivo }) }),
  proveedores: () => pedir<Proveedor[]>('/proveedores'),
  crearProveedor: (d: Record<string, unknown>) => pedir<Proveedor>('/proveedores', { method: 'POST', body: JSON.stringify(d) }),
  editarProveedor: (id: string, d: Record<string, unknown>) => pedir<Proveedor>('/proveedores/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  productos: () => pedir<Producto[]>('/productos'),
  crearProducto: (d: Record<string, unknown>) => pedir<Producto>('/productos', { method: 'POST', body: JSON.stringify(d) }),
  editarProducto: (id: string, d: Record<string, unknown>) => pedir<Producto>('/productos/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  categorias: (tipo?: string) => pedir<Categoria[]>('/categorias-inventario' + (tipo ? '?tipo=' + tipo : '')),
  crearCategoria: (d: { tipo: string; nombre: string }) => pedir<Categoria>('/categorias-inventario', { method: 'POST', body: JSON.stringify(d) }),
  editarCategoria: (id: string, d: Record<string, unknown>) => pedir<Categoria>('/categorias-inventario/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  eliminarCategoria: (id: string) => pedir<{ ok: boolean }>('/categorias-inventario/' + id, { method: 'DELETE' }),
  servicios: () => pedir<Servicio[]>('/servicios'),
  crearServicio: (d: Record<string, unknown>) => pedir<Servicio>('/servicios', { method: 'POST', body: JSON.stringify(d) }),
  editarServicio: (id: string, d: Record<string, unknown>) => pedir<Servicio>('/servicios/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  grupos: () => pedir<Grupo[]>('/grupos'),
  crearGrupo: (d: Record<string, unknown>) => pedir<Grupo>('/grupos', { method: 'POST', body: JSON.stringify(d) }),
  editarGrupo: (id: string, d: Record<string, unknown>) => pedir<Grupo>('/grupos/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  familiasMotor: () => pedir<FamiliaMotor[]>('/familias-motor'),
  reglasPrecio: () => pedir<ReglaPrecio[]>('/reglas-precio'),
  crearRegla: (d: Record<string, unknown>) => pedir<ReglaPrecio>('/reglas-precio', { method: 'POST', body: JSON.stringify(d) }),
  editarRegla: (id: string, d: Record<string, unknown>) => pedir<ReglaPrecio>('/reglas-precio/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  eliminarRegla: (id: string) => pedir<{ ok: boolean }>('/reglas-precio/' + id, { method: 'DELETE' }),
  lineaGenerica: (codigo: string, q: { km?: number | null; aceite?: number | null; fecha?: string | null }) => pedir<LineaTemporal>(`/planes-preventivos/${encodeURIComponent(codigo)}/linea-generica?` + new URLSearchParams(Object.entries(q).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString()),
  lineaTemporal: (vehiculoId: string, borrador?: { uso: string; aceite: string }) => pedir<LineaTemporal>(`/vehiculos/${vehiculoId}/linea-temporal` + (borrador ? `?uso=${encodeURIComponent(borrador.uso)}&aceite=${encodeURIComponent(borrador.aceite)}` : '')),
  planesPreventivos: () => pedir<PlanPreventivo[]>('/planes-preventivos'),
  vehiculosSinPlan: () => pedir<VehiculoSinPlan[]>('/planes-preventivos/sin-plan'),
  asignarPlan: (id: string, planId: string | null) => pedir<{ id: string; planId: string | null }>(`/vehiculos/${id}/plan`, { method: 'PATCH', body: JSON.stringify({ planId }) }),
  preciosPorGrupo: () => pedir<TablaPrecios>('/precios-por-grupo'),
  solapamientos: () => pedir<Solape[]>('/solapamientos'),
  crearSolape: (d: Record<string, unknown>) => pedir<Solape>('/solapamientos', { method: 'POST', body: JSON.stringify(d) }),
  editarSolape: (id: string, d: Record<string, unknown>) => pedir<Solape>('/solapamientos/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  eliminarSolape: (id: string) => pedir<{ ok: boolean }>('/solapamientos/' + id, { method: 'DELETE' }),
  catalogoOds: (vehiculoId?: string) => pedir<CatalogoOds>('/catalogo-ods' + (vehiculoId ? `?vehiculoId=${vehiculoId}` : '')),
  precioServicio: (servicioId: string, vehiculoId?: string) => pedir<PrecioServicio>(`/precio-servicio?servicioId=${encodeURIComponent(servicioId)}${vehiculoId ? '&vehiculoId=' + encodeURIComponent(vehiculoId) : ''}`),
  evaluarSolapes: (vehiculoId: string, lineas: { servicioId?: string | null; total: number }[]) => pedir<AlertaSolape[]>('/solapamientos/evaluar', { method: 'POST', body: JSON.stringify({ vehiculoId, lineas }) }),
  localesInventario: () => pedir<{ id: string; nombre: string }[]>('/inventario/locales'),
  verificarInventario: (password: string) => pedir<{ token: string }>('/inventario/verificar', { method: 'POST', body: JSON.stringify({ password }) }),
  ajustarStock: (id: string, d: { localId: string; cantidad: number; motivo?: string; token: string }) => pedir<Producto>(`/productos/${id}/ajuste`, { method: 'POST', body: JSON.stringify(d) }),
  verComo: (usuarioId: string) => pedir<{ ok: boolean }>('/ver-como', { method: 'POST', body: JSON.stringify({ usuarioId }) }),
};
