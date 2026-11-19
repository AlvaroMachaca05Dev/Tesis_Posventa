import { FormEvent, useMemo, useState } from 'react';
import { api, CatalogosOds, Orden, TipoIgv } from '../comun/api';
import { leerNumero, soles } from '../ordenServicio/ordenServicio.util';
import { useConfirmar } from '../comun/Confirmar';

const TIPOS: [TipoIgv, string][] = [['GRAVADO', 'Gravado'], ['EXONERADO', 'Exonerado'], ['INAFECTO', 'Inafecto']];
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dia = (iso: string) => new Date(iso).toLocaleDateString('es-PE');

/** Mismas reglas que el servidor (RN-15), para mostrar los totales antes de emitir. */
export function totalesDe(lineas: { tipo: string; total: number; tipoIgv: TipoIgv }[]) {
  const suma = (t: TipoIgv) => r2(lineas.filter((l) => l.tipoIgv === t).reduce((a, l) => a + l.total, 0));
  const exonerada = suma('EXONERADO'), inafecta = suma('INAFECTO'), conIgv = suma('GRAVADO');
  const gravada = r2(conIgv / 1.18);
  const total = r2(exonerada + inafecta + conIgv);
  return { exonerada, inafecta, gravada, igv: r2(conIgv - gravada), total, proponeDetraccion: lineas.some((l) => l.tipo === 'servicio') && total > 700, detraccion: Math.floor(r2(total * 0.12) + 0.5) };
}

/**
 * Nota de venta de una orden (RF-088), en una sola pantalla y sin pestañas (DEC-81).
 * Si la orden aún no tiene nota, se emite; si ya la tiene, se muestra con Imprimir y Eliminar.
 * La serie sale del local del usuario; quien no tiene local no puede emitir.
 */
export default function FormNota({ orden, cat, puedeAnular, alImprimir, alCerrar, alHecho }: {
  orden: Orden; cat: CatalogosOds; puedeAnular: boolean; alImprimir: (formato: 'PDF' | 'Ticket') => void; alCerrar: () => void; alHecho: (m: string) => Promise<void> | void;
}) {
  const nota = orden.notaVenta ?? null;
  const locales = cat.locales ?? [];
  const localId = cat.localId ?? '';
  const [condicion, setCondicion] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [vence, setVence] = useState('');
  const [observaciones, setObservaciones] = useState(orden.observaciones ?? '');
  const [comentario, setComentario] = useState('');
  const [tipos, setTipos] = useState<Record<string, TipoIgv>>(() => Object.fromEntries(orden.detalles.map((d, i) => [d.id ?? String(i), d.impuesto === 'NINGUNO' ? 'INAFECTO' : 'GRAVADO'])));
  const [detraccion, setDetraccion] = useState<boolean | null>(null); // null = la que propone el sistema
  const [error, setError] = useState('');
  const [abonos, setAbonos] = useState(orden.abonos);
  const [metodo, setMetodo] = useState(cat.metodosPago[0] ?? 'Efectivo');
  const [valor, setValor] = useState('');
  const [verHistorial, setVerHistorial] = useState(true);
  const pagado = abonos.reduce((a, x) => a + x.valor, 0);

  const lineas = nota ? nota.detalles : orden.detalles.map((d, i) => ({ id: d.id ?? String(i), tipo: d.tipo, descripcion: d.descripcion, referencia: d.referencia, cantidad: d.cantidad, precio: d.precio, descuentoPct: d.descuentoPct, tipoIgv: tipos[d.id ?? String(i)], total: d.total }));
  const calculo = useMemo(() => totalesDe(lineas), [lineas]);
  const t = nota ?? calculo;
  const conDetraccion = nota ? nota.conDetraccion : detraccion ?? calculo.proponeDetraccion;
  const montoDetraccion = nota ? nota.detraccion : conDetraccion ? calculo.detraccion : 0;
  const serie = locales.find((l) => l.id === localId)?.serieNotaVenta ?? null;
  const cond = nota ? nota.condicion : condicion;

  async function emitir(e: FormEvent) {
    e.preventDefault();
    try {
      const n = await api.emitirNotaVenta(orden.id, { localId, condicion, ...(condicion === 'CREDITO' ? { fechaVencimiento: vence ? new Date(`${vence}T12:00:00`).toISOString() : '' } : {}), observaciones, comentario, tiposIgv: tipos, conDetraccion });
      await alHecho(`Nota de venta ${n.codigo} emitida.`);
    } catch (x) {
      setError((x as Error).message);
    }
  }
  async function pagar() {
    try {
      const v = leerNumero(valor);
      if (v === null) throw new Error('Escribe el monto recibido.');
      const o = await api.abonar(orden.id, { metodo, concepto: 'Abono', valor: v });
      setAbonos(o.abonos); setValor(''); setError('');
    } catch (x) { setError((x as Error).message); }
  }
  const { preguntar, modal: confirmacion } = useConfirmar();
  async function anular() {
    if (!nota) return;
    const pagos = abonos.reduce((a, x) => a + x.valor, 0);
    const motivo = await preguntar({ titulo: `¿Eliminar la nota de venta ${nota.codigo}?`, motivo: 'obligatorio', mensaje: mensajeEliminarComprobante(pagos) });
    if (motivo === null) return;
    try { await api.anularNotaVenta(nota.id, motivo); await alHecho(`Nota de venta ${nota.codigo} eliminada.`); } catch (x) { setError((x as Error).message); }
  }

  const fila = (etiqueta: string, valor: string, clase = '') => <div className={'suma ' + clase}><span>{etiqueta}</span>{' '}<b>{valor}</b></div>;
  const titulo = nota ? `Nota de venta ${nota.codigo}` : `Nueva nota de venta · ODS ${orden.codigo}`;
  return (
    <div className="fondo-modal">
      {confirmacion}
      <form className="modal-form modal-nota" role="dialog" aria-modal="true" aria-label={titulo} onSubmit={emitir}>
        <div className="fila entre"><h2>{titulo}</h2><button type="button" className="cerrar" aria-label="Cerrar" onClick={alCerrar}>×</button></div>
        {error && <p className="error" role="alert">{error}</p>}
        <section className="bloque-nota"><h3>Datos del comprobante</h3>
          <div className="dos-col tres">
            <div className="campo"><label htmlFor="n-tipo">Tipo de documento</label>
              <select id="n-tipo" value="NV" disabled><option value="NV">Nota de venta</option></select></div>
            <div className="campo"><label htmlFor="n-serie">Serie</label><input id="n-serie" value={nota ? nota.codigo.split('-')[0] : serie ?? ''} placeholder="Sin serie" disabled /></div>
            <div className="campo"><label htmlFor="n-nro">Número</label><input id="n-nro" value={nota ? nota.codigo.split('-')[1] : 'Automático'} disabled /></div>
            <div className="campo"><label htmlFor="n-emision">Fecha de emisión</label><input id="n-emision" value={dia(nota ? nota.fechaEmision : new Date().toISOString())} disabled /></div>
            <div className="campo"><label htmlFor="n-vence">{`Fecha de vencimiento${cond === 'CREDITO' ? ' *' : ''}`}</label>
              {nota ? <input id="n-vence" value={nota.fechaVencimiento ? dia(nota.fechaVencimiento) : '—'} disabled /> : <input id="n-vence" type="date" value={vence} disabled={condicion !== 'CREDITO'} required={condicion === 'CREDITO'} onChange={(e) => setVence(e.target.value)} />}</div>
            <div className="campo"><label htmlFor="n-ods">Orden de servicio</label><input id="n-ods" value={orden.codigo} disabled /></div>
            <div className="campo ancha"><label htmlFor="n-cliente">Cliente</label><input id="n-cliente" value={`${orden.cliente.documento} · ${orden.cliente.nombre}`} disabled /></div>
            <div className="campo"><label htmlFor="n-placa">Placa</label><input id="n-placa" value={orden.vehiculo.placa} disabled /></div>
            <div className="campo"><label>Condición</label>
              <div className="radios">
                {(['CONTADO', 'CREDITO'] as const).map((c) => (
                  <label key={c} className="check"><input type="radio" name="n-condicion" checked={cond === c} disabled={!!nota} onChange={() => setCondicion(c)} /> {c === 'CONTADO' ? 'Contado' : 'Crédito'}</label>
                ))}
              </div></div>
          </div>
        </section>
        {!nota && !serie && <p className="error" role="alert">{!localId ? 'Tu usuario no tiene un local asignado: la serie sale del local, así que no puedes emitir.' : 'Este local no tiene serie de nota de venta. Asígnala en Empresa y parámetros.'}</p>}
        <div className="tabla">
          <table>
            <thead><tr><th>#</th><th>Código</th><th>Detalle</th><th className="der">Cant.</th><th>Tipo de IGV</th><th className="der">Precio</th><th className="der">Descuento</th><th className="der">Subtotal</th><th className="der">Total</th></tr></thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={l.id}>
                  <td>{i + 1}</td>
                  <td>{l.referencia ?? ''}</td>
                  <td>{l.descripcion}</td>
                  <td className="der">{l.cantidad}</td>
                  <td>
                    <select aria-label={`Tipo de IGV de ${l.descripcion}`} value={l.tipoIgv} disabled={!!nota} onChange={(e) => setTipos({ ...tipos, [l.id]: e.target.value as TipoIgv })}>
                      {TIPOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                  </td>
                  <td className="der">{soles(l.precio)}</td>
                  <td className="der">{l.descuentoPct ? `${l.descuentoPct} %` : '—'}</td>
                  <td className="der">{soles(l.cantidad * l.precio)}</td>
                  <td className="der">{soles(l.total)}</td>
                </tr>
              ))}
              {lineas.length === 0 && <tr><td colSpan={9} className="suave">La orden no tiene ítems.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="dos-col">
          <section className="bloque-nota"><h3>Observaciones</h3><textarea aria-label="Observaciones" rows={2} value={nota ? nota.observaciones ?? '' : observaciones} disabled={!!nota} onChange={(e) => setObservaciones(e.target.value)} /></section>
          <section className="bloque-nota"><h3>Comentario</h3><textarea aria-label="Comentario" rows={2} value={nota ? nota.comentario ?? '' : comentario} disabled={!!nota} onChange={(e) => setComentario(e.target.value)} /></section>
        </div>
        <div className="pie-nota">
          <section className="bloque-nota pagos-nota"><h3>Pagos</h3>
            <div className="fila-pago">
              <select aria-label="Método de pago" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{cat.metodosPago.map((m) => <option key={m}>{m}</option>)}</select>
              <input aria-label="Monto recibido" inputMode="decimal" value={valor} placeholder={cond === 'CREDITO' && !nota ? 'A crédito: solo adelantos' : `Pendiente: ${soles(r2(t.total - pagado))}`} onChange={(e) => setValor(e.target.value)} />
              <button type="button" className="mas" aria-label="Agregar pago" onClick={() => void pagar()}>+</button>
            </div>
            <section className="historia">
              <button type="button" className="historia-cab" aria-expanded={verHistorial} onClick={() => setVerHistorial((x) => !x)}><b>Historial de pagos</b><span aria-hidden="true">{verHistorial ? '⌃' : '⌄'}</span></button>
              {verHistorial && (abonos.length === 0 ? <p className="suave">No hay pagos registrados.</p> : (
                <ul className="historial-pagos">{abonos.map((a) => <li key={a.id}><span className="fecha-pago">{new Date(a.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</span><span className="chip-pago">{a.metodo}</span><span className="suave concepto-pago">{a.concepto || '—'}</span><b>{soles(a.valor)}</b></li>)}</ul>
              ))}
            </section>
          </section>
          <div>
            <label className="check"><input type="checkbox" checked={conDetraccion} disabled={!!nota} onChange={(e) => setDetraccion(e.target.checked)} /> Detracción de 12 %</label>
            <div className="totales-nota" aria-label="Totales">
              {fila('Exonerada', soles(t.exonerada))}
              {fila('Inafecta', soles(t.inafecta))}
              {fila('Gravada', soles(t.gravada))}
              {fila('IGV (18 %)', soles(t.igv))}
              {fila('Total', soles(t.total), 'total')}
              {fila('Detracción', soles(montoDetraccion))}
              {fila('Total pagado', soles(pagado), 'pagado')}
              {fila('Saldo', soles(r2(t.total - pagado)), 'saldo')}
            </div>
          </div>
        </div>
        <div className="fila fin">
          {nota && puedeAnular && <button type="button" className="peligro" onClick={() => void anular()}>Eliminar</button>}
          {nota && <button type="button" onClick={() => alImprimir('Ticket')}>Ticket</button>}
          {nota && <button type="button" onClick={() => alImprimir('PDF')}>PDF</button>}
          <button type="button" onClick={alCerrar}>Salir</button>
          {!nota && <button type="submit" className="primario chico" disabled={!serie || lineas.length === 0}>Emitir</button>}
        </div>
      </form>
    </div>
  );
}

/** Al eliminar un comprobante: el número no se reutiliza, los productos vuelven al stock y los pagos quedan registrados. */
export function mensajeEliminarComprobante(pagos: number) {
  return (
    <>
      <p>El número no se vuelve a usar y los productos vuelven al stock.</p>
      {pagos > 0 && <p>Los pagos recibidos ({soles(pagos)}) no se borran: quedan registrados como ingreso.</p>}
    </>
  );
}
