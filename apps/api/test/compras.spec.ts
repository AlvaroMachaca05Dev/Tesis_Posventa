// Compras (entrada de stock), cuentas por cobrar (cobros a notas) y cuentas por pagar (pagos a proveedores).
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
const ADMIN = 'admin@demo.local', CAJERA = 'cajera@demo.local', LOGISTICO = 'logistico@demo.local', TECNICO = 'tecnico@demo.local';
const sx = `${Date.now() % 100000}`;
let proveedorId = '', productoId = '', localId = '', clienteId = '';
const hoy = new Date().toISOString().slice(0, 10);
const enDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
let k = 0;
const compra = (extra: object = {}) => ({ proveedorId, localId, tipoDocumento: 'FACTURA', serie: 'F001', numero: `${sx}${k++}`, fecha: hoy, condicion: 'CONTADO', items: [{ productoId, cantidad: 10, costo: 12.5 }], ...extra });
const stock = async () => Number((await prisma.stockProducto.findUnique({ where: { productoId_localId: { productoId, localId } } }))?.cantidad ?? 0);

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  proveedorId = (await como(ADMIN, 'post', '/proveedores', { tipoDocumento: 'RUC', documento: `20${sx.padStart(5, '0')}0077`, nombre: 'Proveedor Compras Prueba' })).body.id;
  productoId = (await como(ADMIN, 'post', '/productos', { codigo: `CMP${sx}`, nombre: 'Producto compra prueba', precio: 30 })).body.id;
  localId = (await prisma.usuario.findUniqueOrThrow({ where: { correo: CAJERA } })).localId as string;
  clienteId = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `4${sx.padStart(5, '0')}29`, nombre: 'Cliente Cuentas Prueba' })).body.id;
});
afterAll(async () => {
  const compras = await prisma.compra.findMany({ where: { proveedorId } });
  await prisma.compra.deleteMany({ where: { proveedorId } });
  const notas = await prisma.notaVenta.findMany({ where: { clienteId } });
  const ordenes = await prisma.ordenServicio.findMany({ where: { clienteId } });
  await prisma.abono.deleteMany({ where: { OR: [{ notaId: { in: notas.map((x) => x.id) } }, { ordenId: { in: ordenes.map((o) => o.id) } }] } });
  await prisma.notaVenta.deleteMany({ where: { clienteId } });
  for (const t of ['solicitudOds', 'evidenciaIngreso', 'detalleODS', 'bitacora'] as const) await (prisma[t] as unknown as { deleteMany: (a: object) => Promise<unknown> }).deleteMany({ where: { ordenId: { in: ordenes.map((o) => o.id) } } });
  await prisma.ordenServicio.deleteMany({ where: { clienteId } });
  const vs = await prisma.vehiculo.findMany({ where: { clienteId } });
  await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs.map((v) => v.id) } } });
  await prisma.vehiculo.deleteMany({ where: { clienteId } });
  await prisma.movimientoInventario.deleteMany({ where: { productoId } });
  await prisma.stockProducto.deleteMany({ where: { productoId } });
  await prisma.auditoria.deleteMany({ where: { registroId: { in: [...compras.map((c) => c.id), ...notas.map((x) => x.id), ...ordenes.map((o) => o.id), proveedorId, productoId, clienteId] } } });
  await prisma.producto.deleteMany({ where: { id: productoId } });
  await prisma.proveedor.deleteMany({ where: { id: proveedorId } });
  await prisma.cliente.deleteMany({ where: { id: clienteId } });
  await app.close();
  await prisma.$disconnect();
});

describe('compras', () => {
  it('al contado: sube el stock, deja el kárdex, actualiza el costo y queda pagada', async () => {
    const antes = await stock();
    const r = await como(LOGISTICO, 'post', '/compras', compra({ items: [{ productoId, cantidad: 10, costo: 12.5, descuento: 5 }, { descripcion: 'Flete', cantidad: 1, costo: 20 }] }));
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ total: 140, pagado: 140, saldo: 0, estado: 'REGISTRADA', condicion: 'CONTADO', proveedor: { id: proveedorId } });
    expect(await stock()).toBe(antes + 10);
    expect(Number((await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).costo)).toBe(12);
    expect(await prisma.movimientoInventario.count({ where: { productoId, tipo: 'Compra' } })).toBeGreaterThanOrEqual(1);
    expect((await como(LOGISTICO, 'get', '/compras')).body.some((x: { id: string }) => x.id === r.body.id)).toBe(true);
  });
  it('rechaza datos inválidos (400) y el comprobante repetido del mismo proveedor (409)', async () => {
    const malos: object[] = [
      { proveedorId: 'no-existe' }, { localId: 'no-existe' }, { tipoDocumento: 'RECIBO' }, { serie: '' }, { serie: "F0'1;DROP" }, { serie: 'F00001' },
      { numero: 'abc' }, { numero: '12345678901' }, { fecha: 'ayer' }, { fecha: '2999-01-01' }, { fecha: enDias(5) }, { condicion: 'FIADO' },
      { condicion: 'CREDITO' }, { condicion: 'CREDITO', fechaVencimiento: '2020-01-01' }, { metodo: 'Trueque' }, { items: [] }, { items: 'x' },
      { items: [{ productoId, cantidad: -1, costo: 5 }] }, { items: [{ productoId, cantidad: 0, costo: 5 }] }, { items: [{ productoId, cantidad: 'diez', costo: 5 }] },
      { items: [{ productoId, cantidad: 1e12, costo: 5 }] }, { items: [{ productoId, cantidad: 1, costo: -5 }] }, { items: [{ productoId, cantidad: 1, costo: 'NaN' }] },
      { items: [{ productoId, cantidad: 1, costo: 5, descuento: 6 }] }, { items: [{ cantidad: 1, costo: 5 }] }, { items: [{ productoId: 'otro', cantidad: 1, costo: 5 }] },
      { items: [{ productoId, cantidad: 1, costo: 0 }] }, { items: Array.from({ length: 201 }, () => ({ productoId, cantidad: 1, costo: 1 })) },
      { items: [{ descripcion: 'x'.repeat(301), cantidad: 1, costo: 1 }] }, { observaciones: 'x'.repeat(1001) },
    ];
    for (const m of malos) {
      const r = await como(LOGISTICO, 'post', '/compras', compra(m));
      expect([m, r.status]).toEqual([m, 400]);
    }
    const ok = compra();
    expect((await como(LOGISTICO, 'post', '/compras', ok)).status).toBe(201);
    expect((await como(LOGISTICO, 'post', '/compras', { ...ok, serie: 'f001' })).status).toBe(409);
    expect((await como(TECNICO, 'post', '/compras', compra())).status).toBe(403);
  });
  it('se anula con motivo y nivel «todo»: el stock sale y ya no admite pagos', async () => {
    const c = (await como(LOGISTICO, 'post', '/compras', compra({ condicion: 'CREDITO', fechaVencimiento: enDias(30) }))).body;
    const antes = await stock();
    expect((await como(LOGISTICO, 'post', `/compras/${c.id}/anular`, { motivo: 'Error' })).status).toBe(403);
    expect((await como(ADMIN, 'post', `/compras/${c.id}/anular`, {})).status).toBe(400);
    const a = await como(ADMIN, 'post', `/compras/${c.id}/anular`, { motivo: 'Factura mal digitada' });
    expect(a.body).toMatchObject({ estado: 'ANULADA', saldo: 0, anuladaPor: 'Administrador Demo' });
    expect(await stock()).toBe(antes - 10);
    expect((await como(ADMIN, 'post', `/compras/${c.id}/anular`, { motivo: 'Otra' })).status).toBe(409);
    expect((await como(CAJERA, 'post', `/compras/${c.id}/pagos`, { metodo: 'Efectivo', valor: 10 })).status).toBe(409);
  });
});

describe('cuentas por pagar', () => {
  it('la compra a crédito aparece con su saldo; los pagos lo bajan hasta cero y entonces sale de la lista', async () => {
    const c = (await como(LOGISTICO, 'post', '/compras', compra({ condicion: 'CREDITO', fechaVencimiento: enDias(15) }))).body;
    expect(c).toMatchObject({ total: 125, pagado: 0, saldo: 125 });
    expect((await como(CAJERA, 'get', '/cuentas-pagar')).body.find((x: { id: string }) => x.id === c.id)).toMatchObject({ saldo: 125 });
    expect((await como(CAJERA, 'post', `/compras/${c.id}/pagos`, { metodo: 'Transferencia', valor: 200 })).status).toBe(400);
    for (const m of [{ metodo: 'Plin', valor: 10 }, { metodo: 'Efectivo', valor: 0 }, { metodo: 'Efectivo', valor: -5 }, { metodo: 'Efectivo', valor: 'diez' }, { metodo: 'Efectivo', valor: 10, concepto: 'x'.repeat(201) }]) {
      expect((await como(CAJERA, 'post', `/compras/${c.id}/pagos`, m)).status).toBe(400);
    }
    const p1 = await como(CAJERA, 'post', `/compras/${c.id}/pagos`, { metodo: 'Transferencia', valor: 100.004, concepto: 'Primer pago' });
    expect(p1.status).toBe(201);
    expect(p1.body).toMatchObject({ pagado: 100, saldo: 25 });
    await como(CAJERA, 'post', `/compras/${c.id}/pagos`, { metodo: 'Efectivo', valor: 25 });
    expect((await como(CAJERA, 'get', '/cuentas-pagar')).body.some((x: { id: string }) => x.id === c.id)).toBe(false);
    expect((await como(TECNICO, 'get', '/cuentas-pagar')).status).toBe(403);
    expect((await como(CAJERA, 'post', '/compras/no-existe/pagos', { metodo: 'Efectivo', valor: 1 })).status).toBe(404);
  });
  it('dos pagos simultáneos no pasan del saldo', async () => {
    const c = (await como(LOGISTICO, 'post', '/compras', compra({ condicion: 'CREDITO', fechaVencimiento: enDias(15) }))).body;
    const rs = await Promise.all([1, 2, 3].map(() => como(CAJERA, 'post', `/compras/${c.id}/pagos`, { metodo: 'Efectivo', valor: 100 })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await como(LOGISTICO, 'get', `/compras/${c.id}`)).body.pagado).toBe(100);
  });
});

describe('cuentas por cobrar', () => {
  const item = { tipo: 'servicio', descripcion: 'Servicio a crédito', cantidad: 1, precio: 300, tipoIgv: 'GRAVADO' };
  it('la nota a crédito aparece con su saldo; los cobros lo bajan y sale de la lista al quedar en cero', async () => {
    const n = (await como(CAJERA, 'post', '/notas-venta', { clienteId, items: [item], condicion: 'CREDITO', fechaVencimiento: enDias(10), pagos: [{ metodo: 'Efectivo', valor: 50 }] })).body;
    expect((await como(CAJERA, 'get', '/cuentas-cobrar')).body.find((x: { id: string }) => x.id === n.id)).toMatchObject({ saldo: 250 });
    expect((await como(CAJERA, 'post', `/notas-venta/${n.id}/cobros`, { metodo: 'Yape', valor: 251 })).status).toBe(400);
    const c = await como(CAJERA, 'post', `/notas-venta/${n.id}/cobros`, { metodo: 'Yape', valor: 200 });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ pagado: 250, saldo: 50 });
    expect(c.body.pagos).toHaveLength(2);
    await como(CAJERA, 'post', `/notas-venta/${n.id}/cobros`, { metodo: 'Efectivo', valor: 50 });
    expect((await como(CAJERA, 'get', '/cuentas-cobrar')).body.some((x: { id: string }) => x.id === n.id)).toBe(false);
    expect((await como(TECNICO, 'post', `/notas-venta/${n.id}/cobros`, { metodo: 'Efectivo', valor: 1 })).status).toBe(403);
  });
  it('el cobro de una nota con ODS cerrada se registra en la orden y queda en su bitácora', async () => {
    const v = (await como(CAJERA, 'post', '/vehiculos', { clienteId, placa: `CX${sx}` })).body;
    const o = (await como(CAJERA, 'post', '/ordenes', { vehiculoId: v.id, tipoAtencion: 'Mantenimiento correctivo' })).body;
    await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'Servicio', precio: 120, cantidad: 1 }] });
    const n = (await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, { condicion: 'CREDITO', fechaVencimiento: enDias(5) })).body;
    expect((await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'Cerrada' })).status).toBe(200);
    const c = await como(CAJERA, 'post', `/notas-venta/${n.id}/cobros`, { metodo: 'Efectivo', valor: 120 });
    expect(c.body).toMatchObject({ saldo: 0, pagado: 120 });
    expect(await prisma.abono.count({ where: { ordenId: o.id } })).toBe(1);
    expect(await prisma.bitacora.count({ where: { ordenId: o.id, texto: { contains: 'Cobro de S/ 120.00' } } })).toBe(1);
  });
  it('no se cobra una nota anulada', async () => {
    const n = (await como(CAJERA, 'post', '/notas-venta', { clienteId, items: [item] })).body;
    await como(ADMIN, 'post', `/notas-venta/${n.id}/anular`, { motivo: 'Prueba' });
    expect((await como(CAJERA, 'post', `/notas-venta/${n.id}/cobros`, { metodo: 'Efectivo', valor: 10 })).status).toBe(409);
  });
});
