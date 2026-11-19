import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { api, Categoria, Grupo, Pais, Producto, Proveedor, Servicio } from '../comun/api';
import FormTercero from '../comun/FormTercero';
import TablaMaestro, { Valor } from '../comun/TablaMaestro';
import { soles } from '../ordenServicio/ordenServicio.util';

const UNIDADES = ['UND', 'LT', 'GL', 'KG', 'MT', 'JGO', 'PAR', 'KIT'];
const ETIQUETAS = ['Preventivo', 'Correctivo', 'Preventivo / correctivo', 'Adicional'];
const estado = (a: boolean) => <span className={'pill ' + (a ? 'verde' : 'rojo')}>{a ? 'Activo' : 'Inactivo'}</span>;
const cant = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 3 });
type Local = { id: string; nombre: string };
type Incluido = { nombre: string; horas: number; servicioId?: string };

/** RF-009 y RF-010: catálogo de servicios (precio y horas por grupo, RN-08 y RN-09) y de productos con su stock por local. */
export default function Catalogo({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [pestana, setPestana] = useState<'servicios' | 'productos'>('servicios');
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [locales, setLocales] = useState<Local[]>([]);
  const [paises, setPaises] = useState<Pais[]>([]);
  const [paisBase, setPaisBase] = useState('PE');
  const [porLocal, setPorLocal] = useState(() => { try { return localStorage.getItem('posventa-inv-vista') === 'locales'; } catch { return false; } });
  // Ajuste masivo: con la contraseña de quien lo hace se editan las celdas de la tabla (y el stock) sin abrir cada registro.
  const [permiso, setPermiso] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [nuevoProv, setNuevoProv] = useState<{ poner: (k: string, x: Valor) => void } | null>(null);
  const [errorProv, setErrorProv] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const cargar = useCallback(async () => {
    const [s, p] = await Promise.all([api.servicios(), api.productos()]);
    setServicios(s);
    setProductos(p);
  }, []);
  useEffect(() => {
    cargar().catch((e) => setError((e as Error).message));
    api.proveedores().then(setProveedores).catch(() => setProveedores([]));
    api.categorias().then(setCategorias).catch(() => setCategorias([]));
    api.grupos().then((g) => setGrupos(g.filter((x) => x.activo))).catch(() => setGrupos([]));
    api.localesInventario().then(setLocales).catch(() => setLocales([]));
    api.config().then((c) => { setPaises(c.paises); setPaisBase(c.paisPredeterminado); }).catch(() => undefined);
  }, [cargar]);
  const puede = nivel !== 'V';
  const masivo = !!permiso;
  const verLocales = porLocal || masivo;
  const opcProv = (): [string, string][] => [['', 'Ninguno'], ...proveedores.filter((p) => p.activo).map((p) => [p.id, p.nombre] as [string, string])];
  const opcCat = (tipo: 'producto' | 'servicio', actual?: string): [string, string][] => {
    const l = categorias.filter((c) => (c.tipo === tipo || c.tipo === 'ambos') && c.activo).map((c) => c.nombre);
    return [['', 'Sin categoría'], ...(actual && !l.includes(actual) ? [actual, ...l] : l).map((n) => [n, n] as [string, string])];
  };
  const cambiarVista = () => { const n = !porLocal; setPorLocal(n); try { localStorage.setItem('posventa-inv-vista', n ? 'locales' : 'total'); } catch { /* sin almacenamiento */ } };
  const precioG = (x: Servicio, g: string) => (Object.prototype.hasOwnProperty.call(x.preciosGrupo ?? {}, g) ? (x.preciosGrupo[g] == null ? 'No aplica' : soles(x.preciosGrupo[g] as number)) : soles(x.precioEstandar));
  const horasG = (x: Servicio, g: string) => (x.horasGrupo?.[g] != null ? `${x.horasGrupo[g]} h` : '');
  const fallo = (e: unknown) => { setMensaje(''); setError((e as Error).message); if ((e as { status?: number }).status === 403) setPermiso(null); };

  /** Servicio: precios y horas por grupo, ficha (tipo, línea del plan, incluye) y proveedor solo si es externo. */
  const datosServicio = (d: Record<string, Valor>) => {
    const preciosGrupo: Record<string, string> = {};
    const horasGrupo: Record<string, string> = {};
    for (const g of grupos) {
      if (String(d['p_' + g.codigo] ?? '') !== '') preciosGrupo[g.codigo] = String(d['p_' + g.codigo]);
      if (String(d['h_' + g.codigo] ?? '') !== '') horasGrupo[g.codigo] = String(d['h_' + g.codigo]);
    }
    // El precio y las horas «de referencia» salen del primer grupo con dato (ya no se piden aparte).
    const primero = (t: Record<string, string>) => grupos.map((g) => t[g.codigo]).find((v) => v !== undefined && !/^(na|n\/a|no aplica)$/i.test(v));
    const horasNum = Object.values(horasGrupo).map(Number).filter((n) => Number.isFinite(n));
    let incluye: Incluido[] = [];
    try { incluye = JSON.parse(String(d.incluye || '[]')) as Incluido[]; } catch { incluye = []; }
    const out: Record<string, unknown> = {
      preciosGrupo, horasGrupo, precioEstandar: primero(preciosGrupo) ?? '0', horasEstandar: horasNum.length ? String(Math.max(...horasNum)) : '1',
      subservicios: incluye.filter((x) => x.nombre.trim()).map((x) => ({ nombre: x.nombre.trim(), horas: x.horas, servicioId: x.servicioId })),
      externo: !!d.externo, proveedorId: d.externo ? d.proveedorId : '',
    };
    for (const k of ['codigo', 'nombre', 'categoria', 'etiqueta', 'lineaPlan', 'repuestos', 'descripcion']) out[k] = d[k];
    return out;
  };

  /** Ajuste masivo de un servicio: un campo suelto, un precio o unas horas de un grupo. */
  async function ajustarServicio(s: Servicio, campo: string, valor: string, g?: string) {
    const v = valor.trim();
    const cambio: Record<string, unknown> = {};
    if (campo === 'nombre' || campo === 'categoria') {
      if (v === (campo === 'nombre' ? s.nombre : s.categoria) || (campo === 'nombre' && !v)) return;
      cambio[campo] = v;
    } else {
      const tabla: Record<string, string> = {};
      const actual = campo === 'precio' ? s.preciosGrupo : s.horasGrupo;
      for (const [k, x] of Object.entries(actual ?? {})) tabla[k] = x == null ? 'NA' : String(x);
      if ((tabla[g!] ?? '') === v) return;
      if (v === '') delete tabla[g!]; else tabla[g!] = v;
      cambio[campo === 'precio' ? 'preciosGrupo' : 'horasGrupo'] = tabla;
    }
    try { await api.editarServicio(s.id, cambio); setError(''); setMensaje(`${s.nombre}: guardado.`); await cargar(); } catch (e) { fallo(e); await cargar(); }
  }
  async function ajustarProducto(p: Producto, campo: string, valor: string) {
    const v = valor.trim();
    const actual = campo === 'precio' ? String(p.precio) : campo === 'costo' ? (p.costo != null ? String(p.costo) : '') : String((p as unknown as Record<string, unknown>)[campo] ?? '');
    if (v === actual || (campo === 'nombre' && !v)) return;
    try { await api.editarProducto(p.id, { [campo]: v }); setError(''); setMensaje(`${p.nombre}: guardado.`); await cargar(); } catch (e) { fallo(e); await cargar(); }
  }
  async function ajustarStock(p: Producto, l: Local, valor: string) {
    const n = Number(valor.replace(',', '.'));
    if (valor.trim() === '' || !Number.isFinite(n) || n < 0 || n === (p.stock[l.id] ?? 0)) return;
    try {
      await api.ajustarStock(p.id, { localId: l.id, cantidad: n, token: permiso! });
      setError('');
      setMensaje(`Ajuste de inventario: ${p.nombre} en ${l.nombre}, de ${cant(p.stock[l.id] ?? 0)} a ${cant(n)}.`);
      await cargar();
    } catch (e) { fallo(e); }
  }
  const entrada = (clave: string, valor: string, alSalir: (v: string) => void, etiqueta: string, ancho = 'num'): ReactNode => (
    <input aria-label={etiqueta} className={ancho} key={clave} defaultValue={valor} onBlur={(e) => alSalir(e.target.value)} />
  );

  const rejillaGrupos = (v: Record<string, Valor>, poner: (k: string, x: Valor) => void) => (
    <div className="grilla-grupos" role="group" aria-label="Precio y horas por grupo">
      <span /><b>Precio (S/ o «NA»)</b><b>Horas</b>
      {grupos.map((g) => (
        <div key={g.codigo} className="grilla-fila">
          <span>{g.codigo} · {g.nombre}</span>
          <input aria-label={`Precio ${g.codigo}`} inputMode="decimal" value={String(v['p_' + g.codigo] ?? '')} onChange={(e) => poner('p_' + g.codigo, e.target.value)} />
          <input aria-label={`Horas ${g.codigo}`} inputMode="decimal" value={String(v['h_' + g.codigo] ?? '')} onChange={(e) => poner('h_' + g.codigo, e.target.value)} />
        </div>
      ))}
    </div>
  );
  const editorIncluye = (v: Record<string, Valor>, poner: (k: string, x: Valor) => void) => (
    <EditorIncluye valor={String(v.incluye ?? '[]')} servicios={servicios} alCambiar={(x) => poner('incluye', x)} />
  );
  const masProveedor = { titulo: 'Nuevo proveedor', alClic: (poner: (k: string, x: Valor) => void) => setNuevoProv({ poner }) };

  return (
    <div className="panel ancho">
      <h1>Productos y servicios</h1>
      <div className="pestanas" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'servicios'} className={pestana === 'servicios' ? 'on' : ''} onClick={() => setPestana('servicios')}>Servicios</button>
        <button type="button" role="tab" aria-selected={pestana === 'productos'} className={pestana === 'productos' ? 'on' : ''} onClick={() => setPestana('productos')}>Productos</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      <div className="fila">
        {pestana === 'productos' && <button type="button" onClick={cambiarVista} disabled={masivo}>{verLocales ? 'Ver solo el total' : 'Ver por local'}</button>}
        {nivel === 'A' && (masivo
          ? <button type="button" className="primario chico" onClick={() => setPermiso(null)}>Terminar ajuste</button>
          : <button type="button" onClick={() => setPidiendo(true)}>Ajustar detalles de forma masiva</button>)}
      </div>
      {pidiendo && <ConfirmarClave alCancelar={() => setPidiendo(false)} alConfirmar={(t) => { setPermiso(t); setPidiendo(false); setMensaje('Edita las celdas de la tabla y sal de cada una para guardarla.'); }} />}
      {nuevoProv && (
        <FormTercero uno="proveedor" entrada={null} tipoPorDefecto="RUC" paises={paises} paisBase={paisBase} error={errorProv}
          alCancelar={() => { setNuevoProv(null); setErrorProv(''); }}
          alGuardar={async (d) => {
            try {
              const p = await api.crearProveedor(d as unknown as Record<string, unknown>);
              setProveedores((xs) => [...xs, p].sort((a, b) => a.nombre.localeCompare(b.nombre)));
              nuevoProv.poner('proveedorId', p.id);
              setNuevoProv(null); setErrorProv('');
            } catch (e) { setErrorProv((e as Error).message); }
          }} />
      )}
      {pestana === 'servicios' ? (
        <TablaMaestro<Servicio>
          sinTitulo titulo="Servicios" uno="servicio" filas={servicios} puedeEditar={puede && !masivo} alCambiar={cargar} modalAncho
          columnas={[
            { titulo: 'Código', texto: (x) => x.codigo },
            { titulo: 'Servicio', texto: (x) => x.nombre, ancho: 32, celda: (x) => (masivo ? entrada(`n-${x.id}-${x.nombre}`, x.nombre, (v) => void ajustarServicio(x, 'nombre', v), `Nombre de ${x.codigo}`, 'largo') : x.nombre) },
            { titulo: 'Categoría', texto: (x) => x.categoria, celda: (x) => (masivo
              ? <select aria-label={`Categoría de ${x.codigo}`} value={x.categoria} onChange={(e) => void ajustarServicio(x, 'categoria', e.target.value)}>{opcCat('servicio', x.categoria).map(([o, t]) => <option key={o} value={o}>{t}</option>)}</select> : x.categoria) },
            { titulo: 'Tipo', texto: (x) => x.etiqueta ?? '' },
            ...grupos.flatMap((g) => [
              { titulo: `${g.codigo} precio`, texto: (x: Servicio) => precioG(x, g.codigo), celda: (x: Servicio) => (masivo ? entrada(`p-${x.id}-${g.codigo}-${String(x.preciosGrupo[g.codigo])}`, x.preciosGrupo[g.codigo] == null ? (Object.prototype.hasOwnProperty.call(x.preciosGrupo, g.codigo) ? 'NA' : '') : String(x.preciosGrupo[g.codigo]), (v) => void ajustarServicio(x, 'precio', v, g.codigo), `Precio ${g.codigo} de ${x.codigo}`) : precioG(x, g.codigo)) },
              { titulo: `${g.codigo} horas`, texto: (x: Servicio) => horasG(x, g.codigo), celda: (x: Servicio) => (masivo ? entrada(`h-${x.id}-${g.codigo}-${String(x.horasGrupo[g.codigo])}`, x.horasGrupo[g.codigo] != null ? String(x.horasGrupo[g.codigo]) : '', (v) => void ajustarServicio(x, 'horas', v, g.codigo), `Horas ${g.codigo} de ${x.codigo}`) : horasG(x, g.codigo)) },
            ]),
            { titulo: 'Externo', texto: (x) => (x.externo ? `Sí · ${x.proveedor ?? ''}` : 'No'), ancho: 20 },
            { titulo: 'Estado', texto: (x) => (x.activo ? 'Activo' : 'Inactivo'), celda: (x) => estado(x.activo) },
          ]}
          campos={(_, v) => [
            { k: 'codigo', etiqueta: 'Código', requerido: true },
            { k: 'nombre', etiqueta: 'Nombre del servicio', requerido: true },
            { k: 'categoria', etiqueta: 'Categoría', tipo: 'select', opciones: opcCat('servicio', String(v.categoria ?? '')), requerido: true },
            { k: 'etiqueta', etiqueta: 'Tipo de mantenimiento', tipo: 'select', opciones: [['', '—'], ...ETIQUETAS.map((e) => [e, e] as [string, string])] },
            { k: 'lineaPlan', etiqueta: 'Línea del plan' },
            { k: 'grilla', etiqueta: 'Precio y horas por grupo', ancha: true, render: rejillaGrupos },
            { k: 'externo', etiqueta: 'Servicio externo', tipo: 'check' },
            ...(v.externo ? [{ k: 'proveedorId', etiqueta: 'Proveedor del servicio', tipo: 'select' as const, opciones: opcProv(), mas: masProveedor }] : []),
            { k: 'repuestos', etiqueta: 'Repuestos sugeridos', tipo: 'multi', opciones: productos.filter((p) => p.activo).map((p) => [p.nombre, p.nombre] as [string, string]), ancha: true },
            { k: 'incluyeCampo', etiqueta: 'Servicios que incluye (sale en la ficha del servicio)', ancha: true, render: editorIncluye },
            { k: 'descripcion', etiqueta: 'Acciones a realizar (salen en la ficha del servicio)', tipo: 'area' },
          ]}
          valores={(x) => ({
            codigo: x?.codigo ?? '', nombre: x?.nombre ?? '', categoria: x?.categoria ?? '', etiqueta: x?.etiqueta ?? '', lineaPlan: x?.lineaPlan ?? '',
            externo: x?.externo ?? false, proveedorId: x?.proveedorId ?? '', repuestos: x?.repuestos ?? [], descripcion: x?.descripcion ?? '', incluye: JSON.stringify(x?.subservicios ?? []),
            ...Object.fromEntries(grupos.flatMap((g) => [
              ['p_' + g.codigo, x && Object.prototype.hasOwnProperty.call(x.preciosGrupo ?? {}, g.codigo) ? (x.preciosGrupo[g.codigo] == null ? 'NA' : String(x.preciosGrupo[g.codigo])) : ''],
              ['h_' + g.codigo, x?.horasGrupo?.[g.codigo] != null ? String(x.horasGrupo[g.codigo]) : ''],
            ])),
          })}
          guardar={(x, d) => (x ? api.editarServicio(x.id, datosServicio(d)) : api.crearServicio(datosServicio(d)))}
          activo={(x) => x.activo}
          alternar={(x) => api.editarServicio(x.id, { activo: !x.activo })}
          eliminar={(x) => api.eliminarServicio(x.id)}
        />
      ) : (
        <TablaMaestro<Producto>
          sinTitulo titulo="Productos" uno="producto" filas={productos} puedeEditar={puede && !masivo} alCambiar={cargar}
          columnas={[
            { titulo: 'Código', texto: (x) => x.codigo },
            { titulo: 'Producto', texto: (x) => x.nombre, ancho: 30, celda: (x) => (masivo ? entrada(`n-${x.id}-${x.nombre}`, x.nombre, (v) => void ajustarProducto(x, 'nombre', v), `Nombre de ${x.codigo}`, 'largo') : x.nombre) },
            { titulo: 'Referencia', texto: (x) => x.referencia ?? '', ancho: 16, celda: (x) => (masivo ? entrada(`r-${x.id}-${x.referencia ?? ''}`, x.referencia ?? '', (v) => void ajustarProducto(x, 'referencia', v), `Referencia de ${x.codigo}`, 'medio') : x.referencia ?? '—') },
            { titulo: 'Unidad', texto: (x) => x.unidad },
            { titulo: 'Categoría', texto: (x) => x.categoria ?? '', celda: (x) => (masivo
              ? <select aria-label={`Categoría de ${x.codigo}`} value={x.categoria ?? ''} onChange={(e) => void ajustarProducto(x, 'categoria', e.target.value)}>{opcCat('producto', x.categoria ?? undefined).map(([o, t]) => <option key={o} value={o}>{t}</option>)}</select> : x.categoria ?? '—') },
            { titulo: 'Precio', texto: (x) => soles(x.precio), celda: (x) => (masivo ? entrada(`pr-${x.id}-${x.precio}`, String(x.precio), (v) => void ajustarProducto(x, 'precio', v), `Precio de ${x.codigo}`) : soles(x.precio)) },
            { titulo: 'Costo', texto: (x) => (x.costo != null ? soles(x.costo) : ''), celda: (x) => (masivo ? entrada(`co-${x.id}-${x.costo ?? ''}`, x.costo != null ? String(x.costo) : '', (v) => void ajustarProducto(x, 'costo', v), `Costo de ${x.codigo}`) : x.costo != null ? soles(x.costo) : '—') },
            ...(verLocales ? locales.map((l) => ({
              titulo: l.nombre, texto: (x: Producto) => cant(x.stock[l.id] ?? 0),
              celda: (x: Producto) => (masivo
                ? <input aria-label={`Stock de ${x.nombre} en ${l.nombre}`} className="num" key={`${x.id}-${l.id}-${x.stock[l.id] ?? 0}`} defaultValue={x.stock[l.id] ?? 0} inputMode="decimal" onBlur={(e) => void ajustarStock(x, l, e.target.value)} />
                : cant(x.stock[l.id] ?? 0)),
            })) : []),
            { titulo: 'Stock total', texto: (x) => cant(x.stockTotal) },
            { titulo: 'Proveedor', texto: (x) => x.proveedor ?? '', ancho: 20 },
            { titulo: 'Estado', texto: (x) => (x.activo ? 'Activo' : 'Inactivo'), celda: (x) => estado(x.activo) },
          ]}
          campos={(_, v) => [
            { k: 'codigo', etiqueta: 'Código', requerido: true },
            { k: 'nombre', etiqueta: 'Nombre del producto', requerido: true },
            { k: 'referencia', etiqueta: 'Referencia' },
            { k: 'unidad', etiqueta: 'Unidad', tipo: 'select', opciones: UNIDADES.map((u) => [u, u]) },
            { k: 'categoria', etiqueta: 'Categoría', tipo: 'select', opciones: opcCat('producto', String(v.categoria ?? '')) },
            { k: 'marca', etiqueta: 'Marca' },
            { k: 'precio', etiqueta: 'Precio de venta (S/)', tipo: 'numero', requerido: true },
            { k: 'costo', etiqueta: 'Costo (S/)', tipo: 'numero' },
            { k: 'proveedorId', etiqueta: 'Proveedor', tipo: 'select', opciones: opcProv(), mas: masProveedor },
          ]}
          valores={(x) => ({ codigo: x?.codigo ?? '', nombre: x?.nombre ?? '', referencia: x?.referencia ?? '', unidad: x?.unidad ?? 'UND', categoria: x?.categoria ?? '', marca: x?.marca ?? '', precio: x ? String(x.precio) : '', costo: x?.costo != null ? String(x.costo) : '', proveedorId: x?.proveedorId ?? '' })}
          guardar={(x, d) => (x ? api.editarProducto(x.id, d) : api.crearProducto(d))}
          activo={(x) => x.activo}
          alternar={(x) => api.editarProducto(x.id, { activo: !x.activo })}
          eliminar={(x) => api.eliminarProducto(x.id)}
        />
      )}
    </div>
  );
}

/** Servicios que incluye: se eligen del catálogo (traen su tiempo y su precio de referencia) o se escriben a mano; se agregan y quitan como ítems. */
function EditorIncluye(p: { valor: string; servicios: Servicio[]; alCambiar: (v: string) => void }) {
  let filas: Incluido[] = [];
  try { filas = JSON.parse(p.valor || '[]') as Incluido[]; } catch { filas = []; }
  const poner = (x: Incluido[]) => p.alCambiar(JSON.stringify(x));
  const lista = 'incluye-lista';
  const cambiar = (i: number, nombre: string) => {
    const sv = p.servicios.find((s) => s.nombre === nombre);
    poner(filas.map((f, j) => (j !== i ? f : sv ? { nombre: sv.nombre, servicioId: sv.id, horas: sv.horasGrupo?.G1 ?? sv.horasEstandar } : { nombre, horas: f.horas })));
  };
  return (
    <div className="editor-incluye">
      <datalist id={lista}>{p.servicios.filter((s) => s.activo).map((s) => <option key={s.id} value={s.nombre}>{s.codigo}</option>)}</datalist>
      {filas.length > 0 && (
        <table>
          <thead><tr><th>#</th><th>Servicio</th><th>Horas</th><th>Referencia</th><th aria-label="Quitar" /></tr></thead>
          <tbody>
            {filas.map((f, i) => {
              const sv = f.servicioId ? p.servicios.find((s) => s.id === f.servicioId) : undefined;
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><input aria-label={`Servicio incluido ${i + 1}`} className="largo" list={lista} value={f.nombre} onChange={(e) => cambiar(i, e.target.value)} /></td>
                  <td><input aria-label={`Horas del servicio incluido ${i + 1}`} className="num" inputMode="decimal" value={String(f.horas)} onChange={(e) => poner(filas.map((y, j) => (j === i ? { ...y, horas: Number(e.target.value.replace(',', '.')) || 0 } : y)))} /></td>
                  <td className="suave">{sv ? `${sv.codigo} · ${soles(sv.preciosGrupo.G1 ?? sv.precioEstandar)}` : '—'}</td>
                  <td><button type="button" className="quitar" aria-label={`Quitar servicio incluido ${i + 1}`} onClick={() => poner(filas.filter((_, j) => j !== i))}>🗑</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <button type="button" className="chico" onClick={() => poner([...filas, { nombre: '', horas: 0.25 }])}>+ Agregar servicio</button>
    </div>
  );
}

/** El ajuste masivo pide la contraseña de quien lo hace. */
function ConfirmarClave(p: { alCancelar: () => void; alConfirmar: (token: string) => void }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    try { p.alConfirmar((await api.verificarInventario(clave)).token); } catch (x) { setError((x as Error).message); }
  }
  return (
    <div className="fondo-modal">
      <form className="modal-form" role="dialog" aria-modal="true" aria-label="Ajuste masivo" onSubmit={enviar}>
        <h2>Ajuste masivo</h2>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="campo"><label htmlFor="inv-clave">Tu contraseña</label><input id="inv-clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required /></div>
        <div className="fila fin">
          <button type="button" onClick={p.alCancelar}>Cancelar</button>
          <button type="submit" className="primario chico">Confirmar</button>
        </div>
      </form>
    </div>
  );
}
