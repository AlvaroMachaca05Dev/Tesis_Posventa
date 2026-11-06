import { useEffect, useState } from 'react';

/** Recorta `filas` a la página actual y expone el control «1 al 20 de 612» con tamaño de página, refrescar y navegación. */
export function usePaginacion<T>(filas: T[]) {
  const [tam, setTam] = useState(10);
  const [pagina, setPagina] = useState(1);
  const total = filas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tam));
  useEffect(() => { if (pagina > totalPaginas) setPagina(totalPaginas); }, [totalPaginas, pagina]);
  const inicio = total === 0 ? 0 : (pagina - 1) * tam + 1;
  const fin = Math.min(total, pagina * tam);
  const visibles = filas.slice(inicio - 1, fin);
  return { visibles, pagina, setPagina, tam, setTam, total, totalPaginas, inicio, fin };
}

export function Paginacion({ pagina, setPagina, tam, setTam, total, totalPaginas, inicio, fin, alRefrescar }: {
  pagina: number; setPagina: (n: number) => void; tam: number; setTam: (n: number) => void;
  total: number; totalPaginas: number; inicio: number; fin: number; alRefrescar?: () => void;
}) {
  const ult = Math.min(totalPaginas, Math.max(5, Math.min(totalPaginas, pagina + 2)));
  const prim = Math.max(1, ult - 4);
  const numeros = Array.from({ length: ult - prim + 1 }, (_, i) => prim + i);
  return (
    <div className="paginacion">
      <span className="suave">{total === 0 ? '0 de 0' : `${inicio} al ${fin} de ${total}`}</span>
      <select aria-label="Registros por página" value={tam} onChange={(e) => { setTam(Number(e.target.value)); setPagina(1); }}>
        {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      {alRefrescar && <button type="button" className="icono" aria-label="Refrescar" title="Refrescar" onClick={alRefrescar}>⟳</button>}
      <span className="nav-paginas">
        <button type="button" aria-label="Primera página" disabled={pagina <= 1} onClick={() => setPagina(1)}>⏮</button>
        <button type="button" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>◀</button>
        {numeros.map((n) => (
          <button key={n} type="button" className={n === pagina ? 'primario chico' : ''} aria-label={`Página ${n}`} aria-current={n === pagina} onClick={() => setPagina(n)}>{n}</button>
        ))}
        <button type="button" aria-label="Página siguiente" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>▶</button>
        <button type="button" aria-label="Última página" disabled={pagina >= totalPaginas} onClick={() => setPagina(totalPaginas)}>⏭</button>
      </span>
    </div>
  );
}
