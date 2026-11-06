import { useState } from 'react';
import { api, Orden } from '../comun/api';
import { leerNumero, soles } from './ordenServicio.util';

const fecha = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

export default function FormAbono({ orden, metodos, alGuardar, alFallar }: { orden: Orden; metodos: string[]; alGuardar: (m: string) => Promise<void> | void; alFallar: (e: unknown) => void }) {
  const [metodo, setMetodo] = useState(metodos[0] ?? 'Efectivo');
  const [concepto, setConcepto] = useState('Abono');
  const [valor, setValor] = useState('');
  return (
    <form className="abono" onSubmit={async (e) => { e.preventDefault(); try { const v = leerNumero(valor); if (v === null) throw new Error('Escribe el valor del abono (puedes usar coma o punto).'); await api.abonar(orden.id, { metodo, concepto, valor: v }); setValor(''); await alGuardar('Abono registrado.'); } catch (x) { alFallar(x); } }}>
      <span className="suave">Pendiente por pagar: {soles(orden.pendiente)}</span>
      <label>Método<select value={metodo} onChange={(e) => setMetodo(e.target.value)}>{metodos.map((m) => <option key={m}>{m}</option>)}</select></label>
      <label>Concepto<input value={concepto} onChange={(e) => setConcepto(e.target.value)} /></label>
      <label>Valor<input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required /></label>
      <button type="submit" className="primario chico">$ Registrar abono</button>
      <h4>Historial de pagos</h4>
      {orden.abonos.length === 0 ? (
        <p className="suave">No hay pagos registrados.</p>
      ) : (
        <ul className="historial-pagos">
          {orden.abonos.map((a) => (
            <li key={a.id}>
              <span>{fecha(a.fecha)}</span>
              <span>{a.metodo}</span>
              <span className="suave">{a.concepto || '—'}</span>
              <b>{soles(a.valor)}</b>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
