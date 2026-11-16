import { useCallback, useEffect, useState } from 'react';
import { api, CatalogosOds, Cotizacion, Orden } from '../comun/api';
import TablaMaestro from '../comun/TablaMaestro';
import { TIPO_CORTO } from '../comun/documento';
import VistaPreviaPdf from '../ordenServicio/VistaPreviaPdf';
import { soles } from '../ordenServicio/ordenServicio.util';
import FormVenta from './FormVenta';
import { generarPdfNota } from './pdfNota';

const empresaVacia = { nombre: '', ruc: null, direccion: null, telefono: null, correo: null, lema: null, cuentasBancarias: null, terminosRecepcion: null };
const dia = (iso: string) => new Date(iso).toLocaleDateString('es-PE');
const ESTADO = { VIGENTE: ['Vigente', 'verde'], VENCIDA: ['Vencida', 'amarillo'], ANULADA: ['Anulada', 'rojo'] } as const;

/** Cotizaciones: no afectan caja, stock ni pagos. Se emiten con el mismo formato de la nota de venta y luego se cargan al facturar. */
export default function Cotizaciones({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [filas, setFilas] = useState<Cotizacion[]>([]);
  const [cat, setCat] = useState<CatalogosOds | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  // nueva: cotización en blanco, copia (duplicar) o edición; facturar: emitir el comprobante desde una cotización.
  const [form, setForm] = useState<{ cot?: Cotizacion; editar?: boolean } | null>(null);
  const [facturar, setFacturar] = useState<Cotizacion | null>(null);
  const [vista, setVista] = useState<{ titulo: string; url: string } | null>(null);
  const cargar = useCallback(async () => setFilas(await api.cotizaciones()), []);
  useEffect(() => { Promise.all([cargar(), api.catalogosOds().then(setCat)]).catch((e) => setError((e as Error).message)); }, [cargar]);

  const cerrarVista = () => { if (vista) URL.revokeObjectURL(vista.url); setVista(null); };
  function imprimir(c: Cotizacion, formato: 'PDF' | 'Ticket') {
    try {
      const o = { codigo: '', km: null, cliente: c.cliente, vehiculo: c.vehiculo ?? { placa: '', marca: null, modelo: null } } as unknown as Orden;
      const nota = { ...c, local: c.local.nombre, fechaVencimiento: c.validaHasta, conDetraccion: false, detraccionPct: 12, detraccion: 0 } as unknown as Parameters<typeof generarPdfNota>[2];
      const bytes = generarPdfNota(formato, o, nota, cat?.empresa ?? empresaVacia, 'COTIZACION');
      cerrarVista();
      setVista({ titulo: `${formato === 'Ticket' ? 'Ticket' : 'Cotización'} ${c.codigo}`, url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })) });
    } catch (x) { setError((x as Error).message); }
  }
  async function eliminar(c: Cotizacion) {
    if (!window.confirm(`¿Eliminar la cotización ${c.codigo}? No se puede deshacer.`)) return;
    try { await api.eliminarCotizacion(c.id); setError(''); setMensaje(`Cotización ${c.codigo} eliminada.`); await cargar(); } catch (x) { setError((x as Error).message); }
  }
  async function anular(c: Cotizacion) {
    const motivo = window.prompt(`¿Por qué anulas la cotización ${c.codigo}?`);
    if (!motivo) return;
    try { await api.anularCotizacion(c.id, motivo); setError(''); setMensaje(`Cotización ${c.codigo} anulada.`); await cargar(); } catch (x) { setError((x as Error).message); }
  }

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {vista && <VistaPreviaPdf titulo={vista.titulo} url={vista.url} alCerrar={cerrarVista} />}
      {form && cat && <FormVenta modo="cotizacion" cat={cat} cotizacionInicial={form.cot} editarId={form.editar ? form.cot?.id : undefined} alCerrar={() => setForm(null)} alHecho={async (m) => { setForm(null); setMensaje(m); await cargar(); }} />}
      {facturar && cat && <FormVenta cat={cat} cotizacionInicial={facturar} alCerrar={() => setFacturar(null)} alHecho={async (m) => { setFacturar(null); setMensaje(m); await cargar(); }} />}
      <TablaMaestro<Cotizacion>
        titulo="Cotizaciones"
        uno="cotización"
        filas={filas}
        puedeEditar={nivel !== 'V'}
        alNuevo={() => setForm({})}
        alCambiar={cargar}
        guardar={async () => undefined}
        columnas={[
          { titulo: 'Local', texto: (x) => x.local.nombre, ancho: 18 },
          { titulo: 'Cotización', texto: (x) => x.codigo, celda: (x) => <span className="chip-pago">{x.codigo}</span> },
          { titulo: 'Tipo doc.', texto: (x) => TIPO_CORTO[x.cliente.tipoDocumento] ?? x.cliente.tipoDocumento },
          { titulo: 'Núm. doc.', texto: (x) => x.cliente.documento },
          { titulo: 'Razón social', texto: (x) => x.cliente.nombre, ancho: 28 },
          { titulo: 'Placa', texto: (x) => x.vehiculo?.placa ?? '' },
          { titulo: 'Fecha de emisión', texto: (x) => dia(x.fechaEmision) },
          { titulo: 'Válida hasta', texto: (x) => dia(x.validaHasta) },
          { titulo: 'Moneda', texto: () => 'S/' },
          { titulo: 'Total', texto: (x) => soles(x.total) },
          { titulo: 'Forma de pago', texto: (x) => x.formaPago ?? '' },
          { titulo: 'Usuario', texto: (x) => x.creadaPor, ancho: 18 },
          { titulo: 'Estado', texto: (x) => ESTADO[x.estado][0], celda: (x) => <span className={'pill ' + ESTADO[x.estado][1]}>{ESTADO[x.estado][0]}</span> },
        ]}
        acciones={(x) => (
          <>
            {x.estado === 'VIGENTE' && nivel !== 'V' && <button type="button" onClick={() => setFacturar(x)}>Emitir comprobante</button>}
            <button type="button" onClick={() => imprimir(x, 'Ticket')}>Ticket</button>
            <button type="button" onClick={() => imprimir(x, 'PDF')}>PDF</button>
            {nivel !== 'V' && <button type="button" onClick={() => setForm({ cot: x })}>Duplicar</button>}
            {nivel !== 'V' && x.estado !== 'ANULADA' && <button type="button" onClick={() => setForm({ cot: x, editar: true })}>Editar</button>}
            {nivel === 'A' && x.estado !== 'ANULADA' && <button type="button" className="peligro" onClick={() => void anular(x)}>Anular</button>}
            {nivel === 'A' && <button type="button" className="peligro" onClick={() => void eliminar(x)}>Eliminar</button>}
          </>
        )}
      />
    </>
  );
}
