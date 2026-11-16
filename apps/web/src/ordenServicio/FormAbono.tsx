import { useState } from 'react';
import { api, Orden } from '../comun/api';
import { leerNumero, soles } from './ordenServicio.util';

const fecha = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

/** Pagos recibidos de una orden: los campos van uno bajo otro, luego el historial plegable y abajo Salir y Guardar. */
export default function FormAbono({ orden, metodos, alGuardar, alFallar, alCancelar }: { orden: Orden; metodos: string[]; alGuardar: (m: string) => Promise<void> | void; alFallar: (e: unknown) => void; alCancelar: () => void }) {
  const [metodo, setMetodo] = useState(metodos[0] ?? 'Efectivo');
  const [concepto, setConcepto] = useState('Abono');
  const [valor, setValor] = useState('');
  const [verHistorial, setVerHistorial] = useState(true);
  return (
    <form className="pagos" onSubmit={async (e) => { e.preventDefault(); try { const v = leerNumero(valor); if (v === null) throw new Error('Escribe el valor recibido (puedes usar coma o punto).'); await api.abonar(orden.id, { metodo, concepto, valor: v }); setValor(''); await alGuardar('Abono registrado.'); } catch (x) { alFallar(x); } }}>
      <div className="campo"><label htmlFor="pg-metodo">Método</label>
        <select id="pg-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{metodos.map((m) => <option key={m}>{m}</option>)}</select></div>
      <div className="campo"><label htmlFor="pg-valor">Valor recibido</label>
        <input id="pg-valor" inputMode="decimal" value={valor} placeholder={`Pendiente por pagar: ${soles(orden.pendiente)}`} onChange={(e) => setValor(e.target.value)} required /></div>
      <div className="campo"><label htmlFor="pg-concepto">Concepto de pago</label>
        <textarea id="pg-concepto" rows={2} value={concepto} onChange={(e) => setConcepto(e.target.value)} /></div>
      <section className="historia">
        <button type="button" className="historia-cab" aria-expanded={verHistorial} onClick={() => setVerHistorial((x) => !x)}>
          <b>Historia de pagos</b><span aria-hidden="true">{verHistorial ? '⌃' : '⌄'}</span>
        </button>
        {verHistorial && (
          orden.abonos.length === 0 ? (
            <p className="suave">No hay pagos registrados.</p>
          ) : (
            <ul className="historial-pagos">
              {orden.abonos.map((a) => (
                <li key={a.id}>
                  <span className="fecha-pago">{fecha(a.fecha)}</span>
                  <span className="chip-pago">{a.metodo}</span>
                  <span className="suave concepto-pago">{a.concepto || '—'}</span>
                  <b>{soles(a.valor)}</b>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
      <div className="fila fin pie-pagos">
        <button type="button" onClick={alCancelar}>Salir</button>
        <button type="submit" className="primario chico">Guardar</button>
      </div>
    </form>
  );
}
