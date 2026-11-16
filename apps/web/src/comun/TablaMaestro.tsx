import { CSSProperties, FormEvent, ReactNode, useEffect, useState } from 'react';
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
}) {
  const [editando, setEditando] = useState<T | 'nuevo' | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const { filtros, setFiltros, pasa } = useFiltros<T>(p.columnas.map((c) => c.texto));
  const { anchos, iniciarArrastre } = useColumnasRedimensionables(p.uno);
  const filtradas = p.filas.filter((x) => (verInactivos || !p.activo || p.activo(x)) && pasa(x));
  const { visibles, pagina, setPagina, tam, setTam, total, totalPaginas, inicio, fin } = usePaginacion(filtradas);
  const conAcciones = p.puedeEditar || !!p.acciones;

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

  return (
    <div className={p.sinTitulo ? '' : 'panel ancho'}>
      {!p.sinTitulo && <h1>{p.titulo}</h1>}
      <div className="fila entre">
        {p.activo ? <label className="check"><input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Mostrar inactivos</label> : <span />}
        {p.puedeEditar && <button type="button" className="primario chico" onClick={() => setEditando('nuevo')}>+ Nuevo</button>}
      </div>
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {error && !editando && <p className="error" role="alert">{error}</p>}
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
            titulo={`${fila ? 'Editar' : 'Nuevo'} ${p.uno}`}
            fila={fila}
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
                      {p.puedeEditar && <button type="button" onClick={() => setEditando(x)}>Editar</button>}
                      {p.puedeEditar && p.alternar && p.activo && (
                        <button type="button" className={p.activo(x) ? 'peligro' : ''} onClick={() => { if (!p.activo!(x) || window.confirm(`¿Quitar este ${p.uno} de la lista activa? Se conserva y puedes restaurarlo.`)) void hacer(() => p.alternar!(x), p.activo!(x) ? 'Quitado de la lista activa.' : 'Restaurado.'); }}>{p.activo(x) ? 'Quitar' : 'Restaurar'}</button>
                      )}
                      {p.puedeEditar && p.eliminar && <button type="button" className="peligro" onClick={() => { if (window.confirm(`¿Eliminar este ${p.uno}?`)) void hacer(() => p.eliminar!(x), 'Eliminado.'); }}>Eliminar</button>}
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

function FormMaestro<T>(p: { titulo: string; fila: T | null; campos: Campo[] | ((x: T | null, v: Record<string, Valor>) => Campo[]); inicial: Record<string, Valor>; error: string; alCancelar: () => void; alGuardar: (d: Record<string, Valor>) => Promise<void> }) {
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
      <form className="modal-form" role="dialog" aria-modal="true" aria-label={p.titulo} onSubmit={enviar}>
        <h2>{p.titulo}</h2>
        {p.error && <p className="error" role="alert">{p.error}</p>}
        <div className="dos-col">
          {campos.map((c) => (
            <div key={c.k} className={'campo' + (c.ancha || c.tipo === 'area' ? ' ancha' : '')}>
              {c.tipo === 'check' ? (
                <label className="check"><input id={id(c.k)} type="checkbox" checked={!!v[c.k]} onChange={(e) => setV({ ...v, [c.k]: e.target.checked })} /> {c.etiqueta}</label>
              ) : (
                <>
                  <label htmlFor={id(c.k)}>{c.etiqueta}</label>
                  {c.tipo === 'multi' ? (
                    <select id={id(c.k)} multiple size={8} value={(v[c.k] as string[]) ?? []} onChange={(e) => setV({ ...v, [c.k]: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
                      {(c.opciones ?? []).map(([o, t]) => <option key={o} value={o}>{t}</option>)}
                    </select>
                  ) : c.tipo === 'select' ? (
                    <select id={id(c.k)} value={String(v[c.k] ?? '')} required={c.requerido} onChange={(e) => setV({ ...v, [c.k]: e.target.value })}>
                      {(c.opciones ?? []).map(([o, t]) => <option key={o} value={o}>{t}</option>)}
                    </select>
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
