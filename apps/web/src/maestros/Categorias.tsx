import { useCallback, useEffect, useState } from 'react';
import { api, Categoria } from '../comun/api';
import TablaMaestro from '../comun/TablaMaestro';

const TIPO: Record<string, string> = { producto: 'Producto', servicio: 'Servicio', ambos: 'Ambos' };

/** Categorías del inventario: una lista para productos y otra para servicios; se eligen al crear cada uno. */
export default function Categorias({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [filas, setFilas] = useState<Categoria[]>([]);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => setFilas(await api.categorias()), []);
  useEffect(() => { cargar().catch((e) => setError((e as Error).message)); }, [cargar]);
  return (
    <div className="panel ancho">
      <h1>Categorías</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <TablaMaestro<Categoria>
        sinTitulo femenino titulo="Categorías" uno="categoría" filas={filas} puedeEditar={nivel !== 'V'} alCambiar={cargar}
        columnas={[
          { titulo: 'Categoría', texto: (x) => x.nombre, ancho: 30 },
          { titulo: 'Tipo de ítem', texto: (x) => TIPO[x.tipo] },
          { titulo: 'En uso', texto: (x) => String(x.usos) },
        ]}
        campos={(x) => [
          { k: 'tipo', etiqueta: 'Tipo de ítem', tipo: 'select', opciones: Object.entries(TIPO) },
          { k: 'nombre', etiqueta: 'Nombre de la categoría', requerido: true },
        ]}
        valores={(x) => ({ tipo: x?.tipo ?? 'producto', nombre: x?.nombre ?? '' })}
        guardar={(x, d) => (x ? api.editarCategoria(x.id, { nombre: d.nombre, tipo: d.tipo }) : api.crearCategoria({ tipo: String(d.tipo), nombre: String(d.nombre) }))}
        eliminar={nivel === 'A' || nivel === 'E' ? (x) => api.eliminarCategoria(x.id) : undefined}
      />
    </div>
  );
}
