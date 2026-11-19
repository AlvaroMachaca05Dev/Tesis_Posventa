import { useEffect, useMemo, useRef, useState } from 'react';
import { api, Grupo, LineaLT, LineaTemporal as Datos, Marca, Vehiculo } from '../comun/api';
import { FormVehiculo } from './Vehiculos';

const RECORDAR = 'lt-vehiculo';
const leerUltimo = () => { try { return localStorage.getItem(RECORDAR) ?? ''; } catch { return ''; } };

const kmF = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n).toLocaleString('es-PE')} km`);
const fechaC = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' });
const mesL = (ym: string) => new Date(ym + '-15T12:00:00').toLocaleDateString('es-PE', { month: 'short', year: 'numeric' }).toUpperCase();
const CORTO: Record<string, string> = { SV094: 'Express', SV095: 'Menor', SV096: 'Mayor' };
const ACEITE: Record<string, string> = { M: 'Mineral o semisintético', S: 'Sintético o full sintético' };
const afiCods = ['Limpieza o cambio de bujías (tipo y estado)', 'Revisión de bobinas y chicotes', 'Prueba de presión de bomba', 'Limpieza y mantenimiento de carburador', 'Limpieza de inyectores y obturador / IAC'];

type Fut = Datos['futuras'][number];
const clave = (f: string, n: string) => `${f}|${n}`;
const tipoAceite = (t: string) => (/semi/i.test(t) ? 'M' : /sint[eé]tico/i.test(t) ? 'S' : 'M');
/* Cuándo fue el último cambio de aceite (lista validada en DEC-119): fecha estimada a partir de la fecha de la consulta. */
const CUANDO: [string, string][] = [['', 'No recuerda'], ['semana0', 'Esta semana'], ['semana1', 'La semana pasada'], ['sem23', 'Hace 2 o 3 semanas'], ['mes1', 'El mes pasado'], ['m2', 'Hace 2 meses'], ['m3', 'Hace 3 meses o más'], ['exacta', 'Fecha exacta']];
function fechaCuando(op: string, exacta: string, base: string) {
  const d = new Date(base + 'T12:00:00');
  const dias = (n: number) => d.setDate(d.getDate() - n), mes = (m: number) => { d.setDate(1); d.setMonth(d.getMonth() - m); d.setDate(15); };
  if (op === 'semana0') dias(3); else if (op === 'semana1') dias(9); else if (op === 'sem23') dias(17); else if (op === 'mes1') mes(1); else if (op === 'm2') mes(2); else if (op === 'm3') mes(3); else if (op === 'exacta') return exacta || null; else return null;
  const iso = d.toISOString().slice(0, 10); return iso > base ? base : iso;
}

/** S7 · Línea de tiempo del vehículo: visitas reales (por mes, fecha de salida) y visitas del plan proyectadas; selección para cotizar o recordar. */
export default function LineaTemporal() {
  const [busca, setBusca] = useState('');
  const [opciones, setOpciones] = useState<Vehiculo[]>([]);
  const [vehiculoId, setVehiculoIdBase] = useState(leerUltimo);
  // Vista genérica (sin vehículo): combustible, uso y aceite eligen el plan; la consulta simula el km actual y el último cambio de aceite.
  const [generico, setGenerico] = useState(() => !leerUltimo());
  const [gen, setGen] = useState<{ comb: string; uso: string; aceite: string; km: number | null; aceiteKm: number | null; fecha: string | null; cuando: string; captura: string }>({ comb: 'G', uso: 'Particular', aceite: 'Semisintético', km: null, aceiteKm: null, fecha: null, cuando: '', captura: new Date().toISOString().slice(0, 10) });
  const [consulta, setConsulta] = useState(false);
  const [nota, setNota] = useState<null | { tipo: 'cat' | 'ods'; clave: string; cat?: string; odsId?: string; x: number; y: number }>(null);
  const [simKm, setSimKm] = useState<number | null>(null);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [nuevoVeh, setNuevoVeh] = useState<{ marcas: Marca[]; grupos: Grupo[] } | null>(null);
  const setVehiculoId = (id: string) => { setGenerico(false); setVehiculoIdBase(id); try { localStorage.setItem(RECORDAR, id); } catch { /* sin almacenamiento */ } };
  const [borr, setBorr] = useState<{ uso: string; aceite: string } | null>(null);
  const [editarVeh, setEditarVeh] = useState<{ v: Vehiculo; marcas: Marca[]; grupos: Grupo[] } | null>(null);
  const [completa, setCompleta] = useState(false);
  const [imprimir, setImprimir] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [detalle, setDetalle] = useState(false);
  const [resumen, setResumen] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<null | { tipo: 'cotizar' } | { tipo: 'recordatorio'; texto: string } | { tipo: 'guardar'; codigo: string }>(null);
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listaAbierta) return;
    const t = busca.trim();
    const h = setTimeout(() => { api.vehiculos(t).then((r) => setOpciones([...r].sort((a, b) => a.placa.localeCompare(b.placa)))).catch(() => setOpciones([])); }, t ? 250 : 0);
    return () => clearTimeout(h);
  }, [busca, listaAbierta]);
  useEffect(() => {
    if (!listaAbierta) return;
    const fuera = (e: MouseEvent) => { if (!(e.target as Element).closest?.('.lt-sv')) setListaAbierta(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [listaAbierta]);
  const codigoGen = `${gen.comb}${gen.uso === 'Profesional' ? 'R' : 'P'}-${tipoAceite(gen.aceite)}`;
  useEffect(() => {
    setSel(new Set()); setError(''); setNota(null);
    if (generico) { api.lineaGenerica(codigoGen, { km: gen.km, aceite: gen.aceiteKm, fecha: gen.fecha }).then(setD).catch((e) => { setD(null); setError((e as Error).message); }); return; }
    if (!vehiculoId) return;
    api.lineaTemporal(vehiculoId, borr ?? undefined).then(setD).catch((e) => { setD(null); setError((e as Error).message); });
  }, [vehiculoId, borr, recarga, generico, codigoGen, gen.km, gen.aceiteKm, gen.fecha]);
  async function abrirNuevo() {
    const [marcas, grupos] = await Promise.all([api.marcasVehiculo(), api.grupos()]);
    setNuevoVeh({ marcas, grupos: grupos.filter((g) => g.activo) });
  }
  useEffect(() => { setBorr(null); }, [vehiculoId]);
  useEffect(() => { if (!imprimir) return; const t = setTimeout(() => { window.print(); setImprimir(false); }, 100); return () => clearTimeout(t); }, [imprimir]);
  async function abrirEditar() {
    if (!d?.vehiculo) return;
    const [v, marcas, grupos] = await Promise.all([api.vehiculo(d.vehiculo.id), api.marcasVehiculo(), api.grupos()]);
    setEditarVeh({ v, marcas, grupos: grupos.filter((g) => g.activo) });
  }
  async function guardarUsoAceite() {
    if (!d?.vehiculo || !borr) return;
    try { await api.editarVehiculo(d.vehiculo.id, { uso: borr.uso, aceite: borr.aceite }); setModal(null); setBorr(null); setMensaje('Uso y aceite guardados en el vehículo.'); setRecarga((x) => x + 1); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { if (scroll.current) scroll.current.scrollLeft = scroll.current.scrollWidth; }, [d, detalle]);

  const on = (f: string, n: string) => sel.has(clave(f, n));
  const contar = (f: Fut, cat: string | null) => {
    const L = f.lineas.filter((l) => !cat || l.c === cat), fijas = L.filter((l) => !l.alt), grupos = [...new Set(L.filter((l) => l.alt).map((l) => l.alt as string))];
    return { n: fijas.length + grupos.length, s: fijas.filter((l) => on(f.clave, l.n)).length + grupos.filter((g) => L.some((l) => l.alt === g && on(f.clave, l.n))).length, L };
  };
  /** Marcar en bloque no elige alternativas; elegir una alternativa desmarca la otra en todas las visitas. */
  function poner(f: Fut, lineas: LineaLT[], valor: boolean) {
    setSel((s0) => {
      const s = new Set(s0), una = lineas.length === 1 && lineas[0].alt;
      for (const l of lineas) {
        if (valor && l.alt && !una) continue;
        if (valor && una) d?.futuras.forEach((c) => c.lineas.forEach((o) => { if (o.alt === l.alt && o.n !== l.n) s.delete(clave(c.clave, o.n)); }));
        if (valor) s.add(clave(f.clave, l.n)); else s.delete(clave(f.clave, l.n));
      }
      return s;
    });
  }
  const bloqueada = (n: string) => afiCods.slice(3).includes(n) && afiCods.slice(3).some((o) => o !== n && [...sel].some((k) => k.endsWith('|' + o)));

  const seleccion = useMemo(() => (d ? d.futuras.flatMap((f) => f.lineas.filter((l) => on(f.clave, l.n)).map((l) => ({ f, l }))) : []), [d, sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const unicos = [...new Set(seleccion.map((x) => x.l.n))];
  /** Paquetes completos: cada visita seleccionada entera es su paquete; el afinamiento va aparte (carburado SV071 o inyección SV072). */
  const paquetes = useMemo(() => {
    if (!d) return { paq: [] as string[], sueltos: unicos };
    const completas = d.futuras.filter((f) => { const t = contar(f, null); return t.n > 0 && t.s === t.n; });
    const carb = [...sel].some((k) => k.endsWith('|' + afiCods[3]));
    const paq = [...new Set(completas.flatMap((f) => (f.afinamiento ? [f.paquete, carb ? 'SV071' : 'SV072'] : [f.paquete])))];
    const cubre = new Set(completas.flatMap((f) => f.lineas.map((l) => l.n)));
    const final = paq.filter((k) => !(k === 'SV094' && paq.some((o) => o === 'SV095' || o === 'SV096')));
    return { paq: final, sueltos: unicos.filter((n) => !cubre.has(n)) };
  }, [d, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Servicios ya hechos después de la última visita del plan: descuento en soles proporcional al tiempo (revisiones al 50 %), en múltiplos de 5, sin dejar el paquete en cero. */
  const descuento = (cod: string, precio: number) => {
    if (!d) return 0;
    const ultima = [...d.pasadas].reverse().find((c) => c.paquete);
    if (!ultima) return 0;
    const despues = d.pasadas.flatMap((c) => c.ordenes).filter((o) => o.fecha > ultima.fecha).flatMap((o) => o.servicios.map((x) => x.toLowerCase()));
    const lista = d.futuras.find((f) => f.paquete === cod)?.lineas.filter((l) => !afiCods.includes(l.n)) ?? [];
    const horas = lista.filter((l) => despues.some((x) => x.includes(l.n.toLowerCase().slice(0, 18)))).reduce((a, l) => a + l.h * (/^revisi/i.test(l.n) ? 0.5 : 1), 0);
    const monto = Math.floor((horas * (d.plan?.combustible === 'Diésel' ? 80 : 50)) / 5) * 5;
    return Math.min(monto, Math.max(0, Math.floor((precio - 5) / 5) * 5));
  };
  async function crearCotizacion(porPaquete: boolean) {
    if (!d) return;
    if (!d.vehiculo) { setModal(null); setMensaje('No hay ningún vehículo asignado para guardar esto: elige uno en el buscador o créalo con ＋.'); return; }
    const items: Record<string, unknown>[] = [];
    const nombres = porPaquete ? paquetes.sueltos : unicos;
    if (porPaquete) for (const k of paquetes.paq) { const p = d.precios[k]; if (p) { const ds = descuento(k, p.precio); items.push({ tipo: 'servicio', descripcion: p.nombre, cantidad: p.horas || 1, precio: p.precio, descuentoPct: p.precio > 0 ? Math.round((ds / p.precio) * 10000) / 100 : 0, servicioId: p.id }); } }
    for (const n of nombres) items.push({ tipo: 'servicio', descripcion: n, cantidad: seleccion.find((x) => x.l.n === n)?.l.h || 1, precio: 0 });
    try {
      const c = await api.crearCotizacion({ clienteId: d.vehiculo.cliente.id, vehiculoId: d.vehiculo.id, items, observaciones: 'Desde la línea de tiempo' });
      setModal(null); setSel(new Set()); setError(''); setMensaje(`Cotización ${c.codigo} creada: la ves en Ingresos › Cotizaciones.`);
    } catch (e) { setError((e as Error).message); }
  }
  function recordatorio() {
    if (!d) return;
    const g = new Map<string, { f: Fut; n: string[] }>();
    for (const { f, l } of seleccion) { if (!g.has(f.clave)) g.set(f.clave, { f, n: [] }); if (!g.get(f.clave)!.n.includes(l.n)) g.get(f.clave)!.n.push(l.n); }
    const cuerpo = [...g.values()].map(({ f, n }) => `\n${f.nombre}${f.afinamiento ? ' con afinamiento' : ''}, a los ${f.km.toLocaleString('es-PE')} km (aprox. ${new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}), el cual contiene:\n` + n.map((x) => '• ' + x).join('\n')).join('\n');
    setModal({ tipo: 'recordatorio', texto: `Hola @Nombre 👋\n\nLe saludamos de parte de R Motriz. Pasábamos por aquí para recordarle que, según el plan de mantenimiento preventivo de su vehículo${d.vehiculo ? ' ' + d.vehiculo.placa : ''}, le corresponde el(los) siguiente(s) servicio(s):\n${cuerpo}\n\n¿Desea que le armemos una cotización? Estaremos atentos a su respuesta 😊` });
  }

  const todas = d ? [...new Map([...d.pasadas.flatMap((c) => c.esperadas), ...d.futuras.flatMap((f) => f.lineas)].map((l) => [l.n, l])).values()] : [];
  const enPaq = (k: string, n: string) => !!d && (d.futuras.some((f) => f.paquete === k && f.lineas.some((x) => x.n === n && !afiCods.includes(x.n))) || d.pasadas.some((c) => c.paquete === k && c.esperadas.some((x) => x.n === n)));
  const rk = (l: LineaLT) => { if (afiCods.includes(l.n)) return 5; const i = ['SV094', 'SV095', 'SV096'].findIndex((k) => enPaq(k, l.n)); return i < 0 ? 4 : i; };
  const cats = d ? [...d.categorias].sort((a, b) => Math.min(...todas.filter((l) => l.c === a).map(rk)) - Math.min(...todas.filter((l) => l.c === b).map(rk))) : [];
  const filas = [...todas].sort((a, b) => rk(a) - rk(b) || cats.indexOf(a.c) - cats.indexOf(b.c));
  const cols = d ? [...d.pasadas.map((c) => c.fecha), ...d.futuras.map((f) => f.fecha)] : [];
  const grupos: { k: number; n: number }[] = [];
  if (d) cols.forEach((fecha, i) => { let k = 0; d.tramos.forEach((t, j) => { if (j > 0 && t.corte && (i >= d.pasadas.length || fecha > t.corte)) k = j; }); const u = grupos.at(-1); if (u && u.k === k) u.n++; else grupos.push({ k, n: 1 }); });
  const kmRef = simKm ?? d?.resumen.kmHoy ?? 0;
  if (d && !generico) { d.futuras.forEach((f) => { f.vencido = f.km <= kmRef || f.fecha < d.resumen.hoy; f.porVencer = false; }); const pv = d.futuras.find((f) => !f.vencido); if (pv) pv.porVencer = true; }
  const faltan = (f: Fut) => { const km = f.km - kmRef, dias = Math.max(0, Math.round((new Date(f.fecha).getTime() - new Date(d?.resumen.hoy ?? f.fecha).getTime()) / 86400000)); return d?.plan && km <= dias * (d.plan.km / (d.plan.meses * 30.4375)) ? `faltan ${kmF(km)}` : `faltan ${dias} días`; };
  const fueraPlan = !!d?.plan && d.futuras.filter((f) => f.vencido).length >= d.plan.visitas;
  const ultAceite = d ? (d.resumen.ultimoAceite ?? (() => { const c = [...d.pasadas].reverse().find((x) => x.paquete); return c && c.km != null ? { km: c.km, fecha: c.fecha } : null; })()) : null;
  const proxima = d?.futuras.find((f) => !f.vencido) ?? d?.futuras[0];
  const abrirNota = (e: { currentTarget: Element }, n: { tipo: 'cat' | 'ods'; clave: string; cat?: string; odsId?: string }) => { const r = e.currentTarget.getBoundingClientRect(); setNota({ ...n, x: Math.min(r.left, window.innerWidth - 380), y: Math.min(r.bottom + 6, window.innerHeight - 140) }); };
  const ultVenc = d ? d.futuras.filter((f) => f.vencido).at(-1)?.clave : undefined;
  const claseF = (f: Fut) => 'lt-f' + (f.vencido ? ' lt-venc' : '') + (f.clave === ultVenc ? ' lt-hoy' : '') + (!ultVenc && f.k === 1 ? ' lt-hoy0' : '');

  return (
    <div className={'panel ancho linea-temporal' + (completa ? ' lt-completa' : '')}>
      <div className="lt-cab"><h1>Línea temporal</h1>
        <div className="lt-acc">
          {!generico && <button type="button" className="chico" onClick={() => { setGenerico(true); setSimKm(null); }}>Vista genérica</button>}
          <button type="button" className={'chico' + (resumen ? ' on' : '')} aria-expanded={resumen} onClick={() => setResumen(!resumen)}>{resumen ? '▾' : '▸'} Resumen</button>
          {generico && <button type="button" className="chico" onClick={() => setConsulta(true)}>⏱ Consulta de km</button>}
          <button type="button" className="chico" disabled={!d?.futuras.length} onClick={() => setImprimir(true)}>Imprimir / PDF</button>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {d && resumen && (
        <div className="lt-resumen">
          <div><span>Último cambio de aceite:</span> <b>{ultAceite ? kmF(ultAceite.km) : '—'}</b> <small>{ultAceite && (!generico || gen.km != null) ? `${generico ? '' : 'salida '}${fechaC(ultAceite.fecha)}${generico && gen.cuando && gen.cuando !== 'exacta' ? ' · estimada' : ''}${generico && gen.cuando === 'm3' ? ' · por confirmar' : ''}` : ''}</small></div>
          {generico ? <div><span>Km actual:</span> <b>{gen.km != null ? kmF(gen.km) : '—'}</b> {gen.km != null && <button type="button" className="chico" onClick={() => setGen({ ...gen, km: null, aceiteKm: null, fecha: null, cuando: '' })}>Restablecer</button>}</div>
            : <div><span>Hoy estimado:</span> <b>≈ {kmF(d.resumen.kmHoy)}</b> <small>{d.resumen.rate ? `${d.resumen.rate.toLocaleString('es-PE')} km/mes` : 'sin ritmo'}</small></div>}
          {generico ? <div><span>Plan:</span> <b>{d.plan?.codigo}</b> <small>{d.plan?.nombre}</small></div>
            : <div><span>Última consulta:</span> <b>{kmF(d.resumen.ultimaVisita?.km)}</b> <small>{d.resumen.ultimaVisita ? `${d.resumen.ultimaVisita.fecha} · ODS ${d.resumen.ultimaVisita.codigo}` : ''}</small></div>}
          {generico ? <div><span>Visita:</span> <b>{d.plan ? `${kmF(d.plan.km)} o ${d.plan.meses} ${d.plan.meses === 1 ? 'mes' : 'meses'}` : '—'}</b> <small>{d.plan ? `${d.plan.visitas} visitas` : ''}</small></div>
            : <div><span>Simulación:</span> <input type="number" min={0} step={100} aria-label="Simular kilometraje" className="lt-sim" value={simKm ?? ''} placeholder={String(d.resumen.kmHoy)} onChange={(e) => setSimKm(e.target.value === '' ? null : Number(e.target.value))} /> km</div>}
          {!generico && <div><span>Plan:</span> <b>{d.plan?.codigo ?? 'sin plan'}</b> {d.porConfirmar && <span className="pill">Por confirmar</span>}</div>}
          <div><span>Combustible y uso:</span> <b>{d.plan ? `${d.plan.combustible} · ${d.plan.uso.toLowerCase()}` : '—'}</b> <small>{d.plan ? ACEITE[d.plan.aceite] : ''}</small></div>
          {generico ? <div><span>Horizonte:</span> <b>{d.plan ? `${d.plan.horizonte} ciclo${d.plan.horizonte > 1 ? 's' : ''}` : '—'}</b></div>
            : <div><span>Visita:</span> <b>{d.plan ? `${kmF(d.plan.km)} o ${d.plan.meses} ${d.plan.meses === 1 ? 'mes' : 'meses'}` : '—'}</b> <small>{d.plan ? `${d.plan.visitas} visitas` : ''}</small></div>}
          <div><span>Próxima visita:</span> <b>{proxima ? `${CORTO[proxima.paquete]}${proxima.afinamiento ? ' + afinamiento' : ''}` : '—'}</b> <small>{proxima ? `${kmF(proxima.km)} · ${fechaC(proxima.fecha)} (est.)` : ''}</small></div>
          {generico && <div><span>Afinamiento:</span> <b>{!d.plan ? '—' : d.plan.combustible === 'Diésel' ? 'no lleva' : (() => { const n = d.futuras.slice(0, d.plan.visitas).filter((f) => f.afinamiento).length, porAnio = (n * 12) / (d.plan.meses * d.plan.visitas); return porAnio === 1 ? 'lleva · una vez al año' : porAnio >= 2 ? `lleva · ${porAnio === 2 ? 'dos' : String(porAnio)} veces al año` : `lleva · ${n} por ciclo`; })()}</b></div>}
        </div>
      )}
      <div className="lt-barra">
        <div className="lt-veh">
          <label htmlFor="lt-busca">Vehículo</label>
          <div className="lt-veh-fila">
            <div className="lt-sv">
              <button type="button" id="lt-busca" className="lt-sv-btn" aria-haspopup="listbox" aria-expanded={listaAbierta} onClick={() => setListaAbierta(!listaAbierta)}>
                <span>{d?.vehiculo && !generico ? `${[d.vehiculo.marca, d.vehiculo.modelo].filter(Boolean).join(' ')}, ${d.vehiculo.placa}` : '-Seleccionar vehículo-'}</span><i>▾</i>
              </button>
              {listaAbierta && (
                <div className="lt-sv-panel">
                  <input autoFocus aria-label="Buscar vehículo" placeholder="Buscar vehículo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
                  <div className="lt-sv-lista" role="listbox" aria-label="Vehículos">
                    <button type="button" role="option" aria-selected={generico} className="lt-gen-op" onMouseDown={() => { setGenerico(true); setSimKm(null); setBusca(''); setListaAbierta(false); try { localStorage.removeItem(RECORDAR); } catch { /* sin almacenamiento */ } }}><b>Vista genérica</b><small>sin seleccionar vehículo</small></button>
                    {opciones.map((v) => <button type="button" role="option" aria-selected={!generico && d?.vehiculo?.id === v.id} key={v.id} onMouseDown={() => { setVehiculoId(v.id); setBusca(''); setMensaje(''); setListaAbierta(false); }}><b>{[v.marca, v.modelo].filter(Boolean).join(' ')}{v.marca || v.modelo ? ', ' : ''}{v.placa}</b><small>{v.cliente.nombre}{v.nroVin ? ` · VIN: ${v.nroVin}` : ''}</small></button>)}
                    {!opciones.length && <em className="suave">Buscando…</em>}
                  </div>
                </div>
              )}
            </div>
            <button type="button" className="chico" title="Nuevo vehículo" aria-label="Nuevo vehículo" onClick={() => void abrirNuevo()}>＋</button>
            {!generico && d?.vehiculo && <button type="button" className="chico" title="Editar vehículo" aria-label="Editar vehículo" onClick={() => void abrirEditar()}>✎</button>}
          </div>

        </div>
        {d && <>
          <label className="lt-ua">Combustible<select aria-label="Combustible" disabled={!generico} value={generico ? gen.comb : (d.plan?.combustible === 'Diésel' ? 'D' : 'G')} onChange={(e) => setGen({ ...gen, comb: e.target.value })}><option value="G">Gasolina</option><option value="D">Diésel</option></select></label>
          <label className="lt-ua">Uso<select aria-label="Uso" disabled={!generico && d.asignado} value={generico ? gen.uso : borr?.uso ?? d.vehiculo?.uso ?? ''} onChange={(e) => (generico ? setGen({ ...gen, uso: e.target.value }) : setBorr({ uso: e.target.value, aceite: borr?.aceite ?? d.vehiculo?.aceite ?? '' }))}>{!generico && <option value="">Sin definir</option>}<option value="Particular">Particular</option><option value="Profesional">Profesional</option></select></label>
          <label className="lt-ua">Aceite<select aria-label="Aceite" disabled={!generico && d.asignado} value={generico ? gen.aceite : borr?.aceite ?? d.vehiculo?.aceite ?? ''} onChange={(e) => (generico ? setGen({ ...gen, aceite: e.target.value }) : setBorr({ uso: borr?.uso ?? d.vehiculo?.uso ?? '', aceite: e.target.value }))}>{!generico && <option value="">Sin definir</option>}{['Mineral', 'Semisintético', 'Sintético', 'Full sintético'].map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          <div className="seg lt-vista"><button type="button" className={!detalle ? 'primario' : ''} onClick={() => setDetalle(false)}>Comprimido</button><button type="button" className={detalle ? 'primario' : ''} onClick={() => setDetalle(true)}>Detalle</button></div>
          <button type="button" className="chico" onClick={() => setCompleta(!completa)}>{completa ? 'Salir de pantalla completa' : 'Pantalla completa'}</button>
          <span className="lt-sel"><b className="lt-cnt">{unicos.length} servicios<br />seleccionados</b>
            <button type="button" className="primario chico" disabled={!unicos.length} onClick={recordatorio}>Enviar recordatorio<br />por WhatsApp</button>
            <button type="button" className="chico" disabled={!unicos.length} onClick={() => (!d.vehiculo ? setMensaje('No hay ningún vehículo asignado para guardar esto: elige uno en el buscador o créalo con ＋.') : paquetes.paq.length ? setModal({ tipo: 'cotizar' }) : void crearCotizacion(false))}>＋ Agregar a<br />cotización</button>
            <button type="button" className="chico" disabled title="Disponible con el Espacio de trabajo">Crear tarea<br />de contacto</button>
            {!generico && !d.asignado && <button type="button" className="primario chico" disabled={!borr?.uso || !borr?.aceite} onClick={() => setModal({ tipo: 'guardar', codigo: d.plan?.codigo ?? '' })}>Guardar</button>}
          </span>
        </>}
      </div>
      {d && !d.plan && <p className="suave">El vehículo no tiene plan: registra su uso y tipo de aceite en Vehículos.</p>}
      {d && d.plan && (
        <>
          {fueraPlan && <p className="lt-fuera" role="status"><b>Fuera de plan:</b> lo vencido supera un ciclo completo; se sugiere la revisión completa.</p>}
          <p className="lt-leyenda">✓ Hecho · ○ Pendiente · <span className="lt-v">Vencido</span> · <span className="lt-pv">por vencer</span> · <i className="lt-lr" /> última visita · <i className="lt-ly" /> hoy</p>
          <div className={'lt-scroll' + (detalle ? ' lt-det' : '')} ref={scroll}>
            <table className="lt-m">
              <thead>
                <tr className="lt-plan">{detalle && <th className="lt-cc" />}<th className="lt-k">Plan</th>{grupos.map((g) => { const t = d.tramos[g.k]; return <th key={g.k} colSpan={g.n} className={'lt-pg' + (g.k < d.tramos.length - 1 ? ' lt-cong' : '')}><span className="lt-pw"><b>{t.codigo}</b> <small title={`${d.plan?.nombre ?? ''}`}>desde {t.desde ? `${fechaC(t.desde.fecha)}${t.desde.km != null ? ' · ' + kmF(t.desde.km) : ''}` : '—'}{t.hasta ? ` · hasta ODS ${t.hasta}` : ''}{t.por ? ` · ${t.por}` : ''}</small></span></th>; })}</tr>
                <tr>
                  {detalle && <th className="lt-cc">Categoría</th>}<th className="lt-k">{detalle ? 'Servicio' : 'Categoría'}</th>
                  {d.pasadas.map((c, i) => <th key={c.clave} className={'lt-p' + (i === d.pasadas.length - 1 ? ' lt-ult' : '')}>{mesL(c.mes)}<small>{kmF(c.km)} · {c.ordenes.length} ODS</small>{c.paquete && <small>{c.hechos.length}/{c.esperadas.length} · {CORTO[c.paquete]}</small>}</th>)}
                  {d.futuras.map((f) => { const t = contar(f, null); return (
                    <th key={f.clave} className={claseF(f)}>
                      <label className="lt-hk"><input type="checkbox" checked={t.s === t.n && t.n > 0} onChange={(e) => poner(f, f.lineas, e.target.checked)} aria-label={`Seleccionar la visita de ${f.km} km`} /><b>{kmF(f.km)}</b></label>
                      <small>{fechaC(f.fecha)} · est.{f.vencido && <> · <span className="lt-v">vencido</span></>}{f.porVencer && <> · <span className="lt-pv">por vencer</span></>}</small>{f.porVencer && <small>{faltan(f)}</small>}
                      <small>{t.s}/{t.n} <span title={`${f.nombre}${f.afinamiento ? ' con afinamiento' : ''}`}>ⓘ</span></small>
                    </th>); })}
                </tr>
              </thead>
              <tbody>
                {!detalle && cats.map((cat) => (
                  <tr key={cat}><td className="lt-k"><b>{cat}</b></td>
                    {d.pasadas.map((c, i) => { const L = c.esperadas.filter((l) => l.c === cat), h = L.filter((l) => c.hechos.includes(l.n)).length; return <td key={c.clave} className={'lt-pc' + (i === d.pasadas.length - 1 ? ' lt-ult' : '')}>{L.length > 0 && <button type="button" className={'lt-n ' + (h === L.length ? 'ok' : h ? 'parte' : 'cero')} onClick={(e) => abrirNota(e, { tipo: 'cat', clave: c.clave, cat })}>{h}/{L.length}</button>}</td>; })}
                    {d.futuras.map((f) => { const t = contar(f, cat); return <td key={f.clave} className={claseF(f)}>{t.n > 0 && <label className={'lt-c' + (t.s === t.n ? ' lleno' : t.s ? ' parte' : '')}><input type="checkbox" checked={t.s === t.n} onChange={(e) => poner(f, t.L, e.target.checked)} aria-label={`${cat} en ${f.km} km`} /><button type="button" className="lt-num" onClick={(e) => abrirNota(e, { tipo: 'cat', clave: f.clave, cat })}>{t.s}/{t.n}</button></label>}</td>; })}
                  </tr>
                ))}
                {detalle && filas.map((l) => (
                  <tr key={l.n}><td className="lt-cc"><span className="lt-tag">{l.c}</span></td><td className="lt-k lt-s">{l.n}{l.alt && <sup className="a-elegir" title="A elegir: carburado o inyección">*</sup>}</td>
                    {d.pasadas.map((c, i) => <td key={c.clave} className={'lt-pc' + (i === d.pasadas.length - 1 ? ' lt-ult' : '')}>{c.esperadas.some((x) => x.n === l.n) ? (c.hechos.includes(l.n) ? '✓' : '○') : ''}</td>)}
                    {d.futuras.map((f) => <td key={f.clave} className={claseF(f)}>{f.lineas.some((x) => x.n === l.n) && <input type="checkbox" checked={on(f.clave, l.n)} disabled={!on(f.clave, l.n) && bloqueada(l.n)} onChange={(e) => poner(f, [f.lineas.find((x) => x.n === l.n)!], e.target.checked)} aria-label={`${l.n} en ${f.km} km`} />}</td>)}
                  </tr>
                ))}
                {!generico && <tr className="lt-hist">{detalle && <td className="lt-cc" />}<td className="lt-k"><b>Historial</b></td>
                  {d.pasadas.map((c, i) => <td key={c.clave} className={'lt-pc' + (i === d.pasadas.length - 1 ? ' lt-ult' : '')}>{c.ordenes.map((o) => <button type="button" key={o.id} className="lt-chip" onClick={(e) => abrirNota(e, { tipo: 'ods', clave: c.clave, odsId: o.id })}>#{o.codigo.slice(-5)}{o.km == null && <small> sin km</small>}</button>)}</td>)}
                  {d.futuras.map((f) => <td key={f.clave} className={claseF(f)} />)}
                </tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {modal?.tipo === 'guardar' && d && borr && (
        <div className="fondo-modal"><div className="modal-form" role="alertdialog" aria-modal="true" aria-label="Guardar en el vehículo">
          <h2>Guardar en el vehículo</h2>
          <p>Uso <b>{borr.uso.toLowerCase()}</b> y aceite <b>{borr.aceite.toLowerCase()}</b>: el plan queda en <b>{modal.codigo}</b> para todo el historial. Después, uso y aceite solo se editan desde el vehículo.</p>
          <div className="fila fin"><button type="button" onClick={() => setModal(null)}>Cancelar</button><button type="button" className="primario chico" onClick={() => void guardarUsoAceite()}>Guardar</button></div>
        </div></div>
      )}

      {nota && d && (() => {
        const fut = d.futuras.find((f) => f.clave === nota.clave), pas = d.pasadas.find((c) => c.clave === nota.clave);
        const cerrar = <button type="button" className="lt-x" aria-label="Cerrar" onClick={() => setNota(null)}>✕</button>;
        let cuerpo: JSX.Element | null = null, titulo = '', sub = '';
        if (nota.tipo === 'ods' && pas) {
          const o = pas.ordenes.find((x) => x.id === nota.odsId);
          const NOMBRE: Record<string, string> = { SV094: 'Servicio express', SV095: 'Mantenimiento menor', SV096: 'Mantenimiento mayor' };
          const conAfin = !!o && pas.paquete !== 'SV094' && o.servicios.some((x) => /buj[ií]a|bobina|inyector|carburador|afinamiento/i.test(x));
          if (o) { titulo = `ODS #${o.codigo}`; sub = `${o.fecha}${o.km != null ? ' · ' + kmF(o.km) : ''}`; cuerpo = <><div className="lt-sec"><span>Visita del plan:</span> <b>{pas.paquete ? NOMBRE[pas.paquete] + (conAfin ? ' + afinamiento' : '') : 'Ninguna'}</b></div><div className="lt-sec"><b>Servicios de la ODS</b><ul>{o.servicios.length ? o.servicios.map((x, i) => <li key={i}>{x}</li>) : <li>Sin servicios</li>}</ul></div>{pas.esperadas.length > 0 && <div className="lt-sec"><b>Servicios del plan que sí se cumplieron</b> <span>{pas.hechos.length}/{pas.esperadas.length}</span><ul>{pas.esperadas.map((l) => <li key={l.n} className={pas.hechos.includes(l.n) ? 'ok' : 'no'}>{pas.hechos.includes(l.n) ? '✓' : '○'} {l.n}</li>)}</ul></div>}<footer><a className="boton chico" href="#/ods">Ver ODS</a></footer></>; }
        } else if (fut && nota.cat) {
          const t = contar(fut, nota.cat);
          titulo = nota.cat; sub = `${CORTO[fut.paquete]}${fut.afinamiento ? ' + afinamiento' : ''} · ${kmF(fut.km)}`;
          cuerpo = <><label className="lt-todo"><input type="checkbox" checked={t.s === t.n} onChange={(e) => poner(fut, t.L, e.target.checked)} /> Seleccionar toda la categoría <span>{t.s}/{t.n}</span></label>
            <ul className="lt-checks">{t.L.map((l) => <li key={l.n}><label><input type="checkbox" checked={on(fut.clave, l.n)} disabled={!on(fut.clave, l.n) && bloqueada(l.n)} onChange={(e) => poner(fut, [l], e.target.checked)} /> {l.n}{l.alt && <sup className="a-elegir">*</sup>} <small>{l.h} h</small></label></li>)}</ul></>;
        } else if (pas && nota.cat) {
          const L = pas.esperadas.filter((l) => l.c === nota.cat);
          titulo = nota.cat; sub = `${pas.paquete ? CORTO[pas.paquete] : 'ODS'} · ${kmF(pas.km)} · ${pas.fecha}`;
          cuerpo = <><div className="lt-sec"><b>Hechos en esta visita</b> <span>{L.filter((l) => pas.hechos.includes(l.n)).length}/{L.length}</span></div><ul>{L.map((l) => <li key={l.n} className={pas.hechos.includes(l.n) ? 'ok' : 'no'}>{pas.hechos.includes(l.n) ? '✓' : '○'} {l.n}</li>)}</ul></>;
        }
        return cuerpo && <div className="lt-nota" role="dialog" aria-label={titulo} style={{ left: Math.max(8, nota.x), top: Math.max(8, nota.y) }}><header><div><b>{titulo}</b><small>{sub}</small></div>{cerrar}</header>{cuerpo}</div>;
      })()}
      {consulta && (
        <div className="fondo-modal"><form className="modal-form" role="dialog" aria-modal="true" aria-label="Consulta de kilometraje" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget), km = Number(f.get('km')), ac = f.get('aceite') === '' ? null : Number(f.get('aceite')), cap = String(f.get('captura')), cu = String(f.get('cuando') ?? ''), ex = String(f.get('exacta') ?? '');
          const hoy = new Date().toISOString().slice(0, 10);
          if (!Number.isFinite(km) || km < 0) return setError('Escribe el kilometraje actual.');
          if (ac != null && ac > km) return setError('El último cambio de aceite no puede ser mayor que el kilometraje actual.');
          if (!cap || cap > hoy) return setError('La fecha de la consulta no puede ser futura.');
          if (cu === 'exacta' && (!ex || ex > cap)) return setError('Escribe una fecha exacta que no sea posterior a la consulta.');
          setError(''); setGen({ ...gen, km, aceiteKm: ac, captura: cap, cuando: cu, fecha: fechaCuando(cu, ex, cap) }); setConsulta(false);
        }}>
          <h2>Consulta de kilometraje</h2>
          <div className="dos-col">
            <div className="campo"><label htmlFor="lt-cap">Fecha de la consulta</label><input id="lt-cap" name="captura" type="date" defaultValue={gen.captura} max={new Date().toISOString().slice(0, 10)} required /></div>
            <div className="campo"><label htmlFor="lt-km">Kilometraje actual</label><input id="lt-km" name="km" type="number" min={0} step={1} defaultValue={gen.km ?? ''} required /></div>
            <div className="campo"><label htmlFor="lt-ac">Último cambio de aceite (km)</label><input id="lt-ac" name="aceite" type="number" min={0} step={1} defaultValue={gen.aceiteKm ?? ''} /></div>
            <div className="campo"><label htmlFor="lt-cu">¿Cuándo fue el último cambio de aceite?</label><select id="lt-cu" name="cuando" defaultValue={gen.cuando}>{CUANDO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
            <div className="campo"><label htmlFor="lt-ex">Fecha exacta (si la sabe)</label><input id="lt-ex" name="exacta" type="date" defaultValue={gen.cuando === 'exacta' ? gen.fecha ?? '' : ''} onChange={(e) => { const c = e.currentTarget.form?.elements.namedItem('cuando') as HTMLSelectElement | null; if (c && e.currentTarget.value) c.value = 'exacta'; }} /></div>
          </div>
          <div className="fila fin"><button type="button" onClick={() => setConsulta(false)}>Cancelar</button><button type="submit" className="primario chico">Guardar</button></div>
        </form></div>
      )}
      {nuevoVeh && <FormVehiculo vehiculo={null} marcas={nuevoVeh.marcas} grupos={nuevoVeh.grupos}
        inicial={generico ? { uso: gen.uso, aceite: gen.aceite, grupoId: gen.comb === 'D' ? nuevoVeh.grupos.find((g) => g.codigo === 'G4')?.id : undefined } : undefined}
        alCancelar={() => setNuevoVeh(null)} alFallar={(m) => setError(m)}
        alGuardar={async (m, v) => { setNuevoVeh(null); setMensaje(m); if (v) setVehiculoId(v.id); }} />}
      {editarVeh && <FormVehiculo vehiculo={editarVeh.v} marcas={editarVeh.marcas} grupos={editarVeh.grupos} alCancelar={() => setEditarVeh(null)} alFallar={(m) => setError(m)}
        alGuardar={async (m) => { setEditarVeh(null); setMensaje(m); setRecarga((x) => x + 1); }} />}
      {imprimir && d && d.plan && (
        <div className="lt-print">
          <header><b>R Motriz</b> · Plan de mantenimiento · Próximas visitas · {d.plan.codigo}</header>
          <table className="lt-pr-i"><tbody><tr><td><small>Placa</small>{d.vehiculo?.placa ?? 'Genérico'}</td><td><small>Vehículo</small>{d.vehiculo ? `${d.vehiculo.marca ?? ''} ${d.vehiculo.modelo ?? ''}` : '—'}</td><td><small>Cliente</small>{d.vehiculo?.cliente.nombre ?? '—'}</td><td><small>Plan</small>{d.plan.nombre}</td><td><small>Km estimado hoy</small>≈ {kmF(d.resumen.kmHoy)}</td><td><small>Emitido</small>{fechaC(d.resumen.hoy)}</td></tr></tbody></table>
          <table className="lt-pr-m"><thead><tr><th>Categoría</th><th>Servicio</th>{d.futuras.map((f) => <th key={f.clave}>{CORTO[f.paquete]}{f.afinamiento ? ' + afin.' : ''}<small>{kmF(f.km)}</small><small>{fechaC(f.fecha)}</small></th>)}</tr></thead>
            <tbody>{filas.filter((l) => d.futuras.some((f) => f.lineas.some((x) => x.n === l.n))).map((l) => <tr key={l.n}><td>{l.c}</td><td>{l.n}{l.alt ? '*' : ''}</td>{d.futuras.map((f) => <td key={f.clave}>{f.lineas.some((x) => x.n === l.n) ? '●' : ''}</td>)}</tr>)}</tbody></table>
          <footer>● incluido en la visita · * a elegir: carburado o inyección · km y fechas estimados</footer>
        </div>
      )}
      {modal?.tipo === 'cotizar' && d && (
        <div className="fondo-modal"><div className="modal-form" role="dialog" aria-modal="true" aria-label="Cómo generar la cotización">
          <h2>¿Cómo generar la cotización?</h2>
          <p>{paquetes.paq.length > 1 ? `Hay ${paquetes.paq.length} paquetes del plan en lo que seleccionaste; cada uno va en su propio ítem.` : 'Lo que seleccionaste completa un paquete del plan.'}</p>
          <ul>{paquetes.paq.map((k) => <li key={k}>{d.precios[k]?.codigo} · {d.precios[k]?.nombre} · S/ {d.precios[k]?.precio?.toFixed(2)}{descuento(k, d.precios[k]?.precio ?? 0) > 0 && ` · descuento por servicios hechos −S/ ${descuento(k, d.precios[k]?.precio ?? 0).toFixed(2)}`}</li>)}{paquetes.sueltos.length > 0 && <li>{paquetes.sueltos.length} servicio(s) suelto(s)</li>}</ul>
          <div className="fila fin"><button type="button" onClick={() => setModal(null)}>Cancelar</button><button type="button" onClick={() => void crearCotizacion(false)}>Separar por ítem</button><button type="button" className="primario chico" onClick={() => void crearCotizacion(true)}>Agrupar por paquete</button></div>
        </div></div>
      )}
      {modal?.tipo === 'recordatorio' && d && (
        <div className="fondo-modal"><div className="modal-form lt-rec" role="dialog" aria-modal="true" aria-label="Recordatorio preparado">
          <h2>Recordatorio preparado</h2>
          <textarea rows={16} defaultValue={modal.texto} aria-label="Mensaje" />
          <div className="fila fin">
            {d.vehiculo?.cliente.telefono && <a className="boton primario chico" target="_blank" rel="noreferrer" href={`https://wa.me/${d.vehiculo.cliente.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(modal.texto.replace('@Nombre', d.vehiculo.cliente.nombre.split(' ')[0]))}`}>Abrir WhatsApp</a>}
            <button type="button" onClick={() => setModal(paquetes.paq.length ? { tipo: 'cotizar' } : null)}>Agregar a cotización</button>
            <button type="button" onClick={() => setModal(null)}>Cerrar</button>
          </div>
        </div></div>
      )}
    </div>
  );
}
