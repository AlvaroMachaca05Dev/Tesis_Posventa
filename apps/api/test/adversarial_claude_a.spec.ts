// Revisión adversarial — revisor claude_a. Cada prueba AFIRMA el comportamiento correcto; las que FALLAN demuestran un hallazgo.
// Solo base de pruebas (setupFiles). Datos propios con prefijo claude_a_ ; sin borrados globales.
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
const CAJERA = 'cajera@demo.local', TECNICO = 'tecnico@demo.local', JEFE = 'jefe@demo.local', ADMIN = 'admin@demo.local';
const sufijo = `${Date.now() % 100000}`;
let n = 0, clienteA = '', clienteB = '';
const vehiculo = async (clienteId: string) => (await como(CAJERA, 'post', '/vehiculos', { clienteId, placa: `CA${sufijo}${n++}` })).body.id as string;
const orden = async (vehiculoId: string, extra: object = {}) => como(CAJERA, 'post', '/ordenes', { vehiculoId, tipoAtencion: 'Mantenimiento preventivo', km: 1000, ...extra });
const ordenConItems = async (detalles: object[] = [{ tipo: 'producto', descripcion: 'claude_a_item', cantidad: 1, precio: 100, costo: 60, rentabilidadPct: 40 }]) => {
  const o = await orden(await vehiculo(clienteA));
  expect(o.status).toBe(201);
  const r = await como(CAJERA, 'put', `/ordenes/${o.body.id}/detalles`, { detalles });
  return { id: o.body.id as string, r };
};

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  clienteA = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `7${sufijo.padStart(5, '0')}11`, nombre: 'claude_a_cliente_A' })).body.id;
  clienteB = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `7${sufijo.padStart(5, '0')}12`, nombre: 'claude_a_cliente_B' })).body.id;
});
afterAll(async () => {
  const ids = [clienteA, clienteB].filter(Boolean);
  if (ids.length) {
    const ods = (await prisma.ordenServicio.findMany({ where: { clienteId: { in: ids } } })).map((o) => o.id);
    await prisma.solicitudOds.deleteMany({ where: { ordenId: { in: ods } } });
    await prisma.abono.deleteMany({ where: { ordenId: { in: ods } } });
    await prisma.evidenciaIngreso.deleteMany({ where: { ordenId: { in: ods } } });
    await prisma.detalleODS.deleteMany({ where: { ordenId: { in: ods } } });
    await prisma.bitacora.deleteMany({ where: { ordenId: { in: ods } } });
    await prisma.ordenServicio.deleteMany({ where: { id: { in: ods } } });
    const vs = (await prisma.vehiculo.findMany({ where: { clienteId: { in: ids } } })).map((v) => v.id);
    await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs } } });
    await prisma.vehiculo.deleteMany({ where: { id: { in: vs } } });
    await prisma.cliente.deleteMany({ where: { id: { in: ids } } });
  }
  await app.close();
  await prisma.$disconnect();
});

describe('H01 permisos: el Técnico no debe ver costos ni márgenes (ordenServicio.controller.ts:90 resumen)', () => {
  it('GET /ordenes/:id como Técnico no trae costo ni rentabilidadPct', async () => {
    const { id } = await ordenConItems();
    const r = await como(TECNICO, 'get', `/ordenes/${id}`);
    // si el Técnico ni siquiera ve la orden (no asignada), tampoco hay fuga: la prueba exige que, si la ve, no haya costos
    if (r.status === 200) {
      for (const d of r.body.detalles) { expect(d.costo ?? null).toBeNull(); expect(d.rentabilidadPct ?? null).toBeNull(); }
    }
    expect(r.status === 200 ? 'fuga' : 'ok').toBe('ok');
  });
});

describe('H02 permisos: el Técnico solo ve las ODS que tiene asignadas (ordenServicio.controller.ts:250 lista / :269 una)', () => {
  it('una ODS sin técnico asignado no es visible para el Técnico (404/403)', async () => {
    const { id } = await ordenConItems();
    const r = await como(TECNICO, 'get', `/ordenes/${id}`);
    expect([403, 404]).toContain(r.status);
  });
  it('la lista del Técnico no incluye ODS ajenas', async () => {
    const { id } = await ordenConItems();
    const r = await como(TECNICO, 'get', '/ordenes?n=200');
    expect(r.body.some((o: { id: string }) => o.id === id)).toBe(false);
  });
});

describe('H03 validación: operadores de Prisma por query string dan 500 (ordenServicio.controller.ts:255-257)', () => {
  it.each(['clienteId[foo]=1', 'vehiculoId[foo]=1', 'estado[foo]=1', 'clienteId[]=a&clienteId[]=b'])('GET /ordenes?%s no es 500', async (q) => {
    const r = await como(ADMIN, 'get', `/ordenes?${q}`);
    expect(r.status).toBeLessThan(500);
  });
});

describe('H04 dinero: total de línea desborda Decimal(12,2) → 500 (ordenServicio.controller.ts:154 topes cantidad×precio)', () => {
  it('producto cantidad 100000 × precio 10 000 000 se rechaza con 4xx, no 500', async () => {
    const { r } = await ordenConItems([{ tipo: 'producto', descripcion: 'claude_a_enorme', cantidad: 100000, precio: 10_000_000 }]);
    expect(r.status).toBeLessThan(500);
  });
});

describe('H05 validación: costo y rentabilidadPct sin tope → 500 por desborde de Decimal (ordenServicio.controller.ts:152-153)', () => {
  it('rentabilidadPct = 1e9 (Decimal(8,3)) no es 500', async () => {
    const { r } = await ordenConItems([{ tipo: 'producto', descripcion: 'claude_a_rent', cantidad: 1, precio: 1, rentabilidadPct: 1e9 }]);
    expect(r.status).toBeLessThan(500);
  });
  it('costo = 1e12 (Decimal(12,3)) no es 500', async () => {
    const { r } = await ordenConItems([{ tipo: 'producto', descripcion: 'claude_a_costo', cantidad: 1, precio: 1, costo: 1e12 }]);
    expect(r.status).toBeLessThan(500);
  });
});

describe('H06 validación: linea() usa Number() y acepta true / [] / [5] como cifras (ordenServicio.controller.ts:147-149)', () => {
  it('precio:true no se guarda como S/ 1.00 (aNumero lo definió como NaN)', async () => {
    const { r } = await ordenConItems([{ tipo: 'producto', descripcion: 'claude_a_bool', cantidad: 1, precio: true }]);
    expect(r.status).toBe(400);
  });
  it('cantidad:[3] no se guarda como 3', async () => {
    const { r } = await ordenConItems([{ tipo: 'producto', descripcion: 'claude_a_arr', cantidad: [3], precio: 10 }]);
    expect(r.status).toBe(400);
  });
  it('precio:"0x10" no se guarda como 16', async () => {
    const { r } = await ordenConItems([{ tipo: 'producto', descripcion: 'claude_a_hex', cantidad: 1, precio: '0x10' }]);
    expect(r.status).toBe(400);
  });
});

describe('H07 integridad: cambiar el vehículo de una garantía deja el origen de OTRO cliente (ordenServicio.controller.ts:351-364)', () => {
  it('PATCH vehiculoId a un vehículo de otro cliente no deja garantiaDeId de otro cliente', async () => {
    const vOrigen = await vehiculo(clienteA);
    const origen = await orden(vOrigen);
    const sv = await como(CAJERA, 'put', `/ordenes/${origen.body.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'claude_a_sv', precio: 50 }] });
    const detId = sv.body.detalles[0].id;
    await como(CAJERA, 'patch', `/ordenes/${origen.body.id}`, { estado: 'Cerrada' });
    const g = await orden(await vehiculo(clienteA), { tipoAtencion: 'Garantía', garantiaDeId: origen.body.id, garantiaDetalleIds: [detId] });
    expect(g.status).toBe(201);
    const vB = await vehiculo(clienteB);
    const r = await como(CAJERA, 'patch', `/ordenes/${g.body.id}`, { vehiculoId: vB });
    const fila = await prisma.ordenServicio.findUniqueOrThrow({ where: { id: g.body.id } });
    const ori = await prisma.ordenServicio.findUniqueOrThrow({ where: { id: fila.garantiaDeId! } });
    expect(r.status === 200 && fila.clienteId !== ori.clienteId).toBe(false);
  });
});

describe('H08 integridad: cambiar vehículo/cliente de una ODS con abonos o nota de venta vigente', () => {
  it('PATCH vehiculoId de otro cliente con un abono ya cobrado se rechaza', async () => {
    const { id } = await ordenConItems();
    const ab = await como(CAJERA, 'post', `/ordenes/${id}/abonos`, { metodo: 'Efectivo', valor: 10 });
    expect(ab.status).toBe(201);
    const r = await como(CAJERA, 'patch', `/ordenes/${id}`, { vehiculoId: await vehiculo(clienteB) });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe('H09 integridad: subir evidencias a una ODS cerrada (ordenServicio.controller.ts:661 sin chequeo de Cerrada; quitar sí lo tiene en :692)', () => {
  it('POST /ordenes/:id/evidencias en ODS Cerrada da 409', async () => {
    const { id } = await ordenConItems();
    await como(CAJERA, 'patch', `/ordenes/${id}`, { estado: 'Cerrada' });
    const t = await tokenDe(CAJERA);
    const r = await request(app.getHttpServer()).post(`/ordenes/${id}/evidencias`).set('Authorization', `Bearer ${t}`).attach('archivo', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'a.png', contentType: 'image/png' });
    expect(r.status).toBe(409);
  });
});

describe('H10 seguridad: «solo fotos» se valida solo con el mimetype declarado (ordenServicio.controller.ts:665)', () => {
  it('un texto plano declarado image/png se rechaza', async () => {
    const { id } = await ordenConItems();
    const t = await tokenDe(CAJERA);
    const r = await request(app.getHttpServer()).post(`/ordenes/${id}/evidencias`).set('Authorization', `Bearer ${t}`).attach('archivo', Buffer.from('esto no es una imagen'), { filename: 'a.png', contentType: 'image/png' });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it('un SVG con script (image/svg+xml) no se sirve inline con el mismo origen', async () => {
    const { id } = await ordenConItems();
    const t = await tokenDe(CAJERA);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const up = await request(app.getHttpServer()).post(`/ordenes/${id}/evidencias`).set('Authorization', `Bearer ${t}`).attach('archivo', Buffer.from(svg), { filename: 'x.svg', contentType: 'image/svg+xml' });
    const eid = up.body?.evidencias?.[0]?.id;
    if (up.status >= 400 || !eid) return; // rechazado: correcto
    const g = await request(app.getHttpServer()).get(`/ordenes/${id}/evidencias/${eid}`).set('Authorization', `Bearer ${t}`);
    const peligroso = /svg|html/.test(String(g.headers['content-type'])) && /^inline/.test(String(g.headers['content-disposition'])) && !g.headers['content-security-policy'];
    expect(peligroso).toBe(false);
  });
});
