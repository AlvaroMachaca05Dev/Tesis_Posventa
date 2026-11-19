import { useCallback, useEffect, useState } from 'react';
import { api, FamiliaMotor, Grupo } from '../comun/api';
import TablaMaestro from '../comun/TablaMaestro';

type Pestana = 'grupos' | 'familias';

/** RF-100 y RF-101: grupos de vehículos, sus reglas de precio y tiempo (RN-09) y la tabla resultante por grupo. */
export default function Grupos({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [pestana, setPestana] = useState<Pestana>('grupos');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [familias, setFamilias] = useState<FamiliaMotor[]>([]);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => {
    const [g, f] = await Promise.all([api.grupos(), api.familiasMotor()]);
    setGrupos(g);
    setFamilias(f);
  }, []);
  useEffect(() => { cargar().catch((e) => setError((e as Error).message)); }, [cargar]);
  const puede = nivel !== 'V';
  const opcGrupo: [string, string][] = [['', '—'], ...grupos.filter((g) => g.activo).map((g) => [g.id, `${g.codigo} · ${g.nombre}`] as [string, string])];
  const tabs: [Pestana, string][] = [['grupos', 'Grupos'], ['familias', 'Familias de motor']];

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
          eliminar={(x) => api.eliminarGrupo(x.id)}
        />
      )}
      {pestana === 'familias' && (
        <TablaMaestro<FamiliaMotor>
          sinTitulo femenino titulo="Familias de motor" uno="familia" filas={familias} puedeEditar={puede} alCambiar={cargar}
          columnas={[
            { titulo: 'Familia', texto: (x) => x.codigo },
            { titulo: 'Códigos de motor', texto: (x) => x.codigos.join(', '), ancho: 40 },
            { titulo: 'Combustible', texto: (x) => x.combustible ?? (x.grupo === 'G4' ? 'Diésel' : x.grupo ? 'Gasolina' : '') },
            { titulo: 'Litros', texto: (x) => x.litros ?? '' },
            { titulo: 'Grupo', texto: (x) => x.grupo ?? 'Sin grupo' },
          ]}
          campos={[
            { k: 'codigo', etiqueta: 'Familia', requerido: true },
            { k: 'grupoId', etiqueta: 'Grupo', tipo: 'select', opciones: opcGrupo },
            { k: 'combustible', etiqueta: 'Combustible (si lo dejas vacío sale del grupo)', tipo: 'select', opciones: [['', 'Según el grupo'], ['Gasolina', 'Gasolina'], ['Diésel', 'Diésel']] },
            { k: 'litros', etiqueta: 'Litros (ej. 1.6)' },
            { k: 'codigos', etiqueta: 'Códigos de motor (separados por coma)', tipo: 'area', ancha: true },
          ]}
          valores={(x) => ({ codigo: x?.codigo ?? '', grupoId: x?.grupoId ?? '', combustible: x?.combustible ?? '', litros: x?.litros ?? '', codigos: x?.codigos.join(', ') ?? '' })}
          guardar={(x, d) => (x ? api.editarFamilia(x.id, d) : api.crearFamilia(d))}
          eliminar={nivel === 'A' ? (x) => api.eliminarFamilia(x.id) : undefined}
        />
      )}
    </div>
  );
}
