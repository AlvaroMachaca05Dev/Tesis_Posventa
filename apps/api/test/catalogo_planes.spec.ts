// Slice S6: catálogo de servicios de la empresa (93 + 6 paquetes de visita), ficha del servicio, solapamiento por porcentaje y planes preventivos.
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { evaluarSolapamientos, ReglaSolape } from '../src/maestros/maestros.reglas';
import { esAceite, igual, visitasFuturas } from '../src/plan/lineaTemporal';
import { tipoAceite } from '../src/plan/plan.controller';

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
const creados: { clientes: string[] } = { clientes: [] };

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
});
afterAll(async () => {
  const vs = (await prisma.vehiculo.findMany({ where: { clienteId: { in: creados.clientes } } })).map((v) => v.id);
  await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs } } });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vs } } });
  await prisma.cliente.deleteMany({ where: { id: { in: creados.clientes } } });
  await app.close();
  await prisma.$disconnect();
});

type P2 = { id: string; codigo: string; km: number; ciclo: Record<string, unknown> };
type Sv = { id: string; codigo: string; nombre: string; activo: boolean; etiqueta: string | null; preciosGrupo: Record<string, number | null>; subservicios: { nombre: string; horas: number }[]; pasos: unknown[] };

describe('catálogo de servicios de la empresa', () => {
  it('hay 99 servicios vigentes con etiqueta, y el de la lista de precios cuesta lo definido', async () => {
    const lista = (await como(ADMIN, 'get', '/servicios')).body as Sv[];
    const nuevos = lista.filter((x) => /^SV\d{3}$/.test(x.codigo));
    expect(nuevos).toHaveLength(99);
    expect(nuevos.every((x) => x.etiqueta)).toBe(true);
    const aceite = nuevos.find((x) => x.nombre.startsWith('Cambio de aceite de motor y filtro'))!;
    expect(aceite.etiqueta).toBe('Preventivo');
    expect(aceite.preciosGrupo).toMatchObject({ G1: 25, G4: 60 });
    // lo que no se hace en diésel o en gasolina queda «No aplica»
    expect(nuevos.find((x) => x.nombre.startsWith('Cambio de bomba de alta presión'))!.preciosGrupo.G1).toBeNull();
  });
  it('en todo servicio el precio nunca baja al pasar de G1 a G4', async () => {
    const lista = (await como(ADMIN, 'get', '/servicios')).body as Sv[];
    for (const x of lista.filter((s) => /^SV\d{3}$/.test(s.codigo))) {
      const v = ['G1', 'G2', 'G3', 'G4'].map((g) => x.preciosGrupo[g]).filter((n): n is number => typeof n === 'number');
      expect(v).toEqual([...v].sort((a, b) => a - b));
    }
  });
  it('solo servicios en cero: los generales y el cargo por tarjeta', async () => {
    const lista = (await como(ADMIN, 'get', '/servicios')).body as Sv[];
    const ceros = lista.filter((x) => /^SV\d{3}$/.test(x.codigo) && Object.values(x.preciosGrupo).some((p) => p === 0)).map((x) => x.nombre);
    expect(ceros).toHaveLength(2);
    expect(ceros.join('|')).toMatch(/Cargo por pago con tarjeta/);
    expect(ceros.join('|')).toMatch(/Servicios generales/);
  });
  it('el catálogo viejo de la precarga ya no se ofrece al armar una orden', async () => {
    const v = await prisma.vehiculo.findFirst({ where: { grupo: { codigo: 'G1' } } });
    const c = (await como(CAJERA, 'get', `/catalogo-ods${v ? '?vehiculoId=' + v.id : ''}`)).body as { servicios: { codigo: string }[] };
    expect(c.servicios.length).toBeGreaterThan(80);
    expect(c.servicios.some((x) => /^SV\d{3}$/.test(x.codigo))).toBe(true);
    expect(c.servicios.some((x) => /^A\d\d$/.test(x.codigo))).toBe(false);
  });
});

describe('ficha del servicio', () => {
  it('los paquetes traen la lista de servicios que incluyen, con sus tiempos y sin precios', async () => {
    const lista = (await como(ADMIN, 'get', '/servicios')).body as Sv[];
    const menor = lista.find((x) => x.nombre === 'Mantenimiento menor')!;
    expect(menor.subservicios).toHaveLength(15);
    expect(menor.subservicios[0]).toEqual({ nombre: 'Cambio de aceite y filtro de motor', horas: 0.5 });
    expect(JSON.stringify(menor.subservicios)).not.toMatch(/precio/i);
    const frenos = lista.find((x) => x.nombre.startsWith('Mantenimiento de frenos completo'))!;
    expect(frenos.subservicios).toHaveLength(6);
  });
  it('cualquier servicio puede tener subservicios y una etiqueta válida; con datos malos se rechaza', async () => {
    const cod = `T6${sx}`;
    const ok = await como(ADMIN, 'post', '/servicios', { codigo: cod, nombre: 'Servicio ficha', categoria: 'MOTOR', precioEstandar: 40, horasEstandar: 1, etiqueta: 'Preventivo / correctivo', subservicios: [{ nombre: 'Revisión A', horas: 0.25 }, { nombre: 'Revisión B', horas: 0.5 }] });
    expect(ok.status).toBe(201);
    expect(ok.body.subservicios).toHaveLength(2);
    expect(ok.body.etiqueta).toBe('Preventivo / correctivo');
    expect((await como(ADMIN, 'patch', `/servicios/${ok.body.id}`, { etiqueta: 'Cualquiera' })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/servicios/${ok.body.id}`, { subservicios: [{ nombre: 'X', horas: 0.3 }] })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/servicios/${ok.body.id}`, { subservicios: 'no es lista' })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/servicios/${ok.body.id}`, { preciosGrupo: { G1: 50, G2: 40 } })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/servicios/${ok.body.id}`, { preciosGrupo: { G1: 40, G2: 40, G3: 55, G4: 80 } })).status).toBe(200);
    const catalogo = (await como(CAJERA, 'get', '/catalogo-ods')).body as { servicios: { codigo: string; subservicios: unknown[] }[] };
    expect(catalogo.servicios.find((x) => x.codigo === cod)!.subservicios).toHaveLength(2);
    expect((await como(ADMIN, 'delete', `/servicios/${ok.body.id}`)).status).toBeLessThan(300);
  });
});

describe('solapamiento por porcentaje', () => {
  const regla: ReglaSolape = { id: 'r', codigo: 'T', tipo: 'PAR', base: ['A'], reducidos: ['B'], modo: 'AUTOMATICO', descuentoEstandar: 0, porcentaje: 40 };
  it('el descuento es el porcentaje del servicio que lo recibe, según su precio', () => {
    const h = evaluarSolapamientos([{ indice: 0, servicioId: 'A', total: 200 }, { indice: 1, servicioId: 'B', total: 50 }], [regla], 'G2');
    expect(h).toHaveLength(1);
    expect(h[0].monto).toBe(20);
    const h2 = evaluarSolapamientos([{ indice: 0, servicioId: 'A', total: 200 }, { indice: 1, servicioId: 'B', total: 120 }], [regla], 'G4');
    expect(h2[0].monto).toBe(48);
  });
  it('el 100 % deja el servicio sin costo y nunca pasa de su total', () => {
    const h = evaluarSolapamientos([{ indice: 0, servicioId: 'A', total: 200 }, { indice: 1, servicioId: 'B', total: 35 }], [{ ...regla, porcentaje: 100 }], null);
    expect(h[0].monto).toBe(35);
  });
  it('la precarga trae 51 reglas y las nuevas absorben paquetes', async () => {
    const lista = (await como(ADMIN, 'get', '/solapamientos')).body as { codigo: string; porcentaje: number | null; modo: string }[];
    expect(lista.filter((x) => /^SOL-\d\d$/.test(x.codigo))).toHaveLength(51);
    expect(lista.find((x) => x.codigo === 'SOL-47')).toMatchObject({ porcentaje: 100, modo: 'AUTOMATICO' });
    expect(lista.find((x) => x.codigo === 'SOL-49')).toMatchObject({ porcentaje: null });
  });
  it('se puede guardar una regla con porcentaje o con soles, pero no sin ninguno ni con más de 100', async () => {
    const sv = (await como(ADMIN, 'get', '/servicios')).body as Sv[];
    const [a, b] = sv.filter((x) => /^SV\d{3}$/.test(x.codigo));
    const cuerpo = { codigo: `SOL-T${sx}`, serviciosBase: [a.id], serviciosReducidos: [b.id], modo: 'AUTOMATICO' };
    expect((await como(ADMIN, 'post', '/solapamientos', { ...cuerpo, descuentoEstandar: 7 })).status).toBe(400);
    expect((await como(ADMIN, 'post', '/solapamientos', { ...cuerpo, porcentaje: 150 })).status).toBe(400);
    const ok = await como(ADMIN, 'post', '/solapamientos', { ...cuerpo, porcentaje: 30 });
    expect(ok.status).toBe(201);
    expect(ok.body.porcentaje).toBe(30);
    await como(ADMIN, 'delete', `/solapamientos/${ok.body.id}`);
  });
});

describe('planes preventivos', () => {
  const placa = `PL${sx}`;
  type P = { id: string; codigo: string; combustible: string; uso: string; aceite: string; km: number; meses: number; horizonte: number; ciclo: { secuencia: string[] }; visitas: { nombre: string; afinamiento: boolean }[] };
  it('hay 8 planes con código (combustible × uso × aceite); el diésel no lleva afinamiento y el express nunca', async () => {
    const r = await como(CAJERA, 'get', '/planes-preventivos');
    expect(r.status).toBe(200);
    const p = r.body as P[];
    expect(p.map((x) => x.codigo).sort()).toEqual(['DP-M', 'DP-S', 'DR-M', 'DR-S', 'GP-M', 'GP-S', 'GR-M', 'GR-S']);
    expect(p.filter((x) => x.combustible === 'Diésel').every((x) => x.visitas.every((v) => !v.afinamiento))).toBe(true);
    expect(p.every((x) => x.visitas.every((v) => !(v.afinamiento && v.nombre === 'Servicio express')))).toBe(true);
    const gpm = p.find((x) => x.codigo === 'GP-M')!;
    expect([gpm.km, gpm.meses, gpm.horizonte]).toEqual([5000, 4, 1]);
    expect(gpm.visitas.map((v) => v.nombre + (v.afinamiento ? ' + AF' : ''))).toEqual(['Servicio express', 'Servicio express', 'Mantenimiento menor + AF', 'Servicio express', 'Servicio express', 'Mantenimiento mayor + AF']);
    const grs = p.find((x) => x.codigo === 'GR-S')!;
    expect([grs.km, grs.meses, grs.horizonte, grs.visitas.length]).toEqual([7500, 2, 2, 4]);
    expect(p.find((x) => x.codigo === 'GR-M')!.visitas.filter((v) => v.afinamiento).length).toBe(2);
    expect(p.every((x) => x.meses * x.visitas.length * x.horizonte <= 24)).toBe(true);
  });
  it('el plan del vehículo sale de su combustible (grupo), uso y aceite; sin datos es particular con mineral o semisintético', async () => {
    const c = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `4${sx.padStart(5, "0")}11`, nombre: 'Cliente plan' })).body;
    creados.clientes.push(c.id);
    const grupos = (await como(ADMIN, 'get', '/grupos')).body as { id: string; codigo: string }[];
    const g4 = grupos.find((x) => x.codigo === 'G4')!;
    const v = (await como(CAJERA, 'post', '/vehiculos', { clienteId: c.id, placa, marca: 'TOYOTA', modelo: 'HILUX', grupoId: g4.id })).body;
    expect(v.planCodigo).toBe('DP-M');
    const ed = await como(CAJERA, 'patch', `/vehiculos/${v.id}`, { uso: 'Profesional', aceite: 'Full sintético' });
    expect(ed.status).toBe(200);
    expect(ed.body.planCodigo).toBe('DR-S');
    expect((await como(CAJERA, 'patch', `/vehiculos/${v.id}`, { aceite: '100% sintético 5W30' })).status).toBe(400);
    expect((await como(CAJERA, 'patch', `/vehiculos/${v.id}`, { uso: 'Severo' })).status).toBe(400);
    expect((await como(CAJERA, 'patch', `/vehiculos/${v.id}`, { aceite: 'Semisintético' })).status).toBe(409);
    const sem = await como(CAJERA, 'patch', `/vehiculos/${v.id}`, { aceite: 'Semisintético', confirmarCambioPlan: true });
    expect(sem.body.planCodigo).toBe('DR-M');
    expect((await como(ADMIN, 'patch', `/vehiculos/${v.id}/plan`, { planId: 'no-existe' })).status).toBe(400);
  });
});

describe('línea de tiempo del vehículo', () => {
  it('devuelve el plan, las visitas pasadas por mes y las futuras del ciclo; la cajera la ve', async () => {
    const c = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `5${sx.padStart(5, "0")}22`, nombre: 'Cliente línea' })).body;
    creados.clientes.push(c.id);
    const v = (await como(CAJERA, 'post', '/vehiculos', { clienteId: c.id, placa: `LT${sx}`, marca: 'KIA', modelo: 'RIO', uso: 'Particular', aceite: 'Sintético' })).body;
    expect(v.planCodigo).toBe('GP-S');
    const r = await como(CAJERA, 'get', `/vehiculos/${v.id}/linea-temporal`);
    expect(r.status).toBe(200);
    expect(r.body.plan.codigo).toBe('GP-S');
    expect(r.body.pasadas).toEqual([]);
    expect(r.body.futuras).toEqual([]);
    expect((await como(CAJERA, 'get', '/vehiculos/no-existe/linea-temporal')).status).toBe(404);
  });
  it('las reglas de la proyección: paso del aceite, secuencia que sigue tras el último mayor y afinamiento con alternativas', () => {
    const plan = { codigo: 'GP-S', km: 7500, meses: 6, secuencia: ['SV094', 'SV095+AF', 'SV094', 'SV096+AF'], horizonte: 1 };
    const f = visitasFuturas(plan, { aceite0: { km: 50000, fecha: '2026-01-10' }, paqueteUltimo: 'SV096', rate: 1250, hoy: '2026-01-11', kmHoy: 50100, uso: 'Particular' });
    expect(f.map((x) => x.paquete + (x.afinamiento ? '+AF' : ''))).toEqual(['SV094', 'SV095+AF', 'SV094', 'SV096+AF']);
    expect(f.map((x) => x.km)).toEqual([57500, 65000, 72500, 80000]);
    const g = visitasFuturas(plan, { aceite0: { km: 50000, fecha: '2026-01-10' }, paqueteUltimo: 'SV095', rate: 0, hoy: '2026-01-11', kmHoy: 50000, uso: 'Particular' });
    expect(g[0].paquete).toBe('SV094');
    expect(g[1].paquete).toBe('SV096');
    expect(igual('Revisión de refrigerante', 'REVISION DE REFRIGERANTE')).toBe(true);
    expect(esAceite('Cambio de aceite de motor - 0.25')).toBe(true);
    expect(tipoAceite('Aceite 100% sintético')).toBe('S');
    expect(tipoAceite('semisintético 20w50')).toBe('M');
  });
});

describe('edición de planes, familias de motor y porcentaje diésel', () => {
  it('se editan las reglas de un plan, se rechaza lo inválido y no se elimina un plan en uso', async () => {
    const planes = (await como(ADMIN, 'get', '/planes-preventivos')).body as P2[];
    const dp = planes.find((x) => x.codigo === 'DP-M')!, gp = planes.find((x) => x.codigo === 'GP-M')!;
    const original = dp.ciclo;
    expect((await como(ADMIN, 'patch', `/planes-preventivos/${dp.id}`, { ciclo: { secuencia: ['NO-EXISTE'] } })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/planes-preventivos/${dp.id}`, { ciclo: { secuencia: ['SV094', 'SV095+AF'] } })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/planes-preventivos/${gp.id}`, { ciclo: { secuencia: ['SV094+AF', 'SV095'] } })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/planes-preventivos/${gp.id}`, { ciclo: { meses: 6 } })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/planes-preventivos/${dp.id}`, { ciclo: { km: -5 } })).status).toBe(400);
    expect((await como(CAJERA, 'patch', `/planes-preventivos/${dp.id}`, { nombre: 'X' })).status).toBe(403);
    const ok = await como(ADMIN, 'patch', `/planes-preventivos/${dp.id}`, { ciclo: { km: 6000 } });
    expect(ok.status).toBe(200);
    expect(((await como(ADMIN, 'get', '/planes-preventivos')).body as P2[]).find((x) => x.codigo === 'DP-M')!.km).toBe(6000);
    await como(ADMIN, 'patch', `/planes-preventivos/${dp.id}`, { ciclo: original });
    const usado = await prisma.vehiculo.findFirst({ where: { planId: dp.id } });
    if (usado) expect((await como(ADMIN, 'delete', `/planes-preventivos/${dp.id}`)).status).toBe(409);
  });
  it('las familias de motor se crean, editan y eliminan', async () => {
    const cod = `FT${sx}`;
    const nueva = await como(ADMIN, 'post', '/familias-motor', { codigo: cod, codigos: 'zz1, zz2', combustible: 'Gasolina', litros: '1.2', turbo: true });
    expect(nueva.status).toBe(201);
    expect((await como(ADMIN, 'post', '/familias-motor', { codigo: cod })).status).toBe(409);
    expect((await como(ADMIN, 'patch', `/familias-motor/${nueva.body.id}`, { codigos: ['AA1'], turbo: false })).status).toBe(200);
    const f = ((await como(ADMIN, 'get', '/familias-motor')).body as { codigo: string; codigos: string[]; turbo: boolean }[]).find((x) => x.codigo === cod)!;
    expect(f).toMatchObject({ codigos: ['AA1'], turbo: false });
    expect((await como(ADMIN, 'delete', `/familias-motor/${nueva.body.id}`)).status).toBeLessThan(300);
  });
  it('un solapamiento puede tener un porcentaje distinto para diésel (G4)', () => {
    const r: ReglaSolape = { id: 'r', codigo: 'T', tipo: 'PAR', base: ['A'], reducidos: ['B'], modo: 'AUTOMATICO', descuentoEstandar: 0, porcentaje: 20, porcentajeDiesel: 50 };
    const l = [{ indice: 0, servicioId: 'A', total: 100 }, { indice: 1, servicioId: 'B', total: 100 }];
    expect(evaluarSolapamientos(l, [r], 'G2')[0].monto).toBe(20);
    expect(evaluarSolapamientos(l, [r], 'G4')[0].monto).toBe(50);
  });
});

describe('roles, categorías y series por local', () => {
  const TI = 'ti@demo.local';
  it('solo el Superadministrador edita y elimina roles; el Administrador no', async () => {
    const nuevo = await como(TI, 'post', '/roles', { nombre: `Rol T${sx}`, permisos: [{ modulo: 'clientes', nivel: 'V' }] });
    expect(nuevo.status).toBe(201);
    expect((await como(ADMIN, 'patch', `/roles/${nuevo.body.id}`, { nombre: 'X' })).status).toBe(403);
    expect((await como(ADMIN, 'delete', `/roles/${nuevo.body.id}`)).status).toBe(403);
    const ed = await como(TI, 'patch', `/roles/${nuevo.body.id}`, { nombre: `Rol T${sx} b`, permisos: [{ modulo: 'clientes', nivel: 'E' }, { modulo: 'citas', nivel: 'V' }] });
    expect(ed.status).toBe(200);
    const lista = (await como(TI, 'get', '/roles')).body as { id: string; nombre: string; permisos: unknown[] }[];
    expect(lista.find((x) => x.id === nuevo.body.id)).toMatchObject({ nombre: `Rol T${sx} b` });
    expect(lista.find((x) => x.id === nuevo.body.id)!.permisos).toHaveLength(2);
    const sup = lista.find((x) => x.nombre === 'Superadministrador');
    if (sup) expect((await como(TI, 'delete', `/roles/${sup.id}`)).status).toBe(403);
    expect((await como(TI, 'delete', `/roles/${nuevo.body.id}`)).status).toBeLessThan(300);
  });
  it('las categorías se crean, se renombran con sus ítems y no se eliminan si están en uso', async () => {
    const nombre = `Cat T${sx}`;
    const c = await como(ADMIN, 'post', '/categorias-inventario', { tipo: 'producto', nombre });
    expect(c.status).toBe(201);
    expect((await como(ADMIN, 'post', '/categorias-inventario', { tipo: 'producto', nombre })).status).toBe(409);
    expect((await como(ADMIN, 'post', '/categorias-inventario', { tipo: 'otro', nombre: 'X' })).status).toBe(400);
    const p = await como(ADMIN, 'post', '/productos', { codigo: `PCT${sx}`, nombre: 'Producto categoría', categoria: nombre, precio: 10 });
    expect(p.status).toBe(201);
    expect((await como(ADMIN, 'delete', `/categorias-inventario/${c.body.id}`)).status).toBe(409);
    expect((await como(ADMIN, 'patch', `/categorias-inventario/${c.body.id}`, { nombre: nombre + ' 2' })).status).toBe(200);
    expect(((await como(ADMIN, 'get', '/productos')).body as { id: string; categoria: string }[]).find((x) => x.id === p.body.id)!.categoria).toBe(nombre + ' 2');
    await como(ADMIN, 'delete', `/productos/${p.body.id}`);
    expect((await como(ADMIN, 'delete', `/categorias-inventario/${c.body.id}`)).status).toBeLessThan(300);
  });
  it('las series de un local se asignan desde Almacenes y no se repiten entre locales', async () => {
    const locales = (await como(ADMIN, 'get', '/locales-series')).body as { id: string; serieBoleta: string | null }[];
    expect(locales.length).toBeGreaterThan(1);
    expect((await como(CAJERA, 'patch', `/locales-series/${locales[0].id}`, { serieBoleta: 'B777' })).status).toBe(403);
    const a = await como(ADMIN, 'patch', `/locales-series/${locales[0].id}`, { serieBoleta: locales[0].serieBoleta ?? 'B001' });
    expect(a.status).toBe(200);
    const dup = locales[0].serieBoleta ?? 'B001';
    expect((await como(ADMIN, 'patch', `/locales-series/${locales[1].id}`, { serieBoleta: dup })).status).toBe(409);
  });
});

describe('categorías «ambos», locales y combustible de las familias', () => {
  it('una categoría puede ser de ambos y cambiar de tipo si no hay ítems que lo impidan', async () => {
    const c = await como(ADMIN, 'post', '/categorias-inventario', { tipo: 'ambos', nombre: `Ambos T${sx}` });
    expect(c.status).toBe(201);
    expect(((await como(ADMIN, 'get', '/categorias-inventario?tipo=servicio')).body as { nombre: string }[]).some((x) => x.nombre === `Ambos T${sx}`)).toBe(true);
    expect(((await como(ADMIN, 'get', '/categorias-inventario?tipo=producto')).body as { nombre: string }[]).some((x) => x.nombre === `Ambos T${sx}`)).toBe(true);
    expect((await como(ADMIN, 'patch', `/categorias-inventario/${c.body.id}`, { tipo: 'servicio', nombre: `Ambos T${sx} S` })).status).toBe(200);
    expect((await como(ADMIN, 'delete', `/categorias-inventario/${c.body.id}`)).status).toBeLessThan(300);
  });
  it('se agregan, renombran y eliminan locales; el último o uno con historial no se elimina', async () => {
    const nombre = `Local T${sx}`;
    const lista = (await como(ADMIN, 'post', '/locales-series', { nombre, direccion: 'Av. Prueba 1' })).body as { id: string; nombre: string }[];
    const nuevo = lista.find((x) => x.nombre === nombre)!;
    expect(nuevo).toBeTruthy();
    expect((await como(ADMIN, 'post', '/locales-series', { nombre })).status).toBe(409);
    expect((await como(ADMIN, 'patch', `/locales-series/${nuevo.id}`, { nombre: nombre + ' b', serieBoleta: 'B9' + sx.slice(-2) })).status).toBe(200);
    expect((await como(CAJERA, 'delete', `/locales-series/${nuevo.id}`)).status).toBe(403);
    expect((await como(ADMIN, 'delete', `/locales-series/${nuevo.id}`)).status).toBe(200);
    const todos = (await como(ADMIN, 'get', '/locales-series')).body as { id: string }[];
    const conHistorial = await prisma.local.findFirst({ where: { ordenes: { some: {} } } });
    if (conHistorial) expect((await como(ADMIN, 'delete', `/locales-series/${conHistorial.id}`)).status).toBe(409);
    expect(todos.length).toBeGreaterThan(0);
  });
  it('la familia de motor toma el combustible de su grupo si no se escribe', async () => {
    const grupos = (await como(ADMIN, 'get', '/grupos')).body as { id: string; codigo: string }[];
    const g4 = grupos.find((x) => x.codigo === 'G4')!, g1 = grupos.find((x) => x.codigo === 'G1')!;
    const a = await como(ADMIN, 'post', '/familias-motor', { codigo: `FD${sx}`, codigos: 'DD1', grupoId: g4.id });
    const b = await como(ADMIN, 'post', '/familias-motor', { codigo: `FG${sx}`, codigos: 'GG1', grupoId: g1.id });
    const fam = (await como(ADMIN, 'get', '/familias-motor')).body as { codigo: string; combustible: string | null }[];
    expect(fam.find((x) => x.codigo === `FD${sx}`)!.combustible).toBe('Diésel');
    expect(fam.find((x) => x.codigo === `FG${sx}`)!.combustible).toBe('Gasolina');
    expect(fam.filter((x) => !x.combustible).length).toBe(0);
    await como(ADMIN, 'delete', `/familias-motor/${a.body.id}`);
    await como(ADMIN, 'delete', `/familias-motor/${b.body.id}`);
  });
});
