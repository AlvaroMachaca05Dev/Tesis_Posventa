// Pruebas que intentan romper planes, vehículos y la línea de tiempo: inyección, permisos, datos fuera de rango y la integridad de la base.
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
  const r = request(app.getHttpServer())[metodo](ruta).set('Authorization', `Bearer ${await tokenDe(c)}`);
  return cuerpo ? r.send(cuerpo) : r;
};
const SUPER = 'ti@demo.local', ADMIN = 'admin@demo.local', CAJERA = 'cajera@demo.local', TECNICO = 'tecnico@demo.local';
const sx = `${Date.now() % 100000}`;
const creados = { clientes: [] as string[] };
let vehiculoId = '';

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  await app.listen(0);
  const c = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `7${sx.padStart(5, '0')}33`, nombre: 'Cliente romper' })).body;
  creados.clientes.push(c.id);
  vehiculoId = (await como(CAJERA, 'post', '/vehiculos', { clienteId: c.id, placa: `RP${sx}`, marca: 'KIA', modelo: 'RIO' })).body.id;
});
afterAll(async () => {
  const vs = (await prisma.vehiculo.findMany({ where: { clienteId: { in: creados.clientes } } })).map((v) => v.id);
  await prisma.cambioPlanVehiculo.deleteMany({ where: { vehiculoId: { in: vs } } });
  await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs } } });
  // Los vehículos con ODS o comprobantes quedan en la base de pruebas (se reconstruye entera).
  try {
    await prisma.vehiculo.deleteMany({ where: { id: { in: vs } } });
    await prisma.cliente.deleteMany({ where: { id: { in: creados.clientes } } });
  } catch { /* restringido por la ODS de la prueba de aprobación */ }
  await app.close();
  await prisma.$disconnect();
});

describe('inyección', () => {
  it('la búsqueda de vehículos con SQL no devuelve todo ni falla', async () => {
    const todos = (await como(CAJERA, 'get', '/vehiculos')).body as unknown[];
    for (const q of ["' OR 1=1 --", "'; DROP TABLE \"Vehiculo\"; --", '%', '\\', '_']) {
      const r = await como(CAJERA, 'get', '/vehiculos?q=' + encodeURIComponent(q));
      expect(r.status).toBe(200);
      expect((r.body as unknown[]).length).toBeLessThanOrEqual(todos.length);
    }
    expect(await prisma.vehiculo.count()).toBeGreaterThan(0);
  });
  it('la línea de tiempo con un id inyectado responde 404 y el borrador inyectado 400', async () => {
    expect((await como(CAJERA, 'get', `/vehiculos/${encodeURIComponent("x' OR '1'='1")}/linea-temporal`)).status).toBe(404);
    expect((await como(CAJERA, 'get', `/vehiculos/${vehiculoId}/linea-temporal?uso=${encodeURIComponent("Particular' OR 1=1")}`)).status).toBe(400);
    expect((await como(CAJERA, 'get', `/vehiculos/${vehiculoId}/linea-temporal?aceite=${encodeURIComponent('<script>alert(1)</script>')}`)).status).toBe(400);
    expect((await como(CAJERA, 'get', `/vehiculos/${vehiculoId}/linea-temporal?uso=Profesional&aceite=Sint%C3%A9tico`)).body.plan.codigo).toBe('GR-S');
  });
  it('un texto con HTML se guarda como texto y no cambia el plan', async () => {
    const r = await como(CAJERA, 'patch', `/vehiculos/${vehiculoId}`, { comentario: '<img src=x onerror=alert(1)>' });
    expect(r.status).toBe(200);
    expect(r.body.comentario).toBe('<img src=x onerror=alert(1)>');
    expect((await como(CAJERA, 'patch', `/vehiculos/${vehiculoId}`, { uso: '<b>Particular</b>' })).status).toBe(400);
    expect((await como(CAJERA, 'patch', `/vehiculos/${vehiculoId}`, { aceite: { $ne: null } })).status).toBe(400);
  });
});

describe('permisos y asignación masiva', () => {
  it('sin token o con un token falso no se ve la línea de tiempo ni los planes', async () => {
    expect((await request(app.getHttpServer()).get(`/vehiculos/${vehiculoId}/linea-temporal`)).status).toBe(401);
    expect((await request(app.getHttpServer()).get('/planes-preventivos').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
  });
  it('la cajera no edita ni elimina planes', async () => {
    const p = ((await como(ADMIN, 'get', '/planes-preventivos')).body as { id: string }[])[0];
    expect((await como(CAJERA, 'patch', `/planes-preventivos/${p.id}`, { nombre: 'X' })).status).toBe(403);
    expect((await como(CAJERA, 'delete', `/planes-preventivos/${p.id}`)).status).toBe(403);
  });
  it('el técnico no edita vehículos', async () => {
    const r = await como(TECNICO, 'patch', `/vehiculos/${vehiculoId}`, { uso: 'Profesional' });
    expect([401, 403]).toContain(r.status);
  });
  it('no se puede cambiar la empresa, el id ni el plan a uno de otra empresa por el cuerpo', async () => {
    const antes = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } });
    const r = await como(CAJERA, 'patch', `/vehiculos/${vehiculoId}`, { organizacionId: 'otra', id: 'otro', placaNorm: 'ZZZ' });
    expect(r.status).toBeLessThan(500);
    const despues = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } });
    expect(despues.organizacionId).toBe(antes.organizacionId);
    expect(despues.placaNorm).toBe(antes.placaNorm);
    expect((await como(CAJERA, 'patch', `/vehiculos/${vehiculoId}`, { planId: 'no-existe' })).status).toBe(400);
  });
});

describe('cambio de plan (tramos)', () => {
  it('la primera asignación no crea tramo; cambiar un plan asignado pide confirmar y deja el tramo con quién lo hizo', async () => {
    const a = await como(CAJERA, 'patch', `/vehiculos/${vehiculoId}`, { uso: 'Particular', aceite: 'Semisintético' });
    expect(a.body.planCodigo).toBe('GP-M');
    expect(await prisma.cambioPlanVehiculo.count({ where: { vehiculoId } })).toBe(0);
    const sin = await como(CAJERA, 'patch', `/vehiculos/${vehiculoId}`, { aceite: 'Full sintético' });
    expect(sin.status).toBe(409);
    expect(sin.body.message).toMatch(/pasa de GP-M a GP-S/);
    expect((await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } })).aceite).toBe('Semisintético');
    const con = await como(CAJERA, 'patch', `/vehiculos/${vehiculoId}`, { aceite: 'Full sintético', confirmarCambioPlan: true });
    expect(con.body.planCodigo).toBe('GP-S');
    const t = (await como(CAJERA, 'get', `/vehiculos/${vehiculoId}/linea-temporal`)).body;
    expect(t.tramos.map((x: { codigo: string }) => x.codigo)).toEqual(['GP-M', 'GP-S']);
    expect(t.tramos[1].por).toBeTruthy();
    expect(t.asignado).toBe(true);
    // con uso y aceite guardados, el borrador ya no cambia nada
    expect((await como(CAJERA, 'get', `/vehiculos/${vehiculoId}/linea-temporal?uso=Profesional&aceite=Mineral`)).body.plan.codigo).toBe('GP-S');
    // el mismo plan otra vez (sintético → full sintético) no pide confirmar
    expect((await como(CAJERA, 'patch', `/vehiculos/${vehiculoId}`, { aceite: 'Sintético' })).status).toBe(200);
  });
});

describe('reglas del plan fuera de rango', () => {
  it('se rechazan ciclos absurdos y la base queda igual', async () => {
    const p = ((await como(ADMIN, 'get', '/planes-preventivos')).body as { id: string; codigo: string; ciclo: unknown }[]).find((x) => x.codigo === 'GP-M')!;
    try {
    for (const ciclo of [{ secuencia: Array(13).fill('SV094') }, { secuencia: [] }, { secuencia: 'SV094' }, { horizonte: 3 }, { meses: 0 }, { km: 1e9 }, { km: '5000; DROP' }, { secuencia: ['SV094', 'SV096+XX'] }, { secuencia: ['SV096+AF+AF'] }]) {
      expect((await como(ADMIN, 'patch', `/planes-preventivos/${p.id}`, { ciclo })).status).toBe(400);
    }
    expect((await como(ADMIN, 'patch', `/planes-preventivos/${p.id}`, { nombre: '' })).status).toBe(400);
    const largo = await como(ADMIN, 'patch', `/planes-preventivos/${p.id}`, { ciclo: { patron: 'x'.repeat(5000) } });
    expect([200, 400]).toContain(largo.status);
    const g = ((await como(ADMIN, 'get', '/planes-preventivos')).body as { codigo: string; ciclo: { patron: string; secuencia: string[] } }[]).find((x) => x.codigo === 'GP-M')!;
    expect(g.ciclo.patron.length).toBeLessThanOrEqual(300);
    expect(g.ciclo.secuencia).toEqual((p.ciclo as { secuencia: string[] }).secuencia);
    } finally { await prisma.planPreventivo.update({ where: { id: p.id }, data: { ciclo: p.ciclo as object } }); }
  });
});

describe('integridad de la base', () => {
  it('un tramo sin vehículo no entra y borrar el vehículo borra sus tramos', async () => {
    await expect(prisma.cambioPlanVehiculo.create({ data: { organizacionId: 'x', vehiculoId: 'no-existe', antes: 'GP-M', despues: 'GP-S', corte: '2026-01-01', usuarioId: 'u', usuario: 'u' } })).rejects.toThrow();
    const org = (await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } })).organizacionId;
    const n = await prisma.cambioPlanVehiculo.count({ where: { vehiculoId } });
    expect(n).toBeGreaterThan(0);
    const otro = await prisma.vehiculo.create({ data: { organizacionId: org, clienteId: creados.clientes[0], placa: `RQ${sx}`, placaNorm: `RQ${sx}` } });
    await prisma.cambioPlanVehiculo.create({ data: { organizacionId: org, vehiculoId: otro.id, antes: 'GP-M', despues: 'GP-S', corte: '2026-01-01', usuarioId: 'u', usuario: 'u' } });
    await prisma.vehiculo.delete({ where: { id: otro.id } });
    expect(await prisma.cambioPlanVehiculo.count({ where: { vehiculoId: otro.id } })).toBe(0);
  });
  it('dos vehículos con la misma placa escrita distinto chocan', async () => {
    const r = await como(CAJERA, 'post', '/vehiculos', { clienteId: creados.clientes[0], placa: `rp-${sx}`, marca: 'KIA' });
    expect(r.status).toBe(409);
  });
  it('el código de plan es único por empresa', async () => {
    const p = await prisma.planPreventivo.findFirstOrThrow({ where: { codigo: 'GP-M' } });
    await expect(prisma.planPreventivo.create({ data: { organizacionId: p.organizacionId, codigo: 'GP-M', nombre: 'dup', combustible: 'Gasolina', uso: 'Particular', ciclo: {} } })).rejects.toThrow();
  });
});

describe('aprobación por ítem (opcional por empresa)', () => {
  it('desactivada por defecto; activada, el total aprobado y el comprobante llevan solo lo aprobado', async () => {
    const v = (await como(CAJERA, 'post', '/vehiculos', { clienteId: creados.clientes[0], placa: `AP${sx}`, marca: 'KIA' })).body;
    const o = (await como(CAJERA, 'post', '/ordenes', { vehiculoId: v.id, tipoAtencion: 'Mantenimiento correctivo' })).body;
    const r = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'Cambio de pastillas', precio: 100, cantidad: 1 }, { tipo: 'servicio', descripcion: 'Cambio de discos', precio: 200, cantidad: 1, aprobado: false }] });
    expect(r.body.total).toBe(300);
    expect(r.body.totalAprobado).toBe(100);
    expect(r.body.detalles.map((d: { aprobado: boolean }) => d.aprobado)).toEqual([true, false]);
    expect((await como(SUPER, 'patch', '/empresa', { aprobacionPorItem: 'si' })).status).toBe(400);
    try {
      expect((await como(SUPER, 'patch', '/empresa', { aprobacionPorItem: true })).status).toBe(200);
      const n = await como(CAJERA, 'post', `/ordenes/${o.id}/nota-venta`, { condicion: 'CREDITO', fechaVencimiento: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10) });
      expect(n.status).toBeLessThan(300);
      expect(n.body.detalles.map((d: { descripcion: string }) => d.descripcion)).toEqual(['Cambio de pastillas']);
      expect(n.body.total).toBe(100);
    } finally {
      await como(SUPER, 'patch', '/empresa', { aprobacionPorItem: false });
    }
  });
});
