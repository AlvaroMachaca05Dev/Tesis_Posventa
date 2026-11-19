import { useCallback, useEffect, useState } from 'react';
import { api, CatalogosCompra, Compra } from '../comun/api';
import TablaMaestro from '../comun/TablaMaestro';
import { soles } from '../ordenServicio/ordenServicio.util';
import FormCompra, { TIPOS_COMPRA } from './FormCompra';
import { useConfirmar } from '../comun/Confirmar';

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '—');
const tipo = (t: string) => TIPOS_COMPRA.find(([v]) => v === t)?.[1] ?? t;

/** Compras y comprobantes de proveedores: todas las compras, «+ Nuevo» para ingresar una y anular con motivo. */
export default function Compras({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [filas, setFilas] = useState<Compra[]>([]);
  const [cat, setCat] = useState<CatalogosCompra | null>(null);
  const [nueva, setNueva] = useState(false);
  const [ver, setVer] = useState<Compra | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  // Las compras eliminadas no se muestran (quedan en la base con su motivo y su salida de stock).
  const cargar = useCallback(async () => setFilas((await api.compras()).filter((x) => x.estado === 'REGISTRADA')), []);
  const { preguntar, modal: confirmacion } = useConfirmar();
  useEffect(() => { Promise.all([cargar(), api.catalogosCompra().then(setCat)]).catch((e) => setError((e as Error).message)); }, [cargar]);

  async function anular(c: Compra) {
    const motivo = await preguntar({
      titulo: `¿Eliminar la compra ${c.codigo}?`, motivo: 'obligatorio',
      mensaje: <><p>Sus productos salen del stock.</p>{c.pagado > 0 && <p>Los pagos al proveedor ({soles(c.pagado)}) no se borran: quedan registrados como egreso.</p>}</>,
    });
    if (motivo === null) return;
    try { await api.anularCompra(c.id, motivo); setError(''); setMensaje(`Compra ${c.codigo} eliminada.`); await cargar(); } catch (x) { setError((x as Error).message); }
  }

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {confirmacion}
      {nueva && cat && <FormCompra cat={cat} alCerrar={() => setNueva(false)} alHecho={async (m) => { setNueva(false); setMensaje(m); setError(''); await cargar(); }} />}
      {ver && <DetalleCompra c={ver} alCerrar={() => setVer(null)} />}
      <TablaMaestro<Compra>
        titulo="Compras y comprobantes"
        uno="compra"
        filas={filas}
        puedeEditar={nivel !== 'V'}
        alNuevo={() => setNueva(true)}
        alCambiar={cargar}
        guardar={async () => undefined}
        columnas={[
          { titulo: 'Local', texto: (x) => x.local.nombre, ancho: 18 },
          { titulo: 'Tipo', texto: (x) => tipo(x.tipoDocumento) },
          { titulo: 'Comprobante', texto: (x) => x.codigo, celda: (x) => <span className="chip-pago">{x.codigo}</span> },
          { titulo: 'Fecha', texto: (x) => fecha(x.fecha) },
          { titulo: 'RUC / DNI', texto: (x) => x.proveedor.documento },
          { titulo: 'Proveedor', texto: (x) => x.proveedor.nombre, ancho: 28 },
          { titulo: 'Condición', texto: (x) => (x.condicion === 'CREDITO' ? 'Crédito' : 'Contado') },
          { titulo: 'Total', texto: (x) => soles(x.total) },
          { titulo: 'Pagado', texto: (x) => soles(x.pagado) },
          { titulo: 'Saldo', texto: (x) => soles(x.saldo) },
          { titulo: 'Usuario', texto: (x) => x.registradaPor, ancho: 18 },
        ]}
        acciones={(x) => (
          <>
            <button type="button" onClick={() => setVer(x)}>Ver</button>
            {nivel === 'A' && <button type="button" className="peligro" onClick={() => void anular(x)}>Eliminar</button>}
          </>
        )}
      />
    </>
  );
}

function DetalleCompra({ c, alCerrar }: { c: Compra; alCerrar: () => void }) {
  return (
    <div className="fondo-modal">
      <div className="modal-form modal-cuenta" role="dialog" aria-modal="true" aria-label={`Compra ${c.codigo}`}>
        <div className="fila entre"><h2>{tipo(c.tipoDocumento)} {c.codigo}</h2><button type="button" className="cerrar" aria-label="Cerrar" onClick={alCerrar}>×</button></div>
        <div className="dos-col">
          <div className="campo"><label>Proveedor</label><span>{c.proveedor.documento} · {c.proveedor.nombre}</span></div>
          <div className="campo"><label>Local</label><span>{c.local.nombre}</span></div>
          <div className="campo"><label>Fecha</label><span>{fecha(c.fecha)}</span></div>
          <div className="campo"><label>Condición</label><span>{c.condicion === 'CREDITO' ? `Crédito · vence ${fecha(c.fechaVencimiento)}` : 'Contado'}</span></div>
        </div>
        <div className="tabla"><table>
          <thead><tr><th>Descripción</th><th className="der">Cant.</th><th className="der">Costo</th><th className="der">Desc.</th><th className="der">Total</th></tr></thead>
          <tbody>{c.detalles.map((d) => <tr key={d.id}><td>{d.descripcion}</td><td className="der">{d.cantidad}</td><td className="der">{soles(d.costo)}</td><td className="der">{soles(d.descuento)}</td><td className="der">{soles(d.total)}</td></tr>)}</tbody>
        </table></div>
        <TablaPagos pagos={c.pagos} />
        <div className="fila fin"><span>Total <b>{soles(c.total)}</b> · Pagado <b>{soles(c.pagado)}</b> · Saldo <b>{soles(c.saldo)}</b></span></div>
      </div>
    </div>
  );
}

export function TablaPagos({ pagos }: { pagos: { id: string; fecha: string; metodo: string; concepto: string | null; valor: number }[] }) {
  return (
    <div className="tabla"><table>
      <thead><tr><th>Fecha</th><th>Método</th><th>Observación</th><th className="der">Importe</th></tr></thead>
      <tbody>
        {pagos.map((p) => <tr key={p.id}><td>{new Date(p.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td><td><span className="chip-pago">{p.metodo}</span></td><td>{p.concepto ?? ''}</td><td className="der">{soles(p.valor)}</td></tr>)}
        {pagos.length === 0 && <tr><td colSpan={4} className="suave">Sin pagos.</td></tr>}
      </tbody>
    </table></div>
  );
}
