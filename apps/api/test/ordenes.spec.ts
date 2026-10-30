// Pruebas del slice S3: órdenes de servicio (RF-011 a RF-017; DEC-61, 67, 71, 72, 73). Se escriben primero.
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
const CAJERA = 'cajera@demo.local';
const TECNICO = 'tecnico@demo.local';
const ADMIN = 'admin@demo.local';
let n = 0;
const sufijo = `${Date.now() % 100000}`;
let clienteId: string;
const vehiculo = async () => (await como(CAJERA, 'post', '/vehiculos', { clienteId, placa: `OD${sufijo}${n++}` })).body.id as string;
const nueva = async (vehiculoId: string, extra: object = {}) => como(CAJERA, 'post', '/ordenes', { vehiculoId, tipoAtencion: 'Mantenimiento preventivo', km: 1000, ...extra });

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  clienteId = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `ODS${sufijo}`, nombre: 'Cliente ODS Prueba' })).body.id;
});
afterAll(async () => {
  // Sin el cliente de prueba no se borra nada: un filtro vacío borraría toda la base.
  if (!clienteId) { await app?.close(); await prisma.$disconnect(); return; }
  const ods = await prisma.ordenServicio.findMany({ where: { clienteId } });
  const ids = ods.map((o) => o.id);
  await prisma.abono.deleteMany({ where: { ordenId: { in: ids } } });
  await prisma.evidenciaIngreso.deleteMany({ where: { ordenId: { in: ids } } });
  await prisma.detalleODS.deleteMany({ where: { ordenId: { in: ids } } });
  await prisma.bitacora.deleteMany({ where: { ordenId: { in: ids } } });
  await prisma.ordenServicio.deleteMany({ where: { id: { in: ids } } });
  const vs = await prisma.vehiculo.findMany({ where: { clienteId } });
  await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs.map((v) => v.id) } } });
  await prisma.vehiculo.deleteMany({ where: { clienteId } });
  await prisma.auditoria.deleteMany({ where: { registroId: { in: [...ids, ...vs.map((v) => v.id), clienteId] } } });
  await prisma.cliente.deleteMany({ where: { id: clienteId } });
  await app.close();
  await prisma.$disconnect();
});

describe('crear ODS (RF-011, DEC-67, DEC-71)', () => {
  it('el código es AAAAMMDD + correlativo de 5 dígitos y el técnico es opcional', async () => {
    const r = await nueva(await vehiculo());
    expect(r.status).toBe(201);
    const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    expect(r.body.codigo).toMatch(new RegExp(`^${hoy}\\d{5,}$`));
    expect(r.body).toMatchObject({ estado: 'Recepcion', decision: 'Pendiente de aprobación', tecnico: null, fechaCierre: null });
    expect(r.body.cliente.id).toBe(clienteId);
  });
  it('un número eliminado no se reutiliza: la siguiente ODS sigue el correlativo y la baja queda auditada', async () => {
    const a = (await nueva(await vehiculo())).body;
    const del = await como(ADMIN, 'delete', `/ordenes/${a.id}`, { motivo: 'Se creó por error' });
    expect(del.status).toBe(200);
    const b = (await nueva(await vehiculo())).body;
    expect(Number(b.codigo.slice(8))).toBe(Number(a.codigo.slice(8)) + 1);
    const aud = await prisma.auditoria.findFirst({ where: { tabla: 'orden_servicio', registroId: a.id, motivo: { contains: 'error' } } });
    expect(aud).not.toBeNull();
    expect((await como(CAJERA, 'get', '/ordenes?estado=Recepcion')).body.map((x: { id: string }) => x.id)).not.toContain(a.id);
  });
  it('dos ODS que se crean a la vez reciben números distintos', async () => {
    const [x, y] = await Promise.all([nueva(await vehiculo()), nueva(await vehiculo())]);
    expect(x.body.codigo).not.toBe(y.body.codigo);
  });
  it('un vehículo puede tener dos ODS abiertas solo si una es de Garantía, y nunca dos de Garantía', async () => {
    const v = await vehiculo();
    expect((await nueva(v)).status).toBe(201);
    const otra = await nueva(v);
    expect(otra.status).toBe(409);
    expect(otra.body.message).toMatch(/Garantía/);
    expect((await nueva(v, { tipoAtencion: 'Garantía' })).status).toBe(201);
    expect((await nueva(v, { tipoAtencion: 'Garantía' })).status).toBe(409);
    const g = await vehiculo();
    expect((await nueva(g, { tipoAtencion: 'Garantía' })).status).toBe(201);
    expect((await nueva(g, { tipoAtencion: 'Garantía' })).body.message).toMatch(/ya existe una orden de servicio de tipo Garantía/);
  });
  it('el Técnico ve las ODS pero no las crea (403)', async () => {
    expect((await como(TECNICO, 'get', '/ordenes')).status).toBe(200);
    expect((await nueva(await vehiculo()).then(() => como(TECNICO, 'post', '/ordenes', { vehiculoId: 'x', tipoAtencion: 'Garantía' }))).status).toBe(403);
  });
});

describe('ítems y totales (RF-013, RF-014, DEC-73)', () => {
  it('servicios y productos con referencia; cada línea se redondea a 2 decimales y el total es la suma', async () => {
    const o = (await nueva(await vehiculo())).body;
    const r = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, {
      detalles: [
        { tipo: 'servicio', descripcion: 'Cambio de aceite', cantidad: 1, precio: 60 },
        { tipo: 'producto', descripcion: 'Aceite 5W-30', referencia: 'AMO-102', cantidad: 1, precio: 146.89, descuentoPct: 12.3, costo: 100 },
        { tipo: 'producto', descripcion: 'Filtro', cantidad: 2, precio: 10.005 },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.detalles.map((d: { total: number }) => d.total)).toEqual([60, 128.82, 20.01]);
    expect(r.body.detalles[1]).toMatchObject({ referencia: 'AMO-102', tipo: 'producto' });
    expect(r.body.total).toBe(208.83);
  });
  it('en un servicio la cantidad son H-H y no multiplican el precio; en un producto sí', async () => {
    const o = (await nueva(await vehiculo())).body;
    const r = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'Afinamiento', cantidad: 2.5, precio: 120 }, { tipo: 'producto', descripcion: 'Bujía', cantidad: 4, precio: 15 }] });
    expect(r.body.detalles.map((d: { total: number }) => d.total)).toEqual([120, 60]);
    expect(r.body.total).toBe(180);
  });
  it('el descuento en % se aplica a todos los ítems', async () => {
    const o = (await nueva(await vehiculo())).body;
    await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'A', precio: 100 }, { tipo: 'producto', descripcion: 'B', precio: 50 }] });
    const r = await como(CAJERA, 'post', `/ordenes/${o.id}/descuento`, { porcentaje: 10 });
    expect(r.body.detalles.map((d: { descuentoPct: number }) => d.descuentoPct)).toEqual([10, 10]);
    expect(r.body.total).toBe(135);
  });
  it('un ítem sin descripción o con precio negativo se rechaza', async () => {
    const o = (await nueva(await vehiculo())).body;
    expect((await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: ' ', precio: 1 }] })).status).toBe(400);
    expect((await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'producto', descripcion: 'X', precio: -1 }] })).status).toBe(400);
  });
  it('agregar un ítem nuevo devuelve la decisión a «Pendiente de aprobación» y queda en la bitácora', async () => {
    const o = (await nueva(await vehiculo())).body;
    const d1 = (await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'A', precio: 10 }] })).body.detalles;
    await como(CAJERA, 'patch', `/ordenes/${o.id}`, { decision: 'Aprobada para cotizar' });
    const r = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [...d1, { tipo: 'producto', descripcion: 'Nuevo', precio: 5 }] });
    expect(r.body.decision).toBe('Pendiente de aprobación');
    expect(r.body.bitacora.some((b: { texto: string }) => /Pendiente de aprobación/.test(b.texto))).toBe(true);
  });
});

describe('estados, decisión y cierre (RF-016, RF-017, DEC-61, DEC-72)', () => {
  it('los estados se mueven libremente, incluso de Recepción a Entrega', async () => {
    const o = (await nueva(await vehiculo())).body;
    expect((await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'Entrega' })).body.estado).toBe('Entrega');
    expect((await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'Recepcion' })).body.estado).toBe('Recepcion');
  });
  it('sin nota de venta solo se cierra una ODS «No aprobada»; al cerrar se pone la fecha de cierre y al reabrir se borra', async () => {
    const o = (await nueva(await vehiculo())).body;
    const no = await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'Cerrada' });
    expect(no.status).toBe(409);
    expect(no.body.message).toMatch(/No aprobada/);
    await como(CAJERA, 'patch', `/ordenes/${o.id}`, { decision: 'No aprobada' });
    const c = await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'Cerrada' });
    expect(c.status).toBe(200);
    expect(c.body.fechaCierre).toBeTruthy();
    const re = await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'EnProceso' });
    expect(re.body.fechaCierre).toBeNull();
  });
  it('la decisión solo acepta sus cuatro valores y el estado los suyos', async () => {
    const o = (await nueva(await vehiculo())).body;
    expect((await como(CAJERA, 'patch', `/ordenes/${o.id}`, { decision: 'Aprobada' })).status).toBe(400);
    expect((await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estado: 'Archivada' })).status).toBe(400);
  });
  it('una ODS cerrada deja de contar como abierta para el límite por vehículo', async () => {
    const v = await vehiculo();
    const a = (await nueva(v)).body;
    await como(CAJERA, 'patch', `/ordenes/${a.id}`, { decision: 'No aprobada' });
    await como(CAJERA, 'patch', `/ordenes/${a.id}`, { estado: 'Cerrada' });
    expect((await nueva(v)).status).toBe(201);
  });
});

describe('encabezado, abonos y lista (RF-012, DEC-28, DEC-80)', () => {
  it('se edita el encabezado: técnico, jefe de taller, observaciones y recomendaciones', async () => {
    const o = (await nueva(await vehiculo())).body;
    const tec = await prisma.usuario.findUniqueOrThrow({ where: { correo: TECNICO } });
    const jefe = await prisma.usuario.findUniqueOrThrow({ where: { correo: 'jefe@demo.local' } });
    const r = await como(CAJERA, 'patch', `/ordenes/${o.id}`, { tecnicoId: tec.id, jefeTallerId: jefe.id, observaciones: 'Ruido', recomendaciones: 'Cambiar pastillas', km: 1200 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ tecnico: { id: tec.id }, jefeTaller: { id: jefe.id }, observaciones: 'Ruido', recomendaciones: 'Cambiar pastillas', km: 1200 });
  });
  it('los abonos no superan lo pendiente y bajan el saldo, no el total', async () => {
    const o = (await nueva(await vehiculo())).body;
    await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'A', precio: 100 }] });
    expect((await como(CAJERA, 'post', `/ordenes/${o.id}/abonos`, { metodo: 'Efectivo', valor: 150 })).status).toBe(400);
    expect((await como(CAJERA, 'post', `/ordenes/${o.id}/abonos`, { metodo: 'Efectivo', valor: 0 })).status).toBe(400);
    const r = await como(CAJERA, 'post', `/ordenes/${o.id}/abonos`, { metodo: 'Yape', concepto: 'Adelanto', valor: 40 });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ total: 100, totalAbonos: 40, pendiente: 60 });
    expect(r.body.abonos[0]).toMatchObject({ metodo: 'Yape', concepto: 'Adelanto', valor: 40 });
  });
  it('la lista filtra por estado, texto, cliente y fechas, y trae lo de la tarjeta', async () => {
    const v = await vehiculo();
    const o = (await nueva(v)).body;
    const l = await como(CAJERA, 'get', `/ordenes?estado=Recepcion&q=${o.codigo}`);
    expect(l.body).toHaveLength(1);
    expect(l.body[0]).toMatchObject({ codigo: o.codigo, conComprobante: false, creadoPor: { nombre: 'Cajera Demo' } });
    expect(l.body[0].vehiculo.placa).toBeTruthy();
    const hoy = new Date().toISOString().slice(0, 10);
    expect((await como(CAJERA, 'get', `/ordenes?clienteId=${clienteId}&desde=${hoy}&hasta=${hoy}`)).body.length).toBeGreaterThan(0);
    expect((await como(CAJERA, 'get', `/ordenes?clienteId=${clienteId}&desde=2000-01-01&hasta=2000-01-02`)).body).toEqual([]);
  });
  it('catálogos: tipos de atención, decisiones, estados y personal asignable', async () => {
    const r = await como(CAJERA, 'get', '/ordenes/catalogos');
    expect(r.body.tiposAtencion).toContain('Garantía');
    expect(r.body.decisiones).toEqual(['Pendiente de aprobación', 'Aprobada para cotizar', 'Aprobada para comprar', 'No aprobada']);
    expect(r.body.estados.map((e: { id: string }) => e.id)).toEqual(['Recepcion', 'EnProceso', 'Entrega', 'Cerrada']);
    expect(r.body.tecnicos.some((u: { nombre: string }) => /Técnico/.test(u.nombre))).toBe(true);
    expect(r.body.jefes.some((u: { nombre: string }) => /Jefe/.test(u.nombre))).toBe(true);
  });
});

describe('intentos de romper la ODS (pruebas de ataque del 28/10)', () => {
  it('un tipo de atención fuera de la lista se rechaza', async () => {
    expect((await nueva(await vehiculo(), { tipoAtencion: 'Hackeo' })).status).toBe(400);
  });
  it('cuatro ODS creadas a la vez para el mismo vehículo dejan solo una abierta', async () => {
    const v = await vehiculo();
    const r = await Promise.all([1, 2, 3, 4].map(() => nueva(v)));
    expect(r.filter((x) => x.status === 201)).toHaveLength(1);
  });
  it('tres abonos a la vez por todo lo pendiente: solo entra uno', async () => {
    const o = (await nueva(await vehiculo())).body;
    await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'A', precio: 50 }] });
    await Promise.all([1, 2, 3].map(() => como(CAJERA, 'post', `/ordenes/${o.id}/abonos`, { metodo: 'Efectivo', valor: 50 })));
    expect((await como(CAJERA, 'get', `/ordenes/${o.id}`)).body.totalAbonos).toBe(50);
  });
  it('el total no puede quedar por debajo de lo abonado y una ODS cerrada no admite abonos', async () => {
    const o = (await nueva(await vehiculo())).body;
    await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'A', precio: 50 }] });
    await como(CAJERA, 'post', `/ordenes/${o.id}/abonos`, { metodo: 'Efectivo', valor: 30 });
    expect((await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'A', precio: 10 }] })).status).toBe(409);
    await como(CAJERA, 'patch', `/ordenes/${o.id}`, { decision: 'No aprobada', estado: 'Cerrada' });
    expect((await como(CAJERA, 'post', `/ordenes/${o.id}/abonos`, { metodo: 'Efectivo', valor: 1 })).status).toBe(409);
    expect((await como(CAJERA, 'patch', `/ordenes/${o.id}`, { decision: 'Aprobada para comprar' })).status).toBe(409);
  });
  it('solo un Técnico o Jefe de taller puede ser técnico de la ODS', async () => {
    const o = (await nueva(await vehiculo())).body;
    const cajera = await prisma.usuario.findUniqueOrThrow({ where: { correo: CAJERA } });
    expect((await como(CAJERA, 'patch', `/ordenes/${o.id}`, { tecnicoId: cajera.id })).status).toBe(400);
  });
  it('kilometraje gigante y fechas de filtro inválidas no tumban el servidor (400)', async () => {
    expect((await nueva(await vehiculo(), { km: 1e15 })).status).toBe(400);
    expect((await como(CAJERA, 'get', '/ordenes?desde=hola')).status).toBe(400);
  });
});

describe('ingreso, responsable y fechas (RF-015, 28/10)', () => {
  it('estado del vehículo: se guarda la lista de chequeo y se ignoran claves raras', async () => {
    const o = (await nueva(await vehiculo())).body;
    const r = await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estadoVehiculo: { combustible: '1/2', danos: ['Rayado'], 'x-y': 'no' } });
    expect(r.status).toBe(200);
    expect(r.body.estadoVehiculo).toEqual({ combustible: '1/2', danos: ['Rayado'] });
    expect((await como(CAJERA, 'patch', `/ordenes/${o.id}`, { estadoVehiculo: 'hola' })).status).toBe(400);
  });
  it('evidencias: sube una foto, la devuelve y la quita; rechaza lo que no es foto ni video', async () => {
    const o = (await nueva(await vehiculo())).body;
    const t = await tokenDe(CAJERA);
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const sub = await request(app.getHttpServer()).post(`/ordenes/${o.id}/evidencias`).set('Authorization', `Bearer ${t}`).attach('archivo', png, { filename: 'frente.png', contentType: 'image/png' });
    expect(sub.status).toBe(201);
    const e = sub.body.evidencias[0];
    expect(e).toMatchObject({ nombre: 'frente.png', tipo: 'image/png', tamano: 8 });
    const ver = await request(app.getHttpServer()).get(`/ordenes/${o.id}/evidencias/${e.id}`).set('Authorization', `Bearer ${t}`);
    expect(ver.status).toBe(200);
    expect(ver.headers['content-type']).toContain('image/png');
    const txt = await request(app.getHttpServer()).post(`/ordenes/${o.id}/evidencias`).set('Authorization', `Bearer ${t}`).attach('archivo', Buffer.from('hola'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(txt.status).toBe(400);
    expect((await como(CAJERA, 'delete', `/ordenes/${o.id}/evidencias/${e.id}`)).body.evidencias).toHaveLength(0);
  });
  it('responsable del ítem: debe ser técnico o jefe de taller de la empresa', async () => {
    const o = (await nueva(await vehiculo())).body;
    const cat = (await como(CAJERA, 'get', '/ordenes/catalogos')).body;
    const item = { tipo: 'servicio', descripcion: 'Afinamiento', precio: 50 };
    const ok = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ ...item, tecnicoId: cat.tecnicos[0].id }] });
    expect(ok.body.detalles[0].tecnicoId).toBe(cat.tecnicos[0].id);
    const cajeraId = (await prisma.usuario.findFirstOrThrow({ where: { correo: CAJERA } })).id;
    expect((await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ ...item, tecnicoId: cajeraId }] })).status).toBe(400);
  });
  it('fechas de inicio y cierre: solo el Superadministrador las corrige y queda en la bitácora', async () => {
    const o = (await nueva(await vehiculo())).body;
    const ayer = new Date(Date.now() - 86_400_000).toISOString();
    expect((await como(CAJERA, 'patch', `/ordenes/${o.id}`, { fechaInicio: ayer })).status).toBe(403);
    expect((await como(ADMIN, 'patch', `/ordenes/${o.id}`, { fechaInicio: ayer })).status).toBe(403);
    const r = await como('ti@demo.local', 'patch', `/ordenes/${o.id}`, { fechaInicio: ayer });
    expect(r.status).toBe(200);
    expect(r.body.fechaInicio).toBe(ayer);
    expect(r.body.bitacora[0].texto).toMatch(/Fecha de inicio corregida/);
    expect((await como('ti@demo.local', 'patch', `/ordenes/${o.id}`, { fechaCierre: ayer })).status).toBe(409);
    await como(CAJERA, 'patch', `/ordenes/${o.id}`, { decision: 'No aprobada', estado: 'Cerrada' });
    const antes = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect((await como('ti@demo.local', 'patch', `/ordenes/${o.id}`, { fechaCierre: antes })).status).toBe(400);
    expect((await como('ti@demo.local', 'patch', `/ordenes/${o.id}`, { fechaCierre: ayer })).body.fechaCierre).toBe(ayer);
  });
});
