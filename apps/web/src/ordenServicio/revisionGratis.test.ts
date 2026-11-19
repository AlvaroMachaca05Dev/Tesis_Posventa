import { describe, expect, it } from 'vitest';
import { DetalleOds } from '../comun/api';
import { itemVacio, revisionGratis, totalLinea } from './ordenServicio.util';

const linea = (precio: number, extra: Partial<DetalleOds> = {}): DetalleOds => { const d = { ...itemVacio(), precio, descripcion: 'x', ...extra }; return { ...d, total: totalLinea(d) }; };
const suma = (xs: DetalleOds[]) => Math.round(xs.reduce((a, d) => a + d.total, 0) * 100) / 100;

describe('revisión específica gratis si el cliente repara', () => {
  it('queda en S/ 1 y la diferencia se reparte sin cambiar el total de la orden', () => {
    const xs = [linea(40, { referencia: 'SV002' }), linea(100), linea(60)];
    const r = revisionGratis(xs, 0);
    expect(r[0].total).toBe(1);
    expect(suma(r)).toBe(suma(xs));
    expect(r[1].total).toBeGreaterThan(100);
    expect(r[2].total).toBeGreaterThan(60);
  });
  it('respeta el descuento que ya tenían las otras líneas', () => {
    const xs = [linea(25), linea(200, { descuentoPct: 10 })];
    const r = revisionGratis(xs, 0);
    expect(suma(r)).toBeCloseTo(suma(xs), 1);
    expect(r[1].descuentoPct).toBe(10);
  });
  it('sin otro servicio con monto no cambia nada', () => {
    const xs = [linea(25)];
    expect(revisionGratis(xs, 0)).toBe(xs);
    const prod = [linea(25), linea(90, { tipo: 'producto' })];
    expect(revisionGratis(prod, 0)).toBe(prod);
  });
});
