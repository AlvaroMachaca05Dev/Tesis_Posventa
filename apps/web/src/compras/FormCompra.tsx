import { FormEvent, useMemo, useState } from 'react';
import { api, CatalogosCompra, Pais } from '../comun/api';
import FormTercero from '../comun/FormTercero';
import { soles } from '../ordenServicio/ordenServicio.util';

interface Linea { clave: number; productoId: string; descripcion: string; cantidad: string; costo: string; descuento: string }
let sec = 0;
const nueva = (): Linea => ({ clave: ++sec, productoId: '', descripcion: '', cantidad: '1', costo: '', descuento: '' });
const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const num = (t: string) => (t.trim() === '' ? NaN : Number(t.replace(',', '.')));
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const TIPOS_COMPRA: [string, string][] = [['FACTURA', 'Factura'], ['BOLETA', 'Boleta'], ['NOTA_COMPRA', 'Nota de compra']];
const totalDe = (l: Linea) => { const c = num(l.cantidad), k = num(l.costo), d = num(l.descuento || '0'); return Number.isFinite(c) && Number.isFinite(k) ? r2(c * k - (Number.isFinite(d) ? d : 0)) : 0; };

/** Valida en pantalla lo mismo que el servidor, para avisar antes de enviar. */
export function errorDeCompra(c: { proveedorId: string; localId: string; serie: string; numero: string; fecha: string; condicion: string; vence: string }, lineas: Linea[]): string {
  if (!c.proveedorId) return 'Elige el proveedor.';
  if (!c.localId) return 'Elige el local donde entra la compra.';
  if (!/^[A-Za-z0-9]{1,4}$/.test(c.serie.trim())) return 'La serie lleva de 1 a 4 letras o números (p. ej. F001).';
  if (!/^\d{1,10}$/.test(c.numero.trim())) return 'El número del comprobante lleva solo dígitos (hasta 10).';
  if (!c.fecha || c.fecha > hoyIso()) return 'La fecha de compra no puede ser futura.';
  if (c.condicion === 'CREDITO' && (!c.vence || c.vence < c.fecha)) return 'A crédito, el vencimiento no puede ser anterior a la fecha de compra.';
  const usadas = lineas.filter((l) => l.productoId || l.descripcion.trim() || l.costo.trim());
  if (usadas.length === 0) return 'Agrega al menos un producto a la compra.';
  for (const [i, l] of usadas.entries()) {
    const c2 = num(l.cantidad), k = num(l.costo), d = num(l.descuento || '0');
    if (!l.productoId && !l.descripcion.trim()) return `Ítem ${i + 1}: escribe la descripción o elige un producto.`;
    if (!(c2 > 0 && c2 <= 1_000_000)) return `Ítem ${i + 1}: la cantidad debe ser mayor a cero.`;
    if (!(k >= 0 && k <= 1_000_000)) return `Ítem ${i + 1}: el costo no es válido.`;
    if (!(d >= 0) || d > r2(c2 * k)) return `Ítem ${i + 1}: el descuento no es válido.`;
  }
  return '';
}

/** Ingreso de compra: comprobante del proveedor, productos que entran al stock y contado o crédito. */
export default function FormCompra({ cat, alCerrar, alHecho }: { cat: CatalogosCompra; alCerrar: () => void; alHecho: (m: string) => void }) {
  const [proveedorId, setProveedorId] = useState('');
  // «+» junto al proveedor: alta rápida con el mismo formulario de Proveedores.
  const [proveedores, setProveedores] = useState(cat.proveedores);
  const [nuevoProv, setNuevoProv] = useState<{ paises: Pais[]; paisBase: string } | null>(null);
  const [errorProv, setErrorProv] = useState('');
  async function abrirProveedor() {
    try { const c = await api.config(); setNuevoProv({ paises: c.paises, paisBase: c.paisPredeterminado }); } catch (x) { setError((x as Error).message); }
  }
  const [localId, setLocalId] = useState(cat.localId ?? (cat.locales.length === 1 ? cat.locales[0].id : ''));
  const [tipoDocumento, setTipo] = useState('FACTURA');
  const [serie, setSerie] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(hoyIso());
  const [condicion, setCondicion] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [vence, setVence] = useState(hoyIso());
  const [metodo, setMetodo] = useState(cat.metodos[0] ?? 'Efectivo');
  const [observaciones, setObs] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([nueva()]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const total = useMemo(() => r2(lineas.reduce((a, l) => a + totalDe(l), 0)), [lineas]);
  const cambiar = (clave: number, d: Partial<Linea>) => setLineas((xs) => xs.map((x) => (x.clave === clave ? { ...x, ...d } : x)));
  const elegir = (l: Linea, id: string) => {
    const p = cat.productos.find((x) => x.id === id);
    cambiar(l.clave, { productoId: id, descripcion: p ? p.nombre : l.descripcion, costo: p && !l.costo && p.costo !== null ? String(p.costo) : l.costo });
  };

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const err = errorDeCompra({ proveedorId, localId, serie, numero, fecha, condicion, vence }, lineas);
    if (err) return setError(err);
    setEnviando(true);
    try {
      const items = lineas.filter((l) => l.productoId || l.descripcion.trim() || l.costo.trim())
        .map((l) => ({ productoId: l.productoId || undefined, descripcion: l.descripcion.trim() || undefined, cantidad: num(l.cantidad), costo: num(l.costo), descuento: num(l.descuento || '0') }));
      const c = await api.crearCompra({ proveedorId, localId, tipoDocumento, serie: serie.trim().toUpperCase(), numero: numero.trim(), fecha, condicion, fechaVencimiento: condicion === 'CREDITO' ? vence : undefined, metodo: condicion === 'CONTADO' ? metodo : undefined, observaciones, items });
      alHecho(`Compra ${c.codigo} registrada por ${soles(c.total)}${c.saldo > 0 ? ': pasa a Cuentas por pagar.' : '.'}`);
    } catch (x) { setError((x as Error).message); } finally { setEnviando(false); }
  }

  return (
    <div className="fondo-modal">
      {nuevoProv && (
        <FormTercero uno="proveedor" entrada={null} tipoPorDefecto="RUC" paises={nuevoProv.paises} paisBase={nuevoProv.paisBase} error={errorProv}
          alCancelar={() => { setNuevoProv(null); setErrorProv(''); }}
          alGuardar={async (d) => {
            try {
              const p = await api.crearProveedor(d as unknown as Record<string, unknown>);
              setProveedores((xs) => [...xs, { id: p.id, nombre: p.nombre, documento: p.documento }].sort((a, b) => a.nombre.localeCompare(b.nombre)));
              setProveedorId(p.id); setNuevoProv(null); setErrorProv('');
            } catch (x) { setErrorProv((x as Error).message); }
          }} />
      )}
      <form className="modal-ods modal-venta" role="dialog" aria-modal="true" aria-label="Ingresar compra" onSubmit={guardar} noValidate>
        <div className="fila entre"><h2>Ingresar compra</h2><button type="button" className="cerrar" aria-label="Cerrar" onClick={alCerrar}>×</button></div>
        {error && <p className="error" role="alert">{error}</p>}
        <section className="bloque-nota"><h3>Comprobante del proveedor</h3>
          <div className="dos-col tres">
            <div className="campo ancha"><label htmlFor="c-prov">Proveedor *</label>
              <div className="con-boton">
                <select id="c-prov" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}><option value="">Seleccionar</option>{proveedores.map((p) => <option key={p.id} value={p.id}>{p.documento} · {p.nombre}</option>)}</select>
                <button type="button" className="mas-cuadrado" aria-label="Crear proveedor" title="Crear proveedor" onClick={() => void abrirProveedor()}>+</button>
              </div></div>
            <div className="campo"><label htmlFor="c-local">Local *</label>
              <select id="c-local" value={localId} onChange={(e) => setLocalId(e.target.value)}><option value="">Seleccionar</option>{cat.locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></div>
            <div className="campo"><label htmlFor="c-tipo">Tipo de comprobante</label>
              <select id="c-tipo" value={tipoDocumento} onChange={(e) => setTipo(e.target.value)}>{TIPOS_COMPRA.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
            <div className="campo"><label htmlFor="c-serie">Serie *</label><input id="c-serie" value={serie} maxLength={4} placeholder="F001" onChange={(e) => setSerie(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} /></div>
            <div className="campo"><label htmlFor="c-num">Número *</label><input id="c-num" value={numero} maxLength={10} inputMode="numeric" onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} /></div>
            <div className="campo"><label htmlFor="c-fecha">Fecha de compra *</label><input id="c-fecha" type="date" value={fecha} max={hoyIso()} onChange={(e) => setFecha(e.target.value)} /></div>
            <div className="campo"><label>Condición</label>
              <div className="radios">{(['CONTADO', 'CREDITO'] as const).map((c) => <label key={c} className="check"><input type="radio" name="c-condicion" checked={condicion === c} onChange={() => setCondicion(c)} /> {c === 'CONTADO' ? 'Contado' : 'Crédito'}</label>)}</div></div>
            {condicion === 'CREDITO'
              ? <div className="campo"><label htmlFor="c-vence">Fecha de vencimiento *</label><input id="c-vence" type="date" value={vence} min={fecha} onChange={(e) => setVence(e.target.value)} /></div>
              : <div className="campo"><label htmlFor="c-metodo">Método de pago</label><select id="c-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{cat.metodos.map((m) => <option key={m}>{m}</option>)}</select></div>}
          </div>
        </section>
        <div className="tabla">
          <table>
            <thead><tr><th>#</th><th>Producto</th><th>Descripción</th><th className="der">Cantidad</th><th className="der">Costo unit.</th><th className="der">Descuento</th><th className="der">Total</th><th /></tr></thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={l.clave}>
                  <td>{i + 1}</td>
                  <td><select aria-label={`Producto del ítem ${i + 1}`} value={l.productoId} onChange={(e) => elegir(l, e.target.value)}><option value="">Sin producto (gasto)</option>{cat.productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}</select></td>
                  <td><input aria-label={`Descripción del ítem ${i + 1}`} maxLength={300} value={l.descripcion} onChange={(e) => cambiar(l.clave, { descripcion: e.target.value })} /></td>
                  <td className="der"><input aria-label={`Cantidad del ítem ${i + 1}`} className="corto" inputMode="decimal" maxLength={10} value={l.cantidad} onChange={(e) => cambiar(l.clave, { cantidad: e.target.value.replace(/[^\d.,]/g, '') })} /></td>
                  <td className="der"><input aria-label={`Costo del ítem ${i + 1}`} className="corto" inputMode="decimal" maxLength={10} value={l.costo} onChange={(e) => cambiar(l.clave, { costo: e.target.value.replace(/[^\d.,]/g, '') })} /></td>
                  <td className="der"><input aria-label={`Descuento del ítem ${i + 1}`} className="corto" inputMode="decimal" maxLength={10} value={l.descuento} onChange={(e) => cambiar(l.clave, { descuento: e.target.value.replace(/[^\d.,]/g, '') })} /></td>
                  <td className="der">{soles(totalDe(l))}</td>
                  <td><button type="button" className="peligro" aria-label={`Quitar el ítem ${i + 1}`} onClick={() => setLineas((xs) => (xs.length > 1 ? xs.filter((x) => x.clave !== l.clave) : [nueva()]))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fila entre">
          <button type="button" onClick={() => setLineas([...lineas, nueva()])} disabled={lineas.length >= 200}>+ Agregar ítem</button>
          <b>Total {soles(total)}</b>
        </div>
        <section className="bloque-nota"><h3>Observaciones</h3><textarea aria-label="Observaciones" rows={2} maxLength={1000} value={observaciones} onChange={(e) => setObs(e.target.value)} /></section>
        <div className="fila fin">
          <button type="button" onClick={alCerrar}>Cancelar</button>
          <button type="submit" className="primario chico" disabled={enviando}>Guardar compra</button>
        </div>
      </form>
    </div>
  );
}
