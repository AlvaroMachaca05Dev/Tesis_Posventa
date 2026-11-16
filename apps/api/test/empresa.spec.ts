// Configuración de la empresa: datos que salen en los PDF, parámetros de impresión y series de comprobantes por local (DEC-101).
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
const como = async (c: string, metodo: 'get' | 'patch', ruta: string, cuerpo?: object) => {
  const t = await tokenDe(c);
  const r = request(app.getHttpServer())[metodo](ruta).set("Authorization", `Bearer ${t}`);
  return cuerpo ? r.send(cuerpo) : r;
};
const ADMIN = 'ti@demo.local'; // el Superadministrador: único rol con nivel «todo» en la configuración
const SOLO_VE = 'admin@demo.local';
const CAJERA = 'cajera@demo.local';
let antes: Record<string, unknown>;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  antes = (await como(ADMIN, 'get', '/empresa')).body;
});
afterAll(async () => {
  // Se devuelve la empresa a como estaba para no afectar a las demás pruebas.
  const { locales, ...datos } = antes as { locales: { id: string; direccion: string | null; telefono: string | null; serieNotaVenta: string | null; serieBoleta: string | null; serieFactura: string | null }[] };
  await como(ADMIN, 'patch', '/empresa', datos);
  for (const l of locales) await como(ADMIN, 'patch', `/empresa/locales/${l.id}`, { direccion: l.direccion, telefono: l.telefono, serieNotaVenta: l.serieNotaVenta, serieBoleta: l.serieBoleta, serieFactura: l.serieFactura });
  await app.close();
  await prisma.$disconnect();
});

describe('configuración de la empresa', () => {
  it('el Superadministrador ve los datos, los parámetros de impresión y los locales con sus series', async () => {
    const r = await como(ADMIN, 'get', '/empresa');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ nombre: 'Taller Demo', anchoTicketMm: 80 });
    expect(r.body.pieTicket).toContain('GRACIAS');
    expect(r.body.locales.map((l: { serieNotaVenta: string }) => l.serieNotaVenta).sort()).toEqual(['NV01', 'NV02']);
  });
  it('guarda los datos y los parámetros, y los catálogos de la orden ya los traen para el PDF; queda auditado', async () => {
    const r = await como(ADMIN, 'patch', '/empresa', { razonSocial: 'Taller Demo S.A.C.', telefono: '999888777', pieTicket: 'Gracias por su visita', anchoTicketMm: 58 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ razonSocial: 'Taller Demo S.A.C.', telefono: '999888777', pieTicket: 'Gracias por su visita', anchoTicketMm: 58 });
    const cat = await como(CAJERA, 'get', '/ordenes/catalogos');
    expect(cat.body.empresa).toMatchObject({ razonSocial: 'Taller Demo S.A.C.', pieTicket: 'Gracias por su visita', anchoTicketMm: 58 });
    expect(await prisma.auditoria.count({ where: { tabla: 'organizacion', motivo: 'Configuración de la empresa modificada' } })).toBeGreaterThan(0);
  });
  it('valida el RUC, el correo, el nombre y el ancho del ticket (400)', async () => {
    expect((await como(ADMIN, 'patch', '/empresa', { ruc: '123' })).status).toBe(400);
    expect((await como(ADMIN, 'patch', '/empresa', { correo: 'no-es-correo' })).status).toBe(400);
    expect((await como(ADMIN, 'patch', '/empresa', { nombre: '  ' })).status).toBe(400);
    expect((await como(ADMIN, 'patch', '/empresa', { anchoTicketMm: 20 })).status).toBe(400);
  });
  it('las series de un local tienen formato fijo y no se repiten entre locales', async () => {
    const [a, b] = (await como(ADMIN, 'get', '/empresa')).body.locales as { id: string; serieBoleta: string }[];
    expect((await como(ADMIN, 'patch', `/empresa/locales/${a.id}`, { serieBoleta: 'b1' })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/empresa/locales/${a.id}`, { serieBoleta: b.serieBoleta })).status).toBe(409);
    const ok = await como(ADMIN, 'patch', `/empresa/locales/${a.id}`, { serieBoleta: 'b009', direccion: 'Av. Prueba 1' });
    expect(ok.status).toBe(200);
    expect(ok.body.locales.find((l: { id: string }) => l.id === a.id)).toMatchObject({ serieBoleta: 'B009', direccion: 'Av. Prueba 1' });
    expect((await como(ADMIN, 'patch', '/empresa/locales/no-existe', { direccion: 'x' })).status).toBe(404);
  });
  it('el Administrador solo la ve y la Cajera no la cambia (403)', async () => {
    expect((await como(SOLO_VE, 'get', '/empresa')).status).toBe(200);
    expect((await como(SOLO_VE, 'patch', '/empresa', { telefono: '1' })).status).toBe(403);
    expect((await como(CAJERA, 'patch', '/empresa', { telefono: '1' })).status).toBe(403);
  });
});
