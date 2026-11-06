import { useCallback, useEffect, useState } from 'react';
import { api, Proveedor } from '../comun/api';
import TablaMaestro from '../comun/TablaMaestro';
import { TIPOS } from '../cliente/Clientes';
import { largoDocumento, TIPO_CORTO } from '../comun/documento';

/** RF-008: proveedores de compras y de servicios externos. */
export default function Proveedores({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [filas, setFilas] = useState<Proveedor[]>([]);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => setFilas(await api.proveedores()), []);
  useEffect(() => { cargar().catch((e) => setError((e as Error).message)); }, [cargar]);
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
          { titulo: 'Rubro', texto: (x) => x.rubro ?? '', ancho: 20 },
          { titulo: 'Contacto', texto: (x) => x.contacto ?? '', ancho: 18 },
          { titulo: 'Teléfono', texto: (x) => x.telefono ?? '' },
          { titulo: 'Correo', texto: (x) => x.correo ?? '', ancho: 24 },
          { titulo: 'Estado', texto: (x) => (x.activo ? 'Activo' : 'Inactivo'), celda: (x) => <span className={'pill ' + (x.activo ? 'verde' : 'rojo')}>{x.activo ? 'Activo' : 'Inactivo'}</span> },
        ]}
        campos={(_, v) => [
          { k: 'tipoDocumento', etiqueta: 'Tipo de documento', tipo: 'select', opciones: TIPOS.map((t) => [t.valor, t.etiqueta]) },
          { k: 'documento', etiqueta: 'Número de documento', requerido: true, maxLength: largoDocumento(String(v.tipoDocumento)).max, soloDigitos: largoDocumento(String(v.tipoDocumento)).digitos },
          { k: 'nombre', etiqueta: 'Razón social o nombre', requerido: true },
          { k: 'rubro', etiqueta: 'Rubro' },
          { k: 'contacto', etiqueta: 'Contacto' },
          { k: 'telefono', etiqueta: 'Teléfono (9 dígitos)', maxLength: 9, soloDigitos: true },
          { k: 'correo', etiqueta: 'Correo' },
          { k: 'direccion', etiqueta: 'Dirección' },
        ]}
        valores={(x) => ({ tipoDocumento: x?.tipoDocumento ?? 'RUC', documento: x?.documento ?? '', nombre: x?.nombre ?? '', rubro: x?.rubro ?? '', contacto: x?.contacto ?? '', telefono: x?.telefono ?? '', correo: x?.correo ?? '', direccion: x?.direccion ?? '' })}
        guardar={(x, d) => (x ? api.editarProveedor(x.id, d) : api.crearProveedor(d))}
        activo={(x) => x.activo}
        alternar={(x) => api.editarProveedor(x.id, { activo: !x.activo })}
      />
    </>
  );
}
