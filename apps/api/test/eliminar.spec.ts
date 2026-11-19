// «Eliminar» en todas las tablas: sin uso se borra; con historial sale de la lista activa (o se rechaza si no hay cómo).
// La ODS se elimina aunque tenga adelantos (quedan registrados), pero no con un comprobante vigente.
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
const como = async (c: string, metodo: 'get' | 'post' | 'patch' | 'put' | 'delete', ruta: string, cuerpo?: object) => {
  const t = await tokenDe(c);
  const r = request(app.getHttpServer())[metodo](ruta).set('Authorization', `Bearer ${t}`);
  return cuerpo ? r.send(cuerpo) : r;
};
const ADMIN = 'admin@demo.local', CAJERA = 'cajera@demo.local';
const sx = `${Date.now() % 100000}`;
const clientes: string[] = [];

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
});
afterAll(async () => {
  const ordenes = (await prisma.ordenServicio.findMany({ where: { clienteId: { in: clientes } } })).map((o) => o.id);
  const notas = (await prisma.notaVenta.findMany({ where: { clienteId: { in: clientes } } })).map((n) => n.id);
  await prisma.abono.deleteMany({ where: { OR: [{ ordenId: { in: ordenes } }, { notaId: { in: notas } }] } });
  await prisma.notaVenta.deleteMany({ where: { id: { in: notas } } });
  for (const t of ['solicitudOds', 'evidenciaIngreso', 'detalleODS', 'bitacora'] as const) await (prisma[t] as unknown as { deleteMany: (a: object) => Promise<unknown> }).deleteMany({ where: { ordenId: { in: ordenes } } });
  await prisma.ordenServicio.deleteMany({ where: { id: { in: ordenes } } });
  const vs = (await prisma.vehiculo.findMany({ where: { clienteId: { in: clientes } } })).map((v) => v.id);
  await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs } } });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vs } } });
  await prisma.cliente.deleteMany({ where: { id: { in: clientes } } });
  await app.close();
  await prisma.$disconnect();
});
const nuevoCliente = async (k: string) => {
  const c = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `3${sx.padStart(5, '0')}${k}`, nombre: `Cliente eliminar ${k}` })).body;
  clientes.push(c.id);
  return c;
};

describe('eliminar en las tablas', () => {
  it('cliente sin historial se borra; con vehículo sale de la lista activa', async () => {
    const libre = await nuevoCliente('11');
    expect((await como(CAJERA, 'delete', `/clientes/${libre.id}`)).body).toEqual({ ok: true, eliminado: true });
    expect(await prisma.cliente.count({ where: { id: libre.id } })).toBe(0);
    const usado = await nuevoCliente('12');
    await como(CAJERA, 'post', '/vehiculos', { clienteId: usado.id, placa: `EL${sx}1` });
    expect((await como(CAJERA, 'delete', `/clientes/${usado.id}`)).body).toEqual({ ok: true, eliminado: false });
    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: usado.id } })).activo).toBe(false);
  });
  it('vehículo sin órdenes se borra con sus lecturas; con orden no se elimina', async () => {
    const c = await nuevoCliente('13');
    const v = (await como(CAJERA, 'post', '/vehiculos', { clienteId: c.id, placa: `EL${sx}2` })).body;
    await como(CAJERA, 'post', `/vehiculos/${v.id}/lecturas`, { km: 1000 });
    expect((await como(CAJERA, 'delete', `/vehiculos/${v.id}`)).status).toBe(200);
    expect(await prisma.vehiculo.count({ where: { id: v.id } })).toBe(0);
    const v2 = (await como(CAJERA, 'post', '/vehiculos', { clienteId: c.id, placa: `EL${sx}3` })).body;
    await como(CAJERA, 'post', '/ordenes', { vehiculoId: v2.id, tipoAtencion: 'Mantenimiento correctivo' });
    expect((await como(CAJERA, 'delete', `/vehiculos/${v2.id}`)).status).toBe(409);
  });
  it('producto y proveedor sin uso se borran; un producto con movimientos queda inactivo', async () => {
    const prov = (await como(ADMIN, 'post', '/proveedores', { tipoDocumento: 'RUC', documento: `20${sx.padStart(5, '0')}0055`, nombre: 'Proveedor a eliminar' })).body;
    const libre = (await como(ADMIN, 'post', '/productos', { codigo: `ELP${sx}`, nombre: 'Producto libre', precio: 5, proveedorId: prov.id })).body;
    expect((await como(ADMIN, 'delete', `/productos/${libre.id}`)).body.eliminado).toBe(true);
    expect((await como(ADMIN, 'delete', `/proveedores/${prov.id}`)).body.eliminado).toBe(true);
    const usado = (await como(ADMIN, 'post', '/productos', { codigo: `ELQ${sx}`, nombre: 'Producto usado', precio: 5 })).body;
    await prisma.movimientoInventario.create({ data: { productoId: usado.id, localId: (await prisma.local.findFirstOrThrow()).id, tipo: 'Ajuste', entrada: 1, salida: 0, saldo: 1, usuarioId: (await prisma.usuario.findUniqueOrThrow({ where: { correo: ADMIN } })).id } });
    expect((await como(ADMIN, 'delete', `/productos/${usado.id}`)).body.eliminado).toBe(false);
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: usado.id } })).activo).toBe(false);
    await prisma.movimientoInventario.deleteMany({ where: { productoId: usado.id } });
    await prisma.producto.delete({ where: { id: usado.id } });
  });
  it('un usuario no se elimina a sí mismo; uno nuevo sin movimientos se borra', async () => {
    const yo = await prisma.usuario.findUniqueOrThrow({ where: { correo: ADMIN } });
    expect((await como(ADMIN, 'delete', `/usuarios/${yo.id}`)).status).toBe(400);
    const rol = await prisma.rol.findFirstOrThrow({ where: { organizacionId: yo.organizacionId, nombre: 'Cajera' } });
    const u = (await como(ADMIN, 'post', '/usuarios', { nombre: 'Usuario a eliminar', correo: `el${sx}@demo.local`, password: 'Clave123!', rolIds: [rol.id] })).body;
    expect((await como(ADMIN, 'delete', `/usuarios/${u.id}`)).body).toEqual({ ok: true, eliminado: true });
    expect(await prisma.usuario.count({ where: { id: u.id } })).toBe(0);
  });
});

describe('eliminar la ODS', () => {
  it('con adelantos se elimina y los adelantos quedan registrados; con comprobante vigente no', async () => {
    const c = await nuevoCliente('14');
    const v = (await como(CAJERA, 'post', '/vehiculos', { clienteId: c.id, placa: `EL${sx}4` })).body;
    const o = (await como(CAJERA, 'post', '/ordenes', { vehiculoId: v.id, tipoAtencion: 'Mantenimiento correctivo' })).body;
    await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'Servicio', precio: 200, cantidad: 1 }] });
    await como(CAJERA, 'post', `/ordenes/${o.id}/abonos`, { metodo: 'Yape', valor: 50 });
    expect((await como(ADMIN, 'delete', `/ordenes/${o.id}`, { motivo: 'El cliente desistió' })).status).toBe(200);
    expect(await prisma.abono.count({ where: { ordenId: o.id } })).toBe(1);
    expect(await prisma.bitacora.count({ where: { ordenId: o.id, texto: { contains: 'adelantos (S/ 50.00) quedan registrados' } } })).toBe(1);
    const o2 = (await como(CAJERA, 'post', '/ordenes', { vehiculoId: v.id, tipoAtencion: 'Mantenimiento correctivo' })).body;
    await como(CAJERA, 'put', `/ordenes/${o2.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'Servicio', precio: 100, cantidad: 1 }] });
    const n = (await como(CAJERA, 'post', `/ordenes/${o2.id}/nota-venta`, {})).body;
    expect((await como(ADMIN, 'delete', `/ordenes/${o2.id}`, { motivo: 'x' })).status).toBe(409);
    await como(ADMIN, 'post', `/notas-venta/${n.id}/anular`, { motivo: 'Se rehace' });
    expect((await como(ADMIN, 'delete', `/ordenes/${o2.id}`, { motivo: 'x' })).status).toBe(200);
  });
});
