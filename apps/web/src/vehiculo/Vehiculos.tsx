import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, Cliente, Grupo, Marca, Vehiculo } from '../comun/api';
import { useColumnasRedimensionables } from '../comun/useColumnasRedimensionables';
import { FilaFiltros, useFiltros } from '../comun/FiltrosColumna';
import { MenuAcciones } from '../comun/TablaMaestro';
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

  const COLUMNAS = ['Cliente', 'Número de documento', 'Placa', 'Marca', 'Modelo', 'Año', 'Color', 'Grupo', 'Nro. serie', 'Nro. VIN', 'Nro. motor', 'Último kilometraje', 'Registro'];
  const { filtros, setFiltros, pasa } = useFiltros<Vehiculo>([
    (v) => v.cliente.nombre, (v) => v.cliente.documento, (v) => v.placa, (v) => v.marca ?? '', (v) => v.modelo ?? '', (v) => String(v.anio ?? ''), (v) => v.color ?? '', (v) => v.grupo ?? 'Sin grupo',
    (v) => v.nroSerie ?? '', (v) => v.nroVin ?? '', (v) => v.nroMotor ?? '', (v) => String(v.kmActual ?? ''), (v) => fecha(v.creadoEn),
  ]);
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

  return (
    <div className="panel ancho">
      <h1>Vehículos</h1>
      {puedeEditar && <div className="fila fin"><button type="button" className="primario chico" onClick={() => setEditando('nuevo')}>+ Vehículo</button></div>}
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {error && !editando && !lectura && <p className="error" role="alert">{error}</p>}
      {editando && <FormVehiculo vehiculo={editando === 'nuevo' ? null : editando} marcas={marcas} grupos={grupos} error={error} alCancelar={cerrar} alGuardar={exito} alFallar={fallo} />}
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
              {cabecera('Grupo', 'corta')}
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
                <td className="corta">{v.grupo ?? <span className="suave">Sin grupo</span>}</td>
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

export function FormVehiculo(p: { vehiculo: Vehiculo | null; marcas: Marca[]; grupos: Grupo[]; error?: string; alCancelar: () => void; alGuardar: (m: string, vehiculo?: Vehiculo) => Promise<void>; alFallar: (m: string) => void }) {
  const v = p.vehiculo;
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
  const [grupoId, setGrupoId] = useState(v?.grupoFuente === 'MANUAL' ? v.grupoId ?? '' : '');
  const modelos = p.marcas.find((m) => m.nombre.toLowerCase() === marca.trim().toLowerCase())?.modelos ?? [];

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

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!cliente) return p.alFallar('Elige el cliente: búscalo por documento o por nombre.');
    const datos = { clienteId: cliente.id, placa, marca, modelo, anio: anio ? Number(anio) : null, color, nroSerie: serie, nroVin: vin, nroMotor: motor, comentario, codigoMotor, grupoId };
    try {
      if (v) {
        const guardado = await api.editarVehiculo(v.id, datos);
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
    <div className="fondo-modal">
      <form className="modal-form" role="dialog" aria-modal="true" aria-label={v ? 'Editar vehículo' : 'Nuevo vehículo'} onSubmit={enviar}>
        <h2>{v ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
        {p.error && <p className="error" role="alert">{p.error}</p>}
        <div className="dos-col">
          <div className="campo ancha"><label htmlFor="v-cliente">Cliente (documento o nombre)</label>
            <input id="v-cliente" value={cliente && !busca ? `${cliente.documento} · ${cliente.nombre}` : busca} placeholder="Escribe el documento o el nombre"
              onChange={(e) => { const t = e.target.value; if (cliente && !busca) { setCliente(null); setBusca(t.replace(`${cliente.documento} · ${cliente.nombre}`, '')); } else setBusca(t); }}
              onFocus={(e) => e.target.select()} autoComplete="off" />
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
          {campo('v-placa', 'Placa', placa, setPlaca, { required: true })}
          <div className="campo"><label htmlFor="v-marca">Marca</label>
            <select id="v-marca" value={marca} required onChange={(e) => { setMarca(e.target.value); setModelo(''); }}>
              <option value="">Seleccionar…</option>
              {p.marcas.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
              {marca && !p.marcas.some((m) => m.nombre === marca) && <option value={marca}>{marca}</option>}
            </select></div>
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
          <div className="campo ancha"><label htmlFor="v-com">Comentarios</label>
            <textarea id="v-com" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} /></div>
        </div>
        <div className="fila fin">
          <button type="button" onClick={p.alCancelar}>Cancelar</button>
          <button type="submit" className="primario chico">Guardar vehículo</button>
        </div>
      </form>
    </div>
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
