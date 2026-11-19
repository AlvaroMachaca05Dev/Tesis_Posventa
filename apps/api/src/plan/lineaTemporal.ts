// Línea de tiempo del vehículo (S7): columnas pasadas = visitas reales por mes (fecha de salida de la ODS); columnas futuras = visitas
// del plan (combustible × uso × aceite) proyectadas desde el último cambio de aceite. El paso es el intervalo del aceite (km o meses,
// lo que ocurra primero, según el ritmo de km del vehículo). La secuencia sigue después del último menor o mayor hecho.

export interface Linea { n: string; h: number; c: string; alt?: string }
export interface OdsLT { id: string; codigo: string; fecha: string; km: number | null; servicios: string[]; productos: string[] }

/** Categoría de un servicio por su nombre (mismo orden que el prototipo R8.5). */
const CATS: [string, RegExp][] = [
  ['Motor y lubricación', /cambio de aceite y filtro de motor/i],
  ['Encendido y afinamiento', /buj[ií]a|bobina|chicote|inyector|obturador|presi[oó]n de bomba|carburador|iac/i],
  ['Embrague y caja', /embrague|aceite de caja|soportes de caja/i],
  ['Filtros', /filtro/i],
  ['Refrigeración y clima', /refrigerante|manguera|aire acondicionado/i],
  ['Frenos', /freno|pastilla|zapata|disco|tambor|vac[ií]o/i],
  ['Tracción y ejes', /palier|diferencial|capuchon/i],
  ['Distribución y correas', /distribuci[oó]n|correa/i],
  ['Suspensión y dirección', /amortiguador|r[oó]tula|buje|terminal|direcci[oó]n|trapecio|cremallera/i],
  ['Neumáticos', /neum[aá]tico/i],
  ['Eléctrico, escáner y pruebas', /bater[ií]a|limpiaparabrisas|luces|esc[aá]ner|escaneo|prueba de ruta/i],
  ['Motor y lubricación', /aceite|fugas|soportes de motor|escape|ventilaci[oó]n|motor/i],
];
export const categoria = (n: string) => (CATS.find(([, re]) => re.test(n)) ?? ['Otros'])[0];
export const ORDEN_CATS = [...new Set(CATS.map(([c]) => c).concat('Otros'))];

/** Servicios a elegir: el afinamiento lleva limpieza de carburador o de inyectores, no ambos. */
export const A_ELEGIR = ['Limpieza y mantenimiento de carburador', 'Limpieza de inyectores y obturador / IAC'];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const firma = (s: string) => new Set(norm(s.replace(/\s*-?\s*[\d.]+\s*h?\s*-?\s*$/, '')).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !['cambio', 'revision', 'servicio', 'limpieza', 'ajuste'].includes(w)));
/** ¿Una línea del plan y un servicio de la ODS son lo mismo? (todas las palabras clave de uno están en el otro). */
export function igual(plan: string, ods: string) {
  const a = firma(plan), b = firma(ods);
  if (!a.size || !b.size) return false;
  const sub = (x: Set<string>, y: Set<string>) => [...x].every((t) => y.has(t));
  return sub(b, a) || sub(a, b);
}
export const esAceite = (n: string) => /cambio de aceite/.test(norm(n)) || (/aceite/.test(norm(n)) && /motor/.test(norm(n)) && !/revision/.test(norm(n)));

const MES = 30.4375;
export const sumarMeses = (iso: string, m: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + Math.round(m * MES)); return d.toISOString().slice(0, 10); };
const mesesEntre = (a: string, b: string) => (new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 86400000 / MES;

export interface PlanLT { codigo: string; km: number; meses: number; secuencia: string[]; horizonte: number }

/** Columnas pasadas: una por mes, con sus ODS; km y fecha salen de la ODS del cambio de aceite (o de la última con km). */
export function columnasPasadas(ods: OdsLT[], paquetes: Record<string, Linea[]>) {
  const g = new Map<string, OdsLT[]>();
  for (const o of [...ods].sort((a, b) => a.fecha.localeCompare(b.fecha))) { const k = o.fecha.slice(0, 7); if (!g.has(k)) g.set(k, []); g.get(k)!.push(o); }
  return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, ordenes]) => {
    const conKm = ordenes.filter((o) => o.km != null), aceite = conKm.filter((o) => o.servicios.some(esAceite)), bo = aceite.at(-1) ?? conKm.at(-1);
    const servicios = ordenes.flatMap((o) => o.servicios);
    let paquete: string | null = null;
    if (servicios.some(esAceite)) {
      let mejor = 'SV094', mc = -1, ms = 0;
      for (const k of ['SV094', 'SV095', 'SV096']) {
        const L = paquetes[k] ?? [], c = L.filter((e) => servicios.some((s) => igual(e.n, s))).length;
        if (L.length && c / L.length >= 0.5 && (c > mc || (c === mc && L.length > ms))) { mejor = k; mc = c; ms = L.length; }
      }
      paquete = mejor;
    }
    const esperadas = paquete ? paquetes[paquete] ?? [] : [];
    const hechos = esperadas.filter((e) => servicios.some((s) => igual(e.n, s))).map((e) => e.n);
    return { clave: 'p' + mes, mes, km: bo ? bo.km : null, fecha: bo ? bo.fecha : ordenes.at(-1)!.fecha, paquete, ordenes, esperadas, hechos };
  });
}

/** Ritmo de km por mes con los últimos 5 puntos (lecturas y ODS) ordenados por fecha. */
export function ritmo(puntos: { km: number; fecha: string }[]) {
  const p = puntos.filter((x) => x.km != null).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-5);
  if (p.length < 2) return 0;
  const m = mesesEntre(p[0].fecha, p.at(-1)!.fecha), d = p.at(-1)!.km - p[0].km;
  return m > 0.5 && d > 0 ? Math.round(d / m) : 0;
}

/** Visitas futuras del plan desde el último cambio de aceite. */
export function visitasFuturas(plan: PlanLT, o: { aceite0: { km: number; fecha: string }; paqueteUltimo: string | null; rate: number; hoy: string; kmHoy: number; uso: string }) {
  const L = plan.secuencia.length, rate = o.rate > 0 ? o.rate : 0;
  const dm = rate ? Math.min(plan.meses, plan.km / rate) : plan.meses, paso = rate ? Math.min(plan.km, rate * dm) : plan.km;
  let pos0 = 0;
  if (o.paqueteUltimo === 'SV095' || o.paqueteUltimo === 'SV096') { const i = plan.secuencia.findIndex((t) => t.startsWith(o.paqueteUltimo!)); if (i >= 0) pos0 = (i + 1) % L; }
  const limite = `${Number(o.hoy.slice(0, 4)) + 2}-12-31`, ventana = o.uso === 'Profesional' ? 500 : 100, out = [];
  for (let k = 1; k <= L * plan.horizonte; k++) {
    const fecha = sumarMeses(o.aceite0.fecha, dm * k);
    if (fecha > limite) break;
    const tok = plan.secuencia[(pos0 + k - 1) % L], km = Math.round(o.aceite0.km + paso * k), vencido = km <= o.kmHoy || fecha < o.hoy;
    out.push({ clave: 'f' + k, k, paquete: tok.replace('+AF', ''), afinamiento: tok.endsWith('+AF'), km, fecha, vencido, porVencer: !vencido && (km - o.kmHoy <= ventana || mesesEntre(o.hoy, fecha) * MES <= 5) });
  }
  // DEC-119: la primera visita no vencida siempre es «por vencer»; la ventana de 100/500 km o 5 días rige solo la lista para llamar.
  out.forEach((x) => { x.porVencer = false; });
  const pv = out.find((x) => !x.vencido);
  if (pv) pv.porVencer = true;
  return out;
}
