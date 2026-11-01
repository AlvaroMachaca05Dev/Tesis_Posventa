import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, Cliente, Pais, TipoDocumento } from '../../comun/api';
import { FilaFiltros, useFiltros } from '../../comun/FiltrosColumna';

type Nivel = 'A' | 'E' | 'V';
export const TIPOS: { valor: TipoDocumento; etiqueta: string }[] = [
  { valor: 'DNI', etiqueta: 'DNI' },
  { valor: 'CARNET_EXTRANJERIA', etiqueta: 'Carné de extranjería' },
  { valor: 'RUC', etiqueta: 'RUC' },
];
export const etiquetaDocumento = (t: TipoDocumento) => (t === 'CARNET_EXTRANJERIA' ? 'CE' : t);
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
  const [vehiculosDe, setVehiculosDe] = useState<{ cliente: string; placas: string[] } | null>(null);

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
  const COLUMNAS = ['Documento', 'Cliente', 'Nombre comercial', 'Móvil', 'Vehículos', 'Registro', 'Estado'];
  const { filtros, setFiltros, pasa } = useFiltros<Cliente>([
    (c) => `${etiquetaDocumento(c.tipoDocumento)} ${c.documento}`, (c) => c.nombre, (c) => c.nombreComercial ?? '', movilDe,
    (c) => String(c.vehiculos ?? 0), (c) => fecha(c.creadoEn), (c) => (c.activo ? 'Activo' : 'Eliminado'),
  ]);
  const visibles = clientes.filter((c) => (verEliminados || c.activo) && pasa(c));

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
        {puedeEditar && <button type="button" className="primario chico" onClick={() => setEditando('nuevo')}>+ Cliente</button>}
      </div>
      {vehiculosDe && <p className="ok" role="status">Vehículos de {vehiculosDe.cliente}: {vehiculosDe.placas.length ? vehiculosDe.placas.join(', ') : 'ninguno'}.</p>}
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
              {puedeEditar && <th>Acciones</th>}
              <th>Documento</th>
              <th>Cliente</th>
              <th>Nombre comercial</th>
              <th>Móvil</th>
              <th>Vehículos</th>
              <th>Registro</th>
              <th>Estado</th>
            </tr>
            <FilaFiltros nombres={COLUMNAS} conAcciones={puedeEditar} filtros={filtros} setFiltros={setFiltros} />
          </thead>
          <tbody>
            {visibles.map((c) => (
              <tr key={c.id}>
                {puedeEditar && (
                  <td className="acc">
                    <button type="button" onClick={() => setEditando(c)}>Editar</button>
                    {!c.esGenerico && (
                      <button type="button" className={c.activo ? 'peligro' : ''} onClick={() => void cambiarEstado(c)}>{c.activo ? 'Eliminar' : 'Restaurar'}</button>
                    )}
                    <button type="button" onClick={() => void api.cliente(c.id).then((x) => setVehiculosDe({ cliente: x.nombre, placas: x.vehiculos.map((v) => v.placa) })).catch((e) => setError((e as Error).message))}>Vehículos</button>
                  </td>
                )}
                <td>{`${etiquetaDocumento(c.tipoDocumento)} ${c.documento}`}</td>
                <td>{c.nombre}</td>
                <td className="suave">{c.nombreComercial ?? '—'}</td>
                <td>{movilDe(c)}</td>
                <td>{c.vehiculos ?? 0}</td>
                <td className="suave">{fecha(c.creadoEn)}</td>
                <td><span className={'pill ' + (c.activo ? 'verde' : 'rojo')}>{c.activo ? 'Activo' : 'Eliminado'}</span></td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan={puedeEditar ? 8 : 7} className="suave">No hay clientes que coincidan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormCliente(p: {
  cliente: Cliente | null;
  paises: Pais[];
  paisBase: string;
  error?: string;
  alCancelar: () => void;
  alGuardar: (m: string) => Promise<void>;
  alFallar: (m: string) => void;
}) {
  const c = p.cliente;
  const [tipo, setTipo] = useState<TipoDocumento>(c?.tipoDocumento ?? 'DNI');
  const [documento, setDocumento] = useState(c?.documento ?? '');
  const [nombre, setNombre] = useState(c?.nombre ?? '');
  const [comercial, setComercial] = useState(c?.nombreComercial ?? '');
  const [pais, setPais] = useState(c?.pais ?? p.paisBase);
  const [movil, setMovil] = useState(c?.movil ?? '');
  const [direccion, setDireccion] = useState(c?.direccionFiscal ?? '');
  const [email, setEmail] = useState(c?.email ?? '');
  const [ubigeo, setUbigeo] = useState(c?.ubigeo ?? '');
  const [comentario, setComentario] = useState(c?.comentario ?? '');
  const prefijo = p.paises.find((x) => x.codigo === pais)?.prefijo ?? '';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const datos = { tipoDocumento: tipo, documento, nombre, nombreComercial: comercial, pais, movil, direccionFiscal: direccion, email, ubigeo, comentario };
    try {
      if (c) {
        await api.editarCliente(c.id, datos);
        await p.alGuardar('Cliente guardado.');
      } else {
        await api.crearCliente(datos);
        await p.alGuardar('Cliente creado.');
      }
    } catch (err) {
      p.alFallar((err as Error).message);
    }
  }

  return (
    <div className="fondo-modal">
      <form className="modal-form" role="dialog" aria-modal="true" aria-label={c ? 'Editar cliente' : 'Nuevo cliente'} onSubmit={enviar}>
        <h2>{c ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        {p.error && <p className="error" role="alert">{p.error}</p>}
        <div className="dos-col">
          <div className="campo"><label htmlFor="c-tipo">Tipo de documento</label>
            <select id="c-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)} disabled={c?.esGenerico}>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="c-doc">Número de documento</label>
            <input id="c-doc" value={documento} onChange={(e) => setDocumento(e.target.value)} required disabled={c?.esGenerico} /></div>
          <div className="campo"><label htmlFor="c-nombre">Razón social o nombre</label>
            <input id="c-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required /></div>
          <div className="campo"><label htmlFor="c-comercial">Nombre comercial</label>
            <input id="c-comercial" value={comercial} onChange={(e) => setComercial(e.target.value)} /></div>
          <div className="campo"><label htmlFor="c-pais">País</label>
            <select id="c-pais" value={pais} onChange={(e) => setPais(e.target.value)}>
              {p.paises.map((x) => <option key={x.codigo} value={x.codigo}>{`${x.nombre} (${x.prefijo})`}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="c-movil">Móvil</label>
            <div className="movil">
              <span className="prefijo">{prefijo}</span>
              <input id="c-movil" inputMode="numeric" value={movil} onChange={(e) => setMovil(e.target.value)} placeholder="Sin prefijo" />
            </div></div>
          <div className="campo"><label htmlFor="c-dir">Dirección fiscal</label>
            <input id="c-dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} /></div>
          <div className="campo"><label htmlFor="c-mail">Correo</label>
            <input id="c-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="campo"><label htmlFor="c-ubigeo">Ubigeo</label>
            <input id="c-ubigeo" value={ubigeo} onChange={(e) => setUbigeo(e.target.value)} /></div>
          <div className="campo ancha"><label htmlFor="c-com">Comentario</label>
            <textarea id="c-com" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} /></div>
        </div>
        <div className="fila fin">
          <button type="button" onClick={p.alCancelar}>Cancelar</button>
          <button type="submit" className="primario chico">Guardar cliente</button>
        </div>
      </form>
    </div>
  );
}
