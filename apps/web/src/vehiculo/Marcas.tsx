import { useCallback, useEffect, useState } from 'react';
import { api, Marca } from '../comun/api';
import TablaMaestro from '../comun/TablaMaestro';

/** Marcas de vehículo y sus modelos: lo que se elige en el formulario del vehículo. */
export default function Marcas({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [filas, setFilas] = useState<Marca[]>([]);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => setFilas(await api.marcasVehiculo()), []);
  useEffect(() => { cargar().catch((e) => setError((e as Error).message)); }, [cargar]);
  // Los modelos se escriben uno por línea.
  const aLista = (t: unknown) => String(t ?? '').split('\n').map((m) => m.trim()).filter(Boolean);
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <TablaMaestro<Marca>
        titulo="Marcas de vehículo"
        uno="marca"
        filas={filas}
        puedeEditar={nivel !== 'V'}
        alCambiar={cargar}
        columnas={[
          { titulo: 'Marca', texto: (x) => x.nombre, ancho: 24 },
          { titulo: 'Modelos', texto: (x) => x.modelos.join(', '), ancho: 60 },
          { titulo: 'Cantidad de modelos', texto: (x) => String(x.modelos.length) },
        ]}
        campos={[
          { k: 'nombre', etiqueta: 'Marca *', requerido: true, maxLength: 60, ancha: true },
          { k: 'modelos', etiqueta: 'Modelos (uno por línea)', tipo: 'area', ancha: true },
        ]}
        valores={(x) => ({ nombre: x?.nombre ?? '', modelos: x ? x.modelos.join('\n') : '' })}
        guardar={async (x, d) => {
          const modelos = aLista(d.modelos);
          if (x) return api.editarMarcaVehiculo(x.id, { nombre: d.nombre, modelos });
          const creada = await api.crearMarcaVehiculo(String(d.nombre));
          return modelos.length ? api.editarMarcaVehiculo(creada.id, { modelos }) : creada;
        }}
        eliminar={nivel === 'A' ? (x) => api.eliminarMarcaVehiculo(x.id) : undefined}
      />
    </>
  );
}
