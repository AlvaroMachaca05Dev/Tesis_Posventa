import { useCallback, useRef, useState } from 'react';

/** Anchos de columna que el usuario ajustó a mano (arrastrando el borde), por tabla. Se guardan en localStorage. */
export function useColumnasRedimensionables(claveTabla: string) {
  const [anchos, setAnchos] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('posventa-col-' + claveTabla) ?? '{}');
    } catch {
      return {};
    }
  });
  const arrastre = useRef<{ columna: string; x0: number; ancho0: number } | null>(null);

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
    arrastre.current = { columna, x0: e.clientX, ancho0: anchoActual };
    const mover = (ev: MouseEvent) => {
      if (!arrastre.current) return;
      const nuevo = Math.max(60, Math.min(640, arrastre.current.ancho0 + (ev.clientX - arrastre.current.x0)));
      setAnchos((a) => ({ ...a, [arrastre.current!.columna]: nuevo }));
    };
    const soltar = () => {
      arrastre.current = null;
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('mouseup', soltar);
      setAnchos((a) => { guardar(a); return a; });
    };
    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', soltar);
  }, [guardar]);

  return { anchos, iniciarArrastre };
}
