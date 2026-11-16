import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, CatalogoOds, CatalogosOds, Cliente, Cotizacion, Orden, TipoIgv, Vehiculo } from '../comun/api';
import { leerNumero, soles } from '../ordenServicio/ordenServicio.util';
import { totalesDe } from './FormNota';

const TIPOS: [TipoIgv, string][] = [['GRAVADO', 'Gravado'], ['EXONERADO', 'Exonerado'], ['INAFECTO', 'Inafecto']];
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const hoy = () => new Date().toLocaleDateString('es-PE');
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

interface Linea { clave: number; tipo: 'servicio' | 'producto'; referencia: string; descripcion: string; cantidad: string; precio: string; descuentoPct: string; tipoIgv: TipoIgv; servicioId: string | null; productoId: string | null; origen?: 'orden' | 'cotizacion' }
interface Pago { metodo: string; valor: number }
let contador = 0;
const vacia = (): Linea => ({ clave: ++contador, tipo: 'producto', referencia: '', descripcion: '', cantidad: '1', precio: '', descuentoPct: '0', tipoIgv: 'GRAVADO', servicioId: null, productoId: null });
const num = (t: string) => { const v = leerNumero(t); return v === null ? 0 : v; };
const totalDe = (l: Linea) => r2((l.tipo === 'servicio' ? 1 : num(l.cantidad)) * num(l.precio) * (1 - num(l.descuentoPct) / 100));

/**
 * Nueva nota de venta (RF-088) en el mismo formato que la orden de servicio: se pueden cargar los ítems de una cotización o de una
 * orden de servicio, o escribirlos directo (venta por mostrador). La serie sale del local del usuario.
 */
const lineasDe = (o: Orden): Linea[] => o.detalles.map((d) => ({
  clave: ++contador, tipo: d.tipo, referencia: d.referencia ?? '', descripcion: d.descripcion, cantidad: String(d.cantidad),
  // En un servicio el total ya es el precio (la cantidad son las horas); en un producto, total / cantidad.
  precio: String(d.tipo === 'servicio' ? d.total : d.cantidad ? r2(d.total / d.cantidad) : d.precio), descuentoPct: '0',
  tipoIgv: d.impuesto === 'NINGUNO' ? 'INAFECTO' : 'GRAVADO', servicioId: d.servicioId ?? null, productoId: d.productoId ?? null, origen: 'orden' as const,
}));
const lineasDeCot = (c: Cotizacion): Linea[] => c.detalles.map((d) => ({
  clave: ++contador, tipo: d.tipo === 'servicio' ? 'servicio' : 'producto', referencia: d.referencia ?? '', descripcion: d.descripcion, cantidad: String(d.cantidad),
  precio: String(d.precio), descuentoPct: String(d.descuentoPct), tipoIgv: d.tipoIgv, servicioId: d.servicioId ?? null, productoId: d.productoId ?? null, origen: 'cotizacion' as const,
}));

export default function FormVenta({ cat, ordenInicial, modo = 'comprobante', alCerrar, alHecho }: { cat: CatalogosOds; ordenInicial?: Orden; modo?: 'comprobante' | 'cotizacion'; alCerrar: () => void; alHecho: (m: string) => Promise<void> | void }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const esCot = modo === 'cotizacion';
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [cot, setCot] = useState<Cotizacion | null>(null);
  const [elegidaCot, setElegidaCot] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [conIgv, setConIgv] = useState(true);
  const [catalogo, setCatalogo] = useState<CatalogoOds>({ servicios: [], productos: [] });
  const [clienteId, setClienteId] = useState(ordenInicial?.cliente.id ?? '');
  const [vehiculoId, setVehiculoId] = useState(ordenInicial?.vehiculo.id ?? '');
  const [orden, setOrden] = useState<Orden | null>(ordenInicial ?? null);
  const [elegida, setElegida] = useState(ordenInicial?.id ?? '');
  const [lineas, setLineas] = useState<Linea[]>(() => (ordenInicial ? lineasDe(ordenInicial) : [vacia()]));
  const [condicion, setCondicion] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  // El vencimiento (en la cotización, «válida hasta») se puede elegir siempre y por defecto es hoy, igual que la emisión.
  const [vence, setVence] = useState(hoyIso());
  const [observaciones, setObservaciones] = useState(ordenInicial?.observaciones ?? '');
  const [comentario, setComentario] = useState('');
  const [detraccion, setDetraccion] = useState<boolean | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [metodo, setMetodo] = useState(cat.metodosPago[0] ?? 'Efectivo');
  const [valor, setValor] = useState('');
  const [verHistorial, setVerHistorial] = useState(true);
  const [error, setError] = useState('');
  const nuevaLinea = (): Linea => ({ ...vacia(), tipoIgv: conIgv ? 'GRAVADO' : 'INAFECTO' });

  useEffect(() => {
    Promise.all([api.clientes(), api.vehiculos(), esCot ? Promise.resolve([]) : api.ordenes({}), api.catalogoOds(), esCot ? Promise.resolve([]) : api.cotizaciones().catch(() => [] as Cotizacion[])])
      .then(([c, v, o, k, cs]) => {
        setClientes(c); setVehiculos(v); setCatalogo(k); setCotizaciones((cs as Cotizacion[]).filter((x) => x.estado === 'VIGENTE'));
        const libres = o.filter((x) => !x.conComprobante && x.estado !== 'Cerrada' && x.decision !== 'No aprobada' && x.detalles.length > 0);
        setOrdenes(ordenInicial && !libres.some((x) => x.id === ordenInicial.id) ? [ordenInicial, ...libres] : libres);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const serie = (cat.locales ?? []).find((l) => l.id === cat.localId)?.serieNotaVenta ?? null;
  const detalle = lineas.map((l) => ({ tipo: l.tipo, total: totalDe(l), tipoIgv: l.tipoIgv }));
  const calculo = useMemo(() => totalesDe(detalle), [detalle]); // eslint-disable-line react-hooks/exhaustive-deps
  const conDetraccion = detraccion ?? calculo.proponeDetraccion;
  const previos = orden ? orden.abonos : [];
  const pagado = r2(previos.reduce((a, x) => a + x.valor, 0) + pagos.reduce((a, x) => a + x.valor, 0));
  const placas = vehiculos.filter((v) => v.cliente.id === clienteId).map((v) => ({ id: v.id, placa: v.placa }));
  // La orden cargada siempre aparece en los selectores, aunque la lista aún no haya llegado.
  if (orden && !placas.some((v) => v.id === orden.vehiculo.id)) placas.unshift({ id: orden.vehiculo.id, placa: orden.vehiculo.placa });
  const opcOrdenes = ordenInicial && !ordenes.some((x) => x.id === ordenInicial.id) ? [ordenInicial, ...ordenes] : ordenes;
  const opcClientes = orden && !clientes.some((c) => c.id === orden.cliente.id) ? [{ id: orden.cliente.id, documento: orden.cliente.documento, nombre: orden.cliente.nombre }, ...clientes] : clientes;

  // Cargar una orden o cotización reemplaza lo que vino de la anterior de su tipo y conserva lo escrito a mano.
  const propias = (xs: Linea[], origen: Linea['origen']) => xs.filter((l) => l.origen !== origen && (l.descripcion.trim() || l.origen));
  function cargarOrden() {
    const o = ordenes.find((x) => x.id === elegida);
    if (!o) return;
    setOrden(o); setClienteId(o.cliente.id); setVehiculoId(o.vehiculo.id);
    setLineas((xs) => [...propias(xs, 'orden'), ...lineasDe(o)]);
    setObservaciones(o.observaciones ?? ''); setError('');
  }
  function quitarOrden() { setOrden(null); setElegida(''); setLineas((xs) => { const r = propias(xs, 'orden'); return r.length ? r : [nuevaLinea()]; }); }
  function cargarCotizacion() {
    const c = cotizaciones.find((x) => x.id === elegidaCot);
    if (!c) return;
    setCot(c);
    if (!orden) { setClienteId(c.cliente.id); setVehiculoId(c.vehiculo?.id ?? ''); }
    setCondicion(c.condicion); if (c.observaciones) setObservaciones(c.observaciones);
    setLineas((xs) => [...propias(xs, 'cotizacion'), ...lineasDeCot(c)]); setError('');
  }
  function quitarCotizacion() { setCot(null); setElegidaCot(''); setLineas((xs) => { const r = propias(xs, 'cotizacion'); return r.length ? r : [nuevaLinea()]; }); }
  function alternarIgv(v: boolean) { setConIgv(v); setLineas((xs) => xs.map((l) => ({ ...l, tipoIgv: v ? 'GRAVADO' : 'INAFECTO' }))); }
  const cambiar = (clave: number, parte: Partial<Linea>) => setLineas((xs) => xs.map((l) => (l.clave === clave ? { ...l, ...parte } : l)));
  // Al escribir el código o el nombre exacto de un producto o servicio del catálogo se completan el precio y la referencia.
  function escribir(l: Linea, texto: string) {
    const t = normal(texto);
    const sv = l.tipo === 'servicio' ? catalogo.servicios.find((x) => normal(`${x.codigo} · ${x.nombre}`) === t || normal(x.nombre) === t) : undefined;
    const pr = l.tipo === 'producto' ? catalogo.productos.find((x) => normal(`${x.codigo} · ${x.nombre}`) === t || normal(x.nombre) === t) : undefined;
    if (sv) cambiar(l.clave, { descripcion: sv.nombre, referencia: sv.codigo, precio: String(sv.precio), servicioId: sv.id, productoId: null, cantidad: '1' });
    else if (pr) cambiar(l.clave, { descripcion: pr.nombre, referencia: pr.referencia ?? pr.codigo, precio: String(pr.precio), productoId: pr.id, servicioId: null });
    else cambiar(l.clave, { descripcion: texto, servicioId: null, productoId: null });
  }
  function agregarPago() {
    const v = leerNumero(valor);
    if (v === null || v <= 0) return setError('Escribe el monto recibido.');
    setPagos([...pagos, { metodo, valor: v }]); setValor(''); setError('');
  }
  async function emitir(e: FormEvent) {
    e.preventDefault();
    try {
      const items = lineas.filter((l) => l.descripcion.trim()).map((l) => ({ tipo: l.tipo, referencia: l.referencia, descripcion: l.descripcion, cantidad: num(l.cantidad), precio: num(l.precio), descuentoPct: num(l.descuentoPct), tipoIgv: l.tipoIgv, servicioId: l.servicioId, productoId: l.productoId }));
      const fecha = vence ? new Date(`${vence}T12:00:00`).toISOString() : '';
      if (esCot) {
        const c = await api.crearCotizacion({ clienteId, vehiculoId: vehiculoId || undefined, validaHasta: fecha, condicion, formaPago: formaPago || undefined, conIgv, observaciones, comentario, conDetraccion, items });
        await alHecho(`Cotización ${c.codigo} emitida.`);
        return;
      }
      const n = await api.emitirNotaDirecta({ clienteId, vehiculoId: vehiculoId || undefined, ordenId: orden?.id, condicion, fechaVencimiento: fecha, observaciones, comentario, conDetraccion, pagos, items });
      await alHecho(`Nota de venta ${n.codigo} emitida.`);
    } catch (x) { setError((x as Error).message); }
  }

  const fila = (etiqueta: string, v: string, clase = '') => <div className={'suma ' + clase}><span>{etiqueta}</span>{' '}<b>{v}</b></div>;
  const puede = (esCot || !!serie) && !!clienteId && lineas.some((l) => l.descripcion.trim());
  return (
    <div className="fondo-modal">
      <form className="modal-ods modal-venta" role="dialog" aria-modal="true" aria-label={esCot ? 'Emitir nueva cotización' : 'Emitir nuevo comprobante'} onSubmit={emitir}>
        <div className="fila entre"><h2>{esCot ? 'Emitir nueva cotización' : orden ? `Emitir nuevo comprobante · ODS ${orden.codigo}` : 'Emitir nuevo comprobante'}</h2><button type="button" className="cerrar" aria-label="Cerrar" onClick={alCerrar}>×</button></div>
        {error && <p className="error" role="alert">{error}</p>}
        {!esCot && (
          <section className="bloque-nota cargar-items">
            <div className="dos-col">
              <div className="campo"><label htmlFor="v-cot">Cargar ítems desde una cotización</label>
                <div className="con-boton">
                  <select id="v-cot" value={elegidaCot} onChange={(e) => setElegidaCot(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {cotizaciones.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.cliente.nombre} · {soles(c.total)}</option>)}
                  </select>
                  <button type="button" onClick={cargarCotizacion} disabled={!elegidaCot || elegidaCot === cot?.id}>+ Agregar</button>
                  {cot && <button type="button" onClick={quitarCotizacion}>Quitar</button>}
                </div></div>
              <div className="campo"><label htmlFor="v-ods">Cargar ítems desde una orden de servicio</label>
                <div className="con-boton">
                  <select id="v-ods" value={elegida} onChange={(e) => setElegida(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {opcOrdenes.map((o) => <option key={o.id} value={o.id}>#{o.codigo} · {o.cliente.nombre} · {o.vehiculo.placa} · {soles(o.total)}</option>)}
                  </select>
                  <button type="button" onClick={cargarOrden} disabled={!elegida || elegida === orden?.id}>+ Agregar</button>
                  {orden && <button type="button" onClick={quitarOrden}>Quitar</button>}
                </div></div>
            </div>
          </section>
        )}
        <section className="bloque-nota"><h3>{esCot ? 'Datos de la cotización' : 'Datos del comprobante'}</h3>
          <div className="dos-col tres">
            {esCot ? (
              <div className="campo"><label htmlFor="v-nro">Código</label><input id="v-nro" value="Automático" disabled /></div>
            ) : (
              <>
                <div className="campo"><label htmlFor="v-tipo">Tipo de documento</label><select id="v-tipo" value="NV" onChange={() => undefined}><option value="NV">Nota de venta</option></select></div>
                <div className="campo"><label htmlFor="v-serie">Serie</label><input id="v-serie" value={serie ?? ''} placeholder="Sin serie" disabled /></div>
                <div className="campo"><label htmlFor="v-nro">Número</label><input id="v-nro" value="Automático" disabled /></div>
              </>
            )}
            <div className="campo"><label htmlFor="v-emision">Fecha de emisión</label><input id="v-emision" value={hoy()} disabled /></div>
            <div className="campo"><label htmlFor="v-vence">{esCot ? 'Válida hasta' : `Fecha de vencimiento${condicion === 'CREDITO' ? ' *' : ''}`}</label>
              <input id="v-vence" type="date" value={vence} min={esCot ? hoyIso() : undefined} required={esCot || condicion === 'CREDITO'} onChange={(e) => setVence(e.target.value)} /></div>
            {esCot && (
              <>
                <div className="campo"><label htmlFor="v-forma">Forma de pago</label>
                  <select id="v-forma" value={formaPago} onChange={(e) => setFormaPago(e.target.value)}><option value="">Sin definir</option>{cat.metodosPago.map((m) => <option key={m}>{m}</option>)}</select></div>
                <div className="campo"><label>Incluir IGV</label><label className="check"><input type="checkbox" checked={conIgv} onChange={(e) => alternarIgv(e.target.checked)} /> Los precios incluyen el IGV</label></div>
              </>
            )}
            <div className="campo"><label>Condición</label>
              <div className="radios">{(['CONTADO', 'CREDITO'] as const).map((c) => <label key={c} className="check"><input type="radio" name="v-condicion" checked={condicion === c} onChange={() => setCondicion(c)} /> {c === 'CONTADO' ? 'Contado' : 'Crédito'}</label>)}</div></div>
            <div className="campo ancha"><label htmlFor="v-cliente">Cliente *</label>
              <select id="v-cliente" value={clienteId} disabled={!!orden} required onChange={(e) => { setClienteId(e.target.value); setVehiculoId(''); }}>
                <option value="">Seleccionar</option>{opcClientes.map((c) => <option key={c.id} value={c.id}>{c.documento} · {c.nombre}</option>)}
              </select></div>
            <div className="campo"><label htmlFor="v-placa">{esCot ? 'Placa (opcional)' : 'Placa'}</label>
              <select id="v-placa" value={vehiculoId} disabled={!!orden || !clienteId} onChange={(e) => setVehiculoId(e.target.value)}>
                <option value="">Sin placa</option>{placas.map((v) => <option key={v.id} value={v.id}>{v.placa}</option>)}
              </select></div>
          </div>
        </section>
        {!esCot && !serie && <p className="error" role="alert">{!cat.localId ? 'Tu usuario no tiene un local asignado: la serie sale del local, así que no puedes emitir.' : 'Este local no tiene serie de nota de venta. Asígnala en Empresa y parámetros.'}</p>}
        <div className="tabla">
          <table>
            <thead><tr><th>#</th><th>Tipo</th><th>Código</th><th>Detalle</th><th className="der">Cant.</th><th>Tipo de IGV</th><th className="der">Precio</th><th className="der">Desc. %</th><th className="der">Total</th><th /></tr></thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={l.clave}>
                  <td>{i + 1}</td>
                  <td><select aria-label={`Tipo del ítem ${i + 1}`} value={l.tipo} onChange={(e) => cambiar(l.clave, { tipo: e.target.value as Linea['tipo'], servicioId: null, productoId: null })}><option value="producto">Producto</option><option value="servicio">Servicio</option></select></td>
                  <td><input aria-label={`Código del ítem ${i + 1}`} value={l.referencia} onChange={(e) => cambiar(l.clave, { referencia: e.target.value })} /></td>
                  <td><input aria-label={`Detalle del ítem ${i + 1}`} list={`cat-${l.tipo}`} value={l.descripcion} placeholder="Escribe para buscar…" onChange={(e) => escribir(l, e.target.value)} /></td>
                  <td className="der"><input aria-label={`Cantidad del ítem ${i + 1}`} className="corto" inputMode="decimal" value={l.cantidad} disabled={l.tipo === 'servicio'} onChange={(e) => cambiar(l.clave, { cantidad: e.target.value })} /></td>
                  <td><select aria-label={`Tipo de IGV del ítem ${i + 1}`} value={l.tipoIgv} onChange={(e) => cambiar(l.clave, { tipoIgv: e.target.value as TipoIgv })}>{TIPOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></td>
                  <td className="der"><input aria-label={`Precio del ítem ${i + 1}`} className="corto" inputMode="decimal" value={l.precio} onChange={(e) => cambiar(l.clave, { precio: e.target.value })} /></td>
                  <td className="der"><input aria-label={`Descuento del ítem ${i + 1}`} className="corto" inputMode="decimal" value={l.descuentoPct} onChange={(e) => cambiar(l.clave, { descuentoPct: e.target.value })} /></td>
                  <td className="der">{soles(totalDe(l))}</td>
                  <td><button type="button" className="peligro" aria-label={`Quitar el ítem ${i + 1}`} onClick={() => setLineas((xs) => (xs.length > 1 ? xs.filter((x) => x.clave !== l.clave) : [nuevaLinea()]))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="cat-producto">{catalogo.productos.map((p) => <option key={p.id} value={`${p.codigo} · ${p.nombre}`} />)}</datalist>
          <datalist id="cat-servicio">{catalogo.servicios.map((p) => <option key={p.id} value={`${p.codigo} · ${p.nombre}`} />)}</datalist>
        </div>
        <div className="fila"><button type="button" onClick={() => setLineas([...lineas, nuevaLinea()])}>+ Agregar ítem</button></div>
        <div className="dos-col">
          <section className="bloque-nota"><h3>Observaciones</h3><textarea aria-label="Observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></section>
          <section className="bloque-nota"><h3>Comentario</h3><textarea aria-label="Comentario" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} /></section>
        </div>
        <div className="pie-nota">
          {esCot ? <span /> : <section className="bloque-nota pagos-nota"><h3>Pagos</h3>
            <div className="fila-pago">
              <select aria-label="Método de pago" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{cat.metodosPago.map((m) => <option key={m}>{m}</option>)}</select>
              <input aria-label="Monto recibido" inputMode="decimal" value={valor} placeholder={condicion === 'CREDITO' ? 'A crédito: solo adelantos' : `Pendiente: ${soles(r2(calculo.total - pagado))}`} onChange={(e) => setValor(e.target.value)} />
              <button type="button" className="mas" aria-label="Agregar pago" onClick={agregarPago}>+</button>
            </div>
            <section className="historia">
              <button type="button" className="historia-cab" aria-expanded={verHistorial} onClick={() => setVerHistorial((x) => !x)}><b>Historial de pagos</b><span aria-hidden="true">{verHistorial ? '⌃' : '⌄'}</span></button>
              {verHistorial && (previos.length + pagos.length === 0 ? <p className="suave">No hay pagos registrados.</p> : (
                <ul className="historial-pagos">
                  {previos.map((a) => <li key={a.id}><span className="fecha-pago">{new Date(a.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</span><span className="chip-pago">{a.metodo}</span><span className="suave concepto-pago">Adelanto en la ODS</span><b>{soles(a.valor)}</b></li>)}
                  {pagos.map((a, i) => <li key={`n${i}`}><span className="fecha-pago">Ahora</span><span className="chip-pago">{a.metodo}</span><span className="suave concepto-pago"><button type="button" className="enlace" onClick={() => setPagos(pagos.filter((_, j) => j !== i))}>Quitar</button></span><b>{soles(a.valor)}</b></li>)}
                </ul>
              ))}
            </section>
          </section>}
          <div>
            <label className="check"><input type="checkbox" checked={conDetraccion} onChange={(e) => setDetraccion(e.target.checked)} /> Detracción de 12 %</label>
            <div className="totales-nota" aria-label="Totales">
              {fila('Exonerada', soles(calculo.exonerada))}{fila('Inafecta', soles(calculo.inafecta))}{fila('Gravada', soles(calculo.gravada))}{fila('IGV (18 %)', soles(calculo.igv))}
              {fila('Total', soles(calculo.total), 'total')}{fila('Detracción', soles(conDetraccion ? calculo.detraccion : 0))}
              {!esCot && fila('Total pagado', soles(pagado), 'pagado')}{!esCot && fila('Saldo', soles(r2(calculo.total - pagado)), 'saldo')}
            </div>
          </div>
        </div>
        <div className="fila fin"><button type="button" onClick={alCerrar}>Salir</button><button type="submit" className="primario chico" disabled={!puede}>Emitir</button></div>
      </form>
    </div>
  );
}
