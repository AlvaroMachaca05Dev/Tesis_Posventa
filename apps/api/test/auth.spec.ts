// Pruebas del slice S1 (RF-001, RF-002, RF-003). Se escriben primero; usan la base de desarrollo con las semillas.
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();
let app: INestApplication;
const CLAVE = process.env.SEED_PASSWORD as string;

const login = async (correo: string, password = CLAVE) =>
  request(app.getHttpServer()).post('/auth/login').send({ correo, password });
const token = async (correo: string) => (await login(correo)).body.token as string;
const get = async (ruta: string, correo: string, extra: Record<string, string> = {}) => {
  const t = await token(correo);
  return request(app.getHttpServer()).get(ruta).set('Authorization', `Bearer ${t}`).set(extra);
};

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('CA-S1-01 inicio de sesión (RF-001)', () => {
  it('sin sesión una ruta protegida responde 401', async () => {
    await request(app.getHttpServer()).get('/me').expect(401);
  });
  it('credenciales válidas devuelven sesión con sus roles', async () => {
    const r = await login('admin@demo.local').then((x) => x);
    expect(r.status).toBe(201);
    expect(r.body.token).toBeTruthy();
    expect(r.body.usuario.roles).toEqual(['Administrador']);
  });
  it('contraseña incorrecta o usuario inexistente responden 401', async () => {
    expect((await login('admin@demo.local', 'incorrecta')).status).toBe(401);
    expect((await login('no-existe@demo.local')).status).toBe(401);
  });
  it('un usuario desactivado no entra', async () => {
    await prisma.usuario.update({ where: { correo: 'cajera@demo.local' }, data: { activo: false } });
    try {
      expect((await login('cajera@demo.local')).status).toBe(401);
    } finally {
      await prisma.usuario.update({ where: { correo: 'cajera@demo.local' }, data: { activo: true } });
    }
  });
});

describe('CA-S1-03 y 04 permisos en el servidor (RF-002)', () => {
  it('un Técnico recibe 403 en bancos aunque la pantalla lo oculte', async () => {
    expect((await get('/bancos/ping', 'tecnico@demo.local')).status).toBe(403);
  });
  it('la Cajera accede a bancos', async () => {
    expect((await get('/bancos/ping', 'cajera@demo.local')).status).toBe(200);
  });
  it('con dos roles se suman los permisos y gana el nivel más alto', async () => {
    const r = await get('/me', 'reemplazo@demo.local');
    expect(r.body.permisos.bancos).toBe('E'); // de Cajera
    expect(r.body.permisos.catalogo).toBe('A'); // de Logístico (la Cajera solo ve)
  });
});

describe('CA-S1-15 el Jefe de taller incluye todo lo del Técnico', () => {
  const ord: Record<string, number> = { V: 1, E: 2, A: 3 };
  it('mismo nivel o mayor en cada módulo del Técnico; nada de Cajera ni de Logística', async () => {
    const jefe = (await get('/me', 'jefe@demo.local')).body.permisos;
    const tec = (await get('/me', 'tecnico@demo.local')).body.permisos;
    for (const m of Object.keys(tec)) expect(ord[jefe[m]] ?? 0).toBeGreaterThanOrEqual(ord[tec[m]]);
    expect(jefe.notas).toBeUndefined(); // emitir nota de venta es de Cajera
    expect(jefe.compras).toBeUndefined(); // compras es de Logística
  });
});

describe('CA-S1-12 «Ver como…» solo del Desarrollador, auditado', () => {
  it('el Desarrollador entra como el Técnico y queda auditado', async () => {
    const tec = await prisma.usuario.findUniqueOrThrow({ where: { correo: 'tecnico@demo.local' } });
    const t = await token('superusuario@rmotriz.com');
    const r = await request(app.getHttpServer()).post('/ver-como').set('Authorization', `Bearer ${t}`).send({ usuarioId: tec.id });
    expect(r.status).toBe(201);
    const me = await request(app.getHttpServer()).get('/me').set('Authorization', `Bearer ${t}`).set('X-Ver-Como', tec.id);
    expect(me.body.actuandoComo).toBe(true);
    expect(me.body.esPlataforma).toBe(true); // sigue siendo el Desarrollador, para poder salir de «Ver como»
    expect(me.body.usuario.correo).toBe('tecnico@demo.local');
    expect(me.body.permisos.bancos).toBeUndefined();
    const aud = await prisma.auditoria.findFirst({ where: { tabla: 'ver_como', actuandoComo: tec.id }, orderBy: { fecha: 'desc' } });
    expect(aud).not.toBeNull();
  });
  it('el Superadministrador y el Administrador no pueden usarlo, ni forzando la cabecera', async () => {
    const tec = await prisma.usuario.findUniqueOrThrow({ where: { correo: 'tecnico@demo.local' } });
    for (const c of ['ti@demo.local', 'admin@demo.local']) {
      const t = await token(c);
      expect((await request(app.getHttpServer()).post('/ver-como').set('Authorization', `Bearer ${t}`).send({ usuarioId: tec.id })).status).toBe(403);
      expect((await request(app.getHttpServer()).get('/me').set('Authorization', `Bearer ${t}`).set('X-Ver-Como', tec.id)).status).toBe(403);
    }
  });
});

describe('CA-S1-18 el rol Desarrollador es exclusivo de la plataforma', () => {
  it('el Superadministrador no ve el rol Desarrollador en la lista de roles', async () => {
    const r = await get('/roles', 'ti@demo.local');
    expect(r.status).toBe(200);
    const nombres = r.body.map((x: { nombre: string }) => x.nombre);
    expect(nombres).not.toContain('Desarrollador');
    expect(nombres).toContain('Superadministrador');
  });
  it('el Desarrollador sí lo ve', async () => {
    const nombres = (await get('/roles', 'superusuario@rmotriz.com')).body.map((x: { nombre: string }) => x.nombre);
    expect(nombres).toContain('Desarrollador');
  });
});

describe('menú por rol (RF-002)', () => {
  it('el Técnico recibe solo sus módulos, con etiqueta y grupo', async () => {
    const r = await get('/me', 'tecnico@demo.local');
    const ids = r.body.menu.map((m: { id: string }) => m.id);
    expect(ids).toContain('ods');
    expect(ids).not.toContain('bancos');
    const ods = r.body.menu.find((m: { id: string }) => m.id === 'ods');
    expect(ods).toMatchObject({ label: 'Órdenes de servicio', nivel: expect.stringMatching(/[AEV]/) });
  });
  it('los módulos beta vienen en el grupo Beta', async () => {
    const r = await get('/me', 'ti@demo.local');
    const beta = r.body.menu.filter((m: { grupo: string }) => m.grupo === 'Beta').map((m: { id: string }) => m.id);
    expect(beta).toEqual(expect.arrayContaining(['paquetes', 'cajasm', 'flujo', 'integraciones']));
  });
});

describe('lista de usuarios (RF-003, CA-S1-18)', () => {
  it('el Técnico no puede listar usuarios (403)', async () => {
    expect((await get('/usuarios', 'tecnico@demo.local')).status).toBe(403);
  });
  it('el Superadministrador no ve al Desarrollador en la lista', async () => {
    const r = await get('/usuarios', 'ti@demo.local');
    expect(r.status).toBe(200);
    const correos = r.body.map((u: { correo: string }) => u.correo);
    expect(correos).not.toContain('superusuario@rmotriz.com');
    expect(correos).toContain('admin@demo.local');
  });
  it('el Desarrollador ve a todos', async () => {
    const correos = (await get('/usuarios', 'superusuario@rmotriz.com')).body.map((u: { correo: string }) => u.correo);
    expect(correos).toContain('superusuario@rmotriz.com');
    expect(correos).toContain('admin@demo.local');
  });
});
