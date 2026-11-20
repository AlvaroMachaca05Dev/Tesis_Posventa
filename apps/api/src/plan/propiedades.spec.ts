import * as fc from 'fast-check';
import { sumarMeses, ritmo, visitasFuturas, igual, PlanLT } from './lineaTemporal';
import { cuadreOrdenComprobante } from '../ordenServicio/cuadre';

const fecha = fc.integer({ min: 0, max: 3650 }).map((d) => new Date(Date.UTC(2023, 0, 1) + d * 864e5).toISOString().slice(0, 10));
const token = fc.constantFrom('SV094', 'SV095', 'SV096', 'SV095+AF', 'SV096+AF');
const plan = fc.record({
  codigo: fc.constantFrom('GP-M', 'GR-S'),
  km: fc.constantFrom(5000, 7500), meses: fc.constantFrom(1, 2, 3),
  secuencia: fc.array(token, { minLength: 2, maxLength: 6 }), horizonte: fc.integer({ min: 1, max: 3 }),
}) as fc.Arbitrary<PlanLT>;
const entrada = fc.record({
  aceite0: fc.record({ km: fc.integer({ min: 0, max: 400000 }), fecha }),
  paqueteUltimo: fc.constantFrom(null, 'SV094', 'SV095', 'SV096'),
  rate: fc.integer({ min: -500, max: 6000 }), hoy: fecha, kmHoy: fc.integer({ min: 0, max: 450000 }),
  uso: fc.constantFrom('Particular', 'Profesional'),
});

describe('propiedades de la línea temporal', () => {
  it('las visitas futuras crecen en km y fecha, y a lo sumo una está por vencer', () => {
    fc.assert(fc.property(plan, entrada, (p, o) => {
      const v = visitasFuturas(p, o);
      for (let i = 1; i < v.length; i++) {
        if (v[i].km < v[i - 1].km || v[i].fecha < v[i - 1].fecha) return false;
      }
      if (v.length > p.secuencia.length * p.horizonte) return false;
      const pv = v.filter((x) => x.porVencer);
      return pv.length <= 1 && (!pv[0] || (!pv[0].vencido && v.filter((x) => !x.vencido)[0] === pv[0]));
    }), { numRuns: 500 });
  });
  it('lo vencido es km <= km de hoy o fecha pasada', () => {
    fc.assert(fc.property(plan, entrada, (p, o) => visitasFuturas(p, o).every((x) => x.vencido === (x.km <= o.kmHoy || x.fecha < o.hoy))), { numRuns: 500 });
  });
  it('sumarMeses nunca retrocede y mantiene el formato de fecha', () => {
    fc.assert(fc.property(fecha, fc.double({ min: 0, max: 36, noNaN: true }), (f, m) => {
      const r = sumarMeses(f, m);
      return /^\d{4}-\d{2}-\d{2}$/.test(r) && r >= f;
    }), { numRuns: 500 });
  });
  it('el ritmo de km nunca es negativo', () => {
    fc.assert(fc.property(fc.array(fc.record({ km: fc.integer({ min: 0, max: 500000 }), fecha }), { maxLength: 8 }), (p) => ritmo(p) >= 0), { numRuns: 500 });
  });
  it('un servicio es igual a sí mismo cuando tiene palabras clave', () => {
    fc.assert(fc.property(fc.constantFrom('Cambio de aceite de motor', 'Revisión de frenos delanteros', 'Limpieza de inyectores y obturador / IAC'), (s) => igual(s, s)));
  });
});

const linea = fc.record({ tipo: fc.constantFrom('servicio', 'producto'), descripcion: fc.string({ minLength: 1, maxLength: 12 }), cantidad: fc.integer({ min: 1, max: 5 }), total: fc.integer({ min: 0, max: 100000 }).map((c) => c / 100) });
describe('propiedades del cuadre orden-comprobante', () => {
  it('una orden siempre cuadra consigo misma, en cualquier orden de líneas', () => {
    fc.assert(fc.property(fc.array(linea, { maxLength: 8 }), (l) => cuadreOrdenComprobante(l, [...l].reverse()).cuadra), { numRuns: 500 });
  });
  it('quitar o agregar una línea con monto nunca cuadra', () => {
    fc.assert(fc.property(fc.array(linea, { minLength: 1, maxLength: 8 }), linea, (l, extra) => {
      const monto = { ...extra, total: extra.total + 0.01 };
      return !cuadreOrdenComprobante(l, [...l, monto]).cuadra && !cuadreOrdenComprobante([...l, monto], l).cuadra;
    }), { numRuns: 500 });
  });
});
