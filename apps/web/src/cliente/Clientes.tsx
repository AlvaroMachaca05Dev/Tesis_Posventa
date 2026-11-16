import { useCallback, useEffect, useState } from 'react';
import { api, Cliente, Pais } from '../comun/api';
import FormTercero from '../comun/FormTercero';
import { FilaFiltros, useFiltros } from '../comun/FiltrosColumna';
import { dejarFiltro } from '../comun/filtroPendiente';
import { useColumnasRedimensionables } from '../comun/useColumnasRedimensionables';
import { MenuAcciones } from '../comun/TablaMaestro';
import { Paginacion, usePaginacion } from '../comun/Paginacion';

type Nivel = 'A' | 'E' | 'V';
export { TIPOS, etiquetaDocumento } from '../comun/documento';
import { etiquetaDocumento } from '../comun/documento';
const fecha = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

export default function Clientes({ nivel }: { nivel: Nivel }) {
  const puedeEditar = nivel === 'A' || nivel === 'E';
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [paises, setPaises] = useState<Pais[]>([]);
  const [paisBase, setPaisBase] = useState('PE');
  const [editando, setEditando] = useState<Cliente | 'nuevo' | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [verEliminados, setVerEliminados] = useState(false);

  const cargar = useCallback(async (texto: string) => {
    setClientes(await api.clientes(texto));
  }, []);
  useEffect(() => {
    Promise.all([cargar(''), api.config()])
      .then(([, c]) => {
        setPaises(c.paises);
        setPaisBase(c.paisPredeterminado);
      })
      .catch((e) => setError((e as Error).message));
  }, [cargar]);

  const movilDe = (c: Cliente) => (c.movil ? `${paises.find((p) => p.codigo === c.pais)?.prefijo ?? ''} ${c.movil}`.trim() : '—');
  const COLUMNAS = ['Tipo de documento', 'Número de documento', 'Cliente', 'Nombre comercial', 'Móvil', 'Vehículos', 'Registro', 'Estado'];
  const { filtros, setFiltros, pasa } = useFiltros<Cliente>([
    (c) => etiquetaDocumento(c.tipoDocumento), (c) => c.documento, (c) => c.nombre, (c) => c.nombreComercial ?? '', movilDe,
    (c) => String(c.vehiculos ?? 0), (c) => fecha(c.creadoEn), (c) => (c.activo ? 'Activo' : 'Eliminado'),
  ]);
  const filtrados = clientes.filter((c) => (verEliminados || c.activo) && pasa(c));
  const { visibles, pagina, setPagina, tam, setTam, total, totalPaginas, inicio, fin } = usePaginacion(filtrados);
  const { anchos, iniciarArrastre } = useColumnasRedimensionables('clientes');
  const cabecera = (nombre: string, clase = '') => (
    <th className={(clase + ' col-redim').trim()} style={anchos[nombre] ? { width: anchos[nombre], maxWidth: anchos[nombre] } : undefined}>
      {nombre}
      <span className="resizer" onMouseDown={iniciarArrastre(nombre, anchos[nombre] ?? 160)} />
    </th>
  );

  async function cambiarEstado(c: Cliente) {
    if (c.activo && !window.confirm(`¿Eliminar a ${c.nombre} de la lista activa? Sus vehículos y su historial se conservan y puedes restaurarlo.`)) return;
    try {
      await api.editarCliente(c.id, { activo: !c.activo });
      setError('');
      setMensaje(c.activo ? 'Cliente eliminado de la lista activa.' : 'Cliente restaurado.');
      await cargar('');
    } catch (err) {
      setMensaje('');
      setError((err as Error).message);
    }
  }

  return (
    <div className="panel ancho">
      <h1>Clientes</h1>
      <div className="fila entre">
        <label className="check"><input type="checkbox" checked={verEliminados} onChange={(e) => setVerEliminados(e.target.checked)} /> Mostrar eliminados</label>
        {puedeEditar && <button type="button" className="primario chico" onClick={() => setEditando('nuevo')}>+ Nuevo</button>}
      </div>
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {error && !editando && <p className="error" role="alert">{error}</p>}
      {editando && (
        <FormCliente
          cliente={editando === 'nuevo' ? null : editando}
          paises={paises}
          paisBase={paisBase}
          error={error}
          alCancelar={() => { setEditando(null); setError(''); }}
          alGuardar={async (m) => {
            setEditando(null);
            setError('');
            setMensaje(m);
            await cargar('');
          }}
          alFallar={(m) => {
            setMensaje('');
            setError(m);
          }}
        />
      )}
      <div className="tabla">
        <table>
          <thead>
            <tr>
              {puedeEditar && cabecera('Acciones')}
              {cabecera('Tipo de documento', 'corta')}
              {cabecera('Número de documento', 'corta')}
              {cabecera('Cliente', 'larga')}
              {cabecera('Nombre comercial', 'larga')}
              {cabecera('Móvil', 'corta')}
              {cabecera('Vehículos', 'corta')}
              {cabecera('Registro', 'corta')}
              {cabecera('Estado', 'corta')}
            </tr>
            <FilaFiltros nombres={COLUMNAS} conAcciones={puedeEditar} filtros={filtros} setFiltros={setFiltros} />
          </thead>
          <tbody>
            {visibles.map((c) => (
              <tr key={c.id}>
                {puedeEditar && (
                  <td className="acc">
                    <MenuAcciones>
                      <button type="button" onClick={() => setEditando(c)}>Editar</button>
                      {!c.esGenerico && (
                        <button type="button" className={c.activo ? 'peligro' : ''} onClick={() => void cambiarEstado(c)}>{c.activo ? 'Eliminar' : 'Restaurar'}</button>
                      )}
                      <button type="button" onClick={() => { dejarFiltro('vehiculos', 'Número de documento', c.documento); window.location.hash = '#/vehiculos'; }}>Vehículos</button>
                    </MenuAcciones>
                  </td>
                )}
                <td className="corta">{etiquetaDocumento(c.tipoDocumento)}</td>
                <td className="corta">{c.documento}</td>
                <td className="larga">{c.nombre}</td>
                <td className="suave larga">{c.nombreComercial ?? '—'}</td>
                <td className="corta">{movilDe(c)}</td>
                <td className="corta">{c.vehiculos ?? 0}</td>
                <td className="suave corta">{fecha(c.creadoEn)}</td>
                <td className="corta"><span className={'pill ' + (c.activo ? 'verde' : 'rojo')}>{c.activo ? 'Activo' : 'Eliminado'}</span></td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan={puedeEditar ? 9 : 8} className="suave">No hay clientes que coincidan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Paginacion pagina={pagina} setPagina={setPagina} tam={tam} setTam={setTam} total={total} totalPaginas={totalPaginas} inicio={inicio} fin={fin} />
    </div>
  );
}

export function FormCliente(p: {
  cliente: Cliente | null;
  paises: Pais[];
  paisBase: string;
  error?: string;
  alCancelar: () => void;
  alGuardar: (m: string, cliente?: Cliente) => Promise<void>;
  alFallar: (m: string) => void;
}) {
  const c = p.cliente;
  return (
    <FormTercero
      uno="cliente"
      entrada={c}
      tipoPorDefecto="DNI"
      paises={p.paises}
      paisBase={p.paisBase}
      error={p.error}
      alCancelar={p.alCancelar}
      alGuardar={async (datos) => {
        try {
          if (c) await p.alGuardar('Cliente guardado.', await api.editarCliente(c.id, datos));
          else await p.alGuardar('Cliente creado.', await api.crearCliente(datos));
        } catch (err) {
          p.alFallar((err as Error).message);
        }
      }}
    />
  );
}
