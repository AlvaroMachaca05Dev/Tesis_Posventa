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
export interface UsuarioLista { id: string; nombre: string; correo: string; activo: boolean; roles: string[] }

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
  if (!r.ok) throw Object.assign(new Error(r.status === 401 ? 'Credenciales inválidas.' : 'No se pudo completar la acción.'), { status: r.status });
  return (await r.json()) as T;
}

export const api = {
  login: (correo: string, password: string) =>
    pedir<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ correo, password }) }),
  me: () => pedir<Me>('/me'),
  usuarios: () => pedir<UsuarioLista[]>('/usuarios'),
  verComo: (usuarioId: string) => pedir<{ ok: boolean }>('/ver-como', { method: 'POST', body: JSON.stringify({ usuarioId }) }),
};
