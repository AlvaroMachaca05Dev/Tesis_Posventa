export interface ItemMenu { id: string; label: string; grupo: string; nivel: 'A' | 'E' | 'V' }
export interface Me {
  usuario: { id: string; nombre: string; correo: string; organizacionId: string | null };
  roles: string[];
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
  direccionFiscal: string | null; email: string | null; ubigeo: string | null; comentario: string | null; esGenerico: boolean; activo: boolean; creadoEn: string; vehiculos?: number;
}
export interface Vehiculo {
  id: string; placa: string; marca: string | null; modelo: string | null; anio: number | null; color: string | null; nroSerie: string | null; nroVin: string | null; nroMotor: string | null;
  comentario: string | null; grupo: string | null; grupoId?: string | null; grupoFuente?: string | null; codigoMotor?: string | null; creadoEn: string; kmActual: number | null; cliente: { id: string; nombre: string; documento: string; tipoDocumento: TipoDocumento };
}
export interface Marca { id: string; nombre: string; modelos: string[] }
export interface Persona { id: string; nombre: string }
export interface DetalleOds {
  id?: string; tipo: 'servicio' | 'producto'; descripcion: string; referencia: string | null; cantidad: number; costo: number | null; rentabilidadPct: number | null;
  precio: number; descuentoPct: number; impuesto: 'IGV' | 'NINGUNO'; total: number; tecnicoId?: string | null;
  servicioId?: string | null; productoId?: string | null; horas?: number | null; precioGrupo?: number | null; precioModificado?: boolean;
  trazaPrecio?: string[] | null; descuentoMonto?: number; solapamientoId?: string | null;
}
export interface Abono { id: string; fecha: string; metodo: string; concepto: string | null; valor: number }
export interface Orden {
  id: string; codigo: string; externa: boolean; estado: string; decision: string; tipoAtencion: string; tipoAtencionDetalle: string | null; fechaInicio: string; fechaCierre: string | null; km: number | null;
  observaciones: string | null; recomendaciones: string | null;
  cliente: { id: string; nombre: string; documento: string; tipoDocumento: TipoDocumento };
  vehiculo: { id: string; grupo?: string | null; placa: string; marca: string | null; modelo: string | null; anio: number | null; color: string | null; nroSerie: string | null; nroVin: string | null; nroMotor: string | null };
  tecnico: Persona | null; jefeTaller: Persona | null; creadoPor: Persona | null;
  detalles: DetalleOds[]; total: number; abonos: Abono[]; totalAbonos: number; pendiente: number; solapamientosMantenidos?: string[]; horas?: number;
  estadoVehiculo?: EstadoVehiculo | null; evidencias?: EvidenciaOds[];
  comprobantes: string[]; conComprobante: boolean; ultimaBitacora: { texto: string; fecha: string; actor: string } | null; bitacora: { texto: string; fecha: string; actor: string }[];
}
export type EstadoVehiculo = Record<string, string | string[]>;
export interface EvidenciaOds { id: string; nombre: string; tipo: string; tamano: number; fecha: string }
export interface CatalogosOds { tiposAtencion: string[]; decisiones: string[]; estados: { id: string; nombre: string }[]; metodosPago: string[]; tecnicos: Persona[]; jefes: Persona[]; logisticos?: Persona[]; cajeras?: Persona[] }

// ───── Slice S5: maestros ─────
export interface Proveedor { id: string; tipoDocumento: TipoDocumento; documento: string; nombre: string; contacto: string | null; telefono: string | null; correo: string | null; direccion: string | null; rubro: string | null; activo: boolean; creadoEn: string }
export interface Producto { id: string; codigo: string; nombre: string; referencia: string | null; unidad: string; categoria: string | null; marca: string | null; precio: number; costo: number | null; proveedorId: string | null; proveedor: string | null; activo: boolean; stock: Record<string, number>; stockTotal: number }
export interface Servicio { id: string; codigo: string; nombre: string; categoria: string; descripcion: string | null; trabajoMayor: boolean; externo: boolean; proveedorId: string | null; proveedor: string | null; horasEstandar: number; horasFuente: string; precioEstandar: number; repuestos: string[]; activo: boolean; preciosGrupo: Record<string, number | null>; horasGrupo: Record<string, number> }
export interface Grupo { id: string; codigo: string; nombre: string; descripcion: string | null; activo: boolean; vehiculos: number; reglas: number; familias: number }
export interface ReglaPrecio { id: string; codigo: string; nivel: 'SERVICIO' | 'GRUPO' | 'GLOBAL'; tipo: 'FIJAR' | 'SUMAR' | 'PORCENTAJE'; grupoId: string | null; grupo: string | null; servicios: string[]; horas: number | null; precio: number | null; porcentaje: number | null; precioDesde: number | null; precioHasta: number | null; orden: number; activa: boolean; nota: string | null }
export interface Solape { id: string; codigo: string; tipo: 'PAR' | 'CONJUNTO'; minimo: number; serviciosBase: string[]; serviciosReducidos: string[]; base: string[]; reducidos: string[]; modo: 'AUTOMATICO' | 'OPCIONAL' | 'AVISO'; descuentoEstandar: number; descuentos: Record<string, number>; horasCompartidas: number | null; alerta: string | null; nota: string | null; estado: string; activo: boolean }
export interface FamiliaMotor { id: string; codigo: string; codigos: string[]; combustible: string | null; litros: string | null; turbo: boolean; grupoId: string | null; grupo: string | null }
export interface TablaPrecios { grupos: string[]; filas: { servicioId: string; codigo: string; nombre: string; categoria?: string; estandar: { horas: number; precio: number }; porGrupo: Record<string, { horas: number; precio: number } | null> }[] }
export interface CatalogoOds { servicios: { id: string; codigo: string; nombre: string; categoria: string | null; horas: number; precio: number; grupo: string | null; repuestos: string[] }[]; productos: { id: string; codigo: string; nombre: string; referencia: string | null; unidad: string; marca: string | null; precio: number; costo: number | null; stockTotal: number }[] }
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
  locales: () => pedir<Local[]>('/locales'),
  crearUsuario: (d: { nombre: string; correo: string; password: string; rolIds: string[]; localId?: string }) =>
    pedir<UsuarioLista>('/usuarios', { method: 'POST', body: JSON.stringify(d) }),
  editarUsuario: (id: string, d: { nombre?: string; activo?: boolean; rolIds?: string[]; password?: string; localId?: string }) =>
    pedir<UsuarioLista>('/usuarios/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  crearRol: (d: { nombre: string; permisos: { modulo: string; nivel: string }[] }) => pedir<Rol>('/roles', { method: 'POST', body: JSON.stringify(d) }),
  config: () => pedir<{ paisPredeterminado: string; paises: Pais[] }>('/maestros/config'),
  clientes: (q = '') => pedir<Cliente[]>('/clientes' + (q ? '?q=' + encodeURIComponent(q) : '')),
  cliente: (id: string) => pedir<Cliente & { vehiculos: { id: string; placa: string }[] }>('/clientes/' + id),
  crearCliente: (d: Record<string, unknown>) => pedir<Cliente>('/clientes', { method: 'POST', body: JSON.stringify(d) }),
  editarCliente: (id: string, d: Record<string, unknown>) => pedir<Cliente>('/clientes/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  vehiculos: (q = '') => pedir<Vehiculo[]>('/vehiculos' + (q ? '?q=' + encodeURIComponent(q) : '')),
  crearVehiculo: (d: Record<string, unknown>) => pedir<Vehiculo>('/vehiculos', { method: 'POST', body: JSON.stringify(d) }),
  editarVehiculo: (id: string, d: Record<string, unknown>) => pedir<Vehiculo>('/vehiculos/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  registrarKm: (id: string, km: number, observacion = '', fecha?: string, fuente?: string) =>
    pedir<{ id: string; km: number }>(`/vehiculos/${id}/lecturas`, { method: 'POST', body: JSON.stringify({ km, ...(observacion ? { observacion } : {}), ...(fecha ? { fecha } : {}), ...(fuente ? { fuente } : {}) }) }),
  marcasVehiculo: () => pedir<Marca[]>('/marcas-vehiculo'),
  catalogosOds: () => pedir<CatalogosOds>('/ordenes/catalogos'),
  ordenes: (f: Record<string, string>) => pedir<Orden[]>('/ordenes?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString()),
  orden: (id: string) => pedir<Orden>('/ordenes/' + id),
  crearOrden: (d: Record<string, unknown>) => pedir<Orden>('/ordenes', { method: 'POST', body: JSON.stringify(d) }),
  editarOrden: (id: string, d: Record<string, unknown>) => pedir<Orden>('/ordenes/' + id, { method: 'PATCH', body: JSON.stringify(d) }),
  guardarDetalles: (id: string, detalles: DetalleOds[], solapamientosMantenidos?: string[]) => pedir<Orden>(`/ordenes/${id}/detalles`, { method: 'PUT', body: JSON.stringify({ detalles, ...(solapamientosMantenidos ? { solapamientosMantenidos } : {}) }) }),
  descuentoOrden: (id: string, porcentaje: number) => pedir<Orden>(`/ordenes/${id}/descuento`, { method: 'POST', body: JSON.stringify({ porcentaje }) }),
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
