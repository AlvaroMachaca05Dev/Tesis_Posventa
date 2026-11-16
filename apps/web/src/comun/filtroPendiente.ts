import type { Filtro } from './FiltrosColumna';

/**
 * Deja un filtro listo para otra vista: por ejemplo, «Vehículos» del cliente abre el módulo de vehículos
 * con el número de documento ya escrito en el filtro de esa columna.
 */
const CLAVE = 'posventa.filtroPendiente';
type Pendiente = { vista: string; columna: string; valor: string };

export function dejarFiltro(vista: string, columna: string, valor: string) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ vista, columna, valor } satisfies Pendiente));
  } catch {
    /* sin almacenamiento: la vista se abre sin filtro */
  }
}

/** Lee el filtro pendiente de la vista (sin borrarlo; ver `olvidarFiltro`). Devuelve los filtros por posición de columna. */
export function leerFiltro(vista: string, columnas: string[]): Record<number, Filtro> | undefined {
  try {
    const p = JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null') as Pendiente | null;
    const i = p && p.vista === vista ? columnas.indexOf(p.columna) : -1;
    if (!p || i < 0) return undefined;
    return { [i]: { op1: 'igual', v1: p.valor, union: 'Y', op2: 'contiene', v2: '' } };
  } catch {
    return undefined;
  }
}

export function olvidarFiltro() {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* nada que borrar */
  }
}
