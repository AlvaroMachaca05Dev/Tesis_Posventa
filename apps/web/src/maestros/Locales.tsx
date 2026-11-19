import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, LocalEmpresa } from '../comun/api';
import TablaMaestro, { Valor } from '../comun/TablaMaestro';

const SERIES: [keyof Pick<LocalEmpresa, 'serieNotaVenta' | 'serieBoleta' | 'serieFactura'>, string][] = [['serieNotaVenta', 'Serie de nota de venta'], ['serieBoleta', 'Serie de boleta'], ['serieFactura', 'Serie de factura']];
const mayus = (v: Valor) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Almacenes (locales) de la empresa: se agregan, editan y eliminan, y cada uno tiene sus series de comprobantes («Asignar series»). */
export default function Locales({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [filas, setFilas] = useState<LocalEmpresa[]>([]);
  const [asignando, setAsignando] = useState<LocalEmpresa | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const cargar = useCallback(async () => setFilas(await api.localesSeries()), []);
  useEffect(() => { cargar().catch((e) => setError((e as Error).message)); }, [cargar]);
  const puede = nivel === 'A';

  async function guardar(x: LocalEmpresa | null, d: Record<string, Valor>) {
    const series = Object.fromEntries(SERIES.map(([k]) => [k, mayus(d[k])]));
    if (x) { setFilas(await api.asignarSeries(x.id, { nombre: String(d.nombre), direccion: String(d.direccion ?? ''), telefono: String(d.telefono ?? ''), ...series })); return; }
    const lista = await api.crearLocal({ nombre: d.nombre, direccion: d.direccion, telefono: d.telefono });
    const nuevo = lista.find((l) => l.nombre === String(d.nombre).trim());
    setFilas(nuevo && Object.values(series).some(Boolean) ? await api.asignarSeries(nuevo.id, series) : lista);
  }

  return (
    <div className="panel ancho">
      <h1>Almacenes (locales)</h1>
      {error && !asignando && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      <TablaMaestro<LocalEmpresa>
        sinTitulo titulo="Locales" uno="local" filas={filas} puedeEditar={puede} alCambiar={cargar}
        columnas={[
          { titulo: 'Local', texto: (x) => x.nombre },
          { titulo: 'Dirección', texto: (x) => x.direccion ?? '', ancho: 30 },
          { titulo: 'Teléfono', texto: (x) => x.telefono ?? '' },
          ...SERIES.map(([k, t]) => ({ titulo: t, texto: (x: LocalEmpresa) => x[k] ?? '' })),
        ]}
        campos={[
          { k: 'nombre', etiqueta: 'Nombre del local', requerido: true },
          { k: 'direccion', etiqueta: 'Dirección' },
          { k: 'telefono', etiqueta: 'Teléfono' },
          ...SERIES.map(([k, t]) => ({ k, etiqueta: t, maxLength: 4 })),
        ]}
        valores={(x) => ({ nombre: x?.nombre ?? '', direccion: x?.direccion ?? '', telefono: x?.telefono ?? '', serieNotaVenta: x?.serieNotaVenta ?? '', serieBoleta: x?.serieBoleta ?? '', serieFactura: x?.serieFactura ?? '' })}
        guardar={guardar}
        eliminar={puede ? async (x) => { setFilas(await api.eliminarLocal(x.id)); return { ok: true, eliminado: true }; } : undefined}
        acciones={puede ? (x) => <button type="button" onClick={() => { setError(''); setAsignando(x); }}>Asignar series</button> : undefined}
      />
      {asignando && (
        <AsignarSeries local={asignando} error={error} alCancelar={() => setAsignando(null)}
          alGuardar={async (d) => {
            try { setFilas(await api.asignarSeries(asignando.id, d)); setAsignando(null); setError(''); setMensaje(`${asignando.nombre}: series guardadas.`); } catch (e) { setError((e as Error).message); }
          }} />
      )}
    </div>
  );
}

function AsignarSeries(p: { local: LocalEmpresa; error: string; alCancelar: () => void; alGuardar: (d: Record<string, string>) => Promise<void> }) {
  const [d, setD] = useState({ serieNotaVenta: p.local.serieNotaVenta ?? '', serieBoleta: p.local.serieBoleta ?? '', serieFactura: p.local.serieFactura ?? '' });
  const campo = (k: keyof typeof d, etiqueta: string) => (
    <div className="campo"><label htmlFor={`s-${k}`}>{etiqueta}</label>
      <input id={`s-${k}`} className="serie" maxLength={4} value={d[k]} onChange={(e) => setD((x) => ({ ...x, [k]: mayus(e.target.value) }))} /></div>
  );
  return (
    <div className="fondo-modal">
      <form className="modal-form modal-pagos" role="dialog" aria-modal="true" aria-label={`Asignar series a ${p.local.nombre}`} onSubmit={(e: FormEvent) => { e.preventDefault(); void p.alGuardar(d); }}>
        <h2>Asignar series · {p.local.nombre}</h2>
        {p.error && <p className="error" role="alert">{p.error}</p>}
        {SERIES.map(([k, t]) => campo(k, t))}
        <div className="fila fin"><button type="button" onClick={p.alCancelar}>Cancelar</button><button type="submit" className="primario chico">Guardar</button></div>
      </form>
    </div>
  );
}
