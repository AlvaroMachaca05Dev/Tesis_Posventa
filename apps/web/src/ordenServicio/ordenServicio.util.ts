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
export const totalLinea = (d: DetalleOds) => r2((d.tipo === 'servicio' ? 1 : d.cantidad) * d.precio * (1 - d.descuentoPct / 100));
export const itemVacio = (): DetalleOds => ({ tipo: 'servicio', descripcion: '', referencia: null, cantidad: 1, costo: null, rentabilidadPct: null, precio: 0, descuentoPct: 0, impuesto: 'IGV', total: 0, tecnicoId: null });
