import { CSSProperties, FormEvent, ReactNode, useEffect, useState } from 'react';
import { useConfirmar } from './Confirmar';
import { FilaFiltros, useFiltros } from './FiltrosColumna';
import { Paginacion, usePaginacion } from './Paginacion';
import { useColumnasRedimensionables } from './useColumnasRedimensionables';

/** Módulo de tabla como Clientes: filtros por columna, acciones por fila y modal centrado de dos columnas. */
export type Valor = string | boolean | string[];
export interface Campo {
  k: string;
  etiqueta: string;
  tipo?: 'texto' | 'numero' | 'select' | 'check' | 'area' | 'multi';
  maxLength?: number;
  soloDigitos?: boolean;
  opciones?: [string, string][];
  requerido?: boolean;
  ancha?: boolean;
  soloAlCrear?: boolean;
  /** Para el tipo «multi»: opción → grupo, y la lista se muestra como árbol. */
  agrupar?: Record<string, string>;
  /** Dibuja el campo a mano (rejillas, listas de ítems…). Recibe los valores y cómo cambiarlos. */
  render?: (v: Record<string, Valor>, poner: (k: string, x: Valor) => void) => ReactNode;
  /** Botón «+» junto a un select, para crear el registro que falta sin salir del formulario. */
  mas?: { titulo: string; alClic: (poner: (k: string, x: Valor) => void) => void };
}
// `ancho`: máximo de caracteres del dato más largo que puede traer la columna. Sin él, la columna no se parte en líneas
// (dato corto: código, pill, número, fecha). Con él, se le da el ancho justo para ese máximo, en una o dos líneas.
// `recortar`: para datos largos (listas de varios ítems) que no deben inflar la altura de la fila; se recortan con
// puntos suspensivos en una sola línea angosta y el texto completo queda disponible al pasar el mouse (title).
export interface Columna<T> { titulo: string; texto: (x: T) => string; celda?: (x: T) => ReactNode; ancho?: number; recortar?: boolean }
const anchoCelda = (c: { ancho?: number; recortar?: boolean }, manual?: number): CSSProperties =>
  manual ? { width: manual, maxWidth: manual, whiteSpace: c.recortar ? 'nowrap' : 'normal', wordBreak: 'break-word', overflow: c.recortar ? 'hidden' : undefined, textOverflow: c.recortar ? 'ellipsis' : undefined }
  : c.recortar ? { maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  : c.ancho ? { maxWidth: Math.max(90, Math.min(360, c.ancho * 7.2)), whiteSpace: 'normal', wordBreak: 'break-word' }
  : { whiteSpace: 'nowrap' };

export default function TablaMaestro<T extends { id: string }>(p: {
  titulo: string;
  uno: string; // «proveedor», «servicio»…
  filas: T[];
  columnas: Columna<T>[];
  // Formulario genérico por campos, o un formulario propio (p. ej. el de cliente y proveedor) con `formulario`.
  campos?: Campo[] | ((x: T | null, v: Record<string, Valor>) => Campo[]);
  valores?: (x: T | null) => Record<string, Valor>;
  formulario?: (a: { fila: T | null; error: string; alCancelar: () => void; alGuardar: (d: object) => Promise<void> }) => ReactNode;
  guardar: (x: T | null, d: Record<string, Valor>) => Promise<unknown>;
  puedeEditar: boolean;
  activo?: (x: T) => boolean;
  alternar?: (x: T) => Promise<unknown>;
  eliminar?: (x: T) => Promise<unknown>;
  acciones?: (x: T) => ReactNode;
  alCambiar: () => Promise<void>;
  sinTitulo?: boolean;
  // Módulos cuyo «+ Nuevo» abre un flujo propio y cuyas filas no se editan (p. ej. los comprobantes).
  alNuevo?: () => void;
  // Modal amplio (p. ej. solapamientos, con listas de servicios lado a lado).
  modalAncho?: boolean;
  /** «Nueva» en vez de «Nuevo» (categoría, familia…). */
  femenino?: boolean;
}) {
  const [editando, setEditando] = useState<T | 'nuevo' | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const { filtros, setFiltros, pasa } = useFiltros<T>(p.columnas.map((c) => c.texto));
  const { anchos, iniciarArrastre } = useColumnasRedimensionables(p.uno);
  const filtradas = p.filas.filter((x) => (verInactivos || !p.activo || p.activo(x)) && pasa(x));
  const { visibles, pagina, setPagina, tam, setTam, total, totalPaginas, inicio, fin } = usePaginacion(filtradas);
  const edita = p.puedeEditar && !p.alNuevo;
  const { preguntar, modal: confirmacion } = useConfirmar();
  const conAcciones = edita || !!p.acciones;

  async function hacer(f: () => Promise<unknown>, ok: string) {
    try {
      await f();
      setError('');
      setMensaje(ok);
      await p.alCambiar();
    } catch (e) {
      setMensaje('');
      setError((e as Error).message);
    }
  }

  async function eliminarFila(x: T) {
    if ((await preguntar({ titulo: `¿Eliminar este ${p.uno}?`, mensaje: p.alternar ? 'Si tiene historial no se borra: sale de la lista activa y se puede restaurar.' : undefined })) === null) return;
    try {
      const r = (await p.eliminar!(x)) as { eliminado?: boolean } | undefined;
      setError('');
      setMensaje(r?.eliminado === false ? `Tenía historial: el ${p.uno} salió de la lista activa.` : `${p.uno[0].toUpperCase() + p.uno.slice(1)} eliminado.`);
      await p.alCambiar();
    } catch (e) { setMensaje(''); setError((e as Error).message); }
  }
  async function alternarFila(x: T) {
    if (p.activo!(x) && (await preguntar({ titulo: `¿Eliminar este ${p.uno}?`, mensaje: 'Sale de la lista activa y se puede restaurar.' })) === null) return;
    await hacer(() => p.alternar!(x), p.activo!(x) ? 'Eliminado de la lista activa.' : 'Restaurado.');
  }

  return (
    <div className={p.sinTitulo ? '' : 'panel ancho'}>
      {!p.sinTitulo && <h1>{p.titulo}</h1>}
      <div className="fila entre">
        {p.activo ? <label className="check"><input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Mostrar inactivos</label> : <span />}
        {p.puedeEditar && <button type="button" className="primario chico" onClick={() => (p.alNuevo ? p.alNuevo() : setEditando('nuevo'))}>+ Nuevo</button>}
      </div>
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {error && !editando && <p className="error" role="alert">{error}</p>}
      {confirmacion}
      {editando && (() => {
        const fila = editando === 'nuevo' ? null : editando;
        const alCancelar = () => { setEditando(null); setError(''); };
        const alGuardar = async (d: object) => {
          try {
            await p.guardar(fila, d as Record<string, Valor>);
            setEditando(null);
            setError('');
            setMensaje(fila ? `${p.uno[0].toUpperCase() + p.uno.slice(1)} guardado.` : `${p.uno[0].toUpperCase() + p.uno.slice(1)} creado.`);
            await p.alCambiar();
          } catch (e) {
            setMensaje('');
            setError((e as Error).message);
          }
        };
        return p.formulario ? p.formulario({ fila, error, alCancelar, alGuardar }) : (
          <FormMaestro
            titulo={`${fila ? 'Editar' : p.femenino ? 'Nueva' : 'Nuevo'} ${p.uno}`}
            fila={fila}
            ancho={p.modalAncho}
            campos={p.campos ?? []}
            inicial={p.valores ? p.valores(fila) : {}}
            error={error}
            alCancelar={alCancelar}
            alGuardar={alGuardar}
          />
        );
      })()}
      <div className="tabla">
        <table>
          <thead>
            <tr>
              {conAcciones && <th>Acciones</th>}
              {p.columnas.map((c) => (
                <th key={c.titulo} style={anchoCelda(c, anchos[c.titulo])} className="col-redim">
                  {c.titulo}
                  <span className="resizer" onMouseDown={iniciarArrastre(c.titulo, anchos[c.titulo] ?? 160)} />
                </th>
              ))}
            </tr>
            <FilaFiltros nombres={p.columnas.map((c) => c.titulo)} conAcciones={conAcciones} filtros={filtros} setFiltros={setFiltros} />
          </thead>
          <tbody>
            {visibles.map((x) => (
              <tr key={x.id}>
                {conAcciones && (
                  <td className="acc">
                    <MenuAcciones>
                      {edita && <button type="button" onClick={() => setEditando(x)}>Editar</button>}
                      {/* Un solo «Eliminar»: sin uso se borra; con historial sale de la lista activa y se restaura con «Restaurar». */}
                      {edita && p.alternar && p.activo && (!p.activo(x) || !p.eliminar) && (
                        <button type="button" className={p.activo(x) ? 'peligro' : ''} onClick={() => void alternarFila(x)}>{p.activo(x) ? 'Eliminar' : 'Restaurar'}</button>
                      )}
                      {edita && p.eliminar && (!p.activo || p.activo(x)) && <button type="button" className="peligro" onClick={() => void eliminarFila(x)}>Eliminar</button>}
                      {p.acciones?.(x)}
                    </MenuAcciones>
                  </td>
                )}
                {p.columnas.map((c) => <td key={c.titulo} style={anchoCelda(c, anchos[c.titulo])} title={c.recortar ? c.texto(x) : undefined}>{c.celda ? c.celda(x) : c.texto(x) || '—'}</td>)}
              </tr>
            ))}
            {visibles.length === 0 && <tr><td colSpan={p.columnas.length + (conAcciones ? 1 : 0)} className="suave">No hay registros que coincidan.</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginacion pagina={pagina} setPagina={setPagina} tam={tam} setTam={setTam} total={total} totalPaginas={totalPaginas} inicio={inicio} fin={fin} />
    </div>
  );
}

function FormMaestro<T>(p: { titulo: string; fila: T | null; ancho?: boolean; campos: Campo[] | ((x: T | null, v: Record<string, Valor>) => Campo[]); inicial: Record<string, Valor>; error: string; alCancelar: () => void; alGuardar: (d: Record<string, Valor>) => Promise<void> }) {
  const [v, setV] = useState<Record<string, Valor>>(p.inicial);
  const campos = (typeof p.campos === 'function' ? p.campos(p.fila, v) : p.campos).filter((c) => !(c.soloAlCrear && p.fila));
  // Al cambiar un campo que limita a otro (p. ej. el tipo de documento), el valor se recorta al nuevo largo.
  useEffect(() => {
    const ajuste: Record<string, Valor> = {};
    for (const c of campos) {
      const x = v[c.k];
      if (typeof x === 'string' && c.maxLength && x.length > c.maxLength) ajuste[c.k] = x.slice(0, c.maxLength);
    }
    if (Object.keys(ajuste).length) setV((y) => ({ ...y, ...ajuste }));
  });
  const enviar = (e: FormEvent) => { e.preventDefault(); void p.alGuardar(v); };
  const id = (k: string) => 'm-' + k;
  return (
    <div className="fondo-modal">
      <form className={'modal-form' + (p.ancho ? ' ancho' : '')} role="dialog" aria-modal="true" aria-label={p.titulo} onSubmit={enviar}>
        <h2>{p.titulo}</h2>
        {p.error && <p className="error" role="alert">{p.error}</p>}
        <div className="dos-col">
          {campos.map((c) => (
            <div key={c.k} className={'campo' + (c.ancha || c.tipo === 'area' ? ' ancha' : '')}>
              {c.render ? (
                <>
                  {c.etiqueta && <span className="etiqueta-campo">{c.etiqueta}</span>}
                  {c.render(v, (k, x) => setV((y) => ({ ...y, [k]: x })))}
                </>
              ) : c.tipo === 'check' ? (
                <label className="check"><input id={id(c.k)} type="checkbox" checked={!!v[c.k]} onChange={(e) => setV({ ...v, [c.k]: e.target.checked })} /> {c.etiqueta}</label>
              ) : (
                <>
                  <label htmlFor={id(c.k)}>{c.etiqueta}</label>
                  {c.tipo === 'multi' ? (
                    <SelectorMultiple id={id(c.k)} etiqueta={c.etiqueta} agrupar={c.agrupar} opciones={c.opciones ?? []} valor={(v[c.k] as string[]) ?? []} alCambiar={(x) => setV({ ...v, [c.k]: x })} />
                  ) : c.tipo === 'select' ? (
                    <div className={c.mas ? 'select-mas' : undefined}>
                      <select id={id(c.k)} value={String(v[c.k] ?? '')} required={c.requerido} onChange={(e) => setV({ ...v, [c.k]: e.target.value })}>
                        {(c.opciones ?? []).map(([o, t]) => <option key={o} value={o}>{t}</option>)}
                      </select>
                      {c.mas && <button type="button" className="mas-cuadrado" aria-label={c.mas.titulo} title={c.mas.titulo} onClick={() => c.mas!.alClic((k, x) => setV((y) => ({ ...y, [k]: x })))}>+</button>}
                    </div>
                  ) : c.tipo === 'area' ? (
                    <textarea id={id(c.k)} rows={2} value={String(v[c.k] ?? '')} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
                  ) : (
                    <input id={id(c.k)} inputMode={c.soloDigitos ? 'numeric' : c.tipo === 'numero' ? 'decimal' : undefined} maxLength={c.maxLength} value={String(v[c.k] ?? '')} required={c.requerido}
                      onChange={(e) => setV({ ...v, [c.k]: c.soloDigitos ? e.target.value.replace(/\D/g, '') : e.target.value })} />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="fila fin">
          <button type="button" onClick={p.alCancelar}>Cancelar</button>
          <button type="submit" className="primario chico">Guardar</button>
        </div>
      </form>
    </div>
  );
}

/** Un solo botón por fila (⚙) que despliega verticalmente las acciones, en vez de una fila de botones. Se reutiliza en Clientes y Vehículos, que no usan TablaMaestro. */
export function MenuAcciones({ children }: { children: ReactNode }) {
  // La lista va en posición fija respecto a la ventana: así no la recorta la tabla ni la tapa la paginación.
  // Si no cabe debajo del botón (últimas filas), se abre hacia arriba.
  const [lugar, setLugar] = useState<CSSProperties | null>(null);
  const abierto = lugar !== null;
  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setLugar(null);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => { window.removeEventListener('scroll', cerrar, true); window.removeEventListener('resize', cerrar); };
  }, [abierto]);
  const alternar = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (abierto) return setLugar(null);
    const r = e.currentTarget.getBoundingClientRect();
    const opciones = Array.isArray(children) ? children.flat().filter(Boolean).length : 1;
    const altoEstimado = opciones * 34 + 12;
    const cabeAbajo = window.innerHeight - r.bottom >= altoEstimado || r.top < altoEstimado;
    setLugar(cabeAbajo ? { position: 'fixed', left: r.left, top: r.bottom + 2 } : { position: 'fixed', left: r.left, top: 'auto', bottom: window.innerHeight - r.top + 2 });
  };
  return (
    <div className="menu-acciones" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setLugar(null); }}>
      <button type="button" className="icono" aria-label="Acciones" aria-expanded={abierto} onClick={alternar}>⚙ ▾</button>
      {abierto && <div className="menu-lista" style={lugar!} onClick={() => setLugar(null)}>{children}</div>}
    </div>
  );
}

/** Varios elementos de una lista larga: buscador, casillas y los elegidos arriba (se quitan con ×). */
export function SelectorMultiple(p: { id: string; etiqueta: string; opciones: [string, string][]; valor: string[]; alCambiar: (v: string[]) => void; agrupar?: Record<string, string> }) {
  const [buscar, setBuscar] = useState('');
  const [cerradas, setCerradas] = useState<string[]>([]);
  const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nombre = new Map(p.opciones);
  const visibles = p.opciones.filter(([, t]) => normal(t).includes(normal(buscar.trim())));
  const alternar = (o: string) => p.alCambiar(p.valor.includes(o) ? p.valor.filter((x) => x !== o) : [...p.valor, o]);
  return (
    <div className="selector-multiple" role="group" aria-label={p.etiqueta}>
      {p.valor.length > 0 && (
        <div className="chips">
          {p.valor.map((o) => <span key={o} className="chip">{nombre.get(o) ?? o}<button type="button" aria-label={`Quitar ${nombre.get(o) ?? o}`} onClick={() => alternar(o)}>×</button></span>)}
        </div>
      )}
      <input id={p.id} placeholder="Buscar…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      <ul className={p.agrupar ? 'arbol' : ''}>
        {p.agrupar
          ? [...new Set(visibles.map(([o]) => p.agrupar![o] ?? 'Otros'))].map((g) => {
              const hojas = visibles.filter(([o]) => (p.agrupar![o] ?? 'Otros') === g);
              const cerrada = cerradas.includes(g) && !buscar.trim();
              return (
                <li key={g} className="rama">
                  <button type="button" className="rama-cab" aria-expanded={!cerrada} onClick={() => setCerradas((xs) => (xs.includes(g) ? xs.filter((x) => x !== g) : [...xs, g]))}>{cerrada ? '▸' : '▾'} {g} <span className="suave">({hojas.length})</span></button>
                  {!cerrada && <ul>{hojas.map(([o, t]) => <li key={o} className="hoja"><label><input type="checkbox" checked={p.valor.includes(o)} onChange={() => alternar(o)} /> <span>{t}</span></label></li>)}</ul>}
                </li>
              );
            })
          : visibles.map(([o, t]) => (
              <li key={o}><label><input type="checkbox" checked={p.valor.includes(o)} onChange={() => alternar(o)} /> <span>{t}</span></label></li>
            ))}
        {visibles.length === 0 && <li className="suave">Sin coincidencias.</li>}
      </ul>
    </div>
  );
}
