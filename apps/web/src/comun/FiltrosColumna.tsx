import { useEffect, useRef, useState } from 'react';

/** Filtros por columna, como en el prototipo: un campo bajo cada encabezado y un embudo con dos condiciones unidas por Y u O. */
export type Filtro = { op1: string; v1: string; union: 'Y' | 'O'; op2: string; v2: string };
export const OPERADORES: [string, string][] = [['contiene', 'Contiene'], ['nocontiene', 'No contiene'], ['igual', 'Es igual a'], ['distinto', 'Es diferente de'], ['empieza', 'Empieza con'], ['termina', 'Termina con'], ['mayor', 'Mayor que'], ['menor', 'Menor que']];
const vacio: Filtro = { op1: 'contiene', v1: '', union: 'Y', op2: 'contiene', v2: '' };
const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const numero = (t: string) => { const n = Number(t.replace(/[^\d,.-]/g, '').replace(',', '.')); return t.trim() !== '' && Number.isFinite(n) ? n : null; };

export function cumple(valor: string, op: string, q: string) {
  if (!q) return true;
  const a = normal(valor), b = normal(q);
  switch (op) {
    case 'nocontiene': return !a.includes(b);
    case 'igual': return a === b;
    case 'distinto': return a !== b;
    case 'empieza': return a.startsWith(b);
    case 'termina': return a.endsWith(b);
    case 'mayor': case 'menor': { const x = numero(valor), y = numero(q); if (x != null && y != null) return op === 'mayor' ? x > y : x < y; return op === 'mayor' ? a > b : a < b; }
    default: return a.includes(b);
  }
}
const pasaFiltro = (valor: string, f?: Filtro) => {
  if (!f || (!f.v1 && !f.v2)) return true;
  const a = cumple(valor, f.op1, f.v1), b = cumple(valor, f.op2, f.v2);
  if (!f.v2) return a;
  if (!f.v1) return b;
  return f.union === 'Y' ? a && b : a || b;
};

/** columnas: cómo se lee el texto de cada columna filtrable (sin la de acciones). */
export function useFiltros<T>(columnas: ((x: T) => string)[], inicial?: Record<number, Filtro>) {
  const [filtros, setFiltros] = useState<Record<number, Filtro>>(inicial ?? {});
  const pasa = (x: T) => columnas.every((c, i) => pasaFiltro(c(x), filtros[i]));
  return { filtros, setFiltros, pasa };
}

/** Fila de filtros bajo el encabezado. `conAcciones` deja vacía la primera celda. */
export function FilaFiltros({ nombres, conAcciones, filtros, setFiltros }: { nombres: string[]; conAcciones: boolean; filtros: Record<number, Filtro>; setFiltros: (f: Record<number, Filtro>) => void }) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const poner = (i: number, f: Filtro) => setFiltros({ ...filtros, [i]: f });
  return (
    <tr className="fila-filtros">
      {conAcciones && <th />}
      {nombres.map((n, i) => {
        const f = filtros[i] ?? vacio;
        const activo = !!(f.v1 || f.v2) && (f.op1 !== 'contiene' || !!f.v2);
        return (
          <th key={n}>
            <div className="filtro-col">
              <input aria-label={`Filtrar ${n}`} value={f.v1} onChange={(e) => poner(i, { ...f, v1: e.target.value })} />
              <button type="button" className={'embudo' + (activo ? ' on' : '')} aria-label={`Más condiciones para ${n}`} title="Más condiciones" onClick={() => setAbierto(abierto === i ? null : i)}>
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M3 4h18l-7 8v6l-4 2v-8z" /></svg>
              </button>
              {abierto === i && <Condiciones filtro={f} alAplicar={(x) => { poner(i, x); setAbierto(null); }} alCerrar={() => setAbierto(null)} />}
            </div>
          </th>
        );
      })}
    </tr>
  );
}

function Condiciones({ filtro, alAplicar, alCerrar }: { filtro: Filtro; alAplicar: (f: Filtro) => void; alCerrar: () => void }) {
  const [f, setF] = useState(filtro);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) alCerrar(); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [alCerrar]);
  const ops = OPERADORES.map(([v, t]) => <option key={v} value={v}>{t}</option>);
  return (
    <div className="pop-filtro" ref={caja} role="dialog" aria-label="Condiciones del filtro">
      <b>Mostrar registros que sean:</b>
      <select aria-label="Primera condición" value={f.op1} onChange={(e) => setF({ ...f, op1: e.target.value })}>{ops}</select>
      <input aria-label="Primer valor" placeholder="valor" value={f.v1} onChange={(e) => setF({ ...f, v1: e.target.value })} />
      <select aria-label="Unión" value={f.union} onChange={(e) => setF({ ...f, union: e.target.value as 'Y' | 'O' })}><option value="Y">Y (ambas)</option><option value="O">O (cualquiera)</option></select>
      <select aria-label="Segunda condición" value={f.op2} onChange={(e) => setF({ ...f, op2: e.target.value })}>{ops}</select>
      <input aria-label="Segundo valor" placeholder="valor" value={f.v2} onChange={(e) => setF({ ...f, v2: e.target.value })} />
      <div className="fila">
        <button type="button" className="primario chico" onClick={() => alAplicar(f)}>🔍 Filtrar</button>
        <button type="button" onClick={() => alAplicar(vacio)}>🗑 Limpiar</button>
      </div>
    </div>
  );
}
