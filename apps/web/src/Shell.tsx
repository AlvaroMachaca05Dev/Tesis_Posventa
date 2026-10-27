import { useEffect, useMemo, useState } from 'react';
import { api, ItemMenu, Me, sesion, UsuarioLista } from './api';

const NIVEL: Record<string, string> = { A: 'Ver, editar y acciones sensibles', E: 'Ver y editar', V: 'Solo ver' };
const CONSULTA_MOVIL = '(max-width: 900px)';

function useHash() {
  const [h, setH] = useState(() => window.location.hash.replace(/^#\//, ''));
  useEffect(() => {
    const f = () => setH(window.location.hash.replace(/^#\//, ''));
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}

/** Celular y tableta vertical: el menú pasa a ser un cajón que se abre con ☰. */
function useMovil() {
  const [m, setM] = useState(() => window.matchMedia?.(CONSULTA_MOVIL).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(CONSULTA_MOVIL);
    if (!mq) return;
    const f = () => setM(mq.matches);
    mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, []);
  return m;
}

const enPantallaCompleta = () => !!(document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement);

export default function Shell({ me, onCambio, onSalir }: { me: Me; onCambio: () => void | Promise<void>; onSalir: () => void }) {
  const hash = useHash();
  const movil = useMovil();
  const [oculto, setOculto] = useState<boolean>(() => localStorage.getItem('posventa-menu-oculto') === 'si');
  const [cajon, setCajon] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [completa, setCompleta] = useState(enPantallaCompleta());
  const [beta, setBeta] = useState<boolean>(() => localStorage.getItem('posventa-beta') !== 'no');
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const puedeConfigurar = me.permisos['ajustes'] === 'A';

  useEffect(() => {
    if (me.esPlataforma) api.usuarios().then(setUsuarios).catch(() => setUsuarios([]));
  }, [me.esPlataforma]);

  useEffect(() => {
    const f = () => setCompleta(enPantallaCompleta());
    document.addEventListener('fullscreenchange', f);
    document.addEventListener('webkitfullscreenchange', f);
    return () => {
      document.removeEventListener('fullscreenchange', f);
      document.removeEventListener('webkitfullscreenchange', f);
    };
  }, []);

  const visibles = useMemo(() => me.menu.filter((m) => beta || m.grupo !== 'Beta'), [me.menu, beta]);
  const sueltos = visibles.filter((m) => m.grupo === 'General');
  const grupos = useMemo(() => {
    const nombres = [...new Set(visibles.filter((m) => m.grupo !== 'General').map((m) => m.grupo))].sort((a, b) => (a === 'Beta' ? 1 : b === 'Beta' ? -1 : 0));
    return nombres.map((g) => ({ nombre: g, items: visibles.filter((m) => m.grupo === g) }));
  }, [visibles]);

  const actual: ItemMenu | undefined = me.menu.find((m) => m.id === hash);
  const inicio = visibles[0];
  const sinAcceso = hash !== '' && !actual;
  const mostrado = actual ?? (hash === '' ? inicio : undefined);

  // Como en el prototipo: la lista del módulo en que estás se abre sola y las demás se cierran.
  useEffect(() => {
    if (mostrado && mostrado.grupo !== 'General') setAbierto(mostrado.grupo);
  }, [mostrado?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function alternarMenu() {
    if (movil) {
      setCajon((v) => !v);
      return;
    }
    const nuevo = !oculto;
    setOculto(nuevo);
    localStorage.setItem('posventa-menu-oculto', nuevo ? 'si' : 'no');
  }

  async function pantallaCompleta() {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const d = document as Document & { webkitExitFullscreen?: () => Promise<void> };
    try {
      if (enPantallaCompleta()) await (d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d);
      else await (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
    } catch {
      window.alert('Este navegador no permite pantalla completa. En iPad: Compartir → Añadir a pantalla de inicio.');
    }
  }

  async function verComo(id: string) {
    if (!id) {
      sesion.ponerComo(null);
    } else {
      await api.verComo(id);
      sesion.ponerComo(id);
    }
    window.location.hash = '';
    await onCambio();
  }

  function alternarBeta(v: boolean) {
    setBeta(v);
    localStorage.setItem('posventa-beta', v ? 'si' : 'no');
  }

  const clase = ['app', movil ? 'movil' : '', !movil && oculto ? 'oculto' : '', movil && cajon ? 'cajon-abierto' : ''].filter(Boolean).join(' ');
  const enlace = (m: ItemMenu) => (
    <a key={m.id} href={`#/${m.id}`} className={m.id === mostrado?.id ? 'activo' : ''} onClick={() => movil && setCajon(false)}>
      {m.label}
    </a>
  );

  return (
    <div className={clase}>
      {movil && cajon && <div className="velo" onClick={() => setCajon(false)} />}
      <aside>
        <div className="marca">R <b>Motriz</b></div>
        <nav aria-label="Menú">
          {sueltos.length > 0 && <div className="grupo">{sueltos.map(enlace)}</div>}
          {grupos.map((g) => {
            const abierta = abierto === g.nombre;
            const tiene = g.items.some((m) => m.id === mostrado?.id);
            return (
              <div key={g.nombre} className={'grupo seccion' + (abierta ? ' abierta' : '')}>
                <button type="button" className={'sh' + (tiene ? ' tiene' : '')} aria-expanded={abierta} onClick={() => setAbierto(abierta ? null : g.nombre)}>
                  <span>{g.nombre}</span>
                  <i aria-hidden="true">▾</i>
                </button>
                {abierta && <div className="items">{g.items.map(enlace)}</div>}
              </div>
            );
          })}
        </nav>
        <div className="pie">Sistema de posventa · versión en desarrollo</div>
      </aside>
      <main>
        <header>
          <div className="izquierda">
            <button type="button" className="icono" aria-label="Mostrar u ocultar el menú" title="Mostrar u ocultar el menú" onClick={alternarMenu}>☰</button>
            <div className="quien">
              <span className="nombre">{me.usuario.nombre}</span>
              <span className="roles" data-testid="roles">
                {me.roles.map((r) => (
                  <span className="etiqueta" key={r}>{r}</span>
                ))}
              </span>
            </div>
          </div>
          <div className="acciones">
            {me.esPlataforma && (
              <label>
                <span className="solo-escritorio">Ver como…</span>
                <select aria-label="Ver como" value="" onChange={(e) => void verComo(e.target.value)}>
                  <option value="">Ver como…</option>
                  {usuarios.filter((u) => u.id !== me.real.id).map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre} · {u.roles.join(' + ')}</option>
                  ))}
                </select>
              </label>
            )}
            {puedeConfigurar && (
              <label className="beta">
                <input type="checkbox" checked={beta} onChange={(e) => alternarBeta(e.target.checked)} />
                Mostrar módulos beta
              </label>
            )}
            <button type="button" className="icono" aria-label="Pantalla completa" title="Pantalla completa" onClick={() => void pantallaCompleta()}>{completa ? '⤡' : '⛶'}</button>
            <button type="button" onClick={onSalir}>Cerrar sesión</button>
          </div>
        </header>
        {me.actuandoComo && (
          <div className="como" role="status">
            <span>
              Estás viendo el sistema como <b>{me.usuario.nombre}</b> ({me.roles.join(' + ')}). Tus acciones quedan auditadas a nombre de <b>{me.real.nombre}</b>.
            </span>
            <button type="button" onClick={() => void verComo('')}>Salir de «Ver como»</button>
          </div>
        )}
        <section className="contenido">
          {sinAcceso && (
            <div className="panel">
              <h1>Sin acceso</h1>
              <p>Tu rol ({me.roles.join(' + ')}) no tiene acceso a «{hash}». Si lo necesitas, pídeselo al Superadministrador.</p>
              {inicio && <a className="boton" href={`#/${inicio.id}`}>Ir al inicio</a>}
            </div>
          )}
          {mostrado && (
            <div className="panel">
              <h1>{mostrado.label}</h1>
              <p className="sub">Nivel de tu rol: {NIVEL[mostrado.nivel]}.</p>
              <p>Este módulo se construye en un próximo slice. Por ahora puedes comprobar el menú y los permisos de cada rol.</p>
            </div>
          )}
          {!mostrado && !sinAcceso && <div className="panel"><p>Tu rol no tiene módulos disponibles.</p></div>}
        </section>
      </main>
    </div>
  );
}
