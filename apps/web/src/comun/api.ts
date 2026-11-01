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
  comentario: string | null; grupo: string | null; creadoEn: string; kmActual: number | null; cliente: { id: string; nombre: string; documento: string; tipoDocumento: TipoDocumento };
}
export interface Marca { id: string; nombre: string; modelos: string[] }
export interface Persona { id: string; nombre: string }
export interface DetalleOds {
  id?: string; tipo: 'servicio' | 'producto'; descripcion: string; referencia: string | null; cantidad: number; costo: number | null; rentabilidadPct: number | null;
  precio: number; descuentoPct: number; impuesto: 'IGV' | 'NINGUNO'; total: number; tecnicoId?: string | null;
}
export interface Abono { id: string; fecha: string; metodo: string; concepto: string | null; valor: number }
export interface Orden {
  id: string; codigo: string; externa: boolean; estado: string; decision: string; tipoAtencion: string; fechaInicio: string; fechaCierre: string | null; km: number | null;
  observaciones: string | null; recomendaciones: string | null;
  cliente: { id: string; nombre: string; documento: string; tipoDocumento: TipoDocumento };
  vehiculo: { id: string; placa: string; marca: string | null; modelo: string | null; anio: number | null; color: string | null; nroSerie: string | null; nroVin: string | null; nroMotor: string | null };
  tecnico: Persona | null; jefeTaller: Persona | null; creadoPor: Persona | null;
  detalles: DetalleOds[]; total: number; abonos: Abono[]; totalAbonos: number; pendiente: number;
  estadoVehiculo?: EstadoVehiculo | null; evidencias?: EvidenciaOds[];
  comprobantes: string[]; conComprobante: boolean; ultimaBitacora: { texto: string; fecha: string; actor: string } | null; bitacora: { texto: string; fecha: string; actor: string }[];
}
export type EstadoVehiculo = Record<string, string | string[]>;
export interface EvidenciaOds { id: string; nombre: string; tipo: string; tamano: number; fecha: string }
export interface CatalogosOds { tiposAtencion: string[]; decisiones: string[]; estados: { id: string; nombre: string }[]; metodosPago: string[]; tecnicos: Persona[]; jefes: Persona[] }

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
  guardarDetalles: (id: string, detalles: DetalleOds[]) => pedir<Orden>(`/ordenes/${id}/detalles`, { method: 'PUT', body: JSON.stringify({ detalles }) }),
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
  verComo: (usuarioId: string) => pedir<{ ok: boolean }>('/ver-como', { method: 'POST', body: JSON.stringify({ usuarioId }) }),
};
