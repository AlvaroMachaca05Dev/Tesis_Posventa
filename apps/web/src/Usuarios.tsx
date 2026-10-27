import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, Local, Me, Rol, UsuarioLista } from './api';

const NIVEL: Record<string, string> = { A: 'Todo', E: 'Ver y editar', V: 'Solo ver' };

type Nivel = 'A' | 'E' | 'V';

export default function Usuarios({ me, nivel }: { me: Me; nivel: Nivel }) {
  const puedeEditar = nivel === 'A' || nivel === 'E';
  const puedeCrearRoles = nivel === 'A';
  const [pestana, setPestana] = useState<'usuarios' | 'roles'>('usuarios');
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [locales, setLocales] = useState<Local[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const [u, r, l] = await Promise.all([api.usuarios(), api.roles(), api.locales()]);
    setUsuarios(u);
    setRoles(r);
    setLocales(l);
  }, []);
  useEffect(() => {
    cargar().catch((e) => setError((e as Error).message));
  }, [cargar]);

  const nombreLocal = (id?: string | null) => locales.find((l) => l.id === id)?.nombre ?? '—';

  return (
    <div className="panel ancho">
      <h1>Usuarios y responsabilidades</h1>
      <p className="sub">Cada usuario pertenece a un local y puede tener uno o más roles; sus permisos son la suma de los de sus roles.</p>
      <div className="pestanas" role="tablist">
        <button type="button" className={pestana === 'usuarios' ? 'on' : ''} onClick={() => setPestana('usuarios')}>Usuarios</button>
        <button type="button" className={pestana === 'roles' ? 'on' : ''} onClick={() => setPestana('roles')}>Roles</button>
      </div>
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {error && pestana && <p className="error" role="alert">{error}</p>}
      {pestana === 'usuarios' ? (
        <ListaUsuarios
          usuarios={usuarios}
          roles={roles}
          locales={locales}
          nombreLocal={nombreLocal}
          puedeEditar={puedeEditar}
          alGuardar={async (m) => {
            setError('');
            setMensaje(m);
            await cargar();
          }}
          alFallar={(m) => {
            setMensaje('');
            setError(m);
          }}
        />
      ) : (
        <PestanaRoles
          me={me}
          roles={roles}
          nivel={nivel}
          puedeCrear={puedeCrearRoles}
          alGuardar={async (m) => {
            setError('');
            setMensaje(m);
            await cargar();
          }}
          alFallar={(m) => {
            setMensaje('');
            setError(m);
          }}
        />
      )}
    </div>
  );
}

function ListaUsuarios(p: {
  usuarios: UsuarioLista[];
  roles: Rol[];
  locales: Local[];
  nombreLocal: (id?: string | null) => string;
  puedeEditar: boolean;
  alGuardar: (m: string) => Promise<void>;
  alFallar: (m: string) => void;
}) {
  const [editando, setEditando] = useState<UsuarioLista | 'nuevo' | null>(null);
  const asignables = p.roles.filter((r) => r.asignable);

  async function cambiarEstado(u: UsuarioLista) {
    if (u.activo && !window.confirm(`¿Desactivar a ${u.nombre}? Ya no podrá ingresar.`)) return;
    try {
      await api.editarUsuario(u.id, { activo: !u.activo });
      await p.alGuardar(u.activo ? 'Usuario desactivado.' : 'Usuario activado.');
    } catch (e) {
      p.alFallar((e as Error).message);
    }
  }

  return (
    <>
      {p.puedeEditar && !editando && (
        <button type="button" className="primario chico" onClick={() => setEditando('nuevo')}>+ Usuario</button>
      )}
      {editando && (
        <FormUsuario
          usuario={editando === 'nuevo' ? null : editando}
          roles={asignables}
          locales={p.locales}
          alCancelar={() => setEditando(null)}
          alGuardar={async (m) => {
            setEditando(null);
            await p.alGuardar(m);
          }}
          alFallar={p.alFallar}
        />
      )}
      <div className="tabla">
        <table>
          <thead>
            <tr>
              {p.puedeEditar && <th>Acciones</th>}
              <th>Nombre</th>
              <th>Correo</th>
              <th>Local</th>
              <th>Roles</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {p.usuarios.map((u) => (
              <tr key={u.id}>
                {p.puedeEditar && (
                  <td className="acc">
                    <button type="button" onClick={() => setEditando(u)}>Editar</button>
                    <button type="button" className="peligro" onClick={() => void cambiarEstado(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                  </td>
                )}
                <td>{u.nombre}</td>
                <td>{u.correo}</td>
                <td>{p.nombreLocal(u.localId)}</td>
                <td>{u.roles.map((r) => <span className="etiqueta" key={r}>{r}</span>)}</td>
                <td><span className={'pill ' + (u.activo ? 'verde' : 'rojo')}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FormUsuario(p: {
  usuario: UsuarioLista | null;
  roles: Rol[];
  locales: Local[];
  alCancelar: () => void;
  alGuardar: (m: string) => Promise<void>;
  alFallar: (m: string) => void;
}) {
  const [nombre, setNombre] = useState(p.usuario?.nombre ?? '');
  const [correo, setCorreo] = useState(p.usuario?.correo ?? '');
  const [password, setPassword] = useState('');
  const [localId, setLocalId] = useState(p.usuario?.localId ?? p.locales[0]?.id ?? '');
  const [elegidos, setElegidos] = useState<string[]>(() => (p.usuario ? p.roles.filter((r) => p.usuario!.roles.includes(r.nombre)).map((r) => r.id) : []));
  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      if (p.usuario) {
        await api.editarUsuario(p.usuario.id, { nombre, localId: localId || undefined, rolIds: elegidos, ...(password ? { password } : {}) });
        await p.alGuardar('Usuario guardado.');
      } else {
        await api.crearUsuario({ nombre, correo, password, rolIds: elegidos, localId: localId || undefined });
        await p.alGuardar('Usuario creado.');
      }
    } catch (err) {
      p.alFallar((err as Error).message);
    }
  }
  const alternar = (id: string) => setElegidos((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  return (
    <form className="formulario" onSubmit={enviar}>
      <h2>{p.usuario ? 'Editar usuario' : 'Nuevo usuario'}</h2>
      <label htmlFor="u-nombre">Nombre</label>
      <input id="u-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <label htmlFor="u-correo">Correo</label>
      <input id="u-correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required disabled={!!p.usuario} />
      <label htmlFor="u-clave">{p.usuario ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
      <input id="u-clave" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!p.usuario} minLength={p.usuario && !password ? 0 : 8} />
      <label htmlFor="u-local">Local</label>
      <select id="u-local" value={localId} onChange={(e) => setLocalId(e.target.value)}>
        {p.locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
      </select>
      <fieldset>
        <legend>Roles (puedes elegir varios)</legend>
        {p.roles.map((r) => (
          <label key={r.id} className="check">
            <input type="checkbox" aria-label={r.nombre} checked={elegidos.includes(r.id)} onChange={() => alternar(r.id)} /> {r.nombre}
          </label>
        ))}
      </fieldset>
      <div className="fila">
        <button type="submit" className="primario chico">Guardar usuario</button>
        <button type="button" onClick={p.alCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function PestanaRoles(p: { me: Me; roles: Rol[]; nivel: Nivel; puedeCrear: boolean; alGuardar: (m: string) => Promise<void>; alFallar: (m: string) => void }) {
  const [nombre, setNombre] = useState('');
  const [elegidos, setElegidos] = useState<Record<string, Nivel>>({});
  // Solo se pueden elegir módulos que tú tienes, hasta tu mismo nivel.
  const modulos = p.me.menu.filter((m) => m.id !== 'usuarios' || p.nivel === 'A');
  const opciones = (max: Nivel): Nivel[] => (max === 'A' ? ['V', 'E', 'A'] : max === 'E' ? ['V', 'E'] : ['V']);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const permisos = modulos.filter((m) => elegidos[m.id]).map((m) => ({ modulo: m.id, nivel: elegidos[m.id] }));
    try {
      await api.crearRol({ nombre, permisos });
      setNombre('');
      setElegidos({});
      await p.alGuardar('Rol guardado.');
    } catch (err) {
      p.alFallar((err as Error).message);
    }
  }

  return (
    <>
      <div className="tabla">
        <table>
          <thead>
            <tr><th>Rol</th><th>Tipo</th><th>Módulos</th></tr>
          </thead>
          <tbody>
            {p.roles.map((r) => (
              <tr key={r.id}>
                <td>{r.nombre}</td>
                <td>{r.esBase ? 'Base' : 'Propio'}</td>
                <td className="suave">{r.permisos.length ? `${r.permisos.length} módulos` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {p.puedeCrear && (
        <form className="formulario" onSubmit={enviar}>
          <h2>Nuevo rol propio</h2>
          <p className="sub">Elige los módulos que verá y con qué nivel. Solo puedes dar permisos que tú tienes.</p>
          <label htmlFor="r-nombre">Nombre del rol</label>
          <input id="r-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <div className="modulos">
            {modulos.map((m) => (
              <div key={m.id} className="modulo">
                <label className="check">
                  <input
                    type="checkbox"
                    aria-label={m.label}
                    checked={!!elegidos[m.id]}
                    onChange={(e) => setElegidos((x) => { const n = { ...x }; if (e.target.checked) n[m.id] = 'V'; else delete n[m.id]; return n; })}
                  />{' '}
                  {m.label}
                </label>
                <select aria-label={`Nivel de ${m.label}`} disabled={!elegidos[m.id]} value={elegidos[m.id] ?? 'V'} onChange={(e) => setElegidos((x) => ({ ...x, [m.id]: e.target.value as Nivel }))}>
                  {opciones(m.nivel).map((n) => <option key={n} value={n}>{NIVEL[n]}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button type="submit" className="primario chico">Guardar rol</button>
        </form>
      )}
    </>
  );
}
