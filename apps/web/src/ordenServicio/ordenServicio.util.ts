import { DetalleOds } from '../comun/api';

export type Nivel = 'A' | 'E' | 'V';
export const ESTADOS = [
  { id: 'Recepcion', nombre: 'Recepción' },
  { id: 'EnProceso', nombre: 'En proceso' },
  { id: 'Entrega', nombre: 'Entrega' },
  { id: 'Cerrada', nombre: 'Cerrado' },
];
export const soles = (n: number) => 'S/ ' + n.toFixed(2);
export const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const hace = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`;
};
export const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
export const r3 = (x: number) => Math.round((x + Number.EPSILON) * 1000) / 1000;
// En un servicio la cantidad son H-H y no multiplican el precio (decisión R5); en un producto sí.
/** Acepta coma o punto decimal («12,50» o «12.50»); devuelve null si no es un número. */
export const leerNumero = (t: string) => {
  const n = Number(String(t).trim().replace(/\s/g, '').replace(',', '.'));
  return String(t).trim() === '' || !Number.isFinite(n) ? null : n;
};
export const r6 = (x: number) => Math.round((x + Number.EPSILON) * 1e6) / 1e6;
/** Importe de la línea sin descuentos: en un servicio la cantidad son H-H y no multiplican el precio. */
export const baseLinea = (d: DetalleOds) => (d.tipo === 'servicio' ? 1 : d.cantidad) * d.precio;
/** Total de la línea: el Desc. (%) ya incluye el descuento por solapamiento (RF-102). */
export const totalLinea = (d: DetalleOds) => r2(baseLinea(d) * (1 - d.descuentoPct / 100));
/** Descuento manual en soles (lo que no es solapamiento). */
const manualSoles = (d: DetalleOds) => Math.max(0, r2(baseLinea(d) * (d.descuentoPct / 100) - (d.descuentoMonto ?? 0)));
/** Porcentaje manual, sin el solapamiento. */
export const pctManual = (d: DetalleOds) => { const b = baseLinea(d); return b > 0 ? r6((manualSoles(d) / b) * 100) : 0; };
/** Total antes del descuento por solapamiento: sirve para evaluar las reglas y su tope. */
export const totalSinSolape = (d: DetalleOds) => r2(Math.max(0, baseLinea(d) - manualSoles(d)));
/** Pone (o quita, con monto 0) el descuento por solapamiento dentro del Desc. (%) para que el total baje exactamente ese monto. */
export function conSolape(d: DetalleOds, monto: number, regla: string | null): DetalleOds {
  const base = baseLinea(d);
  const total = r2(Math.max(0, totalSinSolape(d) - monto));
  const x = { ...d, descuentoMonto: monto, solapamientoId: regla, descuentoPct: base > 0 ? r6((1 - total / base) * 100) : 0 };
  return { ...x, total: totalLinea(x) };
}
export const itemVacio = (): DetalleOds => ({ tipo: 'servicio', descripcion: '', referencia: null, cantidad: 1, costo: null, rentabilidadPct: null, precio: 0, descuentoPct: 0, impuesto: 'IGV', total: 0, tecnicoId: null });

/** Cobro simbólico de la revisión específica cuando el cliente repara con nosotros: no se factura en cero. */
export const COBRO_REVISION_GRATIS = 1;
/**
 * Deja la revisión específica en S/ 1 y reparte la diferencia entre los demás servicios, en proporción a su total, para que la orden
 * no cambie de monto. Si no hay otro servicio con monto, no se toca nada.
 */
export function revisionGratis(items: DetalleOds[], i: number): DetalleOds[] {
  const rev = items[i];
  if (!rev || rev.tipo !== 'servicio') return items;
  const otros = items.map((d, j) => ({ d, j })).filter(({ d, j }) => j !== i && d.tipo === 'servicio' && d.total > 0 && d.descuentoPct < 100);
  const suma = otros.reduce((a, { d }) => a + d.total, 0);
  const diferencia = r2(rev.total - COBRO_REVISION_GRATIS);
  if (diferencia <= 0 || suma <= 0) return items;
  const aumentos = otros.map(({ d }) => r2((diferencia * d.total) / suma));
  aumentos[aumentos.indexOf(Math.max(...aumentos))] += r2(diferencia - aumentos.reduce((a, x) => a + x, 0));
  return items.map((d, j) => {
    if (j === i) return { ...d, precio: COBRO_REVISION_GRATIS, descuentoPct: 0, descuentoMonto: 0, solapamientoId: null, total: COBRO_REVISION_GRATIS };
    const k = otros.findIndex((o) => o.j === j);
    if (k < 0) return d;
    const nuevoTotal = r2(d.total + aumentos[k]);
    const precio = r2(nuevoTotal / (1 - d.descuentoPct / 100));
    return { ...d, precio, total: totalLinea({ ...d, precio }) };
  });
}
