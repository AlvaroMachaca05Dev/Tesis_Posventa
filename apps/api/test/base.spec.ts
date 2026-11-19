// Pruebas de la base de datos y del backend de S2 y S3 (28/10): reglas que la base hace cumplir por sí sola,
// coherencia entre tablas después de usar la API y que cada cambio deje bitácora y auditoría.
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Prisma, PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();
let app: INestApplication;
const CLAVE = process.env.SEED_PASSWORD as string;
const tokens: Record<string, string> = {};
const tokenDe = async (c: string) => (tokens[c] ??= (await request(app.getHttpServer()).post('/auth/login').send({ correo: c, password: CLAVE })).body.token as string);
const como = async (c: string, metodo: 'get' | 'post' | 'patch' | 'put' | 'delete', ruta: string, cuerpo?: object) => {
  const t = await tokenDe(c);
  const r = request(app.getHttpServer())[metodo](ruta).set('Authorization', `Bearer ${t}`);
  return cuerpo ? r.send(cuerpo) : r;
};
const CAJERA = 'cajera@demo.local';
const sufijo = `${Date.now() % 100000}`;
let organizacionId: string;
let clienteId: string;
let vehiculoId: string;
const esUnico = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const esForanea = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003';

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  organizacionId = (await prisma.organizacion.findFirstOrThrow({ where: { nombre: 'Taller Demo' } })).id;
  clienteId = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `5${sufijo.padStart(5, '0')}01`, nombre: 'Cliente Base Prueba' })).body.id;
  vehiculoId = (await como(CAJERA, 'post', '/vehiculos', { clienteId, placa: `BD-${sufijo}` })).body.id;
});
afterAll(async () => {
  // Sin el cliente de prueba no se borra nada: un filtro vacío borraría toda la base.
  if (!clienteId) { await app?.close(); await prisma.$disconnect(); return; }
  const ids = (await prisma.ordenServicio.findMany({ where: { clienteId } })).map((o) => o.id);
  await prisma.evidenciaIngreso.deleteMany({ where: { ordenId: { in: ids } } });
  await prisma.abono.deleteMany({ where: { ordenId: { in: ids } } });
  await prisma.detalleODS.deleteMany({ where: { ordenId: { in: ids } } });
  await prisma.bitacora.deleteMany({ where: { ordenId: { in: ids } } });
  await prisma.ordenServicio.deleteMany({ where: { id: { in: ids } } });
  const vs = (await prisma.vehiculo.findMany({ where: { clienteId } })).map((v) => v.id);
  await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs } } });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vs } } });
  await prisma.auditoria.deleteMany({ where: { registroId: { in: [...ids, ...vs, clienteId] } } });
  await prisma.cliente.deleteMany({ where: { id: clienteId } });
  await app.close();
  await prisma.$disconnect();
});

describe('la base hace cumplir sus reglas aunque se salte la API', () => {
  it('documento de cliente único por empresa', async () => {
    const e = await prisma.cliente.create({ data: { organizacionId, tipoDocumento: 'DNI', documento: `5${sufijo.padStart(5, '0')}01`, nombre: 'Duplicado' } }).catch((x) => x);
    expect(esUnico(e)).toBe(true);
  });
  it('placa normalizada única por empresa', async () => {
    const v = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } });
    const e = await prisma.vehiculo.create({ data: { organizacionId, clienteId, placa: 'otra', placaNorm: v.placaNorm } }).catch((x) => x);
    expect(esUnico(e)).toBe(true);
  });
  it('código de ODS único por empresa', async () => {
    const o = (await como(CAJERA, 'post', '/ordenes', { vehiculoId, tipoAtencion: 'Mantenimiento correctivo' })).body;
    const base = await prisma.ordenServicio.findUniqueOrThrow({ where: { id: o.id } });
    const e = await prisma.ordenServicio.create({ data: { organizacionId, vehiculoId, clienteId, localId: base.localId, codigo: o.codigo, tipoAtencion: 'Otro', creadoPorId: base.creadoPorId } }).catch((x) => x);
    expect(esUnico(e)).toBe(true);
  });
  it('no hay ítems, abonos ni evidencias sueltos: todos apuntan a una ODS que existe', async () => {
    const usuario = await prisma.usuario.findFirstOrThrow({ where: { correo: CAJERA } });
    const fantasma = '00000000-0000-0000-0000-000000000000';
    expect(esForanea(await prisma.detalleODS.create({ data: { ordenId: fantasma, descripcion: 'x' } }).catch((x) => x))).toBe(true);
    expect(esForanea(await prisma.abono.create({ data: { ordenId: fantasma, metodo: 'Efectivo', valor: 1, registradoPorId: usuario.id } }).catch((x) => x))).toBe(true);
    expect(esForanea(await prisma.evidenciaIngreso.create({ data: { ordenId: fantasma, nombre: 'x', tipo: 'image/png', tamano: 1, datos: Buffer.from([1]), subidoPorId: usuario.id } }).catch((x) => x))).toBe(true);
  });
  it('los montos se guardan exactos (decimales, no flotantes)', async () => {
    const o = (await prisma.ordenServicio.findFirstOrThrow({ where: { clienteId, tipoAtencion: { not: 'Garantía' } } }));
    await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'producto', descripcion: 'Filtro', cantidad: 3, precio: 0.1 }] });
    const d = await prisma.detalleODS.findFirstOrThrow({ where: { ordenId: o.id } });
    expect(d.total.toString()).toBe('0.3');
    expect(d.precio.toString()).toBe('0.1');
  });
});

describe('coherencia entre tablas después de usar la API', () => {
  it('crear una ODS con km deja la lectura del vehículo, la bitácora y la auditoría', async () => {
    const v2 = (await como(CAJERA, 'post', '/vehiculos', { clienteId, placa: `BE-${sufijo}` })).body.id;
    const o = (await como(CAJERA, 'post', '/ordenes', { vehiculoId: v2, tipoAtencion: 'Mantenimiento preventivo', km: 12345 })).body;
    expect(await prisma.lecturaKm.count({ where: { vehiculoId: v2, km: 12345, fuente: 'ODS' } })).toBe(1);
    expect(await prisma.bitacora.count({ where: { ordenId: o.id } })).toBeGreaterThan(0);
    expect(await prisma.auditoria.count({ where: { registroId: o.id, tabla: 'orden_servicio' } })).toBeGreaterThan(0);
  });
  it('la ODS guarda el titular del vehículo al crearse', async () => {
    const o = await prisma.ordenServicio.findFirstOrThrow({ where: { vehiculoId } });
    expect(o.clienteId).toBe(clienteId);
  });
  it('el total que muestra la API coincide con la suma guardada de los ítems y lo pendiente con los abonos', async () => {
    const o = await prisma.ordenServicio.findFirstOrThrow({ where: { vehiculoId, tipoAtencion: { not: 'Garantía' } } });
    await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'Diagnóstico', precio: 80, cantidad: 2 }, { tipo: 'producto', descripcion: 'Aceite', precio: 35.5, cantidad: 2, descuentoPct: 10 }] });
    await como(CAJERA, 'post', `/ordenes/${o.id}/abonos`, { metodo: 'Yape', valor: 50 });
    const api = (await como(CAJERA, 'get', `/ordenes/${o.id}`)).body;
    const det = await prisma.detalleODS.findMany({ where: { ordenId: o.id } });
    const suma = det.reduce((a, d) => a + Number(d.total), 0);
    expect(api.total).toBeCloseTo(suma, 2);
    expect(api.total).toBe(143.9); // 80 (H-H no multiplican) + 2 × 35.50 − 10 %
    expect(api.pendiente).toBe(93.9);
  });
  it('quitar ítems no deja filas viejas: se reemplazan en la misma transacción', async () => {
    const o = await prisma.ordenServicio.findFirstOrThrow({ where: { vehiculoId } });
    await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'Solo uno', precio: 60 }] });
    expect(await prisma.detalleODS.count({ where: { ordenId: o.id } })).toBe(1);
  });
  it('un error a la mitad no deja cambios a medias (total bajo lo abonado: nada se guarda)', async () => {
    const o = await prisma.ordenServicio.findFirstOrThrow({ where: { vehiculoId, tipoAtencion: { not: 'Garantía' } } });
    const antes = await prisma.detalleODS.findMany({ where: { ordenId: o.id } });
    const r = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'Barato', precio: 1 }] });
    expect(r.status).toBe(409);
    expect((await prisma.detalleODS.findMany({ where: { ordenId: o.id } })).map((d) => d.id)).toEqual(antes.map((d) => d.id));
  });
  it('la evidencia guarda los bytes exactos del archivo', async () => {
    const o = await prisma.ordenServicio.findFirstOrThrow({ where: { vehiculoId } });
    const datos = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255]);
    await request(app.getHttpServer()).post(`/ordenes/${o.id}/evidencias`).set('Authorization', `Bearer ${await tokenDe(CAJERA)}`).attach('archivo', datos, { filename: 'á.png', contentType: 'image/png' });
    const e = await prisma.evidenciaIngreso.findFirstOrThrow({ where: { ordenId: o.id } });
    expect(Buffer.from(e.datos).equals(datos)).toBe(true);
    expect(e).toMatchObject({ nombre: 'á.png', tamano: datos.length });
  });
  it('la baja de una ODS es lógica: la fila sigue en la base con su motivo y su número no vuelve', async () => {
    const v3 = (await como(CAJERA, 'post', '/vehiculos', { clienteId, placa: `BF-${sufijo}` })).body.id;
    const o = (await como(CAJERA, 'post', '/ordenes', { vehiculoId: v3, tipoAtencion: 'Otro', tipoAtencionDetalle: 'Revisión de prueba' })).body;
    expect((await como('admin@demo.local', 'delete', `/ordenes/${o.id}`, { motivo: 'Prueba de base' })).status).toBe(200);
    expect(await prisma.ordenServicio.findUnique({ where: { id: o.id } })).toMatchObject({ eliminada: true, motivoEliminacion: 'Prueba de base' });
    expect((await como(CAJERA, 'get', `/ordenes/${o.id}`)).status).toBe(404);
    const otra = (await como(CAJERA, 'post', '/ordenes', { vehiculoId: v3, tipoAtencion: 'Otro', tipoAtencionDetalle: 'Revisión de prueba' })).body;
    expect(otra.codigo).not.toBe(o.codigo);
  });
  it('el texto con tildes, «→» y emojis se guarda y se lee igual (base UTF-8)', async () => {
    const o = await prisma.ordenServicio.findFirstOrThrow({ where: { vehiculoId } });
    const t = 'Ruido → revisar 🚗 ñandú';
    await como(CAJERA, 'patch', `/ordenes/${o.id}`, { observaciones: t });
    expect((await prisma.ordenServicio.findUniqueOrThrow({ where: { id: o.id } })).observaciones).toBe(t);
  });
});
