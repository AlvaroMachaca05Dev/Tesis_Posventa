import { useCallback, useEffect, useState } from 'react';
import { api, FamiliaMotor, Grupo, ReglaPrecio, TablaPrecios } from '../comun/api';
import TablaMaestro from '../comun/TablaMaestro';
import { FilaFiltros, useFiltros } from '../comun/FiltrosColumna';
import { soles } from '../ordenServicio/ordenServicio.util';

type Pestana = 'grupos' | 'reglas' | 'precios' | 'familias';
const NIVEL: Record<string, string> = { SERVICIO: 'Del grupo para servicios', GRUPO: 'General del grupo', GLOBAL: 'Todos los grupos' };
const TIPO: Record<string, string> = { FIJAR: 'Fijar', SUMAR: 'Sumar o restar', PORCENTAJE: 'Porcentaje' };
const n = (x: number | null) => (x == null ? '' : String(x));

/** RF-100 y RF-101: grupos de vehículos, sus reglas de precio y tiempo (RN-09) y la tabla resultante por grupo. */
export default function Grupos({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [pestana, setPestana] = useState<Pestana>('grupos');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [reglas, setReglas] = useState<ReglaPrecio[]>([]);
  const [tabla, setTabla] = useState<TablaPrecios | null>(null);
  const [familias, setFamilias] = useState<FamiliaMotor[]>([]);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => {
    const [g, r, t, f] = await Promise.all([api.grupos(), api.reglasPrecio(), api.preciosPorGrupo(), api.familiasMotor()]);
    setGrupos(g);
    setReglas(r);
    setTabla(t);
    setFamilias(f);
  }, []);
  useEffect(() => { cargar().catch((e) => setError((e as Error).message)); }, [cargar]);
  const puede = nivel !== 'V';
  const opcGrupo: [string, string][] = [['', '—'], ...grupos.filter((g) => g.activo).map((g) => [g.id, `${g.codigo} · ${g.nombre}`] as [string, string])];
  const tabs: [Pestana, string][] = [['grupos', 'Grupos'], ['reglas', 'Reglas de precio'], ['precios', 'Precios por grupo'], ['familias', 'Familias de motor']];

  return (
    <div className="panel ancho">
      <h1>Grupos de vehículos</h1>
      <div className="pestanas" role="tablist">
        {tabs.map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={pestana === k} className={pestana === k ? 'on' : ''} onClick={() => setPestana(k)}>{t}</button>)}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {pestana === 'grupos' && (
        <TablaMaestro<Grupo>
          sinTitulo titulo="Grupos" uno="grupo" filas={grupos} puedeEditar={puede} alCambiar={cargar}
          columnas={[
            { titulo: 'Código', texto: (x) => x.codigo },
            { titulo: 'Grupo', texto: (x) => x.nombre, ancho: 20 },
            { titulo: 'Descripción', texto: (x) => x.descripcion ?? '', ancho: 40 },
            { titulo: 'Vehículos', texto: (x) => String(x.vehiculos) },
            { titulo: 'Familias de motor', texto: (x) => String(x.familias) },
            { titulo: 'Reglas', texto: (x) => String(x.reglas) },
            { titulo: 'Estado', texto: (x) => (x.activo ? 'Activo' : 'Quitado'), celda: (x) => <span className={'pill ' + (x.activo ? 'verde' : 'rojo')}>{x.activo ? 'Activo' : 'Quitado'}</span> },
          ]}
          campos={[{ k: 'codigo', etiqueta: 'Código', requerido: true }, { k: 'nombre', etiqueta: 'Nombre', requerido: true }, { k: 'descripcion', etiqueta: 'Descripción', tipo: 'area' }]}
          valores={(x) => ({ codigo: x?.codigo ?? '', nombre: x?.nombre ?? '', descripcion: x?.descripcion ?? '' })}
          guardar={(x, d) => (x ? api.editarGrupo(x.id, d) : api.crearGrupo(d))}
          activo={(x) => x.activo}
          alternar={(x) => api.editarGrupo(x.id, { activo: !x.activo })}
        />
      )}
      {pestana === 'reglas' && (
        <TablaMaestro<ReglaPrecio>
          sinTitulo titulo="Reglas de precio" uno="regla" filas={reglas} puedeEditar={puede} alCambiar={cargar}
          columnas={[
            { titulo: 'Código', texto: (x) => x.codigo },
            { titulo: 'Nivel', texto: (x) => NIVEL[x.nivel] },
            { titulo: 'Grupo', texto: (x) => x.grupo ?? 'Todos' },
            { titulo: 'Servicios', texto: (x) => (x.servicios.length ? x.servicios.join(', ') : 'Todos'), ancho: 32 },
            { titulo: 'Tipo', texto: (x) => TIPO[x.tipo] },
            { titulo: 'Horas', texto: (x) => n(x.horas) },
            { titulo: 'Precio (S/)', texto: (x) => (x.tipo === 'PORCENTAJE' ? `${x.porcentaje} %` : n(x.precio)) },
            { titulo: 'Rango de precio', texto: (x) => (x.precioDesde != null || x.precioHasta != null ? `${x.precioDesde ?? 0} a ${x.precioHasta ?? '…'}` : ''), ancho: 18 },
            { titulo: 'Estado', texto: (x) => (x.activa ? 'Activa' : 'Inactiva'), celda: (x) => <span className={'pill ' + (x.activa ? 'verde' : 'rojo')}>{x.activa ? 'Activa' : 'Inactiva'}</span> },
          ]}
          campos={(_, v) => [
            { k: 'nivel', etiqueta: 'Nivel', tipo: 'select', opciones: Object.entries(NIVEL) },
            ...(v.nivel !== 'GLOBAL' ? [{ k: 'grupoId', etiqueta: 'Grupo', tipo: 'select' as const, opciones: opcGrupo, requerido: true }] : []),
            { k: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: Object.entries(TIPO) },
            { k: 'servicios', etiqueta: 'Códigos de servicio (vacío = todos)' },
            ...(v.tipo === 'PORCENTAJE'
              ? [{ k: 'porcentaje', etiqueta: 'Porcentaje (negativo = descuento)', tipo: 'numero' as const, requerido: true }]
              : [{ k: 'precio', etiqueta: 'Precio (S/, múltiplo de 5)', tipo: 'numero' as const }, { k: 'horas', etiqueta: 'Horas (de 0,25 en 0,25)', tipo: 'numero' as const }]),
            { k: 'precioDesde', etiqueta: 'Aplica desde S/', tipo: 'numero' },
            { k: 'precioHasta', etiqueta: 'Aplica hasta S/', tipo: 'numero' },
            { k: 'activa', etiqueta: 'Activa', tipo: 'check' },
            { k: 'nota', etiqueta: 'Nota', tipo: 'area' },
          ]}
          valores={(x) => ({ nivel: x?.nivel ?? 'SERVICIO', grupoId: x?.grupoId ?? '', tipo: x?.tipo ?? 'SUMAR', servicios: x?.servicios.join(', ') ?? '', precio: n(x?.precio ?? null), horas: n(x?.horas ?? null), porcentaje: n(x?.porcentaje ?? null), precioDesde: n(x?.precioDesde ?? null), precioHasta: n(x?.precioHasta ?? null), activa: x?.activa ?? true, nota: x?.nota ?? '' })}
          guardar={(x, d) => (x ? api.editarRegla(x.id, d) : api.crearRegla(d))}
          eliminar={nivel === 'A' ? (x) => api.eliminarRegla(x.id) : undefined}
        />
      )}
      {pestana === 'precios' && tabla && <TablaPreciosGrupo tabla={tabla} />}
      {pestana === 'familias' && <TablaFamilias familias={familias} />}
    </div>
  );
}

function TablaPreciosGrupo({ tabla }: { tabla: TablaPrecios }) {
  type Fila = TablaPrecios['filas'][number];
  const celda = (x: { horas: number; precio: number } | null) => (x ? `${soles(x.precio)} · ${x.horas} h` : 'No aplica');
  const nombres = ['Código', 'Servicio', 'Estándar', ...tabla.grupos];
  const { filtros, setFiltros, pasa } = useFiltros<Fila>([(f) => f.codigo, (f) => f.nombre, (f) => celda(f.estandar), ...tabla.grupos.map((g) => (f: Fila) => celda(f.porGrupo[g]))]);
  return (
    <div className="tabla">
      <table>
        <thead>
          <tr>{nombres.map((x) => <th key={x}>{x}</th>)}</tr>
          <FilaFiltros nombres={nombres} conAcciones={false} filtros={filtros} setFiltros={setFiltros} />
        </thead>
        <tbody>
          {tabla.filas.filter(pasa).map((f) => (
            <tr key={f.servicioId}>
              <td>{f.codigo}</td><td>{f.nombre}</td><td>{celda(f.estandar)}</td>
              {tabla.grupos.map((g) => {
                const c = f.porGrupo[g];
                const igual = !!c && c.precio === f.estandar.precio && c.horas === f.estandar.horas;
                return <td key={g} className={igual ? 'suave' : ''}>{celda(c)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaFamilias({ familias }: { familias: FamiliaMotor[] }) {
  const nombres = ['Familia', 'Códigos de motor', 'Combustible', 'Litros', 'Turbo', 'Grupo'];
  const { filtros, setFiltros, pasa } = useFiltros<FamiliaMotor>([(f) => f.codigo, (f) => f.codigos.join(', '), (f) => f.combustible ?? '', (f) => f.litros ?? '', (f) => (f.turbo ? 'Sí' : 'No'), (f) => f.grupo ?? '']);
  return (
    <div className="tabla">
      <table>
        <thead>
          <tr>{nombres.map((x) => <th key={x}>{x}</th>)}</tr>
          <FilaFiltros nombres={nombres} conAcciones={false} filtros={filtros} setFiltros={setFiltros} />
        </thead>
        <tbody>
          {familias.filter(pasa).map((f) => (
            <tr key={f.id}><td>{f.codigo}</td><td>{f.codigos.join(', ')}</td><td>{f.combustible ?? '—'}</td><td>{f.litros ?? '—'}</td><td>{f.turbo ? 'Sí' : 'No'}</td><td>{f.grupo ?? 'Sin grupo'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
