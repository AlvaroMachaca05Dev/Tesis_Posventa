import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, Compra, NotaVenta } from '../comun/api';
import TablaMaestro from '../comun/TablaMaestro';
import { soles } from '../ordenServicio/ordenServicio.util';
import { TablaPagos } from './Compras';

export const METODOS = ['Efectivo', 'Yape', 'Transferencia', 'Tarjeta', 'Otro'];
type Tipo = 'cobrar' | 'pagar';
interface Doc { id: string; codigo: string; emision: string; vence: string; parteId: string; parteDoc: string; parte: string; total: number; pagado: number; saldo: number; pagos: { id: string; fecha: string; metodo: string; concepto: string | null; valor: number }[] }
interface Parte { id: string; doc: string; nombre: string; n: number; total: number; saldo: number; vencido: number }

const diaLima = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
/** Días que faltan para el vencimiento (negativo = vencido), comparando fechas de Lima. */
export const diasParaVencer = (vence: string, hoy = new Date().toISOString()) => Math.round((Date.parse(diaLima(vence)) - Date.parse(diaLima(hoy))) / 86_400_000);
function Estado({ d }: { d: Doc }) {
  const k = diasParaVencer(d.vence);
  return k < 0 ? <span className="pill rojo">Vencido hace {-k} d</span> : k === 0 ? <span className="pill ambar">Vence hoy</span> : <span className="pill ambar">Vence en {k} d</span>;
}
const deNota = (x: NotaVenta): Doc => ({ id: x.id, codigo: x.codigo, emision: x.fechaEmision, vence: x.fechaVencimiento ?? x.fechaEmision, parteId: x.cliente.id, parteDoc: x.cliente.documento, parte: x.cliente.nombre, total: x.total, pagado: x.pagado, saldo: x.saldo, pagos: x.pagos });
const deCompra = (x: Compra): Doc => ({ id: x.id, codigo: x.codigo, emision: x.fecha, vence: x.fechaVencimiento ?? x.fecha, parteId: x.proveedor.id, parteDoc: x.proveedor.documento, parte: x.proveedor.nombre, total: x.total, pagado: x.pagado, saldo: x.saldo, pagos: x.pagos });

/** Cuentas por cobrar (notas de venta con saldo) o por pagar (compras con saldo): solo lo pendiente, por cliente o por comprobante. */
export default function Cuentas({ tipo, nivel }: { tipo: Tipo; nivel: 'A' | 'E' | 'V' }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [vista, setVista] = useState<'parte' | 'doc'>('parte');
  const [abierta, setAbierta] = useState<{ parte: string; doc?: string } | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const quien = tipo === 'cobrar' ? 'cliente' : 'proveedor';
  const cargar = useCallback(async () => setDocs(tipo === 'cobrar' ? (await api.cuentasCobrar()).map(deNota) : (await api.cuentasPagar()).map(deCompra)), [tipo]);
  useEffect(() => { cargar().catch((e) => setError((e as Error).message)); }, [cargar]);
  const partes = useMemo(() => {
    const g = new Map<string, Parte>();
    for (const d of docs) {
      const p = g.get(d.parteId) ?? { id: d.parteId, doc: d.parteDoc, nombre: d.parte, n: 0, total: 0, saldo: 0, vencido: 0 };
      p.n++; p.total += d.total; p.saldo += d.saldo; if (diasParaVencer(d.vence) < 0) p.vencido += d.saldo;
      g.set(d.parteId, p);
    }
    return [...g.values()].sort((a, b) => b.saldo - a.saldo);
  }, [docs]);
  const totalSaldo = docs.reduce((a, d) => a + d.saldo, 0), totalVencido = partes.reduce((a, p) => a + p.vencido, 0);
  const titulo = tipo === 'cobrar' ? 'Cuentas por cobrar' : 'Cuentas por pagar';
  const accion = tipo === 'cobrar' ? 'Cobrar' : 'Pagar';

  return (
    <div className="panel ancho">
      <h1>{titulo}</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      <div className="fila entre">
        <div className="seg" role="group" aria-label="Vista">
          <button type="button" className={vista === 'parte' ? 'primario chico' : ''} aria-pressed={vista === 'parte'} onClick={() => setVista('parte')}>Por {quien}</button>
          <button type="button" className={vista === 'doc' ? 'primario chico' : ''} aria-pressed={vista === 'doc'} onClick={() => setVista('doc')}>Por comprobante</button>
        </div>
        <span aria-label="Resumen de la cuenta">Saldo <b>{soles(totalSaldo)}</b> · Vencido <b className={totalVencido > 0 ? 'texto-rojo' : ''}>{soles(totalVencido)}</b></span>
      </div>
      {abierta && <ModalCuenta tipo={tipo} docs={docs.filter((d) => d.parteId === abierta.parte)} inicial={abierta.doc} puedePagar={nivel !== 'V'}
        alCerrar={() => setAbierta(null)}
        alPagar={async (m) => { setMensaje(m); setError(''); await cargar(); }} />}
      {vista === 'parte' ? (
        <TablaMaestro<Parte> key="parte" sinTitulo titulo={titulo} uno={quien} filas={partes} puedeEditar={false} alCambiar={cargar} guardar={async () => undefined}
          columnas={[
            { titulo: 'Nro. doc.', texto: (x) => x.doc },
            { titulo: 'Razón social', texto: (x) => x.nombre, ancho: 32 },
            { titulo: 'Comprobantes', texto: (x) => String(x.n) },
            { titulo: 'Deuda', texto: (x) => soles(x.total) },
            { titulo: 'Saldo', texto: (x) => soles(x.saldo) },
            { titulo: 'Vencido', texto: (x) => soles(x.vencido), celda: (x) => <span className={x.vencido > 0 ? 'texto-rojo' : ''}>{soles(x.vencido)}</span> },
          ]}
          acciones={(x) => <button type="button" onClick={() => setAbierta({ parte: x.id })}>Ver cuenta y {accion.toLowerCase()}</button>} />
      ) : (
        <TablaMaestro<Doc> key="doc" sinTitulo titulo={titulo} uno="comprobante" filas={docs} puedeEditar={false} alCambiar={cargar} guardar={async () => undefined}
          columnas={[
            { titulo: 'Comprobante', texto: (x) => x.codigo, celda: (x) => <span className="chip-pago">{x.codigo}</span> },
            { titulo: 'Emisión', texto: (x) => fecha(x.emision) },
            { titulo: 'Vencimiento', texto: (x) => fecha(x.vence) },
            { titulo: 'Nro. doc.', texto: (x) => x.parteDoc },
            { titulo: 'Razón social', texto: (x) => x.parte, ancho: 30 },
            { titulo: 'Total', texto: (x) => soles(x.total) },
            { titulo: tipo === 'cobrar' ? 'Recibido' : 'Pagado', texto: (x) => soles(x.pagado) },
            { titulo: 'Saldo', texto: (x) => soles(x.saldo) },
            { titulo: 'Estado', texto: (x) => { const k = diasParaVencer(x.vence); return k < 0 ? 'Vencido' : k === 0 ? 'Vence hoy' : 'Por vencer'; }, celda: (x) => <Estado d={x} /> },
          ]}
          acciones={(x) => <button type="button" onClick={() => setAbierta({ parte: x.parteId, doc: x.id })}>{accion}</button>} />
      )}
    </div>
  );
}

function ModalCuenta(p: { tipo: Tipo; docs: Doc[]; inicial?: string; puedePagar: boolean; alCerrar: () => void; alPagar: (m: string) => Promise<void> }) {
  const [selId, setSelId] = useState(p.inicial ?? p.docs[0]?.id ?? '');
  const sel = p.docs.find((d) => d.id === selId) ?? p.docs[0];
  const [metodo, setMetodo] = useState(METODOS[0]);
  const [valor, setValor] = useState(sel ? String(sel.saldo) : '');
  const [concepto, setConcepto] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (sel) setValor(String(sel.saldo)); }, [sel?.id, sel?.saldo]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sel) return (
    <div className="fondo-modal"><div className="modal-form" role="dialog" aria-modal="true" aria-label="Cuenta">
      <p className="ok">La cuenta quedó sin saldo pendiente.</p><div className="fila fin"><button type="button" onClick={p.alCerrar}>Cerrar</button></div>
    </div></div>
  );

  async function grabar(e: FormEvent) {
    e.preventDefault();
    const v = Math.round(Number(valor.replace(',', '.')) * 100) / 100;
    if (!(v > 0)) return setError('El importe debe ser mayor a cero.');
    if (v > sel.saldo) return setError(`El importe supera el saldo (${soles(sel.saldo)}).`);
    setEnviando(true);
    try {
      const d = { metodo, valor: v, concepto: concepto.trim() || undefined };
      if (p.tipo === 'cobrar') await api.cobrarNota(sel.id, d); else await api.pagarCompra(sel.id, d);
      setError(''); setConcepto('');
      await p.alPagar(`${p.tipo === 'cobrar' ? 'Cobro' : 'Pago'} de ${soles(v)} registrado en ${sel.codigo}.`);
    } catch (x) { setError((x as Error).message); } finally { setEnviando(false); }
  }

  return (
    <div className="fondo-modal">
      <div className="modal-form modal-cuenta" role="dialog" aria-modal="true" aria-label={`Cuenta de ${sel.parte}`}>
        <div className="fila entre"><h2>Cuenta · {sel.parte}</h2><button type="button" className="cerrar" aria-label="Cerrar" onClick={p.alCerrar}>×</button></div>
        <span className="suave">{sel.parteDoc}</span>
        <div className="cuenta-rejilla">
          <div>
            <div className="tabla"><table>
              <thead><tr><th>Comprobante</th><th>Emisión</th><th>Vencimiento</th><th className="der">Deuda</th><th className="der">Saldo</th></tr></thead>
              <tbody>
                {p.docs.map((d) => (
                  <tr key={d.id} className={'clic' + (d.id === sel.id ? ' elegida' : '')} onClick={() => setSelId(d.id)} aria-selected={d.id === sel.id}>
                    <td><button type="button" className="enlace" onClick={() => setSelId(d.id)}>{d.codigo}</button></td><td>{fecha(d.emision)}</td><td>{fecha(d.vence)} <Estado d={d} /></td><td className="der">{soles(d.total)}</td><td className="der">{soles(d.saldo)}</td>
                  </tr>
                ))}
                <tr><td colSpan={3} className="der"><b>Total</b></td><td className="der"><b>{soles(p.docs.reduce((a, d) => a + d.total, 0))}</b></td><td className="der"><b>{soles(p.docs.reduce((a, d) => a + d.saldo, 0))}</b></td></tr>
              </tbody>
            </table></div>
            <h3>Pagos de {sel.codigo}</h3>
            <TablaPagos pagos={sel.pagos} />
          </div>
          {p.puedePagar && (
            <form className="bloque-nota form-pago" onSubmit={grabar} aria-label={`${p.tipo === 'cobrar' ? 'Cobrar' : 'Pagar'} ${sel.codigo}`} noValidate>
              <h3>{p.tipo === 'cobrar' ? 'Cobrar' : 'Pagar'} {sel.codigo}</h3>
              {error && <p className="error" role="alert">{error}</p>}
              <div className="campo"><label htmlFor="cp-metodo">Método</label><select id="cp-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{METODOS.map((m) => <option key={m}>{m}</option>)}</select></div>
              <div className="campo"><label htmlFor="cp-valor">Importe</label><input id="cp-valor" inputMode="decimal" maxLength={12} value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ''))} /></div>
              <div className="campo"><label htmlFor="cp-obs">Observación</label><textarea id="cp-obs" rows={2} maxLength={200} value={concepto} onChange={(e) => setConcepto(e.target.value)} /></div>
              <div className="fila fin"><button type="button" onClick={p.alCerrar}>Cancelar</button><button type="submit" className="primario chico" disabled={enviando}>Grabar</button></div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
