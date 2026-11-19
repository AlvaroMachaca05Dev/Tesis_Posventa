import { useCallback, useEffect, useState } from 'react';
import { api, Pais, Proveedor } from '../comun/api';
import FormTercero from '../comun/FormTercero';
import TablaMaestro from '../comun/TablaMaestro';
import { TIPO_CORTO } from '../comun/documento';

/** RF-008: proveedores de compras y de servicios externos. */
export default function Proveedores({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [filas, setFilas] = useState<Proveedor[]>([]);
  const [error, setError] = useState('');
  const [paises, setPaises] = useState<Pais[]>([]);
  const [paisBase, setPaisBase] = useState('PE');
  const cargar = useCallback(async () => setFilas(await api.proveedores()), []);
  useEffect(() => {
    Promise.all([cargar(), api.config()])
      .then(([, c]) => { setPaises(c.paises); setPaisBase(c.paisPredeterminado); })
      .catch((e) => setError((e as Error).message));
  }, [cargar]);
  const movilDe = (x: Proveedor) => (x.movil ? `${paises.find((q) => q.codigo === x.pais)?.prefijo ?? ''} ${x.movil}`.trim() : '');
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <TablaMaestro<Proveedor>
        titulo="Proveedores"
        uno="proveedor"
        filas={filas}
        puedeEditar={nivel !== 'V'}
        alCambiar={cargar}
        columnas={[
          { titulo: 'Tipo de documento', texto: (x) => TIPO_CORTO[x.tipoDocumento] ?? x.tipoDocumento },
          { titulo: 'Número de documento', texto: (x) => x.documento },
          { titulo: 'Proveedor', texto: (x) => x.nombre, ancho: 28 },
          { titulo: 'Nombre comercial', texto: (x) => x.nombreComercial ?? '', ancho: 22 },
          { titulo: 'Contacto', texto: (x) => x.contacto ?? '', ancho: 18 },
          { titulo: 'Móvil', texto: movilDe },
          { titulo: 'Correo', texto: (x) => x.email ?? '', ancho: 24 },
          { titulo: 'Estado', texto: (x) => (x.activo ? 'Activo' : 'Inactivo'), celda: (x) => <span className={'pill ' + (x.activo ? 'verde' : 'rojo')}>{x.activo ? 'Activo' : 'Inactivo'}</span> },
        ]}
        formulario={({ fila, error: err, alCancelar, alGuardar }) => (
          <FormTercero uno="proveedor" entrada={fila} tipoPorDefecto="RUC" paises={paises} paisBase={paisBase} error={err} alCancelar={alCancelar} alGuardar={alGuardar} />
        )}
        guardar={(x, d) => (x ? api.editarProveedor(x.id, d) : api.crearProveedor(d))}
        activo={(x) => x.activo}
        alternar={(x) => api.editarProveedor(x.id, { activo: !x.activo })}
        eliminar={(x) => api.eliminarProveedor(x.id)}
      />
    </>
  );
}
