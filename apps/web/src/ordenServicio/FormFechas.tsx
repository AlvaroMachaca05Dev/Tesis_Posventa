import { useState } from 'react';
import { api, Orden } from '../comun/api';

/** Fecha y hora en un solo campo (como en ClickUp). Solo el Superadministrador corrige una orden creada o cerrada tarde. */
const aLocal = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
export default function FormFechas({ orden, alGuardar, alFallar }: { orden: Orden; alGuardar: (m: string) => Promise<void> | void; alFallar: (e: unknown) => void }) {
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
