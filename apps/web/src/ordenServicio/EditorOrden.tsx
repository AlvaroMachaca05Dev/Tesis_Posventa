import { useMemo, useState } from 'react';
import { api, CatalogosOds, Cliente, DetalleOds, Orden, Vehiculo } from '../comun/api';
import EstadoVehiculoModal from './EstadoVehiculo';
import FormAbono from './FormAbono';
import Ingreso from './Ingreso';
import { ESTADOS, fecha, itemVacio, leerNumero, r2, r3, soles, totalLinea } from './ordenServicio.util';

/** Crear o editar la ODS en una sola pantalla: datos del comprobante, ítems, TOTAL y abonos. */
export default function EditorOrden(p: { orden: Orden | null; cat: CatalogosOds; clientes: Cliente[]; vehiculos: Vehiculo[]; puedeEditar: boolean; alCerrar: (m?: string) => void }) {
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
