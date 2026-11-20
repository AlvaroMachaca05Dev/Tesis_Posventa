// Revisión adversarial — revisor claude_b. Cada «it» es un hallazgo: la expectativa describe el comportamiento CORRECTO,
// así que la prueba FALLA mientras el defecto exista. Corre solo contra «posventa_test» (test/base-pruebas.ts).
// Datos propios: prefijo claude_b_ / placas CB…; no se borran tablas completas.
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { esAceite } from '../src/plan/lineaTemporal';
import { cargarStaging, Staging } from '../src/migracion/tuulapp.carga';

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
const ADMIN = 'admin@demo.local', CAJERA = 'cajera@demo.local', JEFE = 'jefe@demo.local';
const sx = `${Date.now() % 1000000}`;
let k = 0;
let clienteId = '', productoId = '', localCajera = '';
const notasCreadas: string[] = [];
const planesCreados: string[] = [];

const nuevaOds = async (detalles: object[]) => {
  const v = (await como(CAJERA, 'post', '/vehiculos', { clienteId, placa: `CB${sx}${k++}` })).body;
  const o = (await como(CAJERA, 'post', '/ordenes', { vehiculoId: v.id, tipoAtencion: 'Mantenimiento correctivo' })).body;
  return (await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles })).body;
};
const servicio = (precio: number) => ({ tipo: 'servicio', descripcion: 'claude_b servicio', precio, cantidad: 1 });
const stockDe = async (id: string) => Number((await prisma.stockProducto.findUnique({ where: { productoId_localId: { productoId: id, localId: localCajera } } }))?.cantidad ?? 0);

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  clienteId = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `7${sx.padStart(6, '0')}1`, nombre: 'claude_b cliente' })).body.id;
  productoId = (await como(ADMIN, 'post', '/productos', { codigo: `CB${sx}`, nombre: 'claude_b producto', precio: 20 })).body.id;
  localCajera = (await prisma.usuario.findUniqueOrThrow({ where: { correo: CAJERA } })).localId as string;
});

afterAll(async () => {
  const ordenes = await prisma.ordenServicio.findMany({ where: { clienteId } });
  const ids = ordenes.map((o) => o.id);
  const notas = await prisma.notaVenta.findMany({ where: { OR: [{ clienteId }, { ordenId: { in: ids } }] } });
  const nids = notas.map((x) => x.id);
  await prisma.abono.deleteMany({ where: { OR: [{ notaId: { in: nids } }, { ordenId: { in: ids } }] } });
  await prisma.notaVenta.deleteMany({ where: { id: { in: nids } } });
  for (const t of ['solicitudOds', 'evidenciaIngreso', 'detalleODS', 'bitacora'] as const) await (prisma[t] as unknown as { deleteMany: (a: object) => Promise<unknown> }).deleteMany({ where: { ordenId: { in: ids } } });
  await prisma.ordenServicio.deleteMany({ where: { id: { in: ids } } });
  const vs = await prisma.vehiculo.findMany({ where: { clienteId } });
  await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs.map((v) => v.id) } } });
  await prisma.vehiculo.deleteMany({ where: { clienteId } });
  await prisma.cotizacion.deleteMany({ where: { clienteId } });
  await prisma.movimientoInventario.deleteMany({ where: { productoId } });
  await prisma.stockProducto.deleteMany({ where: { productoId } });
  await prisma.producto.deleteMany({ where: { id: productoId } });
  await prisma.cliente.deleteMany({ where: { id: clienteId } });
  await prisma.planPreventivo.deleteMany({ where: { id: { in: planesCreados } } });
  await app.close();
  await prisma.$disconnect();
});

describe('facturación: montos y referencias', () => {
  it('H1 POST /notas-venta con un ítem de S/ 1 000 000 000 000 responde 4xx, no 500 (lineas.ts:20 admite hasta 1e12 y la columna es Decimal(12,2))', async () => {
    const r = await como(CAJERA, 'post', '/notas-venta', { clienteId, items: [{ tipo: 'producto', descripcion: 'claude_b monto', cantidad: 100000, precio: 10_000_000 }] });
    expect(r.status).toBeLessThan(500);
  });

  it('H2 POST /cotizaciones con el mismo monto responde 4xx, no 500', async () => {
    const r = await como(CAJERA, 'post', '/cotizaciones', { clienteId, items: [{ tipo: 'producto', descripcion: 'claude_b monto', cantidad: 100000, precio: 10_000_000 }] });
    expect(r.status).toBeLessThan(500);
  });

  it('H3 POST /notas-venta con productoId inexistente responde 4xx, no 500 (notaVenta.controller.ts:118, sin validar que el producto exista)', async () => {
    const r = await como(CAJERA, 'post', '/notas-venta', { clienteId, items: [{ tipo: 'producto', descripcion: 'claude_b fantasma', cantidad: 1, precio: 10, productoId: '00000000-0000-0000-0000-000000000000' }] });
    expect(r.status).toBeLessThan(500);
  });

});

describe('facturación: concurrencia (dinero e inventario)', () => {
  it('H5 dos emisiones simultáneas desde la misma ODS dejan UNA sola nota vigente (notaVenta.controller.ts:131 comprueba fuera de la transacción)', async () => {
    const duplicadas: number[] = [];
    for (let i = 0; i < 3; i++) {
      const o = await nuevaOds([servicio(100)]);
      const rs = await Promise.all([1, 2].map(() => como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, {})));
      void rs;
      duplicadas.push(await prisma.notaVenta.count({ where: { ordenId: o.id, estado: 'EMITIDA' } }));
    }
    expect(Math.max(...duplicadas)).toBeLessThanOrEqual(1);
  });

  it('H6 dos anulaciones simultáneas de la misma nota devuelven el stock UNA sola vez (notaVenta.controller.ts:187 no bloquea la fila)', async () => {
    const antes0 = await stockDe(productoId);
    const n = await como(CAJERA, 'post', '/notas-venta', { clienteId, items: [{ tipo: 'producto', descripcion: 'claude_b stock', cantidad: 3, precio: 20, productoId }] });
    expect(n.status).toBe(201);
    expect(await stockDe(productoId)).toBe(antes0 - 3);
    await Promise.all([1, 2, 3].map(() => como(ADMIN, 'post', `/notas-venta/${n.body.id}/anular`, { motivo: 'claude_b carrera' })));
    expect(await stockDe(productoId)).toBe(antes0); // esperado: 0 neto; obtenido: sobra stock inventado
  });
});

describe('facturación: permisos y coherencia', () => {
  it('H7 el Jefe de taller (sin módulo «notas», rol sin nada de Cajera) no puede emitir una nota de venta desde una ODS (notaVenta.controller.ts:124 exige solo «ods» E)', async () => {
    const jefe = await prisma.usuario.findUniqueOrThrow({ where: { correo: JEFE } });
    expect(jefe.localId).toBeTruthy(); // sin local el 409 sería otro motivo
    const o = await nuevaOds([servicio(100)]);
    const r = await como(JEFE, 'post', `/ordenes/${o.id}/nota-venta`, {});
    expect(r.status).toBe(403);
  });

  it('H8 el Jefe de taller no puede anular (eliminar) una nota de venta emitida por caja (notaVenta.controller.ts:186 exige «ods» A, no «notas»)', async () => {
    const n = await como(CAJERA, 'post', '/notas-venta', { clienteId, items: [{ tipo: 'servicio', descripcion: 'claude_b', cantidad: 1, precio: 50 }] });
    expect(n.status).toBe(201);
    const r = await como(JEFE, 'post', `/notas-venta/${n.body.id}/anular`, { motivo: 'claude_b permiso' });
    expect(r.status).toBe(403);
  });

  it('H9 una nota enlazada a una ODS no deja pagos por encima de su propio total: saldo >= 0 (el abono de la ODS se limita con el total de la ODS, no el de la nota)', async () => {
    const o = await nuevaOds([servicio(200)]);
    const n = await como(CAJERA, 'post', '/notas-venta', { ordenId: o.id, items: [{ tipo: 'servicio', descripcion: 'claude_b parcial', cantidad: 1, precio: 100 }] });
    expect(n.status).toBe(201);
    await como(CAJERA, 'post', `/ordenes/${o.id}/abonos`, { metodo: 'Efectivo', valor: 150 });
    const v = await como(CAJERA, 'get', `/notas-venta/${n.body.id}`);
    expect(v.body.saldo).toBeGreaterThanOrEqual(0); // obtenido: -50
  });
});

describe('planes y línea temporal', () => {
  it('H11 esAceite no toma un cambio de aceite de CAJA o de DIFERENCIAL como cambio de aceite de motor (lineaTemporal.ts:35)', () => {
    expect(esAceite('Cambio de aceite de caja')).toBe(false);
    expect(esAceite('Cambio de aceite de diferencial')).toBe(false);
  });

  it('H12 dos duplicados simultáneos del mismo plan no dan 500 (plan.controller.ts:120: el código libre se busca sin bloqueo y el índice único revienta)', async () => {
    const base = (await como(ADMIN, 'get', '/planes-preventivos')).body.find((p: { codigo: string }) => p.codigo === 'GP-M');
    const rs = await Promise.all([1, 2, 3, 4].map(() => como(ADMIN, 'post', `/planes-preventivos/${base.id}/duplicar`)));
    for (const r of rs) if (r.body?.id) planesCreados.push(r.body.id);
    expect(rs.map((r) => r.status).filter((s) => s >= 500)).toEqual([]);
  });

  it('H13 PATCH /planes-preventivos/:id con activo:"false" desactiva el plan (plan.controller.ts:84 usa !!, y "false" es verdadero)', async () => {
    const base = (await como(ADMIN, 'get', '/planes-preventivos')).body.find((p: { codigo: string }) => p.codigo === 'GP-M');
    const c = await como(ADMIN, 'post', `/planes-preventivos/${base.id}/duplicar`);
    planesCreados.push(c.body.id);
    const r = await como(ADMIN, 'patch', `/planes-preventivos/${c.body.id}`, { activo: 'false' });
    const lista = (await como(ADMIN, 'get', '/planes-preventivos')).body.find((p: { id: string }) => p.id === c.body.id);
    // correcto: 400 por valor no booleano, o activo=false; obtenido: 200 y activo=true
    expect(r.status >= 400 || lista.activo === false).toBe(true);
  });
});

describe('migración Tuulapp: filas inválidas deben rechazarse, no abortar el lote', () => {
  const SIS = `claude_b_${sx}`;
  const base = (): Staging => ({
    sistema: SIS,
    personas: [{ clave: 'p1', nombre: 'claude_b persona', correo: `claude_b_${sx}@demo.local`, roles: ['Cajera'], local: 'Union', activo: true }],
    clientes: [{ clave: 'c1', tipoDocumento: 'DNI', documento: `98${sx.padStart(6, '0')}`, nombre: 'claude_b cliente mig' }],
    vehiculos: [{ clave: 'v1', cliente: 'c1', placa: `CBM-${sx.slice(-3)}`, placaNorm: `CBM${sx.slice(-3)}` }],
    ordenes: [], lecturas: [], notas: [],
  });
  const orden = (clave: string, codigo: string, extra: object = {}) => ({ clave, codigo, cliente: 'c1', vehiculo: 'v1', local: 'Union', estado: 'Cerrada', fechaInicio: '2025-03-01T09:00:00', creadoPor: 'p1', detalles: [], ...extra });
  const nota = (clave: string, numero: number, extra: object = {}) => ({ clave, numero, local: 'Union', cliente: 'c1', fechaEmision: '2025-03-02', condicion: 'CONTADO', total: 10, emitidaPor: 'p1', detalles: [], abonos: [], ...extra });

  async function limpiar() {
    const ks = await prisma.claveOrigen.findMany({ where: { sistema: SIS } });
    const de = (t: string) => ks.filter((x) => x.tabla === t).map((x) => x.registroId);
    await prisma.abono.deleteMany({ where: { id: { in: de('Abono') } } });
    await prisma.detalleNota.deleteMany({ where: { id: { in: de('DetalleNota') } } });
    await prisma.notaVenta.deleteMany({ where: { id: { in: de('NotaVenta') } } });
    await prisma.detalleODS.deleteMany({ where: { id: { in: de('DetalleODS') } } });
    await prisma.ordenServicio.deleteMany({ where: { id: { in: de('OrdenServicio') } } });
    await prisma.vehiculo.deleteMany({ where: { id: { in: de('Vehiculo') } } });
    await prisma.cliente.deleteMany({ where: { id: { in: de('Cliente') } } });
    await prisma.usuarioRol.deleteMany({ where: { usuarioId: { in: de('Usuario') } } });
    await prisma.usuario.deleteMany({ where: { id: { in: de('Usuario') } } });
    await prisma.claveOrigen.deleteMany({ where: { sistema: SIS } });
  }
  afterEach(limpiar);

  const carga = (s: Staging) => cargarStaging(prisma, s, { claveUsuarios: 'clave-sintetica-b' });

  it('H14 una ODS con sede «constructor» se rechaza con motivo (tuulapp.carga.ts:219: local[o.local] resuelve a Object.prototype y el lote revienta)', async () => {
    const s = base();
    s.ordenes = [orden('o1', `CBMIG${sx}A`, { local: 'constructor' })];
    const rep = await carga(s); // obtenido: lanza una excepción de Prisma
    expect(rep.rechazos.some((r) => r.clave === 'o1')).toBe(true);
  });

  it('H15 dos ODS del archivo con el mismo código y distinta clave: la segunda se rechaza (tuulapp.carga.ts:195 solo compara con códigos ya en la base)', async () => {
    const s = base();
    s.ordenes = [orden('o1', `CBMIG${sx}B`), orden('o2', `CBMIG${sx}B`)];
    const rep = await carga(s);
    expect(rep.rechazos.some((r) => r.clave === 'o2')).toBe(true);
  });

  it('H16 dos personas del archivo con el mismo correo: la segunda se rechaza (tuulapp.carga.ts:132 solo compara con usuarios ya existentes)', async () => {
    const s = base();
    s.personas.push({ clave: 'p2', nombre: 'claude_b duplicada', correo: s.personas[0].correo, roles: ['Cajera'], local: 'Union', activo: true });
    const rep = await carga(s);
    expect(rep.rechazos.some((r) => r.clave === 'p2')).toBe(true);
  });

  it('H17 dos notas del archivo con la misma serie y número: la segunda se rechaza (tuulapp.carga.ts:296 no mira duplicados dentro del archivo)', async () => {
    const s = base();
    s.notas = [nota('n1', 870001), nota('n2', 870001)];
    const rep = await carga(s);
    expect(rep.rechazos.some((r) => r.clave === 'n2')).toBe(true);
  });

  it('H18 una nota con número fuera de rango entero (3 000 000 000) se rechaza (tuulapp.carga.ts:292 no acota el número; el Int de Postgres desborda)', async () => {
    const s = base();
    s.notas = [nota('n1', 3_000_000_000)];
    const rep = await carga(s);
    expect(rep.rechazos.some((r) => r.clave === 'n1')).toBe(true);
  });

  it('H19 una nota con total que no cabe en Decimal(12,2) se rechaza (tuulapp.carga.ts:294 solo exige total >= 0)', async () => {
    const s = base();
    s.notas = [nota('n1', 870002, { total: 1e13 })];
    const rep = await carga(s);
    expect(rep.rechazos.some((r) => r.clave === 'n1')).toBe(true);
  });
});
