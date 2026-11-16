// Nota de venta (RF-088, RN-03, RN-15; DEC-74, DEC-75, DEC-76, DEC-82): serie del local, número consecutivo, IGV por ítem,
// detracción, stock, cierre de la ODS y anulación.
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { codigoNota, detraccionDe, proponeDetraccion, tipoIgvPorDefecto, totalesNota } from '../src/facturacion/notaVenta.reglas';

const prisma = new PrismaClient();
let app: INestApplication;
const CLAVE = process.env.SEED_PASSWORD as string;
const tokens: Record<string, string> = {};
const tokenDe = async (c: string) => (tokens[c] ??= (await request(app.getHttpServer()).post('/auth/login').send({ correo: c, password: CLAVE })).body.token as string);
const como = async (c: string, metodo: 'get' | 'post' | 'patch' | 'put', ruta: string, cuerpo?: object) => {
  const t = await tokenDe(c); // primero el token: la petición se arma sobre el servidor ya libre
  const r = request(app.getHttpServer())[metodo](ruta).set('Authorization', `Bearer ${t}`);
  return cuerpo ? r.send(cuerpo) : r;
};
const ADMIN = 'admin@demo.local';
const CAJERA = 'cajera@demo.local';
const TECNICO = 'tecnico@demo.local';
const sx = `${Date.now() % 100000}`;
let clienteId = '';
let productoId = '';
let localCajera = '';
let serie = '';
let k = 0;

const nuevaOds = async (detalles: object[]) => {
  const v = (await como(CAJERA, 'post', '/vehiculos', { clienteId, placa: `NV${sx}${k++}` })).body;
  const o = (await como(CAJERA, 'post', '/ordenes', { vehiculoId: v.id, tipoAtencion: 'Mantenimiento correctivo' })).body;
  return (await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles })).body;
};
const servicio = (precio: number, extra: object = {}) => ({ tipo: 'servicio', descripcion: 'Servicio de prueba', precio, cantidad: 1, ...extra });

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  clienteId = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `5${sx.padStart(5, '0')}09`, nombre: 'Cliente Nota Prueba' })).body.id;
  productoId = (await como(ADMIN, 'post', '/productos', { codigo: `NVP${sx}`, nombre: 'Producto nota prueba', precio: 20 })).body.id;
  const cajera = await prisma.usuario.findUniqueOrThrow({ where: { correo: CAJERA }, include: { local: true } });
  localCajera = cajera.localId as string;
  serie = cajera.local?.serieNotaVenta as string;
});
afterAll(async () => {
  if (clienteId) {
    const ordenes = await prisma.ordenServicio.findMany({ where: { clienteId } });
    const ids = ordenes.map((o) => o.id);
    const notas = await prisma.notaVenta.findMany({ where: { ordenId: { in: ids } } });
    await prisma.notaVenta.deleteMany({ where: { ordenId: { in: ids } } });
    for (const t of ['solicitudOds', 'abono', 'evidenciaIngreso', 'detalleODS', 'bitacora'] as const) await (prisma[t] as unknown as { deleteMany: (a: object) => Promise<unknown> }).deleteMany({ where: { ordenId: { in: ids } } });
    await prisma.ordenServicio.deleteMany({ where: { id: { in: ids } } });
    const vs = await prisma.vehiculo.findMany({ where: { clienteId } });
    await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs.map((v) => v.id) } } });
    await prisma.vehiculo.deleteMany({ where: { clienteId } });
    await prisma.movimientoInventario.deleteMany({ where: { productoId } });
    await prisma.stockProducto.deleteMany({ where: { productoId } });
    await prisma.auditoria.deleteMany({ where: { registroId: { in: [...ids, ...notas.map((x) => x.id), ...vs.map((v) => v.id), clienteId, productoId] } } });
    await prisma.producto.deleteMany({ where: { id: productoId } });
    await prisma.cliente.deleteMany({ where: { id: clienteId } });
  }
  await app.close();
  await prisma.$disconnect();
});

describe('reglas de la nota de venta (RN-15)', () => {
  it('un ítem gravado ya incluye el IGV: base = total / 1,18; exonerado e inafecto van aparte y todo cuadra con el total', () => {
    const t = totalesNota([{ tipo: 'servicio', total: 118, tipoIgv: 'GRAVADO' }, { tipo: 'producto', total: 50, tipoIgv: 'EXONERADO' }, { tipo: 'producto', total: 30, tipoIgv: 'INAFECTO' }]);
    expect(t).toEqual({ exonerada: 50, inafecta: 30, gravada: 100, igv: 18, total: 198 });
    const raro = totalesNota([{ tipo: 'servicio', total: 99.99, tipoIgv: 'GRAVADO' }]);
    expect(raro.gravada + raro.igv).toBeCloseTo(99.99, 2);
  });
  it('la detracción se propone con al menos un servicio y más de S/ 700; es 12 % y se redondea a soles (desde 0,50 sube)', () => {
    expect(proponeDetraccion([{ tipo: 'servicio', total: 800, tipoIgv: 'GRAVADO' }], 800)).toBe(true);
    expect(proponeDetraccion([{ tipo: 'servicio', total: 700, tipoIgv: 'GRAVADO' }], 700)).toBe(false);
    expect(proponeDetraccion([{ tipo: 'producto', total: 900, tipoIgv: 'GRAVADO' }], 900)).toBe(false);
    expect(detraccionDe(800)).toEqual({ pct: 12, exacta: 96, redondeada: 96 });
    expect(detraccionDe(754.2).redondeada).toBe(91); // 90,50 sube a 91
    expect(detraccionDe(753).redondeada).toBe(90); // 90,36 baja a 90
  });
  it('el impuesto del ítem da el tipo por defecto y el código lleva la serie y seis dígitos', () => {
    expect(tipoIgvPorDefecto('IGV')).toBe('GRAVADO');
    expect(tipoIgvPorDefecto('NINGUNO')).toBe('INAFECTO');
    expect(codigoNota('NV01', 7)).toBe('NV01-000007');
  });
});

describe('emitir la nota de venta desde la ODS', () => {
  it('toma la serie del local de la cajera y el número siguiente; calcula IGV y totales; la ODS queda «con comprobante» (CA-1, CA-2)', async () => {
    const o = await nuevaOds([servicio(118), { tipo: 'producto', descripcion: 'Producto nota prueba', productoId, precio: 20, cantidad: 2 }]);
    const antes = (await prisma.correlativoSerie.findUnique({ where: { organizacionId_serie: { organizacionId: o.organizacionId ?? (await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } })).organizacionId, serie } } }))?.ultimo ?? 0;
    const r = await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, {});
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ serie, numero: antes + 1, codigo: codigoNota(serie, antes + 1), estado: 'EMITIDA', condicion: 'CONTADO', total: 158, gravada: 133.9, igv: 24.1, conDetraccion: false, detraccion: 0, emitidaPor: 'Cajera Demo' });
    expect(r.body.local.id).toBe(localCajera);
    expect(r.body.detalles).toHaveLength(2);
    const orden = (await como(CAJERA, 'get', `/ordenes/${o.id}`)).body;
    expect(orden).toMatchObject({ conComprobante: true, comprobantes: [r.body.codigo] });
    expect(orden.notaVenta).toMatchObject({ codigo: r.body.codigo, total: 158 });
    expect(orden.bitacora.some((b: { texto: string }) => b.texto.includes(`Nota de venta ${r.body.codigo} emitida`))).toBe(true);
    // Una segunda nota para la misma orden no se emite; la siguiente orden toma el número que sigue, sin saltos.
    expect((await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, {})).status).toBe(409);
    const otra = await nuevaOds([servicio(50)]);
    expect((await como(CAJERA, 'post', `/ordenes/${otra.id}/nota-venta`, {})).body.numero).toBe(antes + 2);
  });
  it('baja el stock del producto en el local de la nota y deja el movimiento «Venta» con el código (DEC-76)', async () => {
    const m = await prisma.movimientoInventario.findMany({ where: { productoId }, orderBy: { fecha: 'asc' } });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ tipo: 'Venta', localId: localCajera });
    expect(Number(m[0].salida)).toBe(2);
    expect(Number(m[0].saldo)).toBe(-2);
    expect(m[0].motivo).toMatch(/Nota de venta .+-\d{6}/);
  });
  it('la cajera elige el tipo de IGV por ítem, la condición a crédito pide vencimiento y la detracción se propone o se cambia', async () => {
    const o = await nuevaOds([servicio(800), servicio(100, { descripcion: 'Otro servicio' })]);
    expect((await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, { condicion: 'CREDITO' })).status).toBe(400);
    expect((await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, { tiposIgv: { [o.detalles[0].id]: 'OTRO' } })).status).toBe(400);
    const vence = new Date(Date.now() + 15 * 86_400_000).toISOString();
    const r = await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, { condicion: 'CREDITO', fechaVencimiento: vence, tiposIgv: { [o.detalles[1].id]: 'EXONERADO' }, comentario: 'Crédito a 15 días' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ condicion: 'CREDITO', exonerada: 100, total: 900, conDetraccion: true, detraccionPct: 12, detraccionExacta: 108, detraccion: 108, comentario: 'Crédito a 15 días' });
    // La detracción la deposita la empresa: no reduce el saldo (DEC-82).
    expect(r.body.saldo).toBe(900);
    const sin = await nuevaOds([servicio(800)]);
    expect((await como(CAJERA, 'post', `/ordenes/${sin.id}/nota-venta`, { conDetraccion: false })).body).toMatchObject({ conDetraccion: false, detraccion: 0 });
  });
  it('no se emite sin ítems, con total cero, si el cliente no aprobó, ni por un Técnico', async () => {
    const vacia = await nuevaOds([]);
    expect((await como(CAJERA, 'post', `/ordenes/${vacia.id}/nota-venta`, {})).status).toBe(409);
    const cero = await nuevaOds([servicio(0)]);
    expect((await como(CAJERA, 'post', `/ordenes/${cero.id}/nota-venta`, {})).status).toBe(409);
    const no = await nuevaOds([servicio(50)]);
    await como(CAJERA, 'patch', `/ordenes/${no.id}`, { decision: 'No aprobada' });
    expect((await como(CAJERA, 'post', `/ordenes/${no.id}/nota-venta`, {})).status).toBe(409);
    const ok = await nuevaOds([servicio(50)]);
    expect((await como(TECNICO, 'post', `/ordenes/${ok.id}/nota-venta`, {})).status).toBe(403);
    expect((await como(CAJERA, 'post', '/ordenes/no-existe/nota-venta', {})).status).toBe(404);
  });
});

describe('la ODS con nota de venta', () => {
  it('se cierra aunque la decisión no sea «No aprobada», no admite cambiar ítems y los abonos dan el saldo de la nota', async () => {
    const o = await nuevaOds([servicio(200)]);
    expect((await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'Cerrada' })).status).toBe(409);
    const nota = (await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, {})).body;
    expect((await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [servicio(10)] })).status).toBe(409);
    await como(CAJERA, 'post', `/ordenes/${o.id}/abonos`, { metodo: 'Efectivo', valor: 150 });
    expect((await como(CAJERA, 'get', `/notas-venta/${nota.id}`)).body).toMatchObject({ pagado: 150, saldo: 50 });
    const c = await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'Cerrada' });
    expect(c.status).toBe(200);
    expect(c.body.estado).toBe('Cerrada');
  });
  it('la lista de notas filtra por texto y por estado', async () => {
    const todas = (await como(CAJERA, 'get', '/notas-venta?q=Cliente Nota Prueba')).body as { estado: string }[];
    expect(todas.length).toBeGreaterThanOrEqual(5);
    expect((await como(CAJERA, 'get', '/notas-venta?q=Cliente Nota Prueba&estado=ANULADA')).body).toHaveLength(0);
    expect((await como(CAJERA, 'get', '/notas-venta/no-existe')).status).toBe(404);
  });
});

describe('anular la nota de venta', () => {
  it('pide motivo y nivel «todo»; devuelve el stock, queda consultable y la ODS puede emitir otra con el número siguiente', async () => {
    const o = await nuevaOds([{ tipo: 'producto', descripcion: 'Producto nota prueba', productoId, precio: 20, cantidad: 3 }]);
    const nota = (await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, {})).body;
    expect((await como(CAJERA, 'post', `/notas-venta/${nota.id}/anular`, { motivo: 'Error' })).status).toBe(403);
    expect((await como(ADMIN, 'post', `/notas-venta/${nota.id}/anular`, {})).status).toBe(400);
    const stockAntes = Number((await prisma.stockProducto.findUniqueOrThrow({ where: { productoId_localId: { productoId, localId: localCajera } } })).cantidad);
    const a = await como(ADMIN, 'post', `/notas-venta/${nota.id}/anular`, { motivo: 'Cliente desistió' });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ estado: 'ANULADA', motivoAnulacion: 'Cliente desistió', anuladaPor: 'Administrador Demo', saldo: 0 });
    expect(Number((await prisma.stockProducto.findUniqueOrThrow({ where: { productoId_localId: { productoId, localId: localCajera } } })).cantidad)).toBe(stockAntes + 3);
    expect((await como(ADMIN, 'post', `/notas-venta/${nota.id}/anular`, { motivo: 'Otra vez' })).status).toBe(409);
    const orden = (await como(CAJERA, 'get', `/ordenes/${o.id}`)).body;
    expect(orden).toMatchObject({ conComprobante: false, comprobantes: [], notaVenta: null });
    const nueva = (await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, {})).body;
    expect(nueva.numero).toBeGreaterThan(nota.numero);
    expect(await prisma.auditoria.count({ where: { tabla: 'nota_venta', registroId: nota.id } })).toBe(2);
  });
  it('no se anula la nota de una ODS cerrada: primero se reabre (RF-018)', async () => {
    const o = await nuevaOds([servicio(80)]);
    const nota = (await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, {})).body;
    await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'Cerrada' });
    expect((await como(ADMIN, 'post', `/notas-venta/${nota.id}/anular`, { motivo: 'Tarde' })).status).toBe(409);
  });
});
