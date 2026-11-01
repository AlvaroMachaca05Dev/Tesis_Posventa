import { useEffect, useRef, useState } from 'react';
import { api, Orden } from '../../comun/api';

/** Evidencias de ingreso (fotos y videos, cargados o tomados con la cámara) y acceso al estado del vehículo (RF-015). */
export default function Ingreso({ orden, bloqueada, puedeEditar, alCambiar, alFallar, abrirEstado }: { orden: Orden; bloqueada: boolean; puedeEditar: boolean; alCambiar: (o: Orden) => void; alFallar: (e: unknown) => void; abrirEstado: () => void }) {
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
