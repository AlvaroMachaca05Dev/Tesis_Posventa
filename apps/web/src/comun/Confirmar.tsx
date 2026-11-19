import { FormEvent, ReactNode, useCallback, useState } from 'react';

/**
 * Confirmación propia (en vez de window.confirm / window.prompt, que el navegador de la app no muestra):
 * título, mensaje, motivo opcional u obligatorio y botón de acción. Se usa como una promesa:
 *   const motivo = await preguntar({ titulo: '¿Eliminar…?', motivo: 'obligatorio' }); // null = canceló
 */
export interface Pregunta { titulo: string; mensaje?: ReactNode; boton?: string; peligro?: boolean; motivo?: 'obligatorio' | 'opcional'; etiquetaMotivo?: string }

export function useConfirmar() {
  const [p, setP] = useState<(Pregunta & { resolver: (v: string | null) => void }) | null>(null);
  const preguntar = useCallback((q: Pregunta) => new Promise<string | null>((resolver) => setP({ ...q, resolver })), []);
  const modal = p ? <DialogoConfirmar {...p} alResponder={(v) => { p.resolver(v); setP(null); }} /> : null;
  return { preguntar, modal };
}

export function DialogoConfirmar(p: Pregunta & { alResponder: (v: string | null) => void }) {
  const [motivo, setMotivo] = useState('');
  const falta = p.motivo === 'obligatorio' && !motivo.trim();
  const enviar = (e: FormEvent) => { e.preventDefault(); if (!falta) p.alResponder(motivo.trim()); };
  return (
    <div className="fondo-modal sobre">
      <form className="modal-form modal-confirmar" role="alertdialog" aria-modal="true" aria-label={p.titulo} onSubmit={enviar}>
        <h2>{p.titulo}</h2>
        {p.mensaje && <div className="mensaje-confirmar">{p.mensaje}</div>}
        {p.motivo && (
          <div className="campo">
            <label htmlFor="confirmar-motivo">{p.etiquetaMotivo ?? 'Motivo'}{p.motivo === 'obligatorio' ? ' *' : ''}</label>
            <textarea id="confirmar-motivo" rows={2} maxLength={500} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        )}
        <div className="fila fin">
          <button type="button" onClick={() => p.alResponder(null)}>Cancelar</button>
          <button type="submit" className={p.peligro === false ? 'primario chico' : 'peligro lleno'} disabled={falta}>{p.boton ?? 'Eliminar'}</button>
        </div>
      </form>
    </div>
  );
}
