// Módulo de marcas de vehículo: editar nombre y modelos, y eliminar solo las que no tienen vehículos.
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
const ADMIN = 'admin@demo.local';
const sx = `${Date.now() % 100000}`;
const ids: string[] = [];
let clienteId = '';

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  clienteId = (await como(ADMIN, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `7${sx.padStart(5, '0')}08`, nombre: 'Cliente Marcas Prueba' })).body.id;
});
afterAll(async () => {
  const vs = await prisma.vehiculo.findMany({ where: { clienteId } });
  await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs.map((v) => v.id) } } });
  await prisma.vehiculo.deleteMany({ where: { clienteId } });
  await prisma.auditoria.deleteMany({ where: { registroId: { in: [...ids, ...vs.map((v) => v.id), clienteId] } } });
  await prisma.marcaVehiculo.deleteMany({ where: { id: { in: ids } } });
  await prisma.cliente.deleteMany({ where: { id: clienteId } });
  await app.close();
  await prisma.$disconnect();
});

describe('marcas de vehículo', () => {
  it('se edita el nombre y los modelos (sin repetidos) y no admite un nombre que ya existe', async () => {
    const a = (await como(ADMIN, 'post', '/marcas-vehiculo', { nombre: `MARCA A${sx}` })).body;
    const b = (await como(ADMIN, 'post', '/marcas-vehiculo', { nombre: `MARCA B${sx}` })).body;
    ids.push(a.id, b.id);
    const e = await como(ADMIN, 'patch', `/marcas-vehiculo/${a.id}`, { modelos: ['UNO', 'uno', 'DOS', ' '] });
    expect(e.status).toBe(200);
    expect(e.body.modelos).toEqual(['UNO', 'DOS']);
    expect((await como(ADMIN, 'patch', `/marcas-vehiculo/${a.id}`, { nombre: `marca b${sx}` })).status).toBe(409);
    expect((await como(ADMIN, 'patch', `/marcas-vehiculo/${a.id}`, { nombre: '' })).status).toBe(400);
  });
  it('al renombrar una marca sus vehículos la siguen; con vehículos no se elimina y sin ellos sí', async () => {
    const m = (await como(ADMIN, 'post', '/marcas-vehiculo', { nombre: `MARCA C${sx}` })).body;
    ids.push(m.id);
    const v = (await como(ADMIN, 'post', '/vehiculos', { clienteId, placa: `MK${sx}1`, marca: m.nombre })).body;
    expect(v.marca).toBe(m.nombre);
    const nuevo = `MARCA C2${sx}`;
    expect((await como(ADMIN, 'patch', `/marcas-vehiculo/${m.id}`, { nombre: nuevo })).body.nombre).toBe(nuevo);
    expect((await prisma.vehiculo.findUniqueOrThrow({ where: { id: v.id } })).marca).toBe(nuevo);
    expect((await como(ADMIN, 'delete', `/marcas-vehiculo/${m.id}`)).status).toBe(409);
    const libre = (await como(ADMIN, 'post', '/marcas-vehiculo', { nombre: `MARCA D${sx}` })).body;
    ids.push(libre.id);
    expect((await como(ADMIN, 'delete', `/marcas-vehiculo/${libre.id}`)).status).toBe(200);
    expect((await como(ADMIN, 'get', '/marcas-vehiculo')).body.some((x: { id: string }) => x.id === libre.id)).toBe(false);
  });
  it('la marca de un vehículo queda en el catálogo: si existe se usa su nombre exacto y se suma el modelo; si no, se registra', async () => {
    const m = (await como(ADMIN, 'post', '/marcas-vehiculo', { nombre: `MARCA E${sx}` })).body;
    ids.push(m.id);
    const v = (await como(ADMIN, 'post', '/vehiculos', { clienteId, placa: `MK${sx}2`, marca: `marca e${sx}`, modelo: 'XE' })).body;
    expect(v.marca).toBe(m.nombre);
    expect((await prisma.marcaVehiculo.findUniqueOrThrow({ where: { id: m.id } })).modelos).toEqual(['XE']);
    await como(ADMIN, 'post', '/vehiculos', { clienteId, placa: `MK${sx}3`, marca: `NUEVA${sx}`, modelo: 'N1' });
    const nueva = await prisma.marcaVehiculo.findFirstOrThrow({ where: { nombre: `NUEVA${sx}` } });
    ids.push(nueva.id);
    expect(nueva.modelos).toEqual(['N1']);
    expect((await como(ADMIN, 'patch', `/vehiculos/${v.id}`, { modelo: 'XE2' })).status).toBe(200);
    expect((await prisma.marcaVehiculo.findUniqueOrThrow({ where: { id: m.id } })).modelos).toEqual(['XE', 'XE2']);
  });
});
