import { useCallback, useEffect, useState } from 'react';
import { api, Servicio, Solape } from '../comun/api';
import TablaMaestro, { Valor } from '../comun/TablaMaestro';
import { soles } from '../ordenServicio/ordenServicio.util';

const MODO: Record<string, string> = { AUTOMATICO: 'Automático', OPCIONAL: 'Opcional', AVISO: 'Aviso' };
const TIPO: Record<string, string> = { PAR: 'Par de servicios', CONJUNTO: 'Conjunto (misma rueda, refrigerante…)' };
const PILL: Record<string, string> = { AUTOMATICO: 'verde', OPCIONAL: 'ambar', AVISO: '' };

/** RF-102: servicios que comparten trabajo; juntos en una ODS, el segundo lleva un descuento en soles. */
export default function Solapamientos({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [filas, setFilas] = useState<Solape[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => setFilas(await api.solapamientos()), []);
  useEffect(() => {
    cargar().catch((e) => setError((e as Error).message));
    api.servicios().then(setServicios).catch(() => setServicios([]));
  }, [cargar]);
  const opcSv: [string, string][] = servicios.filter((s) => s.activo).map((s) => [s.id, `${s.codigo} · ${s.nombre}`] as [string, string]);
  const arbol = Object.fromEntries(servicios.map((x) => [x.id, x.categoria]));
  const datos = (d: Record<string, Valor>) => {
    const { tipo, serviciosBase, serviciosReducidos, minimo, modo, alerta, activo } = d;
    const aviso = modo === 'AVISO';
    // Gasolina rige G1 a G3 y diésel G4: el monto de diésel solo se envía si se escribió.
    const descuentos: Record<string, string> = String(d.solesDiesel ?? '') !== '' ? { G4: String(d.solesDiesel) } : {};
    return { tipo, serviciosBase: tipo === 'CONJUNTO' ? [] : serviciosBase, serviciosReducidos, minimo, modo, alerta, activo, descuentos,
      descuentoEstandar: aviso || String(d.pctGasolina ?? '') !== '' ? '0' : d.solesGasolina || '0', porcentaje: aviso ? '' : d.pctGasolina, porcentajeDiesel: aviso ? '' : d.pctDiesel };
  };

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <TablaMaestro<Solape>
        titulo="Solapamientos de servicios" uno="solapamiento" filas={filas} puedeEditar={nivel !== 'V'} alCambiar={cargar} modalAncho
        columnas={[
          { titulo: 'Código', texto: (x) => x.codigo },
          { titulo: 'Tipo', texto: (x) => (x.tipo === 'CONJUNTO' ? `Conjunto (desde ${x.minimo})` : 'Par') },
          { titulo: 'Servicio base', texto: (x) => (x.tipo === 'CONJUNTO' ? '—' : x.base.join(' · ')), recortar: true },
          { titulo: 'Servicios con descuento', texto: (x) => x.reducidos.join(' · '), recortar: true },
          { titulo: 'Modo', texto: (x) => MODO[x.modo], celda: (x) => <span className={'pill ' + PILL[x.modo]}>{MODO[x.modo]}</span> },
          { titulo: 'Descuento gasolina', texto: (x) => (x.modo === 'AVISO' ? '—' : x.porcentaje ? `${x.porcentaje} %` : soles(x.descuentoEstandar)) },
          { titulo: 'Descuento diésel', texto: (x) => (x.modo === 'AVISO' ? '—' : x.porcentajeDiesel ? `${x.porcentajeDiesel} %` : x.descuentos.G4 != null ? soles(x.descuentos.G4) : 'Igual'), recortar: true },
          { titulo: 'Decisión', texto: (x) => x.estado },
          { titulo: 'Estado', texto: (x) => (x.activo ? 'Activo' : 'Inactivo'), celda: (x) => <span className={'pill ' + (x.activo ? 'verde' : 'rojo')}>{x.activo ? 'Activo' : 'Inactivo'}</span> },
        ]}
        campos={(_, v) => [
          { k: 'tipo', etiqueta: 'Tipo de regla', tipo: 'select', opciones: Object.entries(TIPO) },
          { k: 'modo', etiqueta: 'Modo', tipo: 'select', opciones: Object.entries(MODO) },
          ...(v.tipo === 'CONJUNTO'
            ? [{ k: 'serviciosReducidos', etiqueta: 'Servicios del conjunto', tipo: 'multi' as const, opciones: opcSv, agrupar: arbol, ancha: true },
               { k: 'minimo', etiqueta: 'Desde cuántos servicios', tipo: 'numero' as const }]
            : [{ k: 'serviciosBase', etiqueta: 'Servicios base', tipo: 'multi' as const, opciones: opcSv, agrupar: arbol, ancha: true },
               { k: 'serviciosReducidos', etiqueta: 'Servicios que llevan el descuento', tipo: 'multi' as const, opciones: opcSv, agrupar: arbol, ancha: true }]),
          ...(v.modo === 'AVISO' ? [] : [
            { k: 'pctGasolina', etiqueta: 'Gasolina · % del servicio', tipo: 'numero' as const },
            { k: 'pctDiesel', etiqueta: 'Diésel · % del servicio', tipo: 'numero' as const },
            { k: 'solesGasolina', etiqueta: 'Gasolina · monto fijo (S/)', tipo: 'numero' as const },
            { k: 'solesDiesel', etiqueta: 'Diésel · monto fijo (S/)', tipo: 'numero' as const },
          ]),
          { k: 'activo', etiqueta: 'Activo', tipo: 'check' },
          { k: 'alerta', etiqueta: 'Texto de la alerta ({d} = monto)', tipo: 'area' },
        ]}
        valores={(x) => ({
          tipo: x?.tipo ?? 'PAR', modo: x?.modo ?? 'OPCIONAL', serviciosBase: x?.serviciosBase ?? [], serviciosReducidos: x?.serviciosReducidos ?? [], minimo: String(x?.minimo ?? 2),
          pctGasolina: x?.porcentaje != null ? String(x.porcentaje) : '', pctDiesel: x?.porcentajeDiesel != null ? String(x.porcentajeDiesel) : '',
          solesGasolina: x && !x.porcentaje && x.descuentoEstandar ? String(x.descuentoEstandar) : '', solesDiesel: x?.descuentos.G4 != null ? String(x.descuentos.G4) : '',
          activo: x?.activo ?? true, alerta: x?.alerta ?? '',
        })}
        guardar={(x, d) => (x ? api.editarSolape(x.id, datos(d)) : api.crearSolape(datos(d)))}
        eliminar={nivel === 'A' ? (x) => api.eliminarSolape(x.id) : undefined}
      />
    </>
  );
}
