import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, Grupo, Producto, Proveedor, Servicio } from '../comun/api';
import TablaMaestro, { Valor } from '../comun/TablaMaestro';
import { soles } from '../ordenServicio/ordenServicio.util';

const UNIDADES = ['UND', 'LT', 'GL', 'KG', 'MT', 'JGO', 'PAR', 'KIT'];
const horas = (h: number) => `${h.toLocaleString('es-PE')} h`;
const estado = (a: boolean) => <span className={'pill ' + (a ? 'verde' : 'rojo')}>{a ? 'Activo' : 'Inactivo'}</span>;
const cant = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 3 });
type Local = { id: string; nombre: string };

/** RF-009 y RF-010: catálogo de servicios (precio y horas por grupo, RN-08 y RN-09) y de productos con su stock por local. */
export default function Catalogo({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [pestana, setPestana] = useState<'servicios' | 'productos'>('servicios');
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [locales, setLocales] = useState<Local[]>([]);
  const [porLocal, setPorLocal] = useState(() => { try { return localStorage.getItem('posventa-inv-vista') === 'locales'; } catch { return false; } });
  const [permiso, setPermiso] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
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
    api.grupos().then((g) => setGrupos(g.filter((x) => x.activo))).catch(() => setGrupos([]));
    api.localesInventario().then(setLocales).catch(() => setLocales([]));
  }, [cargar]);
  const opcProv: [string, string][] = [['', 'Ninguno'], ...proveedores.filter((p) => p.activo).map((p) => [p.id, p.nombre] as [string, string])];
  const puede = nivel !== 'V';
  const editandoStock = !!permiso;
  const verLocales = porLocal || editandoStock;
  const cambiarVista = () => { const n = !porLocal; setPorLocal(n); try { localStorage.setItem('posventa-inv-vista', n ? 'locales' : 'total'); } catch { /* sin almacenamiento */ } };
  const precioGrupo = (x: Servicio, g: string) => (Object.prototype.hasOwnProperty.call(x.preciosGrupo ?? {}, g) ? (x.preciosGrupo[g] == null ? 'No aplica' : soles(x.preciosGrupo[g] as number)) : soles(x.precioEstandar));
  const datosServicio = (d: Record<string, Valor>) => {
    const preciosGrupo: Record<string, string> = {};
    const horasGrupo: Record<string, string> = {};
    for (const g of grupos) {
      if (String(d['p_' + g.codigo] ?? '') !== '') preciosGrupo[g.codigo] = String(d['p_' + g.codigo]);
      if (String(d['h_' + g.codigo] ?? '') !== '') horasGrupo[g.codigo] = String(d['h_' + g.codigo]);
    }
    const out: Record<string, unknown> = { preciosGrupo, horasGrupo };
    for (const k of ['codigo', 'nombre', 'categoria', 'horasEstandar', 'precioEstandar', 'proveedorId', 'externo', 'trabajoMayor', 'repuestos', 'descripcion']) out[k] = d[k];
    return out;
  };

  async function ajustar(p: Producto, l: Local, valor: string) {
    const n = Number(valor.replace(',', '.'));
    if (valor.trim() === '' || !Number.isFinite(n) || n < 0 || n === (p.stock[l.id] ?? 0)) return;
    try {
      await api.ajustarStock(p.id, { localId: l.id, cantidad: n, token: permiso! });
      setError('');
      setMensaje(`Ajuste de inventario: ${p.nombre} en ${l.nombre}, de ${cant(p.stock[l.id] ?? 0)} a ${cant(n)}.`);
      await cargar();
    } catch (e) {
      setMensaje('');
      setError((e as Error).message);
      if ((e as { status?: number }).status === 403) setPermiso(null);
    }
  }

  return (
    <div className="panel ancho">
      <h1>Productos y servicios</h1>
      <div className="pestanas" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'servicios'} className={pestana === 'servicios' ? 'on' : ''} onClick={() => setPestana('servicios')}>Servicios</button>
        <button type="button" role="tab" aria-selected={pestana === 'productos'} className={pestana === 'productos' ? 'on' : ''} onClick={() => setPestana('productos')}>Productos</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {pestana === 'servicios' ? (
        <TablaMaestro<Servicio>
          sinTitulo titulo="Servicios" uno="servicio" filas={servicios} puedeEditar={puede} alCambiar={cargar}
          columnas={[
            { titulo: 'Código', texto: (x) => x.codigo },
            { titulo: 'Servicio', texto: (x) => x.nombre, ancho: 32 },
            { titulo: 'Categoría', texto: (x) => x.categoria },
            ...grupos.map((g) => ({ titulo: g.codigo, texto: (x: Servicio) => precioGrupo(x, g.codigo) })),
            { titulo: 'Horas estándar', texto: (x) => horas(x.horasEstandar) + (x.horasFuente === 'PREDETERMINADA' ? ' (predeterminada)' : '') },
            { titulo: 'Externo', texto: (x) => (x.externo ? `Sí · ${x.proveedor ?? ''}` : 'No'), ancho: 20 },
            { titulo: 'Estado', texto: (x) => (x.activo ? 'Activo' : 'Inactivo'), celda: (x) => estado(x.activo) },
          ]}
          campos={[
            { k: 'codigo', etiqueta: 'Código', requerido: true },
            { k: 'nombre', etiqueta: 'Nombre del servicio', requerido: true },
            { k: 'categoria', etiqueta: 'Categoría técnica', requerido: true },
            { k: 'precioEstandar', etiqueta: 'Precio estándar (S/, vehículo sin grupo)', tipo: 'numero', requerido: true },
            ...grupos.map((g) => ({ k: 'p_' + g.codigo, etiqueta: `Precio ${g.codigo} · ${g.nombre} (S/ o «NA»)` })),
            { k: 'horasEstandar', etiqueta: 'Horas estándar (AutoData)', tipo: 'numero' },
            ...grupos.map((g) => ({ k: 'h_' + g.codigo, etiqueta: `Horas ${g.codigo}`, tipo: 'numero' as const })),
            { k: 'proveedorId', etiqueta: 'Proveedor (servicio externo)', tipo: 'select', opciones: opcProv },
            { k: 'externo', etiqueta: 'Servicio externo', tipo: 'check' },
            { k: 'trabajoMayor', etiqueta: 'Trabajo mayor (horas enteras)', tipo: 'check' },
            { k: 'repuestos', etiqueta: 'Repuestos sugeridos (separados por coma)', ancha: true },
            { k: 'descripcion', etiqueta: 'Descripción', tipo: 'area' },
          ]}
          valores={(x) => ({
            codigo: x?.codigo ?? '', nombre: x?.nombre ?? '', categoria: x?.categoria ?? '', horasEstandar: x ? String(x.horasEstandar) : '', precioEstandar: x ? String(x.precioEstandar) : '',
            proveedorId: x?.proveedorId ?? '', externo: x?.externo ?? false, trabajoMayor: x?.trabajoMayor ?? false, repuestos: x?.repuestos.join(', ') ?? '', descripcion: x?.descripcion ?? '',
            ...Object.fromEntries(grupos.flatMap((g) => [
              ['p_' + g.codigo, x && Object.prototype.hasOwnProperty.call(x.preciosGrupo ?? {}, g.codigo) ? (x.preciosGrupo[g.codigo] == null ? 'NA' : String(x.preciosGrupo[g.codigo])) : ''],
              ['h_' + g.codigo, x?.horasGrupo?.[g.codigo] != null ? String(x.horasGrupo[g.codigo]) : ''],
            ])),
          })}
          guardar={(x, d) => (x ? api.editarServicio(x.id, datosServicio(d)) : api.crearServicio(datosServicio(d)))}
          activo={(x) => x.activo}
          alternar={(x) => api.editarServicio(x.id, { activo: !x.activo })}
        />
      ) : (
        <>
          <div className="fila">
            <button type="button" onClick={cambiarVista} disabled={editandoStock}>{verLocales ? 'Ver solo el total' : 'Ver por local'}</button>
            {nivel === 'A' && (editandoStock
              ? <button type="button" className="primario chico" onClick={() => setPermiso(null)}>Terminar ajuste</button>
              : <button type="button" onClick={() => setPidiendo(true)}>Ajustar inventario</button>)}
          </div>
          {pidiendo && <ConfirmarClave alCancelar={() => setPidiendo(false)} alConfirmar={(t) => { setPermiso(t); setPidiendo(false); setMensaje('Edita el stock de cada local y sal de la celda para guardarlo.'); }} />}
          <TablaMaestro<Producto>
            sinTitulo titulo="Productos" uno="producto" filas={productos} puedeEditar={puede && !editandoStock} alCambiar={cargar}
            columnas={[
              { titulo: 'Código', texto: (x) => x.codigo },
              { titulo: 'Producto', texto: (x) => x.nombre, ancho: 30 },
              { titulo: 'Referencia', texto: (x) => x.referencia ?? '', ancho: 16 },
              { titulo: 'Unidad', texto: (x) => x.unidad },
              { titulo: 'Categoría', texto: (x) => x.categoria ?? '' },
              { titulo: 'Precio', texto: (x) => soles(x.precio) },
              { titulo: 'Costo', texto: (x) => (x.costo != null ? soles(x.costo) : '') },
              ...(verLocales ? locales.map((l) => ({
                titulo: l.nombre, texto: (x: Producto) => cant(x.stock[l.id] ?? 0),
                celda: (x: Producto) => (editandoStock
                  ? <input aria-label={`Stock de ${x.nombre} en ${l.nombre}`} className="num" key={`${x.id}-${l.id}-${x.stock[l.id] ?? 0}`} defaultValue={x.stock[l.id] ?? 0} inputMode="decimal" onBlur={(e) => void ajustar(x, l, e.target.value)} />
                  : cant(x.stock[l.id] ?? 0)),
              })) : []),
              { titulo: 'Stock total', texto: (x) => cant(x.stockTotal) },
              { titulo: 'Proveedor', texto: (x) => x.proveedor ?? '', ancho: 20 },
              { titulo: 'Estado', texto: (x) => (x.activo ? 'Activo' : 'Inactivo'), celda: (x) => estado(x.activo) },
            ]}
            campos={[
              { k: 'codigo', etiqueta: 'Código', requerido: true },
              { k: 'nombre', etiqueta: 'Nombre del producto', requerido: true },
              { k: 'referencia', etiqueta: 'Referencia' },
              { k: 'unidad', etiqueta: 'Unidad', tipo: 'select', opciones: UNIDADES.map((u) => [u, u]) },
              { k: 'categoria', etiqueta: 'Categoría' },
              { k: 'marca', etiqueta: 'Marca' },
              { k: 'precio', etiqueta: 'Precio de venta (S/)', tipo: 'numero', requerido: true },
              { k: 'costo', etiqueta: 'Costo (S/)', tipo: 'numero' },
              { k: 'proveedorId', etiqueta: 'Proveedor', tipo: 'select', opciones: opcProv },
            ]}
            valores={(x) => ({ codigo: x?.codigo ?? '', nombre: x?.nombre ?? '', referencia: x?.referencia ?? '', unidad: x?.unidad ?? 'UND', categoria: x?.categoria ?? '', marca: x?.marca ?? '', precio: x ? String(x.precio) : '', costo: x?.costo != null ? String(x.costo) : '', proveedorId: x?.proveedorId ?? '' })}
            guardar={(x, d) => (x ? api.editarProducto(x.id, d) : api.crearProducto(d))}
            activo={(x) => x.activo}
            alternar={(x) => api.editarProducto(x.id, { activo: !x.activo })}
          />
        </>
      )}
    </div>
  );
}

/** El ajuste de inventario pide la contraseña de quien lo hace. */
function ConfirmarClave(p: { alCancelar: () => void; alConfirmar: (token: string) => void }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    try { p.alConfirmar((await api.verificarInventario(clave)).token); } catch (x) { setError((x as Error).message); }
  }
  return (
    <div className="fondo-modal">
      <form className="modal-form" role="dialog" aria-modal="true" aria-label="Ajuste de inventario" onSubmit={enviar}>
        <h2>Ajuste de inventario</h2>
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
