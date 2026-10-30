import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, CatalogosOds, Cliente, DetalleOds, EstadoVehiculo, Orden, Vehiculo } from './api';

type Nivel = 'A' | 'E' | 'V';
const ESTADOS = [
  { id: 'Recepcion', nombre: 'Recepción' },
  { id: 'EnProceso', nombre: 'En proceso' },
  { id: 'Entrega', nombre: 'Entrega' },
  { id: 'Cerrada', nombre: 'Cerrado' },
];
const soles = (n: number) => 'S/ ' + n.toFixed(2);
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const hace = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`;
};
const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const r3 = (x: number) => Math.round((x + Number.EPSILON) * 1000) / 1000;
// En un servicio la cantidad son H-H y no multiplican el precio (decisión R5); en un producto sí.
/** Acepta coma o punto decimal («12,50» o «12.50»); devuelve null si no es un número. */
export const leerNumero = (t: string) => {
  const n = Number(String(t).trim().replace(/\s/g, '').replace(',', '.'));
  return String(t).trim() === '' || !Number.isFinite(n) ? null : n;
};
const totalLinea = (d: DetalleOds) => r2((d.tipo === 'servicio' ? 1 : d.cantidad) * d.precio * (1 - d.descuentoPct / 100));

export default function Ordenes({ nivel, superadmin = false }: { nivel: Nivel; superadmin?: boolean }) {
  const puedeEditar = nivel === 'A' || nivel === 'E';
  const [estado, setEstado] = useState('Recepcion');
  const [f, setF] = useState({ q: '', desde: '', hasta: '', clienteId: '', vehiculoId: '', n: '10' });
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [cat, setCat] = useState<CatalogosOds | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [abierta, setAbierta] = useState<Orden | 'nueva' | null>(null);
  const [menu, setMenu] = useState<{ id: string; tipo: 'estado' | 'imprimir' | 'abono' | 'comprobantes' | 'bitacora' | 'fechas' } | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async (est = estado, filtros = f) => {
    setOrdenes(await api.ordenes({ estado: est, ...filtros }));
  }, [estado, f]);
  useEffect(() => {
    Promise.all([api.catalogosOds(), api.clientes(), api.vehiculos()])
      .then(([c, cl, v]) => { setCat(c); setClientes(cl); setVehiculos(v); })
      .catch((e) => setError((e as Error).message));
    cargar('Recepcion').catch((e) => setError((e as Error).message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ok = async (m: string) => { setError(''); setMensaje(m); setMenu(null); await cargar(); };
  const falla = (e: unknown) => { setMensaje(''); setError((e as Error).message); };

  async function cambiarEstado(o: Orden, e: string) {
    if (o.estado === 'Cerrada' && e !== 'Cerrada' && !window.confirm('La ODS sale de «Cerrado»: se borrará su fecha de cierre. ¿Continuar?')) return;
    try { await api.editarOrden(o.id, { estado: e }); await ok(`ODS ${o.codigo}: estado cambiado.`); } catch (x) { setMenu(null); falla(x); }
  }
  async function eliminar(o: Orden) {
    const motivo = window.prompt(`¿Por qué eliminas la ODS ${o.codigo}? El número no se volverá a usar.`);
    if (motivo === null) return;
    try { await api.eliminarOrden(o.id, motivo); await ok(`ODS ${o.codigo} eliminada.`); } catch (x) { falla(x); }
  }
  function imprimir(o: Orden, formato: 'PDF' | 'Ticket' | 'Recepción') {
    setMenu(null);
    const w = window.open('', '_blank');
    if (!w) return setError('Permite ventanas emergentes para imprimir.');
    const filas = o.detalles.map((d) => `<tr><td>${d.descripcion}</td><td style="text-align:right">${d.cantidad}</td><td style="text-align:right">${soles(d.total)}</td></tr>`).join('');
    const terminos = formato === 'Recepción' ? '<h3>Términos y condiciones</h3><p>El taller no se responsabiliza por objetos de valor dejados en el vehículo. Los repuestos cambiados se entregan al cliente si los solicita.</p><br><p>______________________<br>Firma del cliente</p>' : '';
    w.document.write(`<title>${formato} ODS ${o.codigo}</title><body style="font-family:Arial;padding:20px;${formato === 'Ticket' ? 'width:280px;font-size:12px' : ''}"><h2>${formato === 'Recepción' ? 'Recepción del vehículo' : 'Orden de servicio'} ${o.codigo}</h2><p>${o.cliente.nombre} (${o.cliente.documento})<br>${[o.vehiculo.marca, o.vehiculo.modelo, o.vehiculo.anio, o.vehiculo.placa].filter(Boolean).join(' · ')} · ${o.km ?? ''} km<br>${o.tipoAtencion}</p>${formato === 'Recepción' ? '' : `<table style="width:100%">${filas}</table><h3>TOTAL ${soles(o.total)}</h3>`}${terminos}</body>`);
    w.document.close();
    w.print();
  }

  return (
    <div className="panel ancho ods">
      <div className="fila entre">
        <h1>Órdenes de servicio</h1>
        {puedeEditar && <button type="button" className="primario chico" onClick={() => setAbierta('nueva')}>+ Nueva orden</button>}
      </div>
      <div className="estados" role="tablist">
        {ESTADOS.map((e) => (
          <button key={e.id} type="button" role="tab" aria-selected={estado === e.id} className={'est-' + e.id + (estado === e.id ? ' on' : '')} onClick={() => { setEstado(e.id); cargar(e.id).catch(falla); }}>{e.nombre}</button>
        ))}
      </div>
      <form className="filtros" onSubmit={(e: FormEvent) => { e.preventDefault(); cargar().catch(falla); }}>
        <label>Ingresos desde<input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></label>
        <label>Ingresos hasta<input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></label>
        <label className="ancho">Búsqueda rápida<input placeholder="Cliente, placa o consecutivo" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
        <label>Buscar por cliente<select value={f.clienteId} onChange={(e) => setF({ ...f, clienteId: e.target.value })}><option value="">Todos</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.documento} · {c.nombre}</option>)}</select></label>
        <label>Buscar por vehículo<select value={f.vehiculoId} onChange={(e) => setF({ ...f, vehiculoId: e.target.value })}><option value="">Todos</option>{vehiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}</option>)}</select></label>
        <label>Mostrar<select value={f.n} onChange={(e) => setF({ ...f, n: e.target.value })}>{['10', '25', '50', '100'].map((n) => <option key={n}>{n}</option>)}</select></label>
        <button type="submit" className="primario chico">Filtrar</button>
      </form>
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {error && !abierta && <p className="error" role="alert">{error}</p>}
      {ordenes.map((o) => (
        <article key={o.id} className="tarjeta-ods">
          <div className="info">
            <div><b>Consecutivo:</b> <span>{'#' + o.codigo}</span> <button type="button" className={'etq' + (o.conComprobante ? ' si' : '')} onClick={() => setMenu(menu?.id === o.id && menu.tipo === 'comprobantes' ? null : { id: o.id, tipo: 'comprobantes' })}>{o.conComprobante ? 'Con comprobante' : 'Sin comprobante'}</button></div>
            {menu?.id === o.id && menu.tipo === 'comprobantes' && <div className="sub">{o.comprobantes.length ? o.comprobantes.join(', ') : 'Esta ODS todavía no tiene comprobantes.'}</div>}
            <div><b>Fecha de inicio:</b> {fecha(o.fechaInicio)} · <b>Fecha de cierre:</b> {fecha(o.fechaCierre)}</div>
            <div><b>Cliente:</b> {o.cliente.nombre} ({o.cliente.documento})</div>
            <div><b>Vehículo:</b> {[o.vehiculo.marca && `Marca: ${o.vehiculo.marca}`, o.vehiculo.modelo && `Modelo: ${o.vehiculo.modelo}`, o.vehiculo.anio && `Año: ${o.vehiculo.anio}`, `Placa: ${o.vehiculo.placa}`, o.vehiculo.nroVin && `VIN: ${o.vehiculo.nroVin}`, o.km != null && `Kilometraje: ${o.km}`].filter(Boolean).join(', ')}</div>
            <div><b>Tipo de atención:</b> {o.tipoAtencion} · <b>Decisión:</b> {o.decision}</div>
            {o.observaciones && <div><b>Comentarios:</b> {o.observaciones}</div>}
            <div><b>Técnico:</b> {o.tecnico?.nombre ?? 'Sin asignar'} · <b>Usuario:</b> {o.creadoPor?.nombre ?? '—'} · <b>Total:</b> {soles(o.total)}</div>
            {o.ultimaBitacora && <div className="suave">💬 {o.ultimaBitacora.actor}: {o.ultimaBitacora.texto} ({hace(o.ultimaBitacora.fecha)})</div>}
          </div>
          <div className="acciones-ods">
            <button type="button" className="ac" aria-label="Facturar" title="Facturar: la nota de venta llega con el slice comercial" disabled>$</button>
            <button type="button" className="ac" aria-label="Editar" title="Editar" onClick={() => setAbierta(o)}>✎</button>
            <span className="rel">
              <button type="button" className="ac" aria-label="Fechas de inicio y cierre" title="Fechas de inicio y cierre" disabled={!superadmin} onClick={() => setMenu(menu?.id === o.id && menu.tipo === 'fechas' ? null : { id: o.id, tipo: 'fechas' })}>📅</button>
              {menu?.id === o.id && menu.tipo === 'fechas' && <div className="menu ancho"><FormFechas orden={o} alGuardar={ok} alFallar={falla} /></div>}
            </span>
            <span className="rel">
              <button type="button" className="ac" aria-label="Estado de la orden" title="Estado de la orden" disabled={!puedeEditar} onClick={() => setMenu(menu?.id === o.id && menu.tipo === 'estado' ? null : { id: o.id, tipo: 'estado' })}>⇄</button>
              {menu?.id === o.id && menu.tipo === 'estado' && (
                <div className="menu" role="menu">{ESTADOS.map((e) => <button key={e.id} type="button" role="menuitem" disabled={e.id === o.estado} onClick={() => void cambiarEstado(o, e.id)}>{e.nombre}</button>)}</div>
              )}
            </span>
            <span className="rel">
              <button type="button" className="ac" aria-label="Bitácora" title="Bitácora" onClick={() => setMenu(menu?.id === o.id && menu.tipo === 'bitacora' ? null : { id: o.id, tipo: 'bitacora' })}>💬</button>
              {menu?.id === o.id && menu.tipo === 'bitacora' && <div className="menu ancho">{o.bitacora.length ? o.bitacora.map((b, i) => <p key={i}><b>{b.actor}</b> · {fecha(b.fecha)}<br />{b.texto}</p>) : <p>Sin registros.</p>}</div>}
            </span>
            <span className="rel">
              <button type="button" className="ac" aria-label="Registrar abono o pago" title="Registrar abono o pago" disabled={!puedeEditar} onClick={() => setMenu(menu?.id === o.id && menu.tipo === 'abono' ? null : { id: o.id, tipo: 'abono' })}>💵</button>
              {menu?.id === o.id && menu.tipo === 'abono' && cat && <div className="menu ancho"><FormAbono orden={o} metodos={cat.metodosPago} alGuardar={ok} alFallar={falla} /></div>}
            </span>
            <span className="rel">
              <button type="button" className="ac" aria-label="Imprimir" title="Imprimir" onClick={() => setMenu(menu?.id === o.id && menu.tipo === 'imprimir' ? null : { id: o.id, tipo: 'imprimir' })}>🖨</button>
              {menu?.id === o.id && menu.tipo === 'imprimir' && (
                <div className="menu" role="menu">{(['PDF', 'Ticket', 'Recepción'] as const).map((x) => <button key={x} type="button" role="menuitem" onClick={() => imprimir(o, x)}>{x}</button>)}</div>
              )}
            </span>
            <button type="button" className="ac rojo" aria-label="Eliminar" title="Eliminar" disabled={nivel !== 'A'} onClick={() => void eliminar(o)}>🗑</button>
          </div>
        </article>
      ))}
      {ordenes.length === 0 && <p className="suave">No hay órdenes en este estado con esos filtros.</p>}
      {abierta && cat && (
        <EditorOrden
          orden={abierta === 'nueva' ? null : abierta}
          cat={cat}
          clientes={clientes}
          vehiculos={vehiculos}
          puedeEditar={puedeEditar}
          alCerrar={async (m) => { setAbierta(null); if (m) await ok(m); else await cargar(); }}
        />
      )}
    </div>
  );
}

/** Fecha y hora en un solo campo (como en ClickUp). Solo el Superadministrador corrige una orden creada o cerrada tarde. */
const aLocal = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
function FormFechas({ orden, alGuardar, alFallar }: { orden: Orden; alGuardar: (m: string) => Promise<void> | void; alFallar: (e: unknown) => void }) {
  const [ini, setIni] = useState(aLocal(orden.fechaInicio));
  const [cie, setCie] = useState(aLocal(orden.fechaCierre));
  const cerrada = orden.estado === 'Cerrada';
  return (
    <form className="abono fechas" onSubmit={async (e) => {
      e.preventDefault();
      try {
        const d: Record<string, string> = {};
        if (ini !== aLocal(orden.fechaInicio)) d.fechaInicio = new Date(ini).toISOString();
        if (cerrada && cie && cie !== aLocal(orden.fechaCierre)) d.fechaCierre = new Date(cie).toISOString();
        if (Object.keys(d).length) { await api.editarOrden(orden.id, d); await alGuardar(`ODS ${orden.codigo}: fechas corregidas.`); }
      } catch (x) { alFallar(x); }
    }}>
      <label>Fecha de inicio<input type="datetime-local" required value={ini} onChange={(e) => setIni(e.target.value)} /></label>
      <label>Fecha de cierre<input type="datetime-local" value={cie} disabled={!cerrada} title={cerrada ? '' : 'Se asigna al pasar a Cerrado'} onChange={(e) => setCie(e.target.value)} /></label>
      <button type="submit" className="primario chico">Guardar fechas</button>
    </form>
  );
}

function FormAbono({ orden, metodos, alGuardar, alFallar }: { orden: Orden; metodos: string[]; alGuardar: (m: string) => Promise<void> | void; alFallar: (e: unknown) => void }) {
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
    </form>
  );
}

/** Crear o editar la ODS en una sola pantalla: datos del comprobante, ítems, TOTAL y abonos. */
const itemVacio = (): DetalleOds => ({ tipo: 'servicio', descripcion: '', referencia: null, cantidad: 1, costo: null, rentabilidadPct: null, precio: 0, descuentoPct: 0, impuesto: 'IGV', total: 0, tecnicoId: null });

function EditorOrden(p: { orden: Orden | null; cat: CatalogosOds; clientes: Cliente[]; vehiculos: Vehiculo[]; puedeEditar: boolean; alCerrar: (m?: string) => void }) {
  const [o, setO] = useState<Orden | null>(p.orden);
  const [cab, setCab] = useState(() => ({
    clienteId: p.orden?.cliente.id ?? '', vehiculoId: p.orden?.vehiculo.id ?? '', tipoAtencion: p.orden?.tipoAtencion ?? p.cat.tiposAtencion[0], km: p.orden?.km != null ? String(p.orden.km) : '',
    tecnicoId: p.orden?.tecnico?.id ?? '', jefeTallerId: p.orden?.jefeTaller?.id ?? '', estado: p.orden?.estado ?? 'Recepcion', decision: p.orden?.decision ?? p.cat.decisiones[0],
    observaciones: p.orden?.observaciones ?? '', recomendaciones: p.orden?.recomendaciones ?? '',
  }));
  const [items, setItems] = useState<DetalleOds[]>(p.orden?.detalles ?? [itemVacio()]);
  const [vistaCliente, setVistaCliente] = useState(false);
  const [pct, setPct] = useState('');
  const [error, setError] = useState('');
  const bloqueada = !p.puedeEditar || o?.estado === 'Cerrada';
  const vehiculosCliente = useMemo(() => p.vehiculos.filter((v) => !cab.clienteId || v.cliente.id === cab.clienteId), [p.vehiculos, cab.clienteId]);
  const v = p.vehiculos.find((x) => x.id === cab.vehiculoId) ?? (o ? { ...o.vehiculo } : null);
  const total = r2(items.reduce((a, d) => a + totalLinea(d), 0));

  const cambiarItem = (i: number, campo: keyof DetalleOds, valor: string) => setItems((xs) => xs.map((d, j) => {
    if (j !== i) return d;
    const n = { ...d } as DetalleOds;
    const leido = leerNumero(valor);
    if (!['tipo', 'impuesto', 'descripcion', 'referencia', 'tecnicoId'].includes(campo) && valor !== '' && leido === null) return d; // se ignora lo que no es número
    const num = r3(leido ?? 0);
    if (campo === 'tipo') n.tipo = valor as DetalleOds['tipo'];
    else if (campo === 'impuesto') n.impuesto = valor as DetalleOds['impuesto'];
    else if (campo === 'descripcion' || campo === 'referencia') (n[campo] as string) = valor;
    else if (campo === 'tecnicoId') n.tecnicoId = valor || null;
    else if (campo === 'rentabilidadPct') { n.rentabilidadPct = valor === '' ? null : num; if (n.costo != null && n.rentabilidadPct != null) n.precio = r3(n.costo * (1 + n.rentabilidadPct / 100)); }
    else if (campo === 'costo') { n.costo = valor === '' ? null : num; if (n.costo && n.rentabilidadPct != null) n.precio = r3(n.costo * (1 + n.rentabilidadPct / 100)); }
    else if (campo === 'precio') { n.precio = num; if (n.costo) n.rentabilidadPct = r3((n.precio / n.costo - 1) * 100); }
    else if (campo === 'total') { const base = (n.tipo === 'servicio' ? 1 : n.cantidad) * (1 - n.descuentoPct / 100); n.precio = base > 0 ? r3(num / base) : n.precio; }
    else if (campo === 'cantidad' || campo === 'descuentoPct') n[campo] = num;
    n.total = totalLinea(n);
    return n;
  }));

  async function crear() {
    if (!cab.vehiculoId) return setError('Elige el vehículo.');
    try {
      const n = await api.crearOrden({ vehiculoId: cab.vehiculoId, tipoAtencion: cab.tipoAtencion, km: cab.km || null, tecnicoId: cab.tecnicoId || null, jefeTallerId: cab.jefeTallerId || null, observaciones: cab.observaciones, recomendaciones: cab.recomendaciones });
      const llenos = items.filter((d) => d.descripcion.trim());
      const r = llenos.length ? await api.guardarDetalles(n.id, llenos) : n;
      p.alCerrar(`ODS ${r.codigo} creada.`);
    } catch (x) { setError((x as Error).message); }
  }
  async function guardar() {
    if (!o) return crear();
    try {
      const cambios: Record<string, unknown> = { vehiculoId: cab.vehiculoId, tipoAtencion: cab.tipoAtencion, km: cab.km || null, tecnicoId: cab.tecnicoId || null, jefeTallerId: cab.jefeTallerId || null, decision: cab.decision, observaciones: cab.observaciones, recomendaciones: cab.recomendaciones };
      if (cab.estado !== o.estado) {
        if (o.estado === 'Cerrada' && !window.confirm('La ODS sale de «Cerrado»: se borrará su fecha de cierre. ¿Continuar?')) return;
        cambios.estado = cab.estado;
      }
      let r = o;
      if (o.estado !== 'Cerrada') r = await api.guardarDetalles(o.id, items);
      r = await api.editarOrden(o.id, cambios);
      p.alCerrar(`ODS ${r.codigo} guardada.`);
    } catch (x) { setError((x as Error).message); }
  }
  async function aplicarDescuento() {
    const n = leerNumero(pct) ?? NaN;
    if (!Number.isFinite(n) || n < 0 || n > 100) return setError('El descuento debe estar entre 0 y 100 %.');
    setItems((xs) => xs.map((d) => { const x = { ...d, descuentoPct: n }; x.total = totalLinea(x); return x; }));
  }
  const sel = (id: string, etiqueta: string, valor: string, opciones: [string, string][], cambiar: (v: string) => void, deshabilitado = false) => (
    <label htmlFor={id}>{etiqueta}<select id={id} value={valor} disabled={deshabilitado} onChange={(e) => cambiar(e.target.value)}>{opciones.map(([v1, t]) => <option key={v1} value={v1}>{t}</option>)}</select></label>
  );
  const ro = (etiqueta: string, valor: unknown) => <label>{etiqueta}<input value={valor == null ? '' : String(valor)} disabled /></label>;

  const [abiertoComprobante, setAbiertoComprobante] = useState(true);
  const [formAbono, setFormAbono] = useState(false);
  const [verEstado, setVerEstado] = useState(false);
  const ob = o ?? ({ id: '', codigo: '', estado: 'Recepcion', abonos: [], totalAbonos: 0, evidencias: [] } as unknown as Orden);
  const pendiente = r2(total - ob.totalAbonos);
  const responsables: [string, string][] = [['', '—'], ...p.cat.tecnicos.map((u) => [u.id, u.nombre] as [string, string])];

  return (
    <div className="fondo-modal">
      <div className="modal-ods" role="dialog" aria-modal="true" aria-label={o ? `Editar orden de servicio ${o.codigo}` : 'Nueva orden de servicio'}>
        <div className="cab-ods">
          <h2>{o ? `Orden de servicio ${o.codigo}` : 'Nueva orden de servicio'}</h2>
          {o && <label htmlFor="o-cot" className="cot">¿Deseas enlazar una cotización previa?<select id="o-cot" disabled><option>Las cotizaciones llegan con el slice comercial</option></select></label>}
          {o && sel('o-estado', 'Estado', cab.estado, ESTADOS.map((e) => [e.id, e.nombre]), (x) => setCab({ ...cab, estado: x }), !p.puedeEditar)}
          {o && sel('o-decision', 'Decisión del cliente', cab.decision, p.cat.decisiones.map((d) => [d, d]), (x) => setCab({ ...cab, decision: x }), !p.puedeEditar)}
          <button type="button" onClick={() => p.alCerrar()}>Salir</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <section className={'comprobante' + (abiertoComprobante ? '' : ' cerrado')}>
          <h3><button type="button" className="plegar" aria-expanded={abiertoComprobante} onClick={() => setAbiertoComprobante((x) => !x)}><span aria-hidden="true">{abiertoComprobante ? '▾ ' : '▸ '}</span>Datos del comprobante</button></h3>
          {abiertoComprobante && (
            <div className="rejilla">
              {sel('o-cliente', 'Cliente', cab.clienteId, [['', 'Seleccionar…'], ...p.clientes.map((c) => [c.id, `${c.documento} ${c.nombre}`] as [string, string])], (x) => setCab({ ...cab, clienteId: x, vehiculoId: '' }), bloqueada)}
              {sel('o-vehiculo', 'Vehículo', cab.vehiculoId, [['', 'Seleccionar…'], ...vehiculosCliente.map((x) => [x.id, x.placa] as [string, string])], (x) => setCab({ ...cab, vehiculoId: x, clienteId: p.vehiculos.find((y) => y.id === x)?.cliente.id ?? cab.clienteId }), bloqueada)}
              {sel('o-tipo', 'Tipo de atención', cab.tipoAtencion, p.cat.tiposAtencion.map((t) => [t, t]), (x) => setCab({ ...cab, tipoAtencion: x }), bloqueada)}
              <label htmlFor="o-km">Kilometraje<input id="o-km" inputMode="numeric" value={cab.km} disabled={bloqueada} onChange={(e) => setCab({ ...cab, km: e.target.value })} /></label>
              {ro('Placa', v?.placa)}{ro('Marca', v?.marca)}{ro('Modelo', v?.modelo)}{ro('Año', v?.anio)}
              {sel('o-tecnico', 'Técnico', cab.tecnicoId, [['', 'No asignado'], ...p.cat.tecnicos.map((u) => [u.id, u.nombre] as [string, string])], (x) => setCab({ ...cab, tecnicoId: x }), bloqueada)}
              {sel('o-jefe', 'Jefe de taller (opcional)', cab.jefeTallerId, [['', 'No asignado'], ...p.cat.jefes.map((u) => [u.id, u.nombre] as [string, string])], (x) => setCab({ ...cab, jefeTallerId: x }), bloqueada)}
              {ro('Nro. serie', v?.nroSerie)}{ro('Nro. VIN', v?.nroVin)}{ro('Nro. motor', v?.nroMotor)}
              <label htmlFor="o-pct" className="desc">Descuento (%) a todos los ítems<span className="fila"><input id="o-pct" inputMode="decimal" value={pct} disabled={bloqueada} onChange={(e) => setPct(e.target.value)} /><button type="button" disabled={bloqueada} onClick={() => void aplicarDescuento()}>Aplicar</button></span></label>
              <label htmlFor="o-obs" className="mitad">Observaciones<textarea id="o-obs" rows={2} value={cab.observaciones} disabled={bloqueada} onChange={(e) => setCab({ ...cab, observaciones: e.target.value })} /></label>
              <label htmlFor="o-rec" className="mitad">Recomendaciones<textarea id="o-rec" rows={2} value={cab.recomendaciones} disabled={bloqueada} onChange={(e) => setCab({ ...cab, recomendaciones: e.target.value })} /></label>
            </div>
          )}
        </section>
        {(
          <>
            <div className="fila entre">
              <h3>Detalle</h3>
              <button type="button" onClick={() => setVistaCliente((x) => !x)}>{vistaCliente ? '👁 Ver costos (vista interna)' : '👁 Vista del cliente (ocultar costos)'}</button>
            </div>
            <div className="tabla items">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Tipo</th><th>Detalle</th>{!vistaCliente && <><th>Referencia</th><th>Costo</th><th>Rent. (%)</th></>}
                    <th>Precio unit.</th><th>Desc. (%)</th>{!vistaCliente && <th>Responsable</th>}<th>Cant./H-H</th><th>Total</th><th aria-label="Quitar" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((d, i) => (
                    <tr key={d.id ?? 'n' + i}>
                      <td>{i + 1}</td>
                      <td><select aria-label="Tipo" className="corto" value={d.tipo} disabled={bloqueada} onChange={(e) => cambiarItem(i, 'tipo', e.target.value)}><option value="servicio">Servicio</option><option value="producto">Producto</option></select></td>
                      <td><input aria-label="Detalle" className="largo" value={d.descripcion} disabled={bloqueada} onChange={(e) => cambiarItem(i, 'descripcion', e.target.value)} /></td>
                      {!vistaCliente && <>
                        <td><input aria-label="Referencia" className="medio" value={d.referencia ?? ''} disabled={bloqueada} onChange={(e) => cambiarItem(i, 'referencia', e.target.value)} /></td>
                        <td><input aria-label="Costo" className="num" key={'costo-' + String(d.costo ?? '')} defaultValue={d.costo ?? ''} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'costo', e.target.value)} /></td>
                        <td><input aria-label="Rentabilidad" className="num" key={'rentabilidadPct-' + String(d.rentabilidadPct ?? '')} defaultValue={d.rentabilidadPct ?? ''} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'rentabilidadPct', e.target.value)} /></td>
                      </>}
                      <td><input aria-label="Precio unitario" className="num" key={'precio-' + String(d.precio)} defaultValue={d.precio ?? ''} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'precio', e.target.value)} /></td>
                      <td><input aria-label="Descuento" className="num" key={'descuentoPct-' + String(d.descuentoPct)} defaultValue={d.descuentoPct ?? ''} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'descuentoPct', e.target.value)} /></td>
                      {!vistaCliente && <td><select aria-label="Responsable" className="resp" value={d.tecnicoId ?? ''} disabled={bloqueada} onChange={(e) => cambiarItem(i, 'tecnicoId', e.target.value)}>{responsables.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></td>}
                      <td><input aria-label="Cantidad" className="num" key={'cantidad-' + String(d.cantidad)} defaultValue={d.cantidad ?? ''} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'cantidad', e.target.value)} /></td>
                      <td><input aria-label="Total" className="num" key={'total-' + String(d.total)} defaultValue={d.total ?? ''} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'total', e.target.value)} /></td>
                      <td>{!bloqueada && <button type="button" className="quitar" aria-label="Quitar ítem" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>🗑</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!bloqueada && <button type="button" className="agregar" onClick={() => setItems((xs) => [...xs, itemVacio()])}>+ Agregar ítem</button>}
            <div className="pie-ods">
              <Ingreso orden={ob} bloqueada={bloqueada || !o} puedeEditar={p.puedeEditar} alCambiar={setO} alFallar={(x) => setError((x as Error).message)} abrirEstado={() => setVerEstado(true)} />
              <section className="abonos">
                <div className="total-ods"><span>TOTAL</span><b>{soles(total)}</b></div>
                <div className="fila entre">
                  <h3>Abonos / pagos</h3>
                  {p.puedeEditar && ob.estado !== 'Cerrada' && <button disabled={!o} type="button" className="borde-verde" onClick={() => setFormAbono((x) => !x)}>$ Registrar abono</button>}
                </div>
                {formAbono && o && <FormAbono orden={{ ...o, pendiente }} metodos={p.cat.metodosPago} alGuardar={async () => { setO(await api.orden(o.id)); setFormAbono(false); }} alFallar={(x) => setError((x as Error).message)} />}
                <table>
                  <thead><tr><th>Fecha</th><th>Método</th><th>Concepto</th><th className="der">Valor</th></tr></thead>
                  <tbody>
                    {ob.abonos.map((a) => <tr key={a.id}><td>{fecha(a.fecha)}</td><td>{a.metodo}</td><td>{a.concepto}</td><td className="der">{soles(a.valor)}</td></tr>)}
                    {ob.abonos.length === 0 && <tr><td colSpan={4} className="suave der">No hay abonos registrados.</td></tr>}
                  </tbody>
                </table>
                <div className="suma"><b>Total abonos</b><b>{soles(ob.totalAbonos)}</b></div>
                <div className="suma"><span>Pendiente por pagar</span><span>{soles(pendiente)}</span></div>
              </section>
            </div>
            <div className="fila fin">
              <button type="button" onClick={() => p.alCerrar()}>Salir</button>
              {p.puedeEditar && <button type="button" className="primario chico" onClick={() => void guardar()}>{o ? 'Guardar cambios' : 'Crear orden'}</button>}
            </div>
            {verEstado && o && <EstadoVehiculoModal orden={o} bloqueada={bloqueada} alCerrar={(n) => { if (n) setO(n); setVerEstado(false); }} />}
          </>
        )}
      </div>
    </div>
  );
}

/** Evidencias de ingreso (fotos y videos, cargados o tomados con la cámara) y acceso al estado del vehículo (RF-015). */
function Ingreso({ orden, bloqueada, puedeEditar, alCambiar, alFallar, abrirEstado }: { orden: Orden; bloqueada: boolean; puedeEditar: boolean; alCambiar: (o: Orden) => void; alFallar: (e: unknown) => void; abrirEstado: () => void }) {
  const archivos = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const [vistas, setVistas] = useState<Record<string, string>>({});
  const [subiendo, setSubiendo] = useState(false);
  const evidencias = orden.evidencias ?? [];
  useEffect(() => {
    let vivo = true;
    for (const e of evidencias) if (!vistas[e.id]) api.verEvidencia(orden.id, e.id).then((u) => { if (vivo) setVistas((x) => ({ ...x, [e.id]: u })); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [orden.id, evidencias.map((e) => e.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  async function subir(lista: FileList | null) {
    if (!lista?.length) return;
    setSubiendo(true);
    try { let n = orden; for (const f of Array.from(lista)) n = await api.subirEvidencia(orden.id, f); alCambiar(n); } catch (x) { alFallar(x); } finally { setSubiendo(false); }
  }
  const llenos = Object.values(orden.estadoVehiculo ?? {}).filter((x) => (Array.isArray(x) ? x.length > 0 : !!x && x !== 'Sin registrar')).length;
  return (
    <section className="ingreso">
      <div className="fila entre">
        <h3>Evidencias de ingreso</h3>
        <button type="button" disabled={!orden.id} onClick={abrirEstado}>🚗 Estado del vehículo{llenos ? ` (${llenos})` : ''}</button>
      </div>
      {puedeEditar && !bloqueada && (
        <div className="fila">
          <button type="button" disabled={subiendo} onClick={() => archivos.current?.click()}>📁 Cargar fotos o video</button>
          <button type="button" disabled={subiendo} onClick={() => camara.current?.click()}>📷 Tomar foto</button>
          {subiendo && <span className="suave">Subiendo…</span>}
          <input ref={archivos} type="file" accept="image/*,video/*" multiple hidden aria-label="Cargar evidencias" onChange={(e) => { void subir(e.target.files); e.target.value = ''; }} />
          <input ref={camara} type="file" accept="image/*" capture="environment" hidden aria-label="Tomar foto con la cámara" onChange={(e) => { void subir(e.target.files); e.target.value = ''; }} />
        </div>
      )}
      <div className="galeria">
        {evidencias.map((e) => (
          <figure key={e.id}>
            {vistas[e.id] ? (e.tipo.startsWith('video/') ? <video src={vistas[e.id]} controls /> : <a href={vistas[e.id]} target="_blank" rel="noreferrer"><img src={vistas[e.id]} alt={e.nombre} /></a>) : <span className="suave">…</span>}
            <figcaption title={e.nombre}>{e.nombre}</figcaption>
            {puedeEditar && !bloqueada && <button type="button" className="quitar" aria-label={`Quitar ${e.nombre}`} onClick={async () => { if (!window.confirm(`¿Quitar ${e.nombre}?`)) return; try { alCambiar(await api.quitarEvidencia(orden.id, e.id)); } catch (x) { alFallar(x); } }}>✕</button>}
          </figure>
        ))}
        {evidencias.length === 0 && <p className="suave">Sin fotos ni videos todavía.</p>}
      </div>
    </section>
  );
}

const COMBUSTIBLE = ['Sin registrar', 'Reserva', '1/4', '1/2', '3/4', 'Lleno'];
const FLUIDOS = ['Aceite de motor', 'Líquido de frenos', 'Líquido de embrague', 'Refrigerante', 'Aceite hidráulico', 'Limpia parabrisas'];
const INVENTARIO = ['Llanta de repuesto', 'Kit de carretera', 'Herramientas', 'Botiquín', 'Extintor'];
const DANOS = ['Rayado', 'Fogueado', 'Sumido', 'Picado', 'Golpeado', 'No presenta daños'];

/** Lista de chequeo del vehículo al ingresar: ventana compacta, casi cuadrada. */
function EstadoVehiculoModal({ orden, bloqueada, alCerrar }: { orden: Orden; bloqueada: boolean; alCerrar: (o?: Orden) => void }) {
  const [e, setE] = useState<EstadoVehiculo>(() => ({ combustible: 'Sin registrar', ...(orden.estadoVehiculo ?? {}) }));
  const [error, setError] = useState('');
  const texto = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '');
  const lista = (k: string) => (Array.isArray(e[k]) ? (e[k] as string[]) : []);
  const marcar = (k: string, x: string) => setE({ ...e, [k]: lista(k).includes(x) ? lista(k).filter((y) => y !== x) : [...lista(k), x] });
  const campo = (k: string, etiqueta: string, ph = '') => <label>{etiqueta}<input aria-label={etiqueta} value={texto(k)} placeholder={ph} disabled={bloqueada} onChange={(x) => setE({ ...e, [k]: x.target.value })} /></label>;
  const checks = (k: string, titulo: string, opciones: string[]) => (
    <fieldset><legend>{titulo}</legend>{opciones.map((x) => <label key={x} className="chk"><input type="checkbox" checked={lista(k).includes(x)} disabled={bloqueada} onChange={() => marcar(k, x)} />{x}</label>)}</fieldset>
  );
  return (
    <div className="fondo-modal sobre">
      <div className="modal-estado" role="dialog" aria-modal="true" aria-label="Estado del vehículo">
        <div className="fila entre"><h3>Estado del vehículo · ODS {orden.codigo}</h3><button type="button" aria-label="Cerrar" onClick={() => alCerrar()}>✕</button></div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="rejilla-estado">
          {campo('objetosValor', 'Objetos de valor', 'Especifique objetos')}
          <label>Nivel de combustible<select aria-label="Nivel de combustible" value={texto('combustible')} disabled={bloqueada} onChange={(x) => setE({ ...e, combustible: x.target.value })}>{COMBUSTIBLE.map((c) => <option key={c}>{c}</option>)}</select></label>
          {checks('fluidos', 'Fluidos a nivel', FLUIDOS)}
          {checks('inventario', 'Inventario', INVENTARIO)}
          {campo('otrosFluidos', 'Otros fluidos')}
          {campo('otrosInventario', 'Otros (inventario)')}
          {checks('danos', 'Daños', DANOS)}
          <div className="col">{campo('documentos', 'Documentos', 'Documentos del vehículo')}{campo('otrosDanos', 'Otros daños')}</div>
          <label className="doble">Comentarios<textarea aria-label="Comentarios" rows={2} value={texto('comentarios')} disabled={bloqueada} onChange={(x) => setE({ ...e, comentarios: x.target.value })} /></label>
        </div>
        <div className="fila fin">
          <button type="button" onClick={() => alCerrar()}>Cancelar</button>
          {!bloqueada && <button type="button" className="primario chico" onClick={async () => { try { alCerrar(await api.editarOrden(orden.id, { estadoVehiculo: e })); } catch (x) { setError((x as Error).message); } }}>Guardar</button>}
        </div>
      </div>
    </div>
  );
}
