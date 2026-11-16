import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertaSolape, api, CatalogoOds, CatalogosOds, Cliente, DetalleOds, Grupo, Marca, Orden, Pais, Vehiculo } from '../comun/api';
import { FormCliente } from '../cliente/Clientes';
import { FormVehiculo } from '../vehiculo/Vehiculos';
import EstadoVehiculoModal from './EstadoVehiculo';
import FormAbono from './FormAbono';
import Ingreso from './Ingreso';
import { baseLinea, conSolape, ESTADOS, fecha, itemVacio, leerNumero, pctManual, r2, r3, r6, soles, totalLinea, totalSinSolape } from './ordenServicio.util';

/** Crear o editar la ODS en una sola pantalla: datos del comprobante, ítems, TOTAL y abonos. */
export default function EditorOrden(p: { orden: Orden | null; cat: CatalogosOds; clientes: Cliente[]; vehiculos: Vehiculo[]; puedeEditar: boolean; usuarioId?: string; alCerrar: (m?: string) => void }) {
  const [o, setO] = useState<Orden | null>(p.orden);
  const [cab, setCab] = useState(() => ({
    clienteId: p.orden?.cliente.id ?? '', vehiculoId: p.orden?.vehiculo.id ?? '', tipoAtencion: p.orden?.tipoAtencion ?? p.cat.tiposAtencion[0], km: p.orden?.km != null ? String(p.orden.km) : '',
    tecnicoId: p.orden?.tecnico?.id ?? '', jefeTallerId: p.orden?.jefeTaller?.id ?? '', estado: p.orden?.estado ?? 'Recepcion', decision: p.orden?.decision ?? p.cat.decisiones[0],
    tipoAtencionDetalle: p.orden?.tipoAtencionDetalle ?? '', observaciones: p.orden?.observaciones ?? '', recomendaciones: p.orden?.recomendaciones ?? '',
  }));
  const [editarOtro, setEditarOtro] = useState(false);
  // Responsable por defecto: en servicios, el técnico de la ODS; en productos, la cajera que la registra (o la primera cajera).
  const cajeraDefecto = p.cat.cajeras?.find((c) => c.id === p.usuarioId)?.id ?? p.cat.cajeras?.[0]?.id ?? null;
  const nuevoItem = (tipo: DetalleOds['tipo'], tecnico = cab.tecnicoId): DetalleOds => ({ ...itemVacio(), tipo, tecnicoId: tipo === 'producto' ? cajeraDefecto : tecnico || null });
  const [items, setItems] = useState<DetalleOds[]>(p.orden?.detalles ?? [nuevoItem('servicio')]);
  const [fotos, setFotos] = useState<File[]>([]);
  const [vistaCliente, setVistaCliente] = useState(false);
  const [pct, setPct] = useState('');
  const [error, setError] = useState('');
  // S5: catálogo de servicios y productos, alertas de solapamiento y las opcionales que se decidió no aplicar.
  const [catalogo, setCatalogo] = useState<CatalogoOds>({ servicios: [], productos: [] });
  const [alertas, setAlertas] = useState<AlertaSolape[]>([]);
  const [mantenidos, setMantenidos] = useState<string[]>(p.orden?.solapamientosMantenidos ?? []);
  const cargarCatalogo = () => api.catalogoOds(cab.vehiculoId || undefined).then((c) => setCatalogo({ servicios: Array.isArray(c?.servicios) ? c.servicios : [], productos: Array.isArray(c?.productos) ? c.productos : [] })).catch(() => undefined);
  // Se recarga al cambiar de vehículo: el precio y las horas de cada servicio ya vienen resueltos para el grupo de ese vehículo (RF-100/RN-09).
  useEffect(() => { void cargarCatalogo(); }, [cab.vehiculoId]);
  // Crear cliente, vehículo o ítem del catálogo sin salir de la orden: lo creado se agrega a las listas y queda elegido.
  const [paises, setPaises] = useState<Pais[]>([]);
  const [paisBase, setPaisBase] = useState('PE');
  const [marcasVehiculo, setMarcasVehiculo] = useState<Marca[]>([]);
  const [gruposVehiculo, setGruposVehiculo] = useState<Grupo[]>([]);
  const [clientesExtra, setClientesExtra] = useState<Cliente[]>([]);
  const [vehiculosExtra, setVehiculosExtra] = useState<Vehiculo[]>([]);
  const [crearCliente, setCrearCliente] = useState(false);
  const [crearVehiculo, setCrearVehiculo] = useState(false);
  const [crearItemPara, setCrearItemPara] = useState<number | null>(null);
  const [errorModal, setErrorModal] = useState('');
  useEffect(() => {
    api.config().then((c) => { setPaises(c.paises); setPaisBase(c.paisPredeterminado); }).catch(() => undefined);
    api.marcasVehiculo().then(setMarcasVehiculo).catch(() => undefined);
    api.grupos().then(setGruposVehiculo).catch(() => undefined);
  }, []);
  const clientesTodos = useMemo(() => [...p.clientes, ...clientesExtra.filter((c) => !p.clientes.some((x) => x.id === c.id))], [p.clientes, clientesExtra]);
  const vehiculosTodos = useMemo(() => [...p.vehiculos, ...vehiculosExtra.filter((v) => !p.vehiculos.some((x) => x.id === v.id))], [p.vehiculos, vehiculosExtra]);
  const bloqueada = !p.puedeEditar || o?.estado === 'Cerrada';
  const vehiculosCliente = useMemo(() => vehiculosTodos.filter((v) => !cab.clienteId || v.cliente.id === cab.clienteId), [vehiculosTodos, cab.clienteId]);
  const v = vehiculosTodos.find((x) => x.id === cab.vehiculoId) ?? (o ? { ...o.vehiculo } : null);
  const total = r2(items.reduce((a, d) => a + totalLinea(d), 0));
  const horasTotal = r2(items.reduce((a, d) => a + (d.tipo === 'servicio' ? d.horas ?? 0 : 0), 0));
  const etiquetaCat = (x: { codigo: string; nombre: string }) => `${x.codigo} · ${x.nombre}`;
  // Sin tildes ni mayúsculas, para que la búsqueda encuentre «refrigeracion» al escribir «refrigeración».
  const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const [buscando, setBuscando] = useState<number | null>(null);
  const [posBuscador, setPosBuscador] = useState<{ top: number; left: number; width: number } | null>(null);

  function elegirServicio(i: number, sv: CatalogoOds['servicios'][number]) {
    // El precio y las horas ya vienen resueltos para el grupo del vehículo desde el catálogo (sin otra llamada,
    // para que coincidan exactamente con lo que la cajera vio en la sugerencia).
    setError('');
    const traza = [sv.grupo ? `Precio de ${sv.grupo} ${sv.codigo}: ${sv.horas} h, S/ ${sv.precio}` : `Estándar ${sv.codigo}: ${sv.horas} h, S/ ${sv.precio}`];
    // RF-009: la Referencia toma el código del servicio al elegirlo.
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, tipo: 'servicio', descripcion: sv.nombre, referencia: sv.codigo, servicioId: sv.id, productoId: null, precio: sv.precio, precioGrupo: sv.precio, horas: sv.horas, cantidad: sv.horas, trazaPrecio: traza, descuentoPct: 0, descuentoMonto: 0, solapamientoId: null, total: totalLinea({ ...x, precio: sv.precio, descuentoPct: 0 }) } : x)));
    setBuscando(null);
  }
  async function alCrearCliente(_m: string, creado?: Cliente) {
    if (creado) { setClientesExtra((xs) => [...xs, creado]); setCab((c) => ({ ...c, clienteId: creado.id, vehiculoId: '' })); }
    setCrearCliente(false);
  }
  async function alCrearVehiculo(_m: string, creado?: Vehiculo) {
    if (creado) { setVehiculosExtra((xs) => [...xs, creado]); setCab((c) => ({ ...c, vehiculoId: creado.id, clienteId: creado.cliente.id })); }
    setCrearVehiculo(false);
  }
  function elegirProducto(i: number, pr: CatalogoOds['productos'][number]) {
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, tipo: 'producto', descripcion: pr.nombre, referencia: pr.referencia ?? pr.codigo, productoId: pr.id, servicioId: null, precio: pr.precio, costo: pr.costo, precioGrupo: null, total: totalLinea({ ...x, precio: pr.precio }) } : x)));
    setBuscando(null);
  }
  // Al escribir el nombre exacto (o pegarlo) también se elige, sin necesitar el panel.
  async function elegirDelCatalogo(i: number, texto: string) {
    const d = items[i];
    const t = normalizar(texto);
    const sv = d.tipo === 'servicio' ? catalogo.servicios.find((x) => normalizar(x.nombre) === t || normalizar(etiquetaCat(x)) === t) : undefined;
    const pr = d.tipo === 'producto' ? catalogo.productos.find((x) => normalizar(x.nombre) === t || normalizar(etiquetaCat(x)) === t) : undefined;
    if (sv) await elegirServicio(i, sv);
    else if (pr) elegirProducto(i, pr);
    else if (d.servicioId || d.productoId) setItems((xs) => xs.map((x, j) => (j === i ? conSolape({ ...x, servicioId: null, productoId: null, precioGrupo: null, horas: null }, 0, null) : x)));
  }
  function sugerencias(i: number) {
    const d = items[i];
    const t = normalizar(d.descripcion);
    const de = (x: { codigo: string; nombre: string }) => normalizar(x.codigo).includes(t) || normalizar(x.nombre).includes(t);
    return d.tipo === 'servicio' ? catalogo.servicios.filter(de).slice(0, 12) : catalogo.productos.filter(de).slice(0, 12);
  }

  // Solapamiento (RF-102): con el vehículo y dos servicios que comparten trabajo, se piden las alertas al servidor.
  const claveSolape = cab.vehiculoId + '|' + items.map((d) => `${d.servicioId ?? ''}:${totalSinSolape(d)}`).join(',');
  useEffect(() => {
    const conServicio = items.filter((d) => d.servicioId).length;
    if (!cab.vehiculoId || conServicio < 2) { setAlertas([]); return; }
    let vigente = true;
    api.evaluarSolapes(cab.vehiculoId, items.map((d) => ({ servicioId: d.servicioId ?? null, total: totalSinSolape(d) }))).then((a) => { if (vigente) setAlertas(Array.isArray(a) ? a : []); }).catch(() => setAlertas([]));
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveSolape]);
  // El automático se aplica solo; el opcional, si la cajera lo aceptó. Una línea sin alerta pierde su descuento.
  // El descuento por solapamiento se suma al Desc. (%) de la línea para que el total salga exacto.
  useEffect(() => {
    setItems((xs) => {
      let cambio = false;
      const n = xs.map((d, i) => {
        const a = alertas.find((x) => x.indiceReducido === i);
        const aplica = a && (a.modo === 'AUTOMATICO' || d.solapamientoId === a.solapamientoId);
        const monto = aplica ? a!.monto : 0;
        const regla = aplica ? a!.solapamientoId : null;
        if ((d.descuentoMonto ?? 0) === monto && (d.solapamientoId ?? null) === regla) return d;
        cambio = true;
        return conSolape(d, monto, regla);
      });
      return cambio ? n : xs;
    });
    // «Mantener montos» vale mientras estén los mismos servicios: si se quita uno, la alerta vuelve con sus botones.
    setMantenidos((m) => { const vivas = new Set(alertas.map((a) => a.clave)); const f = m.filter((x) => vivas.has(x)); return f.length === m.length ? m : f; });
  }, [alertas]);
  const aplicarSolape = (a: AlertaSolape) => {
    setMantenidos((m) => m.filter((x) => x !== a.clave));
    setItems((xs) => xs.map((d, i) => (i === a.indiceReducido ? conSolape(d, a.monto, a.solapamientoId) : d)));
  };
  const mantenerSolape = (a: AlertaSolape) => {
    setMantenidos((m) => [...new Set([...m, a.clave])]);
    setItems((xs) => xs.map((d, i) => (i === a.indiceReducido ? conSolape(d, 0, null) : d)));
  };
  const cambiarItem = (i: number, campo: keyof DetalleOds, valor: string) => setItems((xs) => xs.map((d, j) => {
    if (j !== i) return d;
    const n = { ...d } as DetalleOds;
    const leido = leerNumero(valor);
    if (!['tipo', 'impuesto', 'descripcion', 'referencia', 'tecnicoId'].includes(campo) && valor !== '' && leido === null) return d; // se ignora lo que no es número
    const num = r3(leido ?? 0);
    const manualAntes = pctManual(d);
    if (campo === 'tipo') { n.tipo = valor as DetalleOds['tipo']; if (n.tipo !== d.tipo) n.tecnicoId = nuevoItem(n.tipo).tecnicoId; }
    else if (campo === 'impuesto') n.impuesto = valor as DetalleOds['impuesto'];
    else if (campo === 'descripcion' || campo === 'referencia') (n[campo] as string) = valor;
    else if (campo === 'tecnicoId') n.tecnicoId = valor || null;
    else if (campo === 'rentabilidadPct') { n.rentabilidadPct = valor === '' ? null : num; if (n.costo != null && n.rentabilidadPct != null) n.precio = r3(n.costo * (1 + n.rentabilidadPct / 100)); }
    else if (campo === 'costo') { n.costo = valor === '' ? null : num; if (n.costo && n.rentabilidadPct != null) n.precio = r3(n.costo * (1 + n.rentabilidadPct / 100)); }
    else if (campo === 'precio') { n.precio = num; if (n.costo) n.rentabilidadPct = r3((n.precio / n.costo - 1) * 100); }
    else if (campo === 'total') { const base = baseLinea(n); if (base > 0) n.descuentoPct = r6(Math.min(100, Math.max(0, (1 - num / base) * 100))); }
    else if (campo === 'cantidad' || campo === 'descuentoPct') n[campo] = num;
    n.total = totalLinea(n);
    // Si cambió el precio o la cantidad de una línea con solapamiento, se conserva el monto en soles del solapamiento.
    if ((campo === 'precio' || campo === 'cantidad' || campo === 'rentabilidadPct' || campo === 'costo') && (n.descuentoMonto ?? 0) > 0) return conSolape({ ...n, descuentoPct: manualAntes, descuentoMonto: 0 }, d.descuentoMonto ?? 0, d.solapamientoId ?? null);
    return n;
  }));

  async function crear() {
    if (!cab.vehiculoId) return setError('Elige el vehículo.');
    try {
      // La «decisión del cliente» se quita de la pantalla (va a cambiar a aprobación por ítem): al cerrar sin nota de venta se marca sola.
      const n = await api.crearOrden({ vehiculoId: cab.vehiculoId, tipoAtencion: cab.tipoAtencion, tipoAtencionDetalle: cab.tipoAtencion === 'Otro' ? cab.tipoAtencionDetalle : null, km: cab.km || null, tecnicoId: cab.tecnicoId || null, jefeTallerId: cab.jefeTallerId || null, observaciones: cab.observaciones, recomendaciones: cab.recomendaciones, estado: cab.estado, decision: cab.estado === 'Cerrada' ? 'No aprobada' : cab.decision });
      const llenos = items.filter((d) => d.descripcion.trim());
      const r = llenos.length ? await api.guardarDetalles(n.id, llenos, mantenidos) : n;
      for (const f of fotos) await api.subirEvidencia(n.id, f);
      p.alCerrar(`ODS ${r.codigo} creada.`);
    } catch (x) { setError((x as Error).message); }
  }
  async function guardar() {
    if (!o) return crear();
    try {
      const cambios: Record<string, unknown> = { vehiculoId: cab.vehiculoId, tipoAtencion: cab.tipoAtencion, tipoAtencionDetalle: cab.tipoAtencion === 'Otro' ? cab.tipoAtencionDetalle : null, km: cab.km || null, tecnicoId: cab.tecnicoId || null, jefeTallerId: cab.jefeTallerId || null, decision: cab.estado === 'Cerrada' ? 'No aprobada' : cab.decision, observaciones: cab.observaciones, recomendaciones: cab.recomendaciones };
      if (cab.estado !== o.estado) {
        if (o.estado === 'Cerrada' && !window.confirm('La ODS sale de «Cerrado»: se borrará su fecha de cierre. ¿Continuar?')) return;
        cambios.estado = cab.estado;
      }
      let r = o;
      if (o.estado !== 'Cerrada') r = await api.guardarDetalles(o.id, items, mantenidos);
      r = await api.editarOrden(o.id, cambios);
      p.alCerrar(`ODS ${r.codigo} guardada.`);
    } catch (x) { setError((x as Error).message); }
  }
  async function aplicarDescuento() {
    const n = leerNumero(pct) ?? NaN;
    if (!Number.isFinite(n) || n < 0 || n > 100) return setError('El descuento debe estar entre 0 y 100 %.');
    setItems((xs) => xs.map((d) => conSolape({ ...d, descuentoPct: n, descuentoMonto: 0 }, d.descuentoMonto ?? 0, d.solapamientoId ?? null)));
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
  // El responsable de un servicio es un técnico o el jefe de taller; el de un producto, una cajera o un logístico.
  const responsables = (tipo: DetalleOds['tipo']): [string, string][] => [['', '—'], ...(tipo === 'producto' ? [...(p.cat.cajeras ?? []), ...(p.cat.logisticos ?? [])] : p.cat.tecnicos).filter((u, i, xs) => xs.findIndex((y) => y.id === u.id) === i).map((u) => [u.id, u.nombre] as [string, string])];

  return (
    <div className="fondo-modal">
      <div className="modal-ods" role="dialog" aria-modal="true" aria-label={o ? `Editar orden de servicio ${o.codigo}` : 'Nueva orden de servicio'}>
        <div className="cab-ods">
          <h2>{o ? `Orden de servicio ${o.codigo}` : 'Nueva orden de servicio'}</h2>
          <label htmlFor="o-cot" className="cot">¿Deseas enlazar una cotización previa?<select id="o-cot" disabled><option>Ninguna</option></select></label>
          {sel('o-estado', 'Estado', cab.estado, ESTADOS.map((e) => [e.id, e.nombre]), (x) => setCab({ ...cab, estado: x }), !p.puedeEditar)}
          {cab.estado === 'Cerrada' && <span className="suave nota-cierre">Sin nota de venta</span>}
          <button type="button" onClick={() => p.alCerrar()}>Salir</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <section className={'comprobante' + (abiertoComprobante ? '' : ' cerrado')}>
          <h3><button type="button" className="plegar" aria-expanded={abiertoComprobante} onClick={() => setAbiertoComprobante((x) => !x)}><span aria-hidden="true">{abiertoComprobante ? '▾ ' : '▸ '}</span>Datos del comprobante</button></h3>
          {abiertoComprobante && (
            <div className="rejilla filas3">
              <div className="fila-cab">
                <span className="con-boton">{sel('o-cliente', 'Cliente', cab.clienteId, [['', 'Seleccionar…'], ...clientesTodos.map((c) => [c.id, `${c.documento} ${c.nombre}`] as [string, string])], (x) => setCab({ ...cab, clienteId: x, vehiculoId: '' }), bloqueada)}{!bloqueada && <button type="button" className="mas" title="Crear cliente" aria-label="Crear cliente" onClick={() => setCrearCliente(true)}>+</button>}</span>
                <span className="con-boton">{sel('o-vehiculo', 'Vehículo', cab.vehiculoId, [['', 'Seleccionar…'], ...vehiculosCliente.map((x) => [x.id, x.placa] as [string, string])], (x) => setCab({ ...cab, vehiculoId: x, clienteId: vehiculosTodos.find((y) => y.id === x)?.cliente.id ?? cab.clienteId }), bloqueada)}{!bloqueada && <button type="button" className="mas" title="Crear vehículo" aria-label="Crear vehículo" onClick={() => setCrearVehiculo(true)}>+</button>}</span>
                <span className="campo-angosto">{sel('o-tecnico', 'Técnico', cab.tecnicoId, [['', 'No asignado'], ...p.cat.tecnicos.map((u) => [u.id, u.nombre] as [string, string])], (x) => { setCab({ ...cab, tecnicoId: x }); setItems((xs) => xs.map((d) => (d.tipo === 'servicio' && !d.tecnicoId ? { ...d, tecnicoId: x || null } : d))); }, bloqueada)}</span>
                <label htmlFor="o-tipo" className="campo-tipo">Tipo de atención
                  {cab.tipoAtencion !== 'Otro' || !editarOtro ? (
                    <select id="o-tipo" value={cab.tipoAtencion} disabled={bloqueada} onChange={(e) => { if (e.target.value === 'Otro') { setEditarOtro(true); setCab({ ...cab, tipoAtencion: 'Otro' }); } else { setEditarOtro(false); setCab({ ...cab, tipoAtencion: e.target.value, tipoAtencionDetalle: '' }); } }}>
                      {p.cat.tiposAtencion.filter((t) => t !== 'Otro').map((t) => <option key={t} value={t}>{t}</option>)}
                      <option value="Otro">{cab.tipoAtencion === 'Otro' && cab.tipoAtencionDetalle ? cab.tipoAtencionDetalle : 'Otro…'}</option>
                    </select>
                  ) : (
                    <input aria-label="Escribe el tipo de atención" placeholder="Escribe aquí el tipo de atención" autoFocus value={cab.tipoAtencionDetalle} disabled={bloqueada} maxLength={120} onChange={(e) => setCab({ ...cab, tipoAtencionDetalle: e.target.value })} onBlur={() => setEditarOtro(false)} onKeyDown={(e) => e.key === 'Enter' && setEditarOtro(false)} />
                  )}
                </label>
                <label htmlFor="o-km" className="campo-angosto">Kilometraje<input id="o-km" inputMode="numeric" value={cab.km} disabled={bloqueada} onChange={(e) => setCab({ ...cab, km: e.target.value })} /></label>
              </div>
              <div className="fila-cab">
                {ro('Placa', v?.placa)}{ro('Marca', v?.marca)}{ro('Modelo', v?.modelo)}{ro('Año', v?.anio)}
                {ro('Nro. serie', v?.nroSerie)}{ro('Nro. VIN', v?.nroVin)}{ro('Nro. motor', v?.nroMotor)}
              </div>
              <div className="fila-cab">
                <label htmlFor="o-obs" className="ancha">Observaciones<textarea id="o-obs" rows={2} value={cab.observaciones} disabled={bloqueada} onChange={(e) => setCab({ ...cab, observaciones: e.target.value })} /></label>
                <label htmlFor="o-rec" className="ancha">Recomendaciones<textarea id="o-rec" rows={2} value={cab.recomendaciones} disabled={bloqueada} onChange={(e) => setCab({ ...cab, recomendaciones: e.target.value })} /></label>
                <label htmlFor="o-pct" className="desc chica descuento-der">Desc. (%) a todos<span className="fila"><input id="o-pct" inputMode="decimal" value={pct} disabled={bloqueada} onChange={(e) => setPct(e.target.value)} /><button type="button" disabled={bloqueada} onClick={() => void aplicarDescuento()}>Aplicar</button></span></label>
              </div>
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
                      <td>
                        <input aria-label="Detalle" className="largo" autoComplete="off" value={d.descripcion} disabled={bloqueada}
                          onChange={(e) => { cambiarItem(i, 'descripcion', e.target.value); void elegirDelCatalogo(i, e.target.value); }}
                          onFocus={(e) => { setBuscando(i); const r = e.currentTarget.getBoundingClientRect(); setPosBuscador({ top: r.bottom, left: r.left, width: Math.max(r.width, 440) }); }}
                          onBlur={() => setTimeout(() => setBuscando((x) => (x === i ? null : x)), 180)} />
                      </td>
                      {!vistaCliente && <>
                        <td><input aria-label="Referencia" className="medio" value={d.referencia ?? ''} disabled={bloqueada} onChange={(e) => cambiarItem(i, 'referencia', e.target.value)} /></td>
                        <td><input aria-label="Costo" className="num" key={'costo-' + String(d.costo ?? '')} defaultValue={d.costo ?? ''} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'costo', e.target.value)} /></td>
                        <td><input aria-label="Rentabilidad" className="num" key={'rentabilidadPct-' + String(d.rentabilidadPct ?? '')} defaultValue={d.rentabilidadPct ?? ''} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'rentabilidadPct', e.target.value)} /></td>
                      </>}
                      <td><input aria-label="Precio unitario" className="num" key={'precio-' + String(d.precio)} defaultValue={d.precio ?? ''} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'precio', e.target.value)} />{d.precioGrupo != null && d.precioGrupo !== d.precio && <span className="precio-mod" title={(d.trazaPrecio ?? []).join('\n')}>Precio modificado (grupo {soles(d.precioGrupo)})</span>}</td>
                      <td><input aria-label="Descuento" className="num" key={'descuentoPct-' + String(d.descuentoPct)} defaultValue={d.descuentoPct ? Number(d.descuentoPct.toFixed(2)) : 0} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'descuentoPct', e.target.value)} /></td>
                      {!vistaCliente && <td><select aria-label="Responsable" className="resp" value={d.tecnicoId ?? ''} disabled={bloqueada} onChange={(e) => cambiarItem(i, 'tecnicoId', e.target.value)}>{responsables(d.tipo).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></td>}
                      <td><input aria-label="Cantidad" className="num" key={'cantidad-' + String(d.cantidad)} defaultValue={d.cantidad ?? ''} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'cantidad', e.target.value)} /></td>
                      <td><input aria-label="Total" className="num" key={'total-' + String(d.total)} defaultValue={d.total ?? ''} disabled={bloqueada} onBlur={(e) => cambiarItem(i, 'total', e.target.value)} /></td>
                      <td>{!bloqueada && <button type="button" className="quitar" aria-label="Quitar ítem" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>🗑</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {alertas.length > 0 && (
              <div className="aviso-solape" role="status" aria-label="Solapamiento de servicios">
                {alertas.map((a) => {
                  const aplicado = a.indiceReducido >= 0 && (items[a.indiceReducido]?.solapamientoId ?? null) === a.solapamientoId;
                  return (
                    <div key={a.clave} className="linea">
                      <span>{a.alerta}</span>
                      {a.modo === 'OPCIONAL' && a.indiceReducido >= 0 && !bloqueada && (
                        aplicado ? <button type="button" onClick={() => mantenerSolape(a)}>Quitar descuento</button>
                          : mantenidos.includes(a.clave) ? <span className="fila"><span className="pill">Montos mantenidos</span><button type="button" onClick={() => aplicarSolape(a)}>Aplicar {soles(a.monto)}</button></span>
                            : <span className="fila"><button type="button" onClick={() => aplicarSolape(a)}>Aplicar {soles(a.monto)}</button><button type="button" onClick={() => mantenerSolape(a)}>Mantener montos</button></span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {buscando != null && !bloqueada && posBuscador && (
              <div className="panel-buscador" role="listbox" aria-label="Sugerencias del catálogo" style={{ top: posBuscador.top, left: posBuscador.left, width: posBuscador.width }}>
                <div className="fila entre cab-sugerencias"><span className="suave">Sugerencias</span><button type="button" className="chico" onMouseDown={() => setCrearItemPara(buscando)}>+ Crear ítem de inventario</button></div>
                {sugerencias(buscando).length === 0 && <p className="suave sin-sugerencias">Sin coincidencias en el catálogo.</p>}
                {sugerencias(buscando).map((x) => 'horas' in x ? (
                  <button key={x.id} type="button" className="tarjeta-sugerencia" onMouseDown={() => void elegirServicio(buscando, x)}>
                    <span className="fila entre"><b>{x.nombre}</b><span className="pill">REF:{x.codigo}</span></span>
                    <span className="fila chips">
                      <span className="pill verde">$ {soles(x.precio)}</span>
                      <span className="pill">Horas: {x.horas} h</span>
                      <span className="pill violeta">{x.grupo ? `Grupo ${x.grupo}` : 'Precio estándar'}</span>
                      {x.categoria && <span className="pill">{x.categoria}</span>}
                    </span>
                  </button>
                ) : (
                  <button key={x.id} type="button" className="tarjeta-sugerencia" onMouseDown={() => elegirProducto(buscando, x)}>
                    <span className="fila entre"><b>{x.nombre}</b><span className="pill">REF:{x.codigo}</span></span>
                    <span className="fila chips"><span className="pill verde">$ {soles(x.precio)}</span><span className="pill azul">Stock: {x.stockTotal}</span>{x.marca && <span className="pill">Marca: {x.marca}</span>}</span>
                  </button>
                ))}
              </div>
            )}
            {!bloqueada && <button type="button" className="agregar" onClick={() => setItems((xs) => [...xs, nuevoItem('servicio')])}>+ Agregar ítem</button>}
            <div className="pie-ods">
              <Ingreso orden={ob} bloqueada={bloqueada} pendientes={fotos} alPendientes={setFotos} puedeEditar={p.puedeEditar} alCambiar={setO} alFallar={(x) => setError((x as Error).message)} abrirEstado={() => setVerEstado(true)} />
              <section className="abonos">
                <div className="total-ods"><span>TOTAL</span><b>{soles(total)}</b></div>
                {horasTotal > 0 && <div className="suma"><span>Horas de servicio</span><span>{horasTotal} h</span></div>}
                <div className="fila entre">
                  <h3>Abonos / pagos</h3>
                  {p.puedeEditar && ob.estado !== 'Cerrada' && <button disabled={!o} type="button" className="borde-verde" onClick={() => setFormAbono(true)}>$ Registrar abono</button>}
                </div>
                {formAbono && o && (
                  <div className="fondo-modal">
                    <div className="modal-form modal-pagos" role="dialog" aria-modal="true" aria-label="Pagos recibidos">
                      <div className="fila entre"><h3>Pagos recibidos</h3><button type="button" className="cerrar" aria-label="Cerrar" onClick={() => setFormAbono(false)}>×</button></div>
                      <FormAbono orden={{ ...o, pendiente }} metodos={p.cat.metodosPago} alGuardar={async () => { setO(await api.orden(o.id)); setFormAbono(false); }} alFallar={(x) => setError((x as Error).message)} alCancelar={() => setFormAbono(false)} />
                    </div>
                  </div>
                )}
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
            {crearCliente && (
              <FormCliente cliente={null} paises={paises} paisBase={paisBase} error={errorModal}
                alCancelar={() => { setCrearCliente(false); setErrorModal(''); }} alGuardar={alCrearCliente} alFallar={setErrorModal} />
            )}
            {crearVehiculo && (
              <FormVehiculo vehiculo={null} marcas={marcasVehiculo} grupos={gruposVehiculo} error={errorModal}
                alCancelar={() => { setCrearVehiculo(false); setErrorModal(''); }} alGuardar={alCrearVehiculo} alFallar={setErrorModal} alCrearMarca={(m) => setMarcasVehiculo((x) => [...x, m])} />
            )}
            {crearItemPara != null && (
              <div className="fondo-modal sobre">
                <CrearItemCatalogo tipoInicial={items[crearItemPara]?.tipo ?? 'servicio'} nombreInicial={items[crearItemPara]?.descripcion ?? ''} error={errorModal}
                  alCancelar={() => { setCrearItemPara(null); setErrorModal(''); }}
                  alCrear={async (id, tipo) => {
                    await cargarCatalogo();
                    const c = await api.catalogoOds();
                    const fila = tipo === 'servicio' ? c.servicios.find((x) => x.id === id) : c.productos.find((x) => x.id === id);
                    if (fila) { if (tipo === 'servicio') await elegirServicio(crearItemPara, fila as CatalogoOds['servicios'][number]); else elegirProducto(crearItemPara, fila as CatalogoOds['productos'][number]); }
                    setCrearItemPara(null);
                  }}
                  alFallar={setErrorModal} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Crear rápido un servicio o un producto desde la ODS, sin ir a Maestros ni a Inventario. Campos mínimos; el resto se completa luego en su pantalla. */
function CrearItemCatalogo(p: { tipoInicial: 'servicio' | 'producto'; nombreInicial: string; error?: string; alCancelar: () => void; alCrear: (id: string, tipo: 'servicio' | 'producto') => Promise<void>; alFallar: (m: string) => void }) {
  const [tipo, setTipo] = useState<'servicio' | 'producto'>(p.tipoInicial);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState(p.nombreInicial);
  const [categoria, setCategoria] = useState('GENERAL');
  const [unidad, setUnidad] = useState('UND');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      if (tipo === 'servicio') {
        const s = await api.crearServicio({ codigo, nombre, categoria, precioEstandar: precio });
        await p.alCrear(s.id, 'servicio');
      } else {
        const pr = await api.crearProducto({ codigo, nombre, unidad, precio, costo: costo || undefined });
        await p.alCrear(pr.id, 'producto');
      }
    } catch (x) { p.alFallar((x as Error).message); }
  }

  return (
    <form className="modal-form" role="dialog" aria-modal="true" aria-label="Crear ítem de inventario" onSubmit={enviar}>
      <h2>Crear ítem de inventario</h2>
      {p.error && <p className="error" role="alert">{p.error}</p>}
      <div className="dos-col">
        <div className="campo"><label htmlFor="ci-tipo">Tipo</label>
          <select id="ci-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as 'servicio' | 'producto')}>
            <option value="servicio">Servicio</option><option value="producto">Producto</option>
          </select></div>
        <div className="campo"><label htmlFor="ci-codigo">Código</label><input id="ci-codigo" value={codigo} required onChange={(e) => setCodigo(e.target.value)} /></div>
        <div className="campo ancha"><label htmlFor="ci-nombre">Nombre</label><input id="ci-nombre" value={nombre} required onChange={(e) => setNombre(e.target.value)} /></div>
        {tipo === 'servicio'
          ? <div className="campo"><label htmlFor="ci-categoria">Categoría</label><input id="ci-categoria" value={categoria} required onChange={(e) => setCategoria(e.target.value)} /></div>
          : <div className="campo"><label htmlFor="ci-unidad">Unidad</label><input id="ci-unidad" value={unidad} required onChange={(e) => setUnidad(e.target.value)} /></div>}
        <div className="campo"><label htmlFor="ci-precio">Precio (S/)</label><input id="ci-precio" inputMode="decimal" value={precio} required onChange={(e) => setPrecio(e.target.value)} /></div>
        {tipo === 'producto' && <div className="campo"><label htmlFor="ci-costo">Costo (S/)</label><input id="ci-costo" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} /></div>}
      </div>
      <p className="sub">El resto de los datos (horas, repuestos, stock, proveedor…) se completan luego en Maestros o Inventario.</p>
      <div className="fila fin">
        <button type="button" onClick={p.alCancelar}>Cancelar</button>
        <button type="submit" className="primario chico">Crear</button>
      </div>
    </form>
  );
}
