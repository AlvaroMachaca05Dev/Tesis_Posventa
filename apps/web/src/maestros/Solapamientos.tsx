import { useCallback, useEffect, useState } from 'react';
import { api, Grupo, Servicio, Solape } from '../comun/api';
import TablaMaestro, { Valor } from '../comun/TablaMaestro';
import { soles } from '../ordenServicio/ordenServicio.util';

const MODO: Record<string, string> = { AUTOMATICO: 'Automático', OPCIONAL: 'Opcional', AVISO: 'Aviso' };
const TIPO: Record<string, string> = { PAR: 'Par de servicios', CONJUNTO: 'Conjunto (misma rueda, refrigerante…)' };
const PILL: Record<string, string> = { AUTOMATICO: 'verde', OPCIONAL: 'ambar', AVISO: '' };

/** RF-102: servicios que comparten trabajo; juntos en una ODS, el segundo lleva un descuento en soles. */
export default function Solapamientos({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [filas, setFilas] = useState<Solape[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => setFilas(await api.solapamientos()), []);
  useEffect(() => {
    cargar().catch((e) => setError((e as Error).message));
    api.servicios().then(setServicios).catch(() => setServicios([]));
    api.grupos().then((g) => setGrupos(g.filter((x) => x.activo))).catch(() => setGrupos([]));
  }, [cargar]);
  const opcSv: [string, string][] = servicios.filter((s) => s.activo).map((s) => [s.id, `${s.codigo} · ${s.nombre}`] as [string, string]);
  const porGrupo = (x: Solape) => grupos.filter((g) => x.descuentos[g.codigo] != null).map((g) => `${g.codigo} ${soles(x.descuentos[g.codigo])}`).join(' · ');
  const datos = (d: Record<string, Valor>) => {
    const descuentos: Record<string, string> = {};
    for (const g of grupos) if (String(d['g_' + g.codigo] ?? '') !== '') descuentos[g.codigo] = String(d['g_' + g.codigo]);
    const { tipo, serviciosBase, serviciosReducidos, minimo, modo, descuentoEstandar, horasCompartidas, alerta, estado, activo } = d;
    return { tipo, serviciosBase: tipo === 'CONJUNTO' ? [] : serviciosBase, serviciosReducidos, minimo, modo, descuentoEstandar: modo === 'AVISO' ? '0' : descuentoEstandar, horasCompartidas, alerta, estado, activo, descuentos };
  };

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <TablaMaestro<Solape>
        titulo="Solapamientos de servicios" uno="solapamiento" filas={filas} puedeEditar={nivel !== 'V'} alCambiar={cargar}
        columnas={[
          { titulo: 'Código', texto: (x) => x.codigo },
          { titulo: 'Tipo', texto: (x) => (x.tipo === 'CONJUNTO' ? `Conjunto (desde ${x.minimo})` : 'Par') },
          { titulo: 'Servicio base', texto: (x) => (x.tipo === 'CONJUNTO' ? '—' : x.base.join(' · ')), recortar: true },
          { titulo: 'Servicios con descuento', texto: (x) => x.reducidos.join(' · '), recortar: true },
          { titulo: 'Modo', texto: (x) => MODO[x.modo], celda: (x) => <span className={'pill ' + PILL[x.modo]}>{MODO[x.modo]}</span> },
          { titulo: 'Descuento estándar', texto: (x) => (x.modo === 'AVISO' ? '—' : soles(x.descuentoEstandar)) },
          { titulo: 'Descuento por grupo', texto: porGrupo, recortar: true },
          { titulo: 'Decisión', texto: (x) => x.estado },
          { titulo: 'Estado', texto: (x) => (x.activo ? 'Activo' : 'Inactivo'), celda: (x) => <span className={'pill ' + (x.activo ? 'verde' : 'rojo')}>{x.activo ? 'Activo' : 'Inactivo'}</span> },
        ]}
        campos={(_, v) => [
          { k: 'tipo', etiqueta: 'Tipo de regla', tipo: 'select', opciones: Object.entries(TIPO) },
          { k: 'modo', etiqueta: 'Modo', tipo: 'select', opciones: Object.entries(MODO) },
          ...(v.tipo === 'CONJUNTO'
            ? [{ k: 'serviciosReducidos', etiqueta: 'Servicios del conjunto (Ctrl + clic para elegir varios)', tipo: 'multi' as const, opciones: opcSv, ancha: true },
               { k: 'minimo', etiqueta: 'Desde cuántos servicios', tipo: 'numero' as const }]
            : [{ k: 'serviciosBase', etiqueta: 'Servicios base (basta uno)', tipo: 'multi' as const, opciones: opcSv },
               { k: 'serviciosReducidos', etiqueta: 'Servicios que llevan el descuento', tipo: 'multi' as const, opciones: opcSv }]),
          ...(v.modo === 'AVISO' ? [] : [
            { k: 'descuentoEstandar', etiqueta: 'Descuento estándar (S/, múltiplo de 5)', tipo: 'numero' as const, requerido: true },
            ...grupos.map((g) => ({ k: 'g_' + g.codigo, etiqueta: `Descuento en ${g.codigo} (S/)`, tipo: 'numero' as const })),
          ]),
          { k: 'horasCompartidas', etiqueta: 'Horas compartidas', tipo: 'numero' },
          { k: 'estado', etiqueta: 'Decisión', tipo: 'select', opciones: [['Propuesto', 'Propuesto'], ['Decidido', 'Decidido']] },
          { k: 'activo', etiqueta: 'Activo', tipo: 'check' },
          { k: 'alerta', etiqueta: 'Texto de la alerta ({d} = monto)', tipo: 'area' },
        ]}
        valores={(x) => ({
          tipo: x?.tipo ?? 'PAR', modo: x?.modo ?? 'OPCIONAL', serviciosBase: x?.serviciosBase ?? [], serviciosReducidos: x?.serviciosReducidos ?? [], minimo: String(x?.minimo ?? 2),
          estado: x?.estado ?? 'Propuesto', descuentoEstandar: x ? String(x.descuentoEstandar) : '', horasCompartidas: x?.horasCompartidas != null ? String(x.horasCompartidas) : '', activo: x?.activo ?? true, alerta: x?.alerta ?? '',
          ...Object.fromEntries(grupos.map((g) => ['g_' + g.codigo, x?.descuentos[g.codigo] != null ? String(x.descuentos[g.codigo]) : ''])),
        })}
        guardar={(x, d) => (x ? api.editarSolape(x.id, datos(d)) : api.crearSolape(datos(d)))}
        eliminar={nivel === 'A' ? (x) => api.eliminarSolape(x.id) : undefined}
      />
    </>
  );
}
