import { FormEvent, useState } from 'react';
import { api, CatalogosOds, Orden } from '../comun/api';
import { ESTADOS } from './ordenServicio.util';

/** RF-018: una ODS cerrada no se edita de forma ordinaria; aquí se pide su reapertura o la corrección de sus datos. */
export default function FormSolicitud({ orden, cat, alGuardar, alCancelar }: { orden: Orden; cat: CatalogosOds; alGuardar: (m: string) => Promise<void> | void; alCancelar: () => void }) {
  const [tipo, setTipo] = useState<'REAPERTURA' | 'CORRECCION'>('REAPERTURA');
  const [motivo, setMotivo] = useState('');
  const [destino, setDestino] = useState('EnProceso');
  const [km, setKm] = useState(orden.km != null ? String(orden.km) : '');
  const [observaciones, setObservaciones] = useState(orden.observaciones ?? '');
  const [recomendaciones, setRecomendaciones] = useState(orden.recomendaciones ?? '');
  const [tecnicoId, setTecnicoId] = useState(orden.tecnico?.id ?? '');
  const [jefeId, setJefeId] = useState(orden.jefeTaller?.id ?? '');
  const [error, setError] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    // Solo viaja lo que cambió respecto de la orden.
    const cambios: Record<string, unknown> = {};
    if (km !== (orden.km != null ? String(orden.km) : '')) cambios.km = km === '' ? null : Number(km);
    if (observaciones !== (orden.observaciones ?? '')) cambios.observaciones = observaciones;
    if (recomendaciones !== (orden.recomendaciones ?? '')) cambios.recomendaciones = recomendaciones;
    if (tecnicoId !== (orden.tecnico?.id ?? '')) cambios.tecnicoId = tecnicoId || null;
    if (jefeId !== (orden.jefeTaller?.id ?? '')) cambios.jefeTallerId = jefeId || null;
    try {
      await api.solicitarOds(orden.id, tipo === 'REAPERTURA' ? { tipo, motivo, estadoDestino: destino } : { tipo, motivo, cambios });
      await alGuardar(`ODS ${orden.codigo}: solicitud enviada.`);
    } catch (x) {
      setError((x as Error).message);
    }
  }

  return (
    <div className="fondo-modal">
      <form className="modal-form" role="dialog" aria-modal="true" aria-label={`Solicitar corrección o reapertura de la ODS ${orden.codigo}`} onSubmit={enviar}>
        <h2>Solicitar corrección o reapertura</h2>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dos-col">
          <div className="campo"><label htmlFor="s-tipo">Tipo de solicitud *</label>
            <select id="s-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as 'REAPERTURA' | 'CORRECCION')}>
              <option value="REAPERTURA">Reapertura</option>
              <option value="CORRECCION">Corrección de datos</option>
            </select></div>
          {tipo === 'REAPERTURA' ? (
            <div className="campo"><label htmlFor="s-destino">Vuelve al estado *</label>
              <select id="s-destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
                {ESTADOS.filter((x) => x.id !== 'Cerrada').map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select></div>
          ) : (
            <div className="campo"><label htmlFor="s-km">Kilometraje</label><input id="s-km" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))} /></div>
          )}
          {tipo === 'CORRECCION' && (
            <>
              <div className="campo"><label htmlFor="s-tecnico">Técnico</label>
                <select id="s-tecnico" value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}><option value="">Sin asignar</option>{cat.tecnicos.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
              <div className="campo"><label htmlFor="s-jefe">Jefe de taller</label>
                <select id="s-jefe" value={jefeId} onChange={(e) => setJefeId(e.target.value)}><option value="">Sin asignar</option>{cat.jefes.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
              <div className="campo ancha"><label htmlFor="s-obs">Observaciones</label><textarea id="s-obs" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></div>
              <div className="campo ancha"><label htmlFor="s-rec">Recomendaciones</label><textarea id="s-rec" rows={2} value={recomendaciones} onChange={(e) => setRecomendaciones(e.target.value)} /></div>
            </>
          )}
          <div className="campo ancha"><label htmlFor="s-motivo">Motivo *</label><textarea id="s-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} required /></div>
        </div>
        <p className="nota-obligatorio">* Los campos con asterisco son obligatorios.</p>
        <div className="fila fin">
          <button type="button" onClick={alCancelar}>Cancelar</button>
          <button type="submit" className="primario chico">Enviar solicitud</button>
        </div>
      </form>
    </div>
  );
}
