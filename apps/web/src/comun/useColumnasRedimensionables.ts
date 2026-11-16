import { useCallback, useRef, useState } from 'react';

/**
 * Anchos de columna que el usuario ajustó a mano (arrastrando el borde), por tabla. Se guardan en localStorage.
 * Mientras se arrastra, el ancho se aplica directo a las celdas de esa columna (sin volver a dibujar la tabla);
 * al soltar el mouse se guarda y recién ahí se actualiza el estado.
 */
export function useColumnasRedimensionables(claveTabla: string) {
  const [anchos, setAnchos] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('posventa-col-' + claveTabla) ?? '{}');
    } catch {
      return {};
    }
  });
  const ultimos = useRef(anchos);
  ultimos.current = anchos;

  const guardar = useCallback((siguiente: Record<string, number>) => {
    setAnchos(siguiente);
    try {
      localStorage.setItem('posventa-col-' + claveTabla, JSON.stringify(siguiente));
    } catch {
      /* sin almacenamiento: no es grave, el ancho solo no se recuerda */
    }
  }, [claveTabla]);

  const iniciarArrastre = useCallback((columna: string, anchoActual: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).closest('th');
    const tabla = th?.closest('table') ?? null;
    const indice = th ? (th as HTMLTableCellElement).cellIndex : -1;
    const x0 = e.clientX;
    // Se parte del ancho que la columna tiene de verdad en pantalla.
    const ancho0 = th ? th.getBoundingClientRect().width || anchoActual : anchoActual;
    let nuevo = ancho0;
    let cuadro = 0;
    const aplicar = () => {
      cuadro = 0;
      if (!tabla || indice < 0) return;
      tabla.querySelectorAll('tr').forEach((fila) => {
        const celda = fila.children[indice] as HTMLElement | undefined;
        if (celda && fila.children.length > 1) {
          celda.style.width = `${nuevo}px`;
          celda.style.maxWidth = `${nuevo}px`;
        }
      });
    };
    document.body.classList.add('arrastrando-columna');
    const mover = (ev: MouseEvent) => {
      nuevo = Math.max(60, Math.min(640, ancho0 + (ev.clientX - x0)));
      if (!cuadro) cuadro = requestAnimationFrame(aplicar);
    };
    const soltar = () => {
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('mouseup', soltar);
      document.body.classList.remove('arrastrando-columna');
      if (cuadro) cancelAnimationFrame(cuadro);
      aplicar();
      if (nuevo !== ancho0) guardar({ ...ultimos.current, [columna]: nuevo });
    };
    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', soltar);
  }, [guardar]);

  return { anchos, iniciarArrastre };
}
