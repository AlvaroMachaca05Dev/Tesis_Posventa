import { useState } from 'react';
import { Orden } from '../comun/api';
import { fecha, soles } from './ordenServicio.util';

/** Elegir la orden de origen de una garantía y, de su detalle, los servicios por los que vuelve el vehículo. */
export default function ModalGarantia(p: {
  origenes: Orden[];
  inicial: { ordenId: string; ids: string[] };
  nombreResponsable: (id?: string | null) => string;
  alAceptar: (v: { ordenId: string; ids: string[] }) => void;
  alCancelar: () => void;
}) {
  const [ordenId, setOrdenId] = useState(p.inicial.ordenId);
  const [ids, setIds] = useState<string[]>(p.inicial.ids);
  const orden = p.origenes.find((x) => x.id === ordenId) ?? null;
  const alternar = (id: string) => setIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  return (
    <div className="fondo-modal sobre">
      <div className="modal-form ancho" role="dialog" aria-modal="true" aria-label="Orden de origen de la garantía">
        <div className="fila entre"><h2>Orden de origen de la garantía</h2><button type="button" className="cerrar" aria-label="Cerrar" onClick={p.alCancelar}>×</button></div>
        <div className="campo">
          <label htmlFor="g-origen">Orden de servicio</label>
          <select id="g-origen" value={ordenId} onChange={(e) => { setOrdenId(e.target.value); setIds([]); }}>
            <option value="">Seleccionar</option>
            {p.origenes.map((x) => <option key={x.id} value={x.id}>#{x.codigo} · {x.vehiculo.placa} · {fecha(x.fechaInicio)} · {soles(x.total)}</option>)}
          </select>
        </div>
        {orden && (
          <div className="tabla" role="group" aria-label="Detalle de la orden de origen">
            <table>
              <thead><tr><th /><th>Tipo</th><th>Código</th><th>Detalle</th><th className="der">Cant.</th><th className="der">P. unit.</th><th className="der">Desc. %</th><th>Responsable</th><th className="der">Total</th></tr></thead>
              <tbody>
                {orden.detalles.map((d) => {
                  const elegible = d.tipo === 'servicio' && !!d.id;
                  return (
                    <tr key={d.id ?? d.descripcion} className={elegible ? '' : 'suave'}>
                      <td>{elegible && <input type="checkbox" aria-label={`Elegir ${d.descripcion}`} checked={ids.includes(d.id as string)} onChange={() => alternar(d.id as string)} />}</td>
                      <td>{d.tipo === 'servicio' ? 'Servicio' : 'Producto'}</td>
                      <td>{d.referencia ?? '—'}</td>
                      <td>{d.descripcion}</td>
                      <td className="der">{d.cantidad}</td>
                      <td className="der">{soles(d.precio)}</td>
                      <td className="der">{d.descuentoPct ? Number(d.descuentoPct.toFixed(2)) : 0}</td>
                      <td>{p.nombreResponsable(d.tecnicoId)}</td>
                      <td className="der">{soles(d.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="fila fin">
          {p.inicial.ordenId && <button type="button" className="peligro" onClick={() => p.alAceptar({ ordenId: '', ids: [] })}>Quitar origen</button>}
          <button type="button" onClick={p.alCancelar}>Cancelar</button>
          <button type="button" className="primario chico" disabled={!ordenId || ids.length === 0} onClick={() => p.alAceptar({ ordenId, ids })}>Aceptar</button>
        </div>
      </div>
    </div>
  );
}
