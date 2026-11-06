import { useEffect, useMemo, useRef, useState } from 'react';
import { api, Orden } from '../comun/api';

export const MAX_FOTOS = 5;

/** Evidencias de ingreso: hasta 5 fotos opcionales, cargadas o tomadas con la cámara, y acceso al estado del vehículo (RF-015).
 *  En una orden nueva las fotos quedan pendientes y se suben al crearla. */
export default function Ingreso({ orden, bloqueada, puedeEditar, alCambiar, alFallar, abrirEstado, pendientes = [], alPendientes }: {
  orden: Orden; bloqueada: boolean; puedeEditar: boolean; alCambiar: (o: Orden) => void; alFallar: (e: unknown) => void; abrirEstado: () => void;
  pendientes?: File[]; alPendientes?: (f: File[]) => void;
}) {
  const archivos = useRef<HTMLInputElement>(null);
  const camaraNativa = useRef<HTMLInputElement>(null);
  const [vistas, setVistas] = useState<Record<string, string>>({});
  const [subiendo, setSubiendo] = useState(false);
  const [camara, setCamara] = useState(false);
  const evidencias = orden.evidencias ?? [];
  const nueva = !orden.id;
  const total = evidencias.length + pendientes.length;
  const vistasPendientes = useMemo(() => pendientes.map((f) => URL.createObjectURL(f)), [pendientes]);
  useEffect(() => () => vistasPendientes.forEach((u) => URL.revokeObjectURL(u)), [vistasPendientes]);
  useEffect(() => {
    let vivo = true;
    for (const e of evidencias) if (!vistas[e.id]) api.verEvidencia(orden.id, e.id).then((u) => { if (vivo) setVistas((x) => ({ ...x, [e.id]: u })); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [orden.id, evidencias.map((e) => e.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  async function agregar(lista: File[]) {
    const fotos = lista.filter((f) => f.type.startsWith('image/'));
    if (fotos.length < lista.length) alFallar(new Error('Solo se aceptan fotos.'));
    const tomadas = fotos.slice(0, MAX_FOTOS - total);
    if (tomadas.length < fotos.length) alFallar(new Error(`Máximo ${MAX_FOTOS} fotos por orden.`));
    if (!tomadas.length) return;
    if (nueva) return alPendientes?.([...pendientes, ...tomadas]);
    setSubiendo(true);
    try { let n = orden; for (const f of tomadas) n = await api.subirEvidencia(orden.id, f); alCambiar(n); } catch (x) { alFallar(x); } finally { setSubiendo(false); }
  }
  // En la computadora y en la tablet se abre la cámara del navegador; si no se puede (sin conexión segura), la del sistema.
  function tomarFoto() {
    if (window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function') setCamara(true);
    else camaraNativa.current?.click();
  }
  const lleno = total >= MAX_FOTOS;
  const llenos = Object.values(orden.estadoVehiculo ?? {}).filter((x) => (Array.isArray(x) ? x.length > 0 : !!x && x !== 'Sin registrar')).length;
  return (
    <section className="ingreso">
      <div className="fila entre">
        <h3>Evidencias de ingreso <span className="suave">({total}/{MAX_FOTOS})</span></h3>
        <button type="button" disabled={nueva} onClick={abrirEstado}>🚗 Estado del vehículo{llenos ? ` (${llenos})` : ''}</button>
      </div>
      {puedeEditar && !bloqueada && (
        <div className="fila">
          <button type="button" disabled={subiendo || lleno} onClick={() => archivos.current?.click()}>📁 Cargar fotos</button>
          <button type="button" disabled={subiendo || lleno} onClick={tomarFoto}>📷 Tomar foto</button>
          {subiendo && <span className="suave">Subiendo…</span>}
          <input ref={archivos} type="file" accept="image/*" multiple hidden aria-label="Cargar fotos" onChange={(e) => { void agregar(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
          <input ref={camaraNativa} type="file" accept="image/*" capture="environment" hidden aria-label="Tomar foto con la cámara" onChange={(e) => { void agregar(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        </div>
      )}
      <div className="galeria">
        {evidencias.map((e) => (
          <figure key={e.id}>
            {vistas[e.id] ? <a href={vistas[e.id]} target="_blank" rel="noreferrer"><img src={vistas[e.id]} alt={e.nombre} /></a> : <span className="suave">…</span>}
            <figcaption title={e.nombre}>{e.nombre}</figcaption>
            {puedeEditar && !bloqueada && <button type="button" className="quitar" aria-label={`Quitar ${e.nombre}`} onClick={async () => { if (!window.confirm(`¿Quitar ${e.nombre}?`)) return; try { alCambiar(await api.quitarEvidencia(orden.id, e.id)); } catch (x) { alFallar(x); } }}>✕</button>}
          </figure>
        ))}
        {pendientes.map((f, i) => (
          <figure key={f.name + i}>
            <img src={vistasPendientes[i]} alt={f.name} />
            <figcaption title={f.name}>{f.name}</figcaption>
            <button type="button" className="quitar" aria-label={`Quitar ${f.name}`} onClick={() => alPendientes?.(pendientes.filter((_, j) => j !== i))}>✕</button>
          </figure>
        ))}
        {total === 0 && <p className="suave">Sin fotos todavía.</p>}
      </div>
      {camara && <Camara alTomar={(f) => { setCamara(false); void agregar([f]); }} alCerrar={() => setCamara(false)} alFallar={alFallar} />}
    </section>
  );
}

/** Vista de la cámara (trasera si existe) con botón para capturar; el navegador pide permiso la primera vez. */
function Camara({ alTomar, alCerrar, alFallar }: { alTomar: (f: File) => void; alCerrar: () => void; alFallar: (e: unknown) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [listo, setListo] = useState(false);
  useEffect(() => {
    let vivo = true;
    let flujo: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        flujo = s;
        if (video.current) { video.current.srcObject = s; void video.current.play(); }
        setListo(true);
      })
      .catch(() => { alFallar(new Error('No se pudo abrir la cámara. Revisa el permiso de cámara del navegador.')); alCerrar(); });
    return () => { vivo = false; flujo?.getTracks().forEach((t) => t.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function capturar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    c.toBlob((b) => { if (b) alTomar(new File([b], `foto-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`, { type: 'image/jpeg' })); }, 'image/jpeg', 0.9);
  }
  return (
    <div className="fondo-modal sobre">
      <div className="modal-estado modal-camara" role="dialog" aria-modal="true" aria-label="Tomar foto">
        <video ref={video} playsInline muted />
        <div className="fila fin">
          <button type="button" onClick={alCerrar}>Cancelar</button>
          <button type="button" className="primario chico" disabled={!listo} onClick={capturar}>📷 Capturar</button>
        </div>
      </div>
    </div>
  );
}
