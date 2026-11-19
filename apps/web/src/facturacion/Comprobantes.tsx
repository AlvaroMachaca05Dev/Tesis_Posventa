import { useCallback, useEffect, useState } from 'react';
import { api, CatalogosOds, NotaVenta, Orden } from '../comun/api';
import TablaMaestro from '../comun/TablaMaestro';
import { TIPO_CORTO } from '../comun/documento';
import VistaPreviaPdf from '../ordenServicio/VistaPreviaPdf';
import { soles } from '../ordenServicio/ordenServicio.util';
import FormNota, { mensajeEliminarComprobante } from './FormNota';
import { useConfirmar } from '../comun/Confirmar';
import FormVenta from './FormVenta';
import { generarPdfNota } from './pdfNota';

const empresaVacia = { nombre: '', ruc: null, direccion: null, telefono: null, correo: null, lema: null, cuentasBancarias: null, terminosRecepcion: null };
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

/** Emitir comprobante (nota de venta): todas las notas emitidas, con sus acciones, y «+ Nuevo» desde una orden de servicio. */
export default function Comprobantes({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [filas, setFilas] = useState<NotaVenta[]>([]);
  const [cat, setCat] = useState<CatalogosOds | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  // nueva: comprobante en blanco o copia de otro (duplicar).
  const [nueva, setNueva] = useState<{ copia?: NotaVenta } | null>(null);
  const [orden, setOrden] = useState<Orden | null>(null);
  const [vista, setVista] = useState<{ titulo: string; url: string } | null>(null);
  // Los comprobantes eliminados no se muestran (quedan en la base para la auditoría y el stock).
  const cargar = useCallback(async () => setFilas((await api.notasVenta()).filter((x) => x.estado === 'EMITIDA')), []);
  const { preguntar, modal: confirmacion } = useConfirmar();
  useEffect(() => { Promise.all([cargar(), api.catalogosOds().then(setCat)]).catch((e) => setError((e as Error).message)); }, [cargar]);

  const cerrarVista = () => { if (vista) URL.revokeObjectURL(vista.url); setVista(null); };
  async function imprimir(n: NotaVenta, formato: 'PDF' | 'Ticket') {
    try {
      // El PDF solo necesita cliente, placa y kilometraje: salen de la propia nota, con o sin orden de servicio.
      const o = { codigo: n.orden?.codigo ?? '', km: n.orden?.km ?? null, cliente: n.cliente, vehiculo: n.vehiculo ?? { placa: '', marca: null, modelo: null } } as unknown as Orden;
      const bytes = generarPdfNota(formato, o, { ...n, local: n.local.nombre }, cat?.empresa ?? empresaVacia);
      cerrarVista();
      setVista({ titulo: `${formato === 'Ticket' ? 'Ticket' : 'Nota de venta'} ${n.codigo}`, url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })) });
    } catch (x) { setError((x as Error).message); }
  }
  async function anular(n: NotaVenta) {
    const motivo = await preguntar({ titulo: `¿Eliminar la nota de venta ${n.codigo}?`, motivo: 'obligatorio', mensaje: mensajeEliminarComprobante(n.pagado) });
    if (motivo === null) return;
    try { await api.anularNotaVenta(n.id, motivo); setError(''); setMensaje(`Nota de venta ${n.codigo} eliminada.`); await cargar(); } catch (x) { setError((x as Error).message); }
  }
  async function ver(n: NotaVenta) {
    try { if (n.orden) setOrden(await api.orden(n.orden.id)); } catch (x) { setError((x as Error).message); }
  }

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {confirmacion}
      {vista && <VistaPreviaPdf titulo={vista.titulo} url={vista.url} alCerrar={cerrarVista} />}
      {nueva && cat && <FormVenta cat={cat} notaInicial={nueva.copia} alCerrar={() => setNueva(null)} alHecho={async (m) => { setNueva(null); setMensaje(m); await cargar(); }} />}
      {orden && cat && (
        <FormNota orden={orden} cat={cat} puedeAnular={nivel === 'A'}
          alImprimir={(f) => { const n = filas.find((x) => x.orden?.id === orden.id && x.estado === 'EMITIDA'); setOrden(null); if (n) void imprimir(n, f); }}
          alCerrar={() => setOrden(null)}
          alHecho={async (m) => { setOrden(null); setMensaje(m); await cargar(); }} />
      )}
      <TablaMaestro<NotaVenta>
        titulo="Emitir comprobante (nota de venta)"
        uno="comprobante"
        filas={filas}
        puedeEditar={nivel !== 'V'}
        alNuevo={() => setNueva({})}
        alCambiar={cargar}
        guardar={async () => undefined}
        columnas={[
          { titulo: 'Local', texto: (x) => x.local.nombre, ancho: 18 },
          { titulo: 'Comprobante', texto: (x) => x.codigo, celda: (x) => <span className="chip-pago">{x.codigo}</span> },
          { titulo: 'Tipo doc.', texto: (x) => TIPO_CORTO[x.cliente.tipoDocumento] ?? x.cliente.tipoDocumento },
          { titulo: 'Núm. doc.', texto: (x) => x.cliente.documento },
          { titulo: 'Razón social', texto: (x) => x.cliente.nombre, ancho: 28 },
          { titulo: 'Placa', texto: (x) => x.vehiculo?.placa ?? '' },
          { titulo: 'Orden', texto: (x) => x.orden?.codigo ?? '' },
          { titulo: 'Fecha de emisión', texto: (x) => fechaHora(x.fechaEmision), ancho: 14 },
          { titulo: 'Moneda', texto: () => 'S/' },
          { titulo: 'Total', texto: (x) => soles(x.total) },
          { titulo: 'Condición', texto: (x) => (x.condicion === 'CREDITO' ? 'Crédito' : 'Contado') },
          { titulo: 'Usuario', texto: (x) => x.emitidaPor, ancho: 18 },
        ]}
        acciones={(x) => (
          <>
            {x.orden && <button type="button" onClick={() => void ver(x)}>Ver</button>}
            <button type="button" onClick={() => void imprimir(x, 'Ticket')}>Ticket</button>
            <button type="button" onClick={() => void imprimir(x, 'PDF')}>PDF</button>
            {nivel !== 'V' && <button type="button" onClick={() => setNueva({ copia: x })}>Duplicar</button>}
            {nivel === 'A' && <button type="button" className="peligro" onClick={() => void anular(x)}>Eliminar</button>}
          </>
        )}
      />
    </>
  );
}
