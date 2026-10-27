// Pruebas del slice S1: crear usuarios y roles propios (RF-003; CA-S1-05, 13, 14, 16, 18). Se escriben primero.
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();
let app: INestApplication;
const CLAVE = process.env.SEED_PASSWORD as string;
const NUEVA = 'ClaveNueva-2026';
const creados: string[] = [];
let n = 0;
const correo = () => {
  const c = `prueba-${Date.now()}-${n++}@demo.local`;
  creados.push(c);
  return c;
};

const tokenDe = async (c: string, p = CLAVE) => (await request(app.getHttpServer()).post('/auth/login').send({ correo: c, password: p })).body.token as string;
const como = async (c: string, metodo: 'get' | 'post' | 'patch', ruta: string, cuerpo?: object) => {
  const t = await tokenDe(c);
  const r = request(app.getHttpServer())[metodo](ruta).set('Authorization', `Bearer ${t}`);
  return cuerpo ? r.send(cuerpo) : r;
};
const rolId = async (nombre: string) => (await prisma.rol.findFirstOrThrow({ where: { nombre } })).id;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
});
afterAll(async () => {
  const us = await prisma.usuario.findMany({ where: { OR: [{ correo: { in: creados } }, { correo: { startsWith: 'otra-empresa-' } }] } });
  const ids = us.map((u) => u.id);
  await prisma.usuarioRol.deleteMany({ where: { usuarioId: { in: ids } } });
  await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
  const roles = await prisma.rol.findMany({ where: { nombre: { startsWith: 'Prueba ' } } });
  await prisma.rolPermiso.deleteMany({ where: { rolId: { in: roles.map((r) => r.id) } } });
  await prisma.rol.deleteMany({ where: { id: { in: roles.map((r) => r.id) } } });
  await prisma.organizacion.deleteMany({ where: { nombre: 'Empresa B de prueba' } });
  await app.close();
  await prisma.$disconnect();
});

describe('crear usuarios (CA-S1-05)', () => {
  it('el Superadministrador crea un usuario con rol Cajera, entra con su clave y queda auditado', async () => {
    const c = correo();
    const r = await como('ti@demo.local', 'post', '/usuarios', { nombre: 'Prueba Cajera', correo: c, password: NUEVA, rolIds: [await rolId('Cajera')] });
    expect(r.status).toBe(201);
    expect(r.body.roles).toEqual(['Cajera']);
    expect(await tokenDe(c, NUEVA)).toBeTruthy();
    const aud = await prisma.auditoria.findFirst({ where: { tabla: 'usuario', registroId: r.body.id }, orderBy: { fecha: 'desc' } });
    expect(aud).not.toBeNull();
    expect(JSON.stringify(aud!.despues)).not.toContain('passwordHash');
  });
  it('correo repetido responde 409 y contraseña corta 400', async () => {
    const c = correo();
    const ok = await como('ti@demo.local', 'post', '/usuarios', { nombre: 'Prueba A', correo: c, password: NUEVA, rolIds: [await rolId('Técnico')] });
    expect(ok.status).toBe(201);
    expect((await como('ti@demo.local', 'post', '/usuarios', { nombre: 'Prueba B', correo: c, password: NUEVA, rolIds: [await rolId('Técnico')] })).status).toBe(409);
    expect((await como('ti@demo.local', 'post', '/usuarios', { nombre: 'Prueba C', correo: correo(), password: 'corta', rolIds: [await rolId('Técnico')] })).status).toBe(400);
  });
  it('un Técnico no puede crear usuarios (403)', async () => {
    expect((await como('tecnico@demo.local', 'post', '/usuarios', { nombre: 'X', correo: correo(), password: NUEVA, rolIds: [await rolId('Técnico')] })).status).toBe(403);
  });
  it('desactivar a un usuario le impide entrar; reactivarlo lo devuelve', async () => {
    const c = correo();
    const u = await como('ti@demo.local', 'post', '/usuarios', { nombre: 'Prueba Baja', correo: c, password: NUEVA, rolIds: [await rolId('Logístico')] });
    expect((await como('ti@demo.local', 'patch', `/usuarios/${u.body.id}`, { activo: false })).status).toBe(200);
    expect(await tokenDe(c, NUEVA)).toBeUndefined();
    await como('ti@demo.local', 'patch', `/usuarios/${u.body.id}`, { activo: true });
    expect(await tokenDe(c, NUEVA)).toBeTruthy();
  });
});

describe('solo se gestionan roles de nivel inferior (CA-S1-16)', () => {
  it('el Administrador crea un Jefe de taller, pero no otro Administrador ni un Superadministrador', async () => {
    const jefe = await como('admin@demo.local', 'post', '/usuarios', { nombre: 'Prueba Jefe', correo: correo(), password: NUEVA, rolIds: [await rolId('Jefe de taller')] });
    expect(jefe.status).toBe(201);
    expect((await como('admin@demo.local', 'post', '/usuarios', { nombre: 'Prueba Adm', correo: correo(), password: NUEVA, rolIds: [await rolId('Administrador')] })).status).toBe(403);
    expect((await como('admin@demo.local', 'post', '/usuarios', { nombre: 'Prueba Sup', correo: correo(), password: NUEVA, rolIds: [await rolId('Superadministrador')] })).status).toBe(403);
  });
  it('el Administrador no puede modificar a un Superadministrador', async () => {
    const ti = await prisma.usuario.findUniqueOrThrow({ where: { correo: 'ti@demo.local' } });
    expect((await como('admin@demo.local', 'patch', `/usuarios/${ti.id}`, { activo: false })).status).toBe(403);
  });
  it('el Superadministrador crea un Administrador', async () => {
    const r = await como('ti@demo.local', 'post', '/usuarios', { nombre: 'Prueba Admin', correo: correo(), password: NUEVA, rolIds: [await rolId('Administrador')] });
    expect(r.status).toBe(201);
  });
});

describe('el rol Desarrollador es exclusivo (CA-S1-18)', () => {
  it('el Superadministrador no puede asignar el rol Desarrollador', async () => {
    const dev = await prisma.rol.findFirstOrThrow({ where: { nombre: 'Desarrollador' } });
    const r = await como('ti@demo.local', 'post', '/usuarios', { nombre: 'Prueba Dev', correo: correo(), password: NUEVA, rolIds: [dev.id] });
    expect([403, 404]).toContain(r.status);
  });
  it('no puede modificar al Desarrollador: no existe para él', async () => {
    const dev = await prisma.usuario.findUniqueOrThrow({ where: { correo: 'superusuario@rmotriz.com' } });
    expect((await como('ti@demo.local', 'patch', `/usuarios/${dev.id}`, { activo: false })).status).toBe(404);
  });
});

describe('cada empresa ve solo lo suyo (CA-S1-13)', () => {
  it('un usuario de otra empresa no aparece en la lista del Superadministrador, pero sí para el Desarrollador', async () => {
    const orgB = await prisma.organizacion.create({ data: { nombre: 'Empresa B de prueba' } });
    const c = `otra-empresa-${Date.now()}@demo.local`;
    const u = await prisma.usuario.create({ data: { nombre: 'Usuario de B', correo: c, passwordHash: 'x', organizacionId: orgB.id } });
    const propia = (await como('ti@demo.local', 'get', '/usuarios')).body.map((x: { correo: string }) => x.correo);
    expect(propia).not.toContain(c);
    const todos = (await como('superusuario@rmotriz.com', 'get', '/usuarios')).body.map((x: { correo: string }) => x.correo);
    expect(todos).toContain(c);
    expect((await como('ti@demo.local', 'patch', `/usuarios/${u.id}`, { activo: false })).status).toBe(404);
  });
});

describe('roles propios con módulos elegidos (CA-S1-14)', () => {
  it('el Superadministrador crea un rol con módulos y niveles, y quien lo recibe ve exactamente eso', async () => {
    const r = await como('ti@demo.local', 'post', '/roles', { nombre: 'Prueba Recepcionista', permisos: [{ modulo: 'clientes', nivel: 'E' }, { modulo: 'citas', nivel: 'V' }] });
    expect(r.status).toBe(201);
    const c = correo();
    await como('ti@demo.local', 'post', '/usuarios', { nombre: 'Prueba Recep', correo: c, password: NUEVA, rolIds: [r.body.id] });
    const t = await tokenDe(c, NUEVA);
    const me = await request(app.getHttpServer()).get('/me').set('Authorization', `Bearer ${t}`);
    expect(me.body.permisos).toEqual({ clientes: 'E', citas: 'V' });
  });
  it('un nombre repetido responde 409', async () => {
    await como('ti@demo.local', 'post', '/roles', { nombre: 'Prueba Repetido', permisos: [{ modulo: 'clientes', nivel: 'V' }] });
    expect((await como('ti@demo.local', 'post', '/roles', { nombre: 'Prueba Repetido', permisos: [{ modulo: 'clientes', nivel: 'V' }] })).status).toBe(409);
  });
  it('no se pueden elegir módulos que la empresa no tiene habilitados', async () => {
    const org = await prisma.organizacion.findFirstOrThrow({ where: { nombre: 'Taller Demo' } });
    await prisma.moduloHabilitado.delete({ where: { organizacionId_modulo: { organizacionId: org.id, modulo: 'gemini' } } });
    try {
      const r = await como('ti@demo.local', 'post', '/roles', { nombre: 'Prueba Sin Modulo', permisos: [{ modulo: 'gemini', nivel: 'V' }] });
      expect(r.status).toBe(400);
    } finally {
      await prisma.moduloHabilitado.create({ data: { organizacionId: org.id, modulo: 'gemini' } });
    }
  });
  it('el Administrador no puede crear roles (403) y nadie puede dar un permiso mayor al suyo', async () => {
    expect((await como('admin@demo.local', 'post', '/roles', { nombre: 'Prueba No', permisos: [{ modulo: 'clientes', nivel: 'V' }] })).status).toBe(403);
  });
  it('un rol propio no aparece con nivel de gestión: queda en el nivel más bajo y se puede asignar', async () => {
    const roles = (await como('admin@demo.local', 'get', '/roles')).body as { nombre: string; nivel: number; asignable: boolean }[];
    const propio = roles.find((x) => x.nombre === 'Prueba Recepcionista');
    expect(propio).toMatchObject({ nivel: 1, asignable: true });
  });
});

describe('locales de la empresa', () => {
  it('la lista de usuarios indica el local de cada persona', async () => {
    const r = await como('ti@demo.local', 'get', '/usuarios');
    const caj = r.body.find((u: { correo: string }) => u.correo === 'cajera@demo.local');
    expect(caj.localId).toBeTruthy();
  });
  it('el Superadministrador lista los locales de su empresa', async () => {
    const r = await como('ti@demo.local', 'get', '/locales');
    expect(r.status).toBe(200);
    expect(r.body.map((l: { nombre: string }) => l.nombre)).toEqual(expect.arrayContaining(['Local Prohogar', 'Local Unión']));
  });
});
