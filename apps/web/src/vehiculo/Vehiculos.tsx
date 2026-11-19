import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, Cliente, Grupo, Marca, Pais, Vehiculo } from '../comun/api';

/** El grupo G4 es diésel; G1 a G3, gasolina. */
const combustibleDe = (v: Vehiculo) => (v.grupo === 'G4' ? 'Diésel' : v.grupo ? 'Gasolina' : '');
import { FormCliente } from '../cliente/Clientes';
import { leerFiltro, olvidarFiltro } from '../comun/filtroPendiente';
import { useColumnasRedimensionables } from '../comun/useColumnasRedimensionables';
import { FilaFiltros, useFiltros } from '../comun/FiltrosColumna';
import { MenuAcciones } from '../comun/TablaMaestro';
import { useConfirmar } from '../comun/Confirmar';
import { Paginacion, usePaginacion } from '../comun/Paginacion';

type Nivel = 'A' | 'E' | 'V';
const fecha = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
const km = (n: number | null) => (n == null ? '—' : `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} km`);

export default function Vehiculos({ nivel }: { nivel: Nivel }) {
  const puedeEditar = nivel === 'A' || nivel === 'E';
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [editando, setEditando] = useState<Vehiculo | 'nuevo' | null>(null);
  const [lectura, setLectura] = useState<Vehiculo | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async (texto: string) => {
    setVehiculos(await api.vehiculos(texto));
  }, []);
  useEffect(() => {
    Promise.all([cargar(''), api.marcasVehiculo()])
      .then(([, m]) => setMarcas(m))
      .catch((e) => setError((e as Error).message));
    api.grupos().then((g) => setGrupos(g.filter((x) => x.activo))).catch(() => setGrupos([]));
  }, [cargar]);

  const COLUMNAS = ['Cliente', 'Número de documento', 'Placa', 'Marca', 'Modelo', 'Año', 'Color', 'Combustible', 'Uso', 'Aceite', 'Plan', 'Nro. serie', 'Nro. VIN', 'Nro. motor', 'Último kilometraje', 'Registro'];
  // Si se llegó desde «Vehículos» de un cliente, el filtro de Número de documento ya viene escrito.
  const [filtroInicial] = useState(() => leerFiltro('vehiculos', COLUMNAS));
  useEffect(() => { olvidarFiltro(); }, []);
  const { filtros, setFiltros, pasa } = useFiltros<Vehiculo>([
    (v) => v.cliente.nombre, (v) => v.cliente.documento, (v) => v.placa, (v) => v.marca ?? '', (v) => v.modelo ?? '', (v) => String(v.anio ?? ''), (v) => v.color ?? '', (v) => combustibleDe(v), (v) => v.uso ?? '', (v) => v.aceite ?? '', (v) => v.planCodigo ?? 'Sin plan',
    (v) => v.nroSerie ?? '', (v) => v.nroVin ?? '', (v) => v.nroMotor ?? '', (v) => String(v.kmActual ?? ''), (v) => fecha(v.creadoEn),
  ], filtroInicial);
  const filtrados = vehiculos.filter(pasa);
  const { visibles, pagina, setPagina, tam, setTam, total, totalPaginas, inicio, fin } = usePaginacion(filtrados);
  const { anchos, iniciarArrastre } = useColumnasRedimensionables('vehiculos');
  const cabecera = (nombre: string, clase = '') => (
    <th className={(clase + ' col-redim').trim()} style={anchos[nombre] ? { width: anchos[nombre], maxWidth: anchos[nombre] } : undefined}>
      {nombre}
      <span className="resizer" onMouseDown={iniciarArrastre(nombre, anchos[nombre] ?? 160)} />
    </th>
  );
  const cerrar = () => { setEditando(null); setLectura(null); setError(''); };
  const exito = async (m: string) => {
    setEditando(null);
    setLectura(null);
    setError('');
    setMensaje(m);
    await cargar('');
  };
  const fallo = (m: string) => {
    setMensaje('');
    setError(m);
  };
  const { preguntar, modal: confirmacion } = useConfirmar();
  async function eliminar(v: Vehiculo) {
    if ((await preguntar({ titulo: `¿Eliminar el vehículo ${v.placa}?`, mensaje: 'Se borra con sus lecturas de kilometraje. Si tiene órdenes o comprobantes no se puede eliminar.' })) === null) return;
    try { await api.eliminarVehiculo(v.id); await exito(`Vehículo ${v.placa} eliminado.`); } catch (e) { fallo((e as Error).message); }
  }

  return (
    <div className="panel ancho">
      <h1>Vehículos</h1>
      {confirmacion}
      {puedeEditar && <div className="fila fin"><button type="button" className="primario chico" onClick={() => setEditando('nuevo')}>+ Nuevo</button></div>}
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {error && !editando && !lectura && <p className="error" role="alert">{error}</p>}
      {editando && <FormVehiculo vehiculo={editando === 'nuevo' ? null : editando} marcas={marcas} grupos={grupos} error={error} alCancelar={cerrar} alGuardar={exito} alFallar={fallo} alCrearMarca={(m) => setMarcas((x) => [...x, m].sort((a, b) => a.nombre.localeCompare(b.nombre)))} />}
      {lectura && <FormKm vehiculo={lectura} error={error} alCancelar={cerrar} alGuardar={exito} alFallar={fallo} />}
      <div className="tabla">
        <table>
          <thead>
            <tr>
              {puedeEditar && cabecera('Acciones')}
              {cabecera('Cliente', 'media')}
              {cabecera('Número de documento', 'corta')}
              {cabecera('Placa', 'corta')}
              {cabecera('Marca', 'media')}
              {cabecera('Modelo', 'media')}
              {cabecera('Año', 'corta')}
              {cabecera('Color', 'corta')}
              {cabecera('Combustible', 'corta')}
              {cabecera('Uso', 'corta')}
              {cabecera('Aceite', 'corta')}
              {cabecera('Plan', 'corta')}
              {cabecera('Nro. serie', 'corta')}
              {cabecera('Nro. VIN', 'corta')}
              {cabecera('Nro. motor', 'corta')}
              {cabecera('Último kilometraje', 'corta')}
              {cabecera('Registro', 'corta')}
            </tr>
            <FilaFiltros nombres={COLUMNAS} conAcciones={puedeEditar} filtros={filtros} setFiltros={setFiltros} />
          </thead>
          <tbody>
            {visibles.map((v) => (
              <tr key={v.id}>
                {puedeEditar && (
                  <td className="acc">
                    <MenuAcciones>
                      <button type="button" onClick={() => { setLectura(null); setEditando(v); }}>Editar</button>
                      <button type="button" onClick={() => { setEditando(null); setLectura(v); }}>Registrar km</button>
                      <button type="button" className="peligro" onClick={() => void eliminar(v)}>Eliminar</button>
                    </MenuAcciones>
                  </td>
                )}
                <td className="media">{v.cliente.nombre}</td>
                <td className="corta">{v.cliente.documento}</td>
                <td className="corta"><b>{v.placa}</b></td>
                <td className="media">{v.marca ?? '—'}</td>
                <td className="media">{v.modelo ?? '—'}</td>
                <td className="corta">{v.anio ?? '—'}</td>
                <td className="suave corta">{v.color ?? '—'}</td>
                <td className="corta">{combustibleDe(v) || '—'}</td>
                <td className="corta">{v.uso ?? <span className="suave">—</span>}</td>
                <td className="corta">{v.aceite ?? <span className="suave">—</span>}</td>
                <td className="corta">{v.planCodigo ? <span className="pill" title={v.plan ?? ''}>{v.planCodigo}</span> : <span className="suave">Sin plan</span>}{v.planCodigo && (!v.uso || !v.aceite) && <span className="suave"> · por confirmar</span>}</td>
                <td className="corta">{v.nroSerie || '—'}</td>
                <td className="corta">{v.nroVin || '—'}</td>
                <td className="corta">{v.nroMotor || '—'}</td>
                <td className="corta">{km(v.kmActual)}</td>
                <td className="suave corta">{fecha(v.creadoEn)}</td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan={puedeEditar ? 14 : 13} className="suave">No hay vehículos que coincidan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Paginacion pagina={pagina} setPagina={setPagina} tam={tam} setTam={setTam} total={total} totalPaginas={totalPaginas} inicio={inicio} fin={fin} />
    </div>
  );
}

export function FormVehiculo(p: { vehiculo: Vehiculo | null; marcas: Marca[]; grupos: Grupo[]; error?: string; inicial?: { uso?: string; aceite?: string; grupoId?: string }; alCancelar: () => void; alGuardar: (m: string, vehiculo?: Vehiculo) => Promise<void>; alFallar: (m: string) => void; alCrearMarca?: (m: Marca) => void }) {
  const v = p.vehiculo;
  // Uso y tipo de aceite: con el combustible (del grupo) definen el plan preventivo del vehículo.
  const [uso, setUso] = useState(v?.uso ?? p.inicial?.uso ?? '');
  const [aceite, setAceite] = useState(v?.aceite ?? p.inicial?.aceite ?? '');
  // Alta rápida desde este modal: «+» junto al cliente abre el formulario de cliente y «+» junto a la marca pide solo el nombre.
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [paises, setPaises] = useState<Pais[]>([]);
  const [paisBase, setPaisBase] = useState('PE');
  const [errorCliente, setErrorCliente] = useState('');
  const [nuevaMarca, setNuevaMarca] = useState(false);
  const [nombreMarca, setNombreMarca] = useState('');
  const [errorMarca, setErrorMarca] = useState('');
  const [marcasNuevas, setMarcasNuevas] = useState<Marca[]>([]);
  const [consultandoPlaca, setConsultandoPlaca] = useState(false);
  const [errorPlaca, setErrorPlaca] = useState('');
  const marcas = [...p.marcas, ...marcasNuevas.filter((n) => !p.marcas.some((m) => m.id === n.id))];
  const [cliente, setCliente] = useState<{ id: string; nombre: string; documento: string } | null>(v ? v.cliente : null);
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const ultima = useRef(0);
  const [placa, setPlaca] = useState(v?.placa ?? '');
  const [marca, setMarca] = useState(v?.marca ?? '');
  const [modelo, setModelo] = useState(v?.modelo ?? '');
  const [anio, setAnio] = useState(v?.anio ? String(v.anio) : '');
  const [color, setColor] = useState(v?.color ?? '');
  const [serie, setSerie] = useState(v?.nroSerie ?? '');
  const [vin, setVin] = useState(v?.nroVin ?? '');
  const [motor, setMotor] = useState(v?.nroMotor ?? '');
  const [comentario, setComentario] = useState(v?.comentario ?? '');
  const [codigoMotor, setCodigoMotor] = useState(v?.codigoMotor ?? '');
  // Grupo: «Automático» lo asigna el sistema por la familia del motor o por marca, modelo y año (RF-100).
  const [grupoId, setGrupoId] = useState(v?.grupoFuente === 'MANUAL' ? v.grupoId ?? '' : p.inicial?.grupoId ?? '');
  const modelos = marcas.find((m) => m.nombre.toLowerCase() === marca.trim().toLowerCase())?.modelos ?? [];

  // Se busca al cliente por documento o nombre; se ve a quién está enlazado antes de elegirlo.
  useEffect(() => {
    const texto = busca.trim();
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    const n = ++ultima.current;
    api.clientes(texto).then((r) => {
      if (n === ultima.current) setResultados(r.slice(0, 8));
    }).catch(() => setResultados([]));
  }, [busca]);

  // «Consultar» trae de la consulta vehicular los datos de la placa y los escribe en el formulario (lo que no llega queda como estaba).
  async function consultarPlaca() {
    setErrorPlaca('');
    setConsultandoPlaca(true);
    try {
      const r = await api.consultarPlaca(placa);
      if (r.marca) { setMarca(r.marca); setModelo(''); }
      if (r.modelo) setModelo(r.modelo);
      if (r.anio) setAnio(String(r.anio));
      if (r.color) setColor(r.color);
      if (r.nroSerie) setSerie(r.nroSerie);
      if (r.nroVin) setVin(r.nroVin);
      if (r.nroMotor) setMotor(r.nroMotor);
      if (r.codigoMotor) setCodigoMotor(r.codigoMotor);
    } catch (e) {
      setErrorPlaca((e as Error).message);
    } finally {
      setConsultandoPlaca(false);
    }
  }
  function abrirNuevoCliente() {
    setErrorCliente('');
    setNuevoCliente(true);
    if (paises.length === 0) api.config().then((c) => { setPaises(c.paises); setPaisBase(c.paisPredeterminado); }).catch((e) => setErrorCliente((e as Error).message));
  }
  async function crearMarca(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const m = await api.crearMarcaVehiculo(nombreMarca);
      setMarcasNuevas((x) => [...x, m]);
      p.alCrearMarca?.(m);
      setMarca(m.nombre);
      setModelo('');
      setNuevaMarca(false);
      setNombreMarca('');
    } catch (err) {
      setErrorMarca((err as Error).message);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!cliente) return p.alFallar('Elige el cliente: búscalo por documento o por nombre.');
    const datos = { clienteId: cliente.id, placa, marca, modelo, anio: anio ? Number(anio) : null, color, nroSerie: serie, nroVin: vin, nroMotor: motor, comentario, codigoMotor, grupoId, uso: uso || null, aceite: aceite || null };
    try {
      if (v) {
        let guardado;
        try { guardado = await api.editarVehiculo(v.id, datos); }
        catch (er) {
          // Cambio de plan de un vehículo ya asignado: se confirma y queda como tramo nuevo de la línea de tiempo.
          if (!/pasa de/.test((er as Error).message) || !window.confirm((er as Error).message)) throw er;
          guardado = await api.editarVehiculo(v.id, { ...datos, confirmarCambioPlan: true });
        }
        await p.alGuardar('Vehículo guardado.', guardado);
      } else {
        const creado = await api.crearVehiculo(datos);
        await p.alGuardar('Vehículo creado.', creado);
      }
    } catch (err) {
      p.alFallar((err as Error).message);
    }
  }

  const campo = (id: string, etiqueta: string, valor: string, cambiar: (x: string) => void, extra: Record<string, unknown> = {}) => (
    <div className="campo"><label htmlFor={id}>{etiqueta}</label><input id={id} value={valor} onChange={(e) => cambiar(e.target.value)} {...extra} /></div>
  );
  return (
    <>
    <div className="fondo-modal">
      <form className="modal-form" role="dialog" aria-modal="true" aria-label={v ? 'Editar vehículo' : 'Nuevo vehículo'} onSubmit={enviar}>
        <h2>{v ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
        {(p.error || errorPlaca) && <p className="error" role="alert">{p.error || errorPlaca}</p>}
        <div className="dos-col">
          <div className="campo ancha"><label htmlFor="v-cliente">Cliente (documento o nombre)</label>
            <div className="con-mas">
              <input id="v-cliente" value={cliente && !busca ? `${cliente.documento} · ${cliente.nombre}` : busca} placeholder="Escribe el documento o el nombre"
                onChange={(e) => { const t = e.target.value; if (cliente && !busca) { setCliente(null); setBusca(t.replace(`${cliente.documento} · ${cliente.nombre}`, '')); } else setBusca(t); }}
                onFocus={(e) => e.target.select()} autoComplete="off" />
              <button type="button" className="mas" aria-label="Crear cliente nuevo" title="Crear cliente nuevo" onClick={abrirNuevoCliente}>+</button>
            </div>
            {resultados.length > 0 && (
              <div className="resultados">
                {resultados.map((c) => (
                  <button type="button" key={c.id} onClick={() => { setCliente({ id: c.id, nombre: c.nombre, documento: c.documento }); setBusca(''); setResultados([]); }}>
                    {`${c.documento} · ${c.nombre}`}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="campo"><label htmlFor="v-placa">Placa</label>
            <div className="con-mas">
              <input id="v-placa" value={placa} required onChange={(e) => { setErrorPlaca(''); setPlaca(e.target.value); }} />
              <button type="button" className="consultar" disabled={consultandoPlaca || placa.replace(/[^A-Za-z0-9]/g, '').length !== 6} onClick={() => void consultarPlaca()}>{consultandoPlaca ? 'Consultando…' : 'Consultar'}</button>
            </div></div>
          <div className="campo"><label htmlFor="v-marca">Marca</label>
            <div className="con-mas">
              <select id="v-marca" value={marca} required onChange={(e) => { setMarca(e.target.value); setModelo(''); }}>
                <option value="">Seleccionar…</option>
                {marcas.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                {marca && !marcas.some((m) => m.nombre === marca) && <option value={marca}>{marca}</option>}
              </select>
              <button type="button" className="mas" aria-label="Crear marca nueva" title="Crear marca nueva" onClick={() => { setErrorMarca(''); setNombreMarca(''); setNuevaMarca(true); }}>+</button>
            </div></div>
          <div className="campo"><label htmlFor="v-modelo">Modelo</label>
            <input id="v-modelo" list="lista-modelos" value={modelo} onChange={(e) => setModelo(e.target.value)} />
            <datalist id="lista-modelos">{modelos.map((m) => <option key={m} value={m} />)}</datalist></div>
          {campo('v-anio', 'Año', anio, setAnio, { inputMode: 'numeric' })}
          {campo('v-color', 'Color', color, setColor)}
          {campo('v-serie', 'Nro. de serie', serie, setSerie)}
          {campo('v-vin', 'Nro. de VIN', vin, setVin)}
          {campo('v-motor', 'Nro. de motor', motor, setMotor)}
          {campo('v-codmotor', 'Código de motor', codigoMotor, setCodigoMotor)}
          <div className="campo"><label htmlFor="v-grupo">Grupo</label>
            <select id="v-grupo" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
              <option value="">{v?.grupo && v.grupoFuente !== 'MANUAL' ? `Automático (${v.grupo})` : 'Automático'}</option>
              {p.grupos.map((g) => <option key={g.id} value={g.id}>{`${g.codigo} · ${g.nombre}`}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="v-uso">Uso</label>
            <select id="v-uso" value={uso} onChange={(e) => setUso(e.target.value)}>
              <option value="">Sin definir</option><option value="Particular">Particular</option><option value="Profesional">Profesional</option>
            </select></div>
          <div className="campo"><label htmlFor="v-aceite">Tipo de aceite</label>
            <select id="v-aceite" value={aceite} onChange={(e) => setAceite(e.target.value)}>
              <option value="">Sin definir</option>{['Mineral', 'Semisintético', 'Sintético', 'Full sintético'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select></div>
          <div className="campo ancha"><label htmlFor="v-com">Comentarios</label>
            <textarea id="v-com" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} /></div>
        </div>
        <div className="fila fin">
          <button type="button" onClick={p.alCancelar}>Cancelar</button>
          <button type="submit" className="primario chico">Guardar vehículo</button>
        </div>
      </form>
    </div>
    {nuevoCliente && (
      <FormCliente cliente={null} paises={paises} paisBase={paisBase} error={errorCliente} alCancelar={() => setNuevoCliente(false)}
        alGuardar={async (_m, c) => {
          if (c) setCliente({ id: c.id, nombre: c.nombre, documento: c.documento });
          setBusca('');
          setResultados([]);
          setNuevoCliente(false);
        }}
        alFallar={setErrorCliente} />
    )}
    {nuevaMarca && (
      <div className="fondo-modal">
        <form className="modal-form" role="dialog" aria-modal="true" aria-label="Nueva marca" onSubmit={crearMarca}>
          <h2>Nueva marca</h2>
          {errorMarca && <p className="error" role="alert">{errorMarca}</p>}
          <div className="campo"><label htmlFor="m-nombre">Nombre de la marca</label>
            <input id="m-nombre" value={nombreMarca} onChange={(e) => setNombreMarca(e.target.value)} maxLength={60} required autoFocus /></div>
          <div className="fila fin">
            <button type="button" onClick={() => setNuevaMarca(false)}>Cancelar</button>
            <button type="submit" className="primario chico">Guardar</button>
          </div>
        </form>
      </div>
    )}
    </>
  );
}

function FormKm(p: { vehiculo: Vehiculo; error?: string; alCancelar: () => void; alGuardar: (m: string) => Promise<void>; alFallar: (m: string) => void }) {
  const [valor, setValor] = useState('');
  const [observacion, setObservacion] = useState('');
  const ahora = new Date();
  const [dia, setDia] = useState(ahora.toISOString().slice(0, 10));
  const [hora, setHora] = useState(ahora.toTimeString().slice(0, 5));
  const [medio, setMedio] = useState('Llamada');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      await api.registrarKm(p.vehiculo.id, Number(valor), observacion, new Date(`${dia}T${hora}`).toISOString(), medio);
      await p.alGuardar('Lectura de kilometraje guardada.');
    } catch (err) {
      p.alFallar((err as Error).message);
    }
  }
  return (
    <div className="fondo-modal">
      <form className="modal-form" role="dialog" aria-modal="true" aria-label={`Kilometraje de ${p.vehiculo.placa}`} onSubmit={enviar}>
        <h2>{`Kilometraje de ${p.vehiculo.placa}`}</h2>
        {p.error && <p className="error" role="alert">{p.error}</p>}
        <p className="suave">Última lectura: {km(p.vehiculo.kmActual)}</p>
        <div className="dos-col">
          <div className="campo"><label htmlFor="v-km">Kilometraje</label><input id="v-km" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} required /></div>
          <div className="campo"><label htmlFor="v-km-medio">Medio</label><select id="v-km-medio" value={medio} onChange={(e) => setMedio(e.target.value)}>{['Llamada', 'WhatsApp', 'En taller', 'Otro'].map((m) => <option key={m}>{m}</option>)}</select></div>
          <div className="campo"><label htmlFor="v-km-dia">Fecha de la consulta</label><input id="v-km-dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} required /></div>
          <div className="campo"><label htmlFor="v-km-hora">Hora</label><input id="v-km-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} required /></div>
          <div className="campo ancha"><label htmlFor="v-km-obs">Observación (opcional)</label><input id="v-km-obs" value={observacion} onChange={(e) => setObservacion(e.target.value)} /></div>
        </div>
        <div className="fila fin">
          <button type="button" onClick={p.alCancelar}>Cancelar</button>
          <button type="submit" className="primario chico">Guardar lectura</button>
        </div>
      </form>
    </div>
  );
}
