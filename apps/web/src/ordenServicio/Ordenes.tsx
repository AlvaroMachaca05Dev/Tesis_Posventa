import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, CatalogosOds, Cliente, Orden, Vehiculo } from '../comun/api';
import EditorOrden from './EditorOrden';
import FormAbono from './FormAbono';
import FormFechas from './FormFechas';
import VistaPreviaPdf from './VistaPreviaPdf';
import FormSolicitud from './FormSolicitud';
import { FormatoPdf, generarPdf, TITULO_VISTA } from './pdfOrden';
import { Paginacion, usePaginacion } from '../comun/Paginacion';
import { ESTADOS, fecha, hace, Nivel, soles } from './ordenServicio.util';

export default function Ordenes({ nivel, superadmin = false, puedeAutorizar = false, usuarioId }: { nivel: Nivel; superadmin?: boolean; puedeAutorizar?: boolean; usuarioId?: string }) {
  const puedeEditar = nivel === 'A' || nivel === 'E';
  const [estado, setEstado] = useState('Recepcion');
  const [f, setF] = useState({ q: '', desde: '', hasta: '', clienteId: '', vehiculoId: '', n: '10' });
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [cat, setCat] = useState<CatalogosOds | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [abierta, setAbierta] = useState<Orden | 'nueva' | null>(null);
  const [menu, setMenu] = useState<{ id: string; tipo: 'estado' | 'imprimir' | 'abono' | 'comprobantes' | 'bitacora' | 'fechas' } | null>(null);
  const [vista, setVista] = useState<{ titulo: string; url: string } | null>(null);
  const [solicitud, setSolicitud] = useState<Orden | null>(null);
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

  const { visibles: ordenesVisibles, pagina, setPagina, tam, setTam, total, totalPaginas, inicio, fin } = usePaginacion(ordenes);
  const ok = async (m: string) => { setError(''); setMensaje(m); setMenu(null); await cargar(); };
  const falla = (e: unknown) => { setMensaje(''); setError((e as Error).message); };

  // RF-018: autorizar aplica la reapertura o la corrección; rechazar pide el motivo.
  async function resolver(o: Orden, solicitudId: string, aprobar: boolean) {
    const respuesta = aprobar ? '' : window.prompt(`¿Por qué rechazas la solicitud de la ODS ${o.codigo}?`);
    if (respuesta === null) return;
    try { await api.resolverSolicitudOds(o.id, solicitudId, { aprobar, respuesta }); await ok(`ODS ${o.codigo}: solicitud ${aprobar ? 'autorizada' : 'rechazada'}.`); } catch (x) { falla(x); }
  }
  async function cambiarEstado(o: Orden, e: string) {
    try { await api.editarOrden(o.id, { estado: e }); await ok(`ODS ${o.codigo}: estado cambiado.`); } catch (x) { setMenu(null); falla(x); }
  }
  async function eliminar(o: Orden) {
    const motivo = window.prompt(`¿Por qué eliminas la ODS ${o.codigo}? El número no se volverá a usar.`);
    if (motivo === null) return;
    try { await api.eliminarOrden(o.id, motivo); await ok(`ODS ${o.codigo} eliminada.`); } catch (x) { falla(x); }
  }
  // El PDF se arma aquí mismo y se muestra en un modal con el visor del navegador (imprimir y descargar vienen en el visor).
  function imprimir(o: Orden, formato: FormatoPdf) {
    setMenu(null);
    try {
      const bytes = generarPdf(formato, o, cat?.empresa ?? { nombre: '', ruc: null, direccion: null, telefono: null, correo: null, lema: null, cuentasBancarias: null, terminosRecepcion: null });
      cerrarVista();
      setVista({ titulo: `${TITULO_VISTA[formato]} ${o.codigo}`, url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })) });
    } catch (x) {
      falla(x);
    }
  }
  function cerrarVista() {
    setVista((v) => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
  }

  return (
    <div className="panel ancho ods">
      <div className="fila entre">
        <h1>Órdenes de servicio</h1>
        {puedeEditar && <button type="button" className="primario chico" onClick={() => setAbierta('nueva')}>+ Nuevo</button>}
      </div>
      {vista && <VistaPreviaPdf titulo={vista.titulo} url={vista.url} alCerrar={cerrarVista} />}
      {solicitud && cat && <FormSolicitud orden={solicitud} cat={cat} alCancelar={() => setSolicitud(null)} alGuardar={async (m) => { setSolicitud(null); await ok(m); }} />}
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
      {ordenesVisibles.map((o) => (
        <article key={o.id} className="tarjeta-ods">
          <div className="info">
            <div><b>Consecutivo:</b> <span>{'#' + o.codigo}</span> <button type="button" className={'etq' + (o.conComprobante ? ' si' : '')} onClick={() => setMenu(menu?.id === o.id && menu.tipo === 'comprobantes' ? null : { id: o.id, tipo: 'comprobantes' })}>{o.conComprobante ? 'Con comprobante' : 'Sin comprobante'}</button></div>
            {menu?.id === o.id && menu.tipo === 'comprobantes' && <div className="sub">{o.comprobantes.length ? o.comprobantes.join(', ') : 'Esta ODS todavía no tiene comprobantes.'}</div>}
            <div><b>Fecha de inicio:</b> {fecha(o.fechaInicio)} · <b>Fecha de cierre:</b> {fecha(o.fechaCierre)}</div>
            <div><b>Cliente:</b> {o.cliente.nombre} ({o.cliente.documento})</div>
            <div><b>Vehículo:</b> {[o.vehiculo.marca && `Marca: ${o.vehiculo.marca}`, o.vehiculo.modelo && `Modelo: ${o.vehiculo.modelo}`, o.vehiculo.anio && `Año: ${o.vehiculo.anio}`, `Placa: ${o.vehiculo.placa}`, o.vehiculo.nroVin && `VIN: ${o.vehiculo.nroVin}`, o.km != null && `Kilometraje: ${o.km}`].filter(Boolean).join(', ')}</div>
            <div><b>Tipo de atención:</b> {o.tipoAtencion === 'Otro' && o.tipoAtencionDetalle ? o.tipoAtencionDetalle : o.tipoAtencion}</div>
            {o.observaciones && <div><b>Comentarios:</b> {o.observaciones}</div>}
            <div><b>Técnico:</b> {o.tecnico?.nombre ?? 'Sin asignar'} · <b>Usuario:</b> {o.creadoPor?.nombre ?? '—'} · <b>Total:</b> {soles(o.total)}</div>
            {(() => {
              // RF-018: la solicitud pendiente de la ODS cerrada, con Autorizar y Rechazar para quien puede resolverla.
              const q = o.solicitudes?.find((x) => x.estado === 'PENDIENTE');
              if (!q) return null;
              return (
                <div className="solicitud-ods" role="note">
                  <span><b>{q.tipo === 'REAPERTURA' ? `Reapertura solicitada (a ${ESTADOS.find((e) => e.id === q.estadoDestino)?.nombre ?? q.estadoDestino})` : 'Corrección solicitada'}:</b> {q.motivo} · {q.solicitadaPor}</span>
                  {puedeAutorizar && (
                    <span className="fila">
                      <button type="button" className="primario chico" onClick={() => void resolver(o, q.id, true)}>Autorizar</button>
                      <button type="button" className="chico" onClick={() => void resolver(o, q.id, false)}>Rechazar</button>
                    </span>
                  )}
                </div>
              );
            })()}
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
              <button type="button" className="ac" aria-label="Estado de la orden" title={o.estado === 'Cerrada' ? 'Solicitar corrección o reapertura' : 'Estado de la orden'} disabled={!puedeEditar}
                onClick={() => (o.estado === 'Cerrada' ? (setMenu(null), setSolicitud(o)) : setMenu(menu?.id === o.id && menu.tipo === 'estado' ? null : { id: o.id, tipo: 'estado' }))}>⇄</button>
              {menu?.id === o.id && menu.tipo === 'estado' && (
                <div className="menu" role="menu">{ESTADOS.map((e) => <button key={e.id} type="button" role="menuitem" disabled={e.id === o.estado} onClick={() => void cambiarEstado(o, e.id)}>{e.nombre}</button>)}</div>
              )}
            </span>
            <span className="rel">
              <button type="button" className="ac" aria-label="Bitácora" title="Bitácora" onClick={() => setMenu(menu?.id === o.id && menu.tipo === 'bitacora' ? null : { id: o.id, tipo: 'bitacora' })}>💬</button>
              {menu?.id === o.id && menu.tipo === 'bitacora' && <div className="menu ancho">{o.bitacora.length ? o.bitacora.map((b, i) => <p key={i}><b>{b.actor}</b> · {fecha(b.fecha)}<br />{b.texto}</p>) : <p>Sin registros.</p>}</div>}
            </span>
            <button type="button" className="ac" aria-label="Registrar abono o pago" title="Registrar abono o pago" disabled={!puedeEditar} onClick={() => setMenu({ id: o.id, tipo: 'abono' })}>💵</button>
            {menu?.id === o.id && menu.tipo === 'abono' && cat && (
              <div className="fondo-modal">
                <div className="modal-form modal-pagos" role="dialog" aria-modal="true" aria-label="Pagos recibidos">
                  <div className="fila entre"><h3>Pagos recibidos</h3><button type="button" className="cerrar" aria-label="Cerrar" onClick={() => setMenu(null)}>×</button></div>
                  <FormAbono orden={o} metodos={cat.metodosPago} alGuardar={ok} alFallar={falla} alCancelar={() => setMenu(null)} />
                </div>
              </div>
            )}
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
      {ordenes.length > 0 && <Paginacion pagina={pagina} setPagina={setPagina} tam={tam} setTam={setTam} total={total} totalPaginas={totalPaginas} inicio={inicio} fin={fin} />}
      {abierta && cat && (
        <EditorOrden
          orden={abierta === 'nueva' ? null : abierta}
          cat={cat}
          clientes={clientes}
          vehiculos={vehiculos}
          puedeEditar={puedeEditar}
          usuarioId={usuarioId}
          alCerrar={async (m) => { setAbierta(null); if (m) await ok(m); else await cargar(); }}
        />
      )}
    </div>
  );
}
