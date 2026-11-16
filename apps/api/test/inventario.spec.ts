// Ajuste de inventario por local (base del kárdex, RF-092): confirmación de contraseña, entrada, salida, saldo, permisos y auditoría.
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
const como = async (c: string, metodo: 'get' | 'post', ruta: string, cuerpo?: object) => {
  const t = await tokenDe(c); // primero el token: la petición se arma sobre el servidor ya libre
  const r = request(app.getHttpServer())[metodo](ruta).set('Authorization', `Bearer ${t}`);
  return cuerpo ? r.send(cuerpo) : r;
};
const ADMIN = 'admin@demo.local';
const TI = 'ti@demo.local';
const CAJERA = 'cajera@demo.local';
const sx = `${Date.now() % 100000}`;
let productoId = '';
let locales: { id: string; nombre: string }[] = [];
let permiso = '';

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  const p = await como(ADMIN, 'post', '/productos', { codigo: `INV${sx}`, nombre: 'Producto de prueba de inventario', precio: 10 });
  productoId = p.body.id;
  locales = (await como(ADMIN, 'get', '/inventario/locales')).body;
  permiso = (await como(ADMIN, 'post', '/inventario/verificar', { password: CLAVE })).body.token;
});
afterAll(async () => {
  if (productoId) {
    await prisma.movimientoInventario.deleteMany({ where: { productoId } });
    await prisma.stockProducto.deleteMany({ where: { productoId } });
    await prisma.auditoria.deleteMany({ where: { registroId: productoId } });
    await prisma.producto.deleteMany({ where: { id: productoId } });
  }
  await app.close();
  await prisma.$disconnect();
});

const ajustar = (cuerpo: object, quien = ADMIN) => como(quien, 'post', `/productos/${productoId}/ajuste`, cuerpo);
const movimientos = async () => (await como(ADMIN, 'get', `/productos/${productoId}/movimientos`)).body as { tipo: string; local: string; entrada: number; salida: number; saldo: number; motivo: string | null }[];

describe('ajuste de inventario', () => {
  it('el producto de prueba existe y la empresa tiene sus dos locales', () => {
    expect(productoId).toBeTruthy();
    expect(locales.length).toBeGreaterThanOrEqual(2);
  });
  it('hay que confirmar la contraseña: sin ella o con otra no se entrega el permiso (401) y sin permiso no se ajusta (403)', async () => {
    expect((await como(ADMIN, 'post', '/inventario/verificar', { password: 'no-es-la-clave' })).status).toBe(401);
    expect((await como(ADMIN, 'post', '/inventario/verificar', {})).status).toBe(401);
    expect(permiso).toBeTruthy();
    expect((await ajustar({ localId: locales[0].id, cantidad: 5 })).status).toBe(403);
    expect((await ajustar({ localId: locales[0].id, cantidad: 5, token: 'permiso-falso' })).status).toBe(403);
  });
  it('el permiso es de quien confirmó: otra persona no puede usarlo (403) y la Cajera no ajusta inventario (403)', async () => {
    expect((await ajustar({ localId: locales[0].id, cantidad: 5, token: permiso }, TI)).status).toBe(403);
    expect((await ajustar({ localId: locales[0].id, cantidad: 5, token: permiso }, CAJERA)).status).toBe(403);
    expect((await como(CAJERA, 'post', '/inventario/verificar', { password: CLAVE })).status).toBe(403);
  });
  it('subir el stock registra una entrada con su saldo y su motivo, y queda auditado', async () => {
    const r = await ajustar({ localId: locales[0].id, cantidad: 12, motivo: 'Conteo inicial', token: permiso });
    expect(r.status).toBe(201);
    expect(r.body.stockTotal).toBe(12);
    const m = await movimientos();
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ tipo: 'Ajuste de inventario', local: locales[0].nombre, entrada: 12, salida: 0, saldo: 12, motivo: 'Conteo inicial' });
    expect(await prisma.auditoria.count({ where: { tabla: 'stock_producto', registroId: productoId, motivo: 'Ajuste de inventario' } })).toBe(1);
  });
  it('bajar el stock registra una salida; el mismo valor no crea movimiento', async () => {
    const r = await ajustar({ localId: locales[0].id, cantidad: 7.5, token: permiso });
    expect(r.body.stockTotal).toBe(7.5);
    let m = await movimientos();
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ entrada: 0, salida: 4.5, saldo: 7.5 });
    expect(m[0].motivo).toMatch(/De 12 a 7\.5/);
    await ajustar({ localId: locales[0].id, cantidad: 7.5, token: permiso });
    m = await movimientos();
    expect(m).toHaveLength(2);
  });
  it('cada local lleva su propio stock y el total los suma', async () => {
    const r = await ajustar({ localId: locales[1].id, cantidad: 3, token: permiso });
    expect(r.body.stockTotal).toBe(10.5);
    const filas = await prisma.stockProducto.findMany({ where: { productoId } });
    expect(filas.map((f) => Number(f.cantidad)).sort((a, b) => a - b)).toEqual([3, 7.5]);
    expect((await movimientos())[0]).toMatchObject({ local: locales[1].nombre, entrada: 3, saldo: 3 });
  });
  it('valida el local, la cantidad y el producto', async () => {
    expect((await ajustar({ localId: 'no-existe', cantidad: 1, token: permiso })).status).toBe(400);
    expect((await ajustar({ localId: locales[0].id, cantidad: -1, token: permiso })).status).toBe(400);
    expect((await ajustar({ localId: locales[0].id, token: permiso })).status).toBe(400);
    expect((await como(ADMIN, 'post', '/productos/no-existe/ajuste', { localId: locales[0].id, cantidad: 1, token: permiso })).status).toBe(404);
    expect((await como(ADMIN, 'get', '/productos/no-existe/movimientos')).status).toBe(404);
  });
});
