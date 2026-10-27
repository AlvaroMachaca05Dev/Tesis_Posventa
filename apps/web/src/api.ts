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
  verComo: (usuarioId: string) => pedir<{ ok: boolean }>('/ver-como', { method: 'POST', body: JSON.stringify({ usuarioId }) }),
};
