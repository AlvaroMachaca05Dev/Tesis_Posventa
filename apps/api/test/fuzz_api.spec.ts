// Fuzzing ligero: cuerpos al azar y raros contra los endpoints de escritura. Regla única: nunca error 500 (siempre 2xx o 4xx).
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as fc from 'fast-check';
import { AppModule } from '../src/app.module';

let app: INestApplication;
let token = '', ordenId = '', vehiculoId = '', clienteId = '';
const estados: Record<number, number> = {};
const SEMILLA = Number(process.env.FUZZ_SEED ?? 20261119);

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  await app.listen(0);
  token = (await request(app.getHttpServer()).post('/auth/login').send({ correo: 'ti@demo.local', password: process.env.SEED_PASSWORD })).body.token;
  if (!token) throw new Error('El fuzzing no pudo iniciar sesión: sin base de datos o sin SEED_PASSWORD.');
  const lista = async (ruta: string) => (await request(app.getHttpServer()).get(ruta).set('Authorization', `Bearer ${token}`)).body;
  const o = await lista('/ordenes'); ordenId = (Array.isArray(o) ? o : o.items ?? o.ordenes ?? [])[0]?.id ?? 'x';
  const v = await lista('/vehiculos'); vehiculoId = (Array.isArray(v) ? v : v.items ?? [])[0]?.id ?? 'x';
  const c = await lista('/clientes'); clienteId = (Array.isArray(c) ? c : c.items ?? [])[0]?.id ?? 'x';
});
afterAll(async () => { console.log('Respuestas del fuzzing por estado:', JSON.stringify(estados)); await app.close(); });

const raro = fc.oneof(
  fc.string(), fc.constant(null), fc.integer(), fc.double(), fc.boolean(), fc.constant(''), fc.constant("'; DROP TABLE \"Vehiculo\"; --"),
  fc.constant('9'.repeat(400)), fc.constant(-1), fc.constant(1e308), fc.constant('😀'.repeat(50)), fc.constant([]), fc.constant({}),
  fc.array(fc.string(), { maxLength: 3 }), fc.constant('__proto__'), fc.constant('2026-02-31'),
);
const cuerpo = fc.dictionary(
  fc.constantFrom('nombre', 'documento', 'tipoDocumento', 'placa', 'marca', 'modelo', 'km', 'anio', 'clienteId', 'vehiculoId', 'estado', 'detalles',
    'descuento', 'descuentoMonto', 'monto', 'metodoPago', 'aprobado', 'aprobacionPorItem', 'anchoTicketMm', 'pieTicket', 'logo', 'uso', 'aceite', 'fecha', '__proto__', 'constructor'),
  raro, { maxKeys: 8 });

const objetivos: [string, 'post' | 'patch' | 'put', () => string][] = [
  ['clientes', 'post', () => '/clientes'], ['clientes/:id', 'patch', () => `/clientes/${clienteId}`],
  ['vehiculos', 'post', () => '/vehiculos'], ['vehiculos/:id', 'patch', () => `/vehiculos/${vehiculoId}`],
  ['vehiculos/:id/lecturas', 'post', () => `/vehiculos/${vehiculoId}/lecturas`],
  ['ordenes', 'post', () => '/ordenes'], ['ordenes/:id/detalles', 'put', () => `/ordenes/${ordenId}/detalles`],
  ['ordenes/:id/abonos', 'post', () => `/ordenes/${ordenId}/abonos`], ['ordenes/:id/descuento', 'post', () => `/ordenes/${ordenId}/descuento`],
  ['empresa', 'patch', () => '/empresa'],
];

describe('fuzzing de endpoints de escritura', () => {
  for (const [nombre, metodo, ruta] of objetivos) {
    it(`${metodo.toUpperCase()} /${nombre}: 500 entradas al azar sin error 500`, async () => {
      const fallos: string[] = [];
      await fc.assert(fc.asyncProperty(cuerpo, async (b) => {
        const r = await request(app.getHttpServer())[metodo](ruta()).set('Authorization', `Bearer ${token}`).send(b);
        estados[r.status] = (estados[r.status] ?? 0) + 1;
        if (r.status >= 500) { fallos.push(`${r.status} ${JSON.stringify(b).slice(0, 200)}`); return false; }
        return true;
      }), { numRuns: 100, seed: SEMILLA, endOnFailure: true });
      expect(fallos).toEqual([]);
    });
  }
  it('los ítems de la orden con montos extremos no rompen la API', async () => {
    const item = fc.record({ tipo: fc.constantFrom('servicio', 'producto', 'x'), descripcion: raro, cantidad: raro, precio: raro, aprobado: raro });
    await fc.assert(fc.asyncProperty(fc.array(item, { maxLength: 4 }), async (detalles) => {
      const r = await request(app.getHttpServer()).put(`/ordenes/${ordenId}/detalles`).set('Authorization', `Bearer ${token}`).send({ detalles });
      return r.status < 500;
    }), { numRuns: 100, seed: SEMILLA });
  });
});
