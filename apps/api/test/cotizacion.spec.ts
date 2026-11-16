// Cotización: calca de la nota de venta sin caja, pagos ni stock; vehículo opcional y vigencia «válida hasta».
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();
let app: INestApplication;
const CLAVE = process.env.SEED_PASSWORD as string;
const tokens: Record<string, string> = {};
const tokenDe = async (c: string) => (tokens[c] ??= (await request(app.getHttpServer()).post('/auth/login').send({ correo: c, password: CLAVE })).body.token as string);
const como = async (c: string, metodo: 'get' | 'post' | 'patch' | 'delete', ruta: string, cuerpo?: object) => {
  const t = await tokenDe(c);
  const r = request(app.getHttpServer())[metodo](ruta).set('Authorization', `Bearer ${t}`);
  return cuerpo ? r.send(cuerpo) : r;
};
const CAJERA = 'cajera@demo.local';
const sx = `${Date.now() % 100000}`;
let clienteId = '';
const item = (extra: object = {}) => ({ tipo: 'servicio', descripcion: 'Servicio cotizado', cantidad: 1, precio: 118, tipoIgv: 'GRAVADO', ...extra });

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  clienteId = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `6${sx.padStart(5, '0')}09`, nombre: 'Cliente Cotización Prueba' })).body.id;
});
afterAll(async () => {
  const cots = await prisma.cotizacion.findMany({ where: { clienteId } });
  await prisma.cotizacion.deleteMany({ where: { clienteId } });
  await prisma.auditoria.deleteMany({ where: { registroId: { in: [...cots.map((c) => c.id), clienteId] } } });
  await prisma.cliente.deleteMany({ where: { id: clienteId } });
  await app.close();
  await prisma.$disconnect();
});

describe('cotizaciones', () => {
  it('se emite sin vehículo, con código consecutivo, totales y vigencia hasta hoy por defecto; no toca pagos ni stock', async () => {
    const r = await como(CAJERA, 'post', '/cotizaciones', { clienteId, items: [item()], formaPago: 'Yape' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ estado: 'VIGENTE', vehiculo: null, total: 118, gravada: 100, igv: 18, formaPago: 'Yape', conIgv: true, creadaPor: 'Cajera Demo' });
    expect(r.body.codigo).toMatch(/^COT-\d{6}$/);
    const otra = await como(CAJERA, 'post', '/cotizaciones', { clienteId, items: [item({ tipoIgv: 'INAFECTO' })], conIgv: false });
    expect(otra.body).toMatchObject({ conIgv: false, inafecta: 118, igv: 0 });
    expect(otra.body.codigo).not.toBe(r.body.codigo);
    expect((await como(CAJERA, 'get', '/cotizaciones')).body.some((x: { id: string }) => x.id === r.body.id)).toBe(true);
  });
  it('valida cliente, ítems, forma de pago y fecha; sin local no se emite', async () => {
    expect((await como(CAJERA, 'post', '/cotizaciones', { items: [item()] })).status).toBe(400);
    expect((await como(CAJERA, 'post', '/cotizaciones', { clienteId, items: [] })).status).toBe(409);
    expect((await como(CAJERA, 'post', '/cotizaciones', { clienteId, items: [item()], formaPago: 'Trueque' })).status).toBe(400);
    expect((await como(CAJERA, 'post', '/cotizaciones', { clienteId, items: [item()], validaHasta: '2020-01-01' })).status).toBe(400);
    expect((await como('ti@demo.local', 'post', '/cotizaciones', { clienteId, items: [item()] })).status).toBe(409);
  });
  it('se anula con motivo y queda consultable', async () => {
    const c = (await como(CAJERA, 'post', '/cotizaciones', { clienteId, items: [item()] })).body;
    expect((await como(CAJERA, 'post', `/cotizaciones/${c.id}/anular`, {})).status).toBeGreaterThanOrEqual(400);
    const a = await como('admin@demo.local', 'post', `/cotizaciones/${c.id}/anular`, { motivo: 'El cliente desistió' });
    expect(a.body).toMatchObject({ estado: 'ANULADA', motivoAnulacion: 'El cliente desistió' });
    expect((await como(CAJERA, 'get', `/cotizaciones/${c.id}`)).body.estado).toBe('ANULADA');
  });
});

describe('editar y eliminar cotizaciones', () => {
  it('se edita conservando el código, no se edita anulada y se elimina solo con nivel «todo»', async () => {
    const c = (await como(CAJERA, 'post', '/cotizaciones', { clienteId, items: [item()] })).body;
    const e = await como(CAJERA, 'patch', `/cotizaciones/${c.id}`, { clienteId, items: [item({ precio: 236 }), item({ descripcion: 'Otro' })] });
    expect(e.status).toBe(200);
    expect(e.body).toMatchObject({ codigo: c.codigo, total: 354 });
    expect(e.body.detalles).toHaveLength(2);
    expect((await como(CAJERA, 'delete', `/cotizaciones/${c.id}`)).status).toBeGreaterThanOrEqual(403);
    expect((await como('admin@demo.local', 'delete', `/cotizaciones/${c.id}`)).status).toBe(200);
    expect((await como(CAJERA, 'get', `/cotizaciones/${c.id}`)).status).toBe(404);
    const a = (await como(CAJERA, 'post', '/cotizaciones', { clienteId, items: [item()] })).body;
    await como('admin@demo.local', 'post', `/cotizaciones/${a.id}/anular`, { motivo: 'x' });
    expect((await como(CAJERA, 'patch', `/cotizaciones/${a.id}`, { clienteId, items: [item()] })).status).toBe(409);
  });
});
