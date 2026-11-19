// Cierre con cuadre ODS ↔ comprobante, y garantía enlazada (orden de origen, servicios y montos en cero).
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { cuadreOrdenComprobante } from '../src/ordenServicio/cuadre';

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
const CAJERA = 'cajera@demo.local', ADMIN = 'admin@demo.local';
const sx = `${Date.now() % 100000}`;
let clienteId = '', otroCliente = '', k = 0;
const clientes: string[] = [];

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  clienteId = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `2${sx.padStart(5, '0')}41`, nombre: 'Cliente Garantía' })).body.id;
  otroCliente = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `2${sx.padStart(5, '0')}42`, nombre: 'Otro Cliente Garantía' })).body.id;
  clientes.push(clienteId, otroCliente);
});
afterAll(async () => {
  const ordenes = (await prisma.ordenServicio.findMany({ where: { clienteId: { in: clientes } } })).map((o) => o.id);
  const notas = (await prisma.notaVenta.findMany({ where: { clienteId: { in: clientes } } })).map((n) => n.id);
  await prisma.abono.deleteMany({ where: { OR: [{ ordenId: { in: ordenes } }, { notaId: { in: notas } }] } });
  await prisma.notaVenta.deleteMany({ where: { id: { in: notas } } });
  await prisma.ordenServicio.updateMany({ where: { id: { in: ordenes } }, data: { garantiaDeId: null } });
  for (const t of ['solicitudOds', 'evidenciaIngreso', 'detalleODS', 'bitacora'] as const) await (prisma[t] as unknown as { deleteMany: (a: object) => Promise<unknown> }).deleteMany({ where: { ordenId: { in: ordenes } } });
  await prisma.ordenServicio.deleteMany({ where: { id: { in: ordenes } } });
  const vs = (await prisma.vehiculo.findMany({ where: { clienteId: { in: clientes } } })).map((v) => v.id);
  await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs } } });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vs } } });
  await prisma.auditoria.deleteMany({ where: { registroId: { in: [...ordenes, ...notas, ...vs, ...clientes] } } });
  await prisma.cliente.deleteMany({ where: { id: { in: clientes } } });
  await app.close();
  await prisma.$disconnect();
});

const sv = (descripcion: string, precio: number, extra: object = {}) => ({ tipo: 'servicio', descripcion, precio, cantidad: 1, ...extra });
const vehiculo = async (cliente = clienteId) => (await como(CAJERA, 'post', '/vehiculos', { clienteId: cliente, placa: `GA${sx}${k++}` })).body;
const orden = async (v: { id: string }, detalles: object[] = [], extra: object = {}) => {
  const o = (await como(CAJERA, 'post', '/ordenes', { vehiculoId: v.id, tipoAtencion: 'Mantenimiento correctivo', ...extra })).body;
  if (detalles.length) return (await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles })).body;
  return o;
};

describe('cuadre entre la orden y el comprobante (regla pura)', () => {
  const l = (descripcion: string, total: number, tipo = 'servicio', cantidad = 1) => ({ tipo, descripcion, cantidad, total });
  it('cuadra con los mismos ítems en otro orden, sin importar tildes ni mayúsculas; avisa qué falta y qué sobra', () => {
    expect(cuadreOrdenComprobante([l('Cambio de aceite', 100), l('Filtro', 40, 'producto', 2)], [l('FILTRO', 40, 'producto', 2), l('Cambio de áceite', 100)]).cuadra).toBe(true);
    const r = cuadreOrdenComprobante([l('Cambio de aceite', 100), l('Alineación', 60)], [l('Cambio de aceite', 100), l('Alineación', 80)]);
    expect(r).toMatchObject({ cuadra: false, totalOrden: 160, totalComprobante: 180 });
    expect(r.faltanEnComprobante[0]).toContain('Alineación');
    expect(r.sobranEnComprobante[0]).toContain('80.00');
    expect(cuadreOrdenComprobante([l('A', 50)], [l('A', 50), l('A', 50)]).cuadra).toBe(false);
  });
});

describe('cierre de la ODS', () => {
  it('se cierra sin comprobante con cualquier decisión; queda «Sin comprobante»', async () => {
    const o = await orden(await vehiculo(), [sv('Servicio sin factura', 80)]);
    expect((await como(CAJERA, 'get', `/ordenes/${o.id}`)).body.decision).not.toBe('No aprobada');
    const c = await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'Cerrada' });
    expect(c.status).toBe(200);
    expect(c.body).toMatchObject({ estado: 'Cerrada', conComprobante: false });
  });
  it('con comprobante que cuadra se cierra; si el comprobante se rehízo con otros montos, no deja cerrar y dice qué no coincide', async () => {
    const v = await vehiculo();
    const o = await orden(v, [sv('Cambio de aceite', 100), sv('Alineación', 60)]);
    const n1 = (await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, {})).body;
    expect((await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'Cerrada' })).status).toBe(200);
    // Otra orden: la nota se elimina, la orden cambia y se vuelve a emitir directo con un monto distinto → no cuadra.
    const o2 = await orden(v, [sv('Cambio de aceite', 100)]);
    const n2 = (await como(CAJERA, 'post', `/ordenes/${o2.id}/nota-venta`, {})).body;
    await como(ADMIN, 'post', `/notas-venta/${n2.id}/anular`, { motivo: 'Se corrige' });
    const rehecha = await como(CAJERA, 'post', '/notas-venta', { ordenId: o2.id, items: [{ tipo: 'servicio', descripcion: 'Cambio de aceite', cantidad: 1, precio: 120 }] });
    expect(rehecha.status).toBe(201);
    const malo = await como(CAJERA, 'patch', `/ordenes/${o2.id}`, { estado: 'Cerrada' });
    expect(malo.status).toBe(409);
    expect(malo.body.message).toMatch(/no cuadra con el comprobante/);
    expect(malo.body.message).toMatch(/S\/ 100\.00 y el del comprobante S\/ 120\.00/);
    expect(n1.codigo).toBeDefined();
    // Se corrige el comprobante igual que la orden y entonces sí se cierra.
    await como(ADMIN, 'post', `/notas-venta/${rehecha.body.id}/anular`, { motivo: 'Mal monto' });
    await como(CAJERA, 'post', '/notas-venta', { ordenId: o2.id, items: [{ tipo: 'servicio', descripcion: 'Cambio de aceite', cantidad: 1, precio: 100 }] });
    expect((await como(CAJERA, 'patch', `/ordenes/${o2.id}`, { estado: 'Cerrada' })).status).toBe(200);
  });
});

describe('garantía enlazada', () => {
  it('se enlaza a una orden del mismo cliente con los servicios elegidos; devuelve la orden de origen y el técnico de cada servicio', async () => {
    const v = await vehiculo();
    const tecnico = (await prisma.usuario.findUniqueOrThrow({ where: { correo: 'tecnico@demo.local' } })).id;
    const origen = await orden(v, [sv('Cambio de embrague', 300, { tecnicoId: tecnico }), sv('Lavado', 30)]);
    const embrague = origen.detalles.find((d: { descripcion: string }) => d.descripcion === 'Cambio de embrague');
    const g = await como(CAJERA, 'post', '/ordenes', { vehiculoId: v.id, tipoAtencion: 'Garantía', garantiaDeId: origen.id, garantiaDetalleIds: [embrague.id] });
    expect(g.status).toBe(201);
    expect(g.body.garantia).toMatchObject({ ordenId: origen.id, codigo: origen.codigo, servicios: [{ id: embrague.id, descripcion: 'Cambio de embrague', total: 300, tecnico: { nombre: 'Técnico Demo 1' } }] });
  });
  it('rechaza origen de otro cliente, sin servicios, con un producto, de una garantía o inexistente', async () => {
    const v = await vehiculo(), vOtro = await vehiculo(otroCliente);
    const origen = await orden(v, [sv('Servicio A', 100), { tipo: 'producto', descripcion: 'Aceite', precio: 20, cantidad: 1 }]);
    const sA = origen.detalles.find((d: { tipo: string }) => d.tipo === 'servicio').id, prod = origen.detalles.find((d: { tipo: string }) => d.tipo === 'producto').id;
    const pide = (extra: object, veh = v) => como(CAJERA, 'post', '/ordenes', { vehiculoId: veh.id, tipoAtencion: 'Garantía', ...extra });
    expect((await pide({ garantiaDeId: origen.id, garantiaDetalleIds: [sA] }, vOtro)).status).toBe(409);
    expect((await pide({ garantiaDeId: origen.id, garantiaDetalleIds: [] })).status).toBe(400);
    expect((await pide({ garantiaDeId: origen.id })).status).toBe(400);
    expect((await pide({ garantiaDeId: origen.id, garantiaDetalleIds: [prod] })).status).toBe(400);
    expect((await pide({ garantiaDeId: origen.id, garantiaDetalleIds: ['no-existe'] })).status).toBe(400);
    expect((await pide({ garantiaDeId: 'no-existe', garantiaDetalleIds: [sA] })).status).toBe(404);
    expect((await pide({ garantiaDeId: { $ne: 1 }, garantiaDetalleIds: [sA] })).status).toBe(400);
    const buena = await pide({ garantiaDeId: origen.id, garantiaDetalleIds: [sA] });
    expect(buena.status).toBe(201);
    await como(CAJERA, 'patch', `/ordenes/${buena.body.id}`, { estado: 'Cerrada' });
    const v3 = await vehiculo();
    expect((await como(CAJERA, 'post', '/ordenes', { vehiculoId: v3.id, tipoAtencion: 'Garantía', garantiaDeId: buena.body.id, garantiaDetalleIds: [buena.body.detalles[0]?.id ?? 'x'] })).status).toBeGreaterThanOrEqual(400);
  });
  it('una ODS de garantía lleva todos sus montos en cero aunque se manden precios, no se factura y se cierra sin pedir nada', async () => {
    const v = await vehiculo();
    const g = await orden(v, [sv('Reparación en garantía', 250), { tipo: 'producto', descripcion: 'Repuesto', precio: 40, cantidad: 2 }], { tipoAtencion: 'Garantía' });
    expect(g.total).toBe(0);
    expect(g.detalles.every((d: { total: number; precio: number }) => d.total === 0 && d.precio === 0)).toBe(true);
    expect((await como(CAJERA, 'post', `/ordenes/${g.id}/nota-venta`, {})).status).toBe(409);
    expect((await como(CAJERA, 'post', '/notas-venta', { ordenId: g.id, items: [{ tipo: 'servicio', descripcion: 'x', cantidad: 1, precio: 10 }] })).status).toBe(409);
    expect((await como(CAJERA, 'post', `/ordenes/${g.id}/abonos`, { metodo: 'Efectivo', valor: 10 })).status).toBe(400);
    const c = await como(CAJERA, 'patch', `/ordenes/${g.id}`, { estado: 'Cerrada' });
    expect(c.status).toBe(200);
  });
  it('al cambiar una orden con montos a «Garantía» se ponen en cero; con adelantos o comprobante no se deja; al volver a otro tipo se quita el enlace', async () => {
    const v = await vehiculo();
    const o = await orden(v, [sv('Servicio con monto', 90)]);
    const g = await como(CAJERA, 'patch', `/ordenes/${o.id}`, { tipoAtencion: 'Garantía' });
    expect(g.status).toBe(200);
    expect(g.body.total).toBe(0);
    const o2 = await orden(await vehiculo(), [sv('Otro', 70)]);
    await como(CAJERA, 'post', `/ordenes/${o2.id}/abonos`, { metodo: 'Efectivo', valor: 10 });
    expect((await como(CAJERA, 'patch', `/ordenes/${o2.id}`, { tipoAtencion: 'Garantía' })).status).toBe(409);
    const origen = await orden(await vehiculo(), [sv('Servicio origen', 100)]);
    const ge = (await como(CAJERA, 'post', '/ordenes', { vehiculoId: (await vehiculo()).id, tipoAtencion: 'Garantía', garantiaDeId: origen.id, garantiaDetalleIds: [origen.detalles[0].id] })).body;
    const vuelta = await como(CAJERA, 'patch', `/ordenes/${ge.id}`, { tipoAtencion: 'Mantenimiento correctivo' });
    expect(vuelta.body.garantia).toBeNull();
  });
});
