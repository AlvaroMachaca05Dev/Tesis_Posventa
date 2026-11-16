// Pruebas del slice S5: maestros de proveedores, servicios, productos, grupos, precios por grupo y solapamiento
// (RF-008, RF-009, RF-010, RF-100, RF-101, RF-102; RN-08, RN-09). Casos CP-19 a CP-24.
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
  const t = await tokenDe(c); // primero el token: la petición se arma sobre el servidor ya libre
  const r = request(app.getHttpServer())[metodo](ruta).set('Authorization', `Bearer ${t}`);
  return cuerpo ? r.send(cuerpo) : r;
};
const ADMIN = 'admin@demo.local';
const CAJERA = 'cajera@demo.local';
const sx = `${Date.now() % 100000}`;
const cod = (p: string) => `${p}${sx}`;
let clienteId = '';
let grupo: { id: string; codigo: string };
const sv: Record<string, { id: string }> = {};
let n = 0;

async function vehiculo(extra: object = {}) {
  return (await como(CAJERA, 'post', '/vehiculos', { clienteId, placa: `S5${sx}${n++}`, ...extra })).body;
}
async function ods(vehiculoId: string) {
  return (await como(CAJERA, 'post', '/ordenes', { vehiculoId, tipoAtencion: 'Mantenimiento correctivo' })).body;
}
const lineaDe = (id: string, descripcion: string, precio: number, extra: object = {}) => ({ tipo: 'servicio', descripcion, servicioId: id, precio, cantidad: 1, ...extra });

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  clienteId = (await como(CAJERA, 'post', '/clientes', { tipoDocumento: 'DNI', documento: `4${sx.padStart(5, '0')}01`, nombre: 'Cliente S5 Prueba' })).body.id;
  grupo = (await como(ADMIN, 'post', '/grupos', { codigo: cod('T'), nombre: 'Grupo de prueba' })).body;
  for (const [k, horas, precio] of [['COR', 3.5, 80], ['BOM', 2, 40], ['CAD', 4.5, 180]] as const) {
    sv[k] = (await como(ADMIN, 'post', '/servicios', { codigo: cod(k), nombre: `Servicio ${k} prueba`, categoria: 'MOTOR', horasEstandar: horas, precioEstandar: precio })).body;
  }
});

afterAll(async () => {
  if (!clienteId) { await app?.close(); await prisma.$disconnect(); return; }
  const ordenes = await prisma.ordenServicio.findMany({ where: { clienteId } });
  const ids = ordenes.map((o) => o.id);
  await prisma.detalleODS.deleteMany({ where: { ordenId: { in: ids } } });
  await prisma.bitacora.deleteMany({ where: { ordenId: { in: ids } } });
  await prisma.ordenServicio.deleteMany({ where: { id: { in: ids } } });
  const vs = await prisma.vehiculo.findMany({ where: { clienteId } });
  await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vs.map((v) => v.id) } } });
  await prisma.vehiculo.deleteMany({ where: { clienteId } });
  await prisma.cliente.deleteMany({ where: { id: clienteId } });
  await prisma.solapamiento.deleteMany({ where: { codigo: { endsWith: sx } } });
  await prisma.reglaPrecio.deleteMany({ where: { codigo: { endsWith: sx } } });
  await prisma.familiaMotor.deleteMany({ where: { codigo: { endsWith: sx } } });
  await prisma.servicio.deleteMany({ where: { codigo: { endsWith: sx } } });
  await prisma.producto.deleteMany({ where: { codigo: { endsWith: sx } } });
  await prisma.proveedor.deleteMany({ where: { documento: { startsWith: `20${sx.padStart(5, '0')}` } } });
  await prisma.grupoVehicular.deleteMany({ where: { codigo: { endsWith: sx } } });
  await app.close();
  await prisma.$disconnect();
});

describe('CP-19 Proveedores (RF-008)', () => {
  it('crea, edita y lista un proveedor; el documento no se repite', async () => {
    const p = await como(ADMIN, 'post', '/proveedores', { tipoDocumento: 'RUC', documento: `20${sx.padStart(5, '0')}0010`, nombre: 'Proveedor Prueba', rubro: 'Filtros' });
    expect(p.status).toBe(201);
    expect((await como(ADMIN, 'patch', `/proveedores/${p.body.id}`, { movil: '999 111 222' })).body.movil).toBe('999111222');
    expect((await como(CAJERA, 'get', '/proveedores')).body.some((x: { id: string }) => x.id === p.body.id)).toBe(true);
    expect((await como(ADMIN, 'post', '/proveedores', { tipoDocumento: 'RUC', documento: `20${sx.padStart(5, '0')}0010`, nombre: 'Otro' })).status).toBe(409);
  });

  it('guarda los mismos datos que un cliente: nombre comercial, país, móvil, dirección fiscal, correo, contacto y comentario', async () => {
    const doc = `20${sx.padStart(5, '0')}0030`;
    const p = await como(ADMIN, 'post', '/proveedores', { tipoDocumento: 'RUC', documento: doc, nombre: 'Proveedor Completo', nombreComercial: 'Completo SAC', pais: 'PE', movil: '987654321', direccionFiscal: 'Av. Prueba 123', email: 'compras@demo.test', contacto: 'Luis Torres', comentario: 'Entrega en 24 horas' });
    expect(p.status).toBe(201);
    expect(p.body).toMatchObject({ nombreComercial: 'Completo SAC', pais: 'PE', movil: '987654321', direccionFiscal: 'Av. Prueba 123', email: 'compras@demo.test', contacto: 'Luis Torres', comentario: 'Entrega en 24 horas' });
    // Mismas reglas que el cliente: el móvil de Perú lleva 9 dígitos, el correo debe ser válido y el país debe existir.
    expect((await como(ADMIN, 'patch', `/proveedores/${p.body.id}`, { movil: '12345' })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/proveedores/${p.body.id}`, { email: 'sin-arroba' })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/proveedores/${p.body.id}`, { pais: 'XX' })).status).toBe(400);
    expect((await como(ADMIN, 'patch', `/proveedores/${p.body.id}`, { pais: 'CO', movil: '3001234567' })).body).toMatchObject({ pais: 'CO', movil: '3001234567' });
  });

  it('los países para el formulario los puede leer quien tiene proveedores aunque no tenga clientes', async () => {
    const r = await como('logistico@demo.local', 'get', '/maestros/config');
    expect(r.status).toBe(200);
    expect(r.body.paises.length).toBeGreaterThan(1);
  });

  it('un servicio externo necesita su proveedor', async () => {
    const sin = await como(ADMIN, 'post', '/servicios', { codigo: cod('TOR'), nombre: 'Tornería', categoria: 'MOTOR', externo: true, horasEstandar: 1, precioEstandar: 300 });
    expect(sin.status).toBe(400);
    const prov = (await como(ADMIN, 'post', '/proveedores', { tipoDocumento: 'RUC', documento: `20${sx.padStart(5, '0')}0020`, nombre: 'Tornero Prueba' })).body;
    const con = await como(ADMIN, 'post', '/servicios', { codigo: cod('TOR'), nombre: 'Tornería', categoria: 'MOTOR', externo: true, proveedorId: prov.id, horasEstandar: 1, precioEstandar: 300 });
    expect(con.status).toBe(201);
    expect(con.body).toMatchObject({ externo: true, proveedor: 'Tornero Prueba' });
  });
});

describe('CP-20 Servicios con horas estándar (RF-009, RN-08)', () => {
  it('un servicio guarda categoría, horas, precio base y marca externo', async () => {
    const r = (await como(ADMIN, 'get', '/servicios')).body.find((x: { id: string }) => x.id === sv.COR.id);
    expect(r).toMatchObject({ categoria: 'MOTOR', horasEstandar: 3.5, precioEstandar: 80, externo: false, horasFuente: 'AUTODATA' });
  });

  it('sin horas de AutoData el servicio toma 1 h (RN-08)', async () => {
    const r = await como(ADMIN, 'post', '/servicios', { codigo: cod('SIN'), nombre: 'Sin tiempo', categoria: 'OTROS', precioEstandar: 20 });
    expect(r.body).toMatchObject({ horasEstandar: 1, horasFuente: 'PREDETERMINADA' });
    expect((await como(ADMIN, 'post', '/servicios', { codigo: cod('MAL'), nombre: 'Mal', categoria: 'OTROS', horasEstandar: 0.3, precioEstandar: 20 })).status).toBe(400);
  });
});

describe('CP-21 Productos (RF-010)', () => {
  it('un producto guarda código, unidad, precio y costo; el código no se repite', async () => {
    const p = await como(ADMIN, 'post', '/productos', { codigo: cod('P'), nombre: 'Filtro de prueba', unidad: 'UND', precio: 25, costo: 14 });
    expect(p.body).toMatchObject({ unidad: 'UND', precio: 25, costo: 14 });
    expect((await como(ADMIN, 'post', '/productos', { codigo: cod('P'), nombre: 'Otro', precio: 1 })).status).toBe(409);
    expect((await como(ADMIN, 'post', '/productos', { codigo: cod('Q'), nombre: 'Sin precio' })).status).toBe(400);
  });

  it('el producto del catálogo se usa como ítem de la ODS', async () => {
    const p = (await como(ADMIN, 'get', '/productos')).body.find((x: { codigo: string }) => x.codigo === cod('P'));
    const o = await ods((await vehiculo()).id);
    const r = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'producto', descripcion: p.nombre, productoId: p.id, precio: p.precio, cantidad: 2 }] });
    expect(r.status).toBe(200);
    expect(r.body.detalles[0]).toMatchObject({ productoId: p.id, total: 50 });
    expect((await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [{ tipo: 'producto', descripcion: 'X', productoId: '00000000-0000-0000-0000-00000000dead', precio: 1 }] })).status).toBe(400);
  });
});

describe('CP-22 Grupos de vehículos (RF-100)', () => {
  it('se crea, renombra y quita un grupo sin perder sus vehículos', async () => {
    const g = (await como(ADMIN, 'post', '/grupos', { codigo: cod('Q'), nombre: 'Para quitar' })).body;
    const v = await vehiculo({ grupoId: g.id });
    expect(v).toMatchObject({ grupoId: g.id, grupoFuente: 'MANUAL' });
    expect((await como(ADMIN, 'patch', `/grupos/${g.id}`, { nombre: 'Renombrado' })).body.nombre).toBe('Renombrado');
    const q = await como(ADMIN, 'patch', `/grupos/${g.id}`, { activo: false });
    expect(q.body).toMatchObject({ activo: false, vehiculos: 1 });
    expect((await como(CAJERA, 'get', `/vehiculos/${v.id}`)).body.grupoId).toBe(g.id);
    expect((await como(CAJERA, 'post', '/grupos', { codigo: cod('Z'), nombre: 'No' })).status).toBe(403);
  });

  it('el vehículo toma su grupo por la familia del motor y se puede reasignar', async () => {
    await prisma.familiaMotor.create({ data: { organizacionId: '00000000-0000-0000-0000-000000000001', codigo: cod('FM'), codigos: [cod('MOT')], grupoId: grupo.id } });
    const v = await vehiculo({ codigoMotor: cod('MOT').toLowerCase() });
    expect(v).toMatchObject({ grupo: grupo.codigo, grupoFuente: 'FAMILIA_MOTOR' });
    const otro = (await como(ADMIN, 'get', '/grupos')).body.find((x: { codigo: string; activo: boolean }) => x.codigo !== grupo.codigo && x.activo);
    expect((await como(CAJERA, 'patch', `/vehiculos/${v.id}`, { grupoId: otro.id })).body).toMatchObject({ grupoId: otro.id, grupoFuente: 'MANUAL' });
    expect((await como(CAJERA, 'patch', `/vehiculos/${v.id}`, { grupoId: '' })).body).toMatchObject({ grupoId: grupo.id, grupoFuente: 'FAMILIA_MOTOR' });
  });
});

describe('CP-23 Precios por grupo (RF-101, RN-09)', () => {
  it('el servicio agregado a la ODS toma el precio y las horas del grupo del vehículo (RN-09)', async () => {
    const r = await como(ADMIN, 'post', '/reglas-precio', { codigo: cod('RP'), nivel: 'SERVICIO', tipo: 'SUMAR', grupoId: grupo.id, servicios: [cod('COR')], precio: 20, horas: 0.5 });
    expect(r.status).toBe(201);
    const v = await vehiculo({ grupoId: grupo.id });
    const p = await como(CAJERA, 'get', `/precio-servicio?servicioId=${sv.COR.id}&vehiculoId=${v.id}`);
    expect(p.body).toMatchObject({ grupo: grupo.codigo, horas: 4, precio: 100 });
    expect(p.body.traza).toHaveLength(2);
    const sinGrupo = await como(CAJERA, 'get', `/precio-servicio?servicioId=${sv.COR.id}`);
    expect(sinGrupo.body).toMatchObject({ horas: 3.5, precio: 80 });
    const o = await ods(v.id);
    const d = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [lineaDe(sv.COR.id, 'Correa', 100)] });
    expect(d.body.detalles[0]).toMatchObject({ horas: 4, precioGrupo: 100, precioModificado: false });
  });

  it('un precio cambiado en la línea queda marcado como modificado', async () => {
    const o = await ods((await vehiculo({ grupoId: grupo.id })).id);
    const d = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [lineaDe(sv.COR.id, 'Correa', 90)] });
    expect(d.body.detalles[0]).toMatchObject({ precio: 90, precioGrupo: 100, precioModificado: true });
  });

  it('una regla con monto que no termina en 0 o 5 se rechaza y la cajera no edita reglas', async () => {
    expect((await como(ADMIN, 'post', '/reglas-precio', { nivel: 'GRUPO', tipo: 'SUMAR', grupoId: grupo.id, precio: 18 })).status).toBe(400);
    expect((await como(CAJERA, 'post', '/reglas-precio', { nivel: 'GRUPO', tipo: 'SUMAR', grupoId: grupo.id, precio: 10 })).status).toBe(403);
    const t = await como(ADMIN, 'get', '/precios-por-grupo');
    expect(t.body.filas.find((f: { codigo: string }) => f.codigo === cod('COR')).porGrupo[grupo.codigo]).toEqual({ horas: 4, precio: 100 });
  });
});

describe('CP-24 Solapamiento de servicios (RF-102)', () => {
  it('con dos servicios que se solapan, el automático aplica el descuento y avisa en la bitácora', async () => {
    const r = await como(ADMIN, 'post', '/solapamientos', { codigo: cod('SA'), serviciosBase: [sv.CAD.id], serviciosReducidos: [sv.BOM.id], modo: 'AUTOMATICO', descuentoEstandar: 10, horasCompartidas: 0.5 });
    expect(r.status).toBe(201);
    expect((await como(ADMIN, 'post', '/solapamientos', { serviciosBase: [sv.CAD.id], serviciosReducidos: [sv.CAD.id], descuentoEstandar: 12 })).status).toBe(400);
    const v = await vehiculo();
    const al = await como(CAJERA, 'post', '/solapamientos/evaluar', { vehiculoId: v.id, lineas: [{ servicioId: sv.CAD.id, total: 180 }, { servicioId: sv.BOM.id, total: 40 }] });
    expect(al.body).toMatchObject([{ codigo: cod('SA'), modo: 'AUTOMATICO', indiceReducido: 1, monto: 10 }]);
    const o = await ods(v.id);
    const d = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [lineaDe(sv.CAD.id, 'Cadena', 180), lineaDe(sv.BOM.id, 'Bomba', 40)] });
    expect(d.body.detalles[1]).toMatchObject({ descuentoMonto: 10, total: 30, solapamientoId: r.body.id });
    expect(d.body.total).toBe(210);
    expect(d.body.bitacora.some((b: { texto: string }) => b.texto.includes(`Descuento por solapamiento ${cod('SA')}`))).toBe(true);
  });

  it('el par solapado descuenta las horas compartidas', async () => {
    const o = await ods((await vehiculo()).id);
    const d = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [lineaDe(sv.CAD.id, 'Cadena', 180), lineaDe(sv.BOM.id, 'Bomba', 40)] });
    expect(d.body.detalles[1].horas).toBe(1.5);
    expect(d.body.horas).toBe(6);
  });

  it('el opcional se aplica solo si la cajera lo acepta y se puede mantener el monto', async () => {
    const r = (await como(ADMIN, 'post', '/solapamientos', { codigo: cod('SO'), serviciosBase: [sv.COR.id], serviciosReducidos: [sv.CAD.id], modo: 'OPCIONAL', descuentoEstandar: 35, descuentos: { [grupo.codigo]: 60 } })).body;
    const o = await ods((await vehiculo({ grupoId: grupo.id })).id);
    const sinAceptar = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [lineaDe(sv.COR.id, 'Correa', 100), lineaDe(sv.CAD.id, 'Cadena', 180)] });
    expect(sinAceptar.body.detalles[1]).toMatchObject({ descuentoMonto: 0, total: 180 });
    const clave = `${r.id}:${sv.CAD.id}`; // la decisión se guarda por regla y por el servicio que lleva el descuento
    const mantener = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [lineaDe(sv.COR.id, 'Correa', 100), lineaDe(sv.CAD.id, 'Cadena', 180)], solapamientosMantenidos: [clave] });
    expect(mantener.body.solapamientosMantenidos).toEqual([clave]);
    const aceptar = await como(CAJERA, 'put', `/ordenes/${o.id}/detalles`, { detalles: [lineaDe(sv.COR.id, 'Correa', 100), lineaDe(sv.CAD.id, 'Cadena', 180, { solapamientoId: r.id })] });
    expect(aceptar.body.detalles[1]).toMatchObject({ descuentoMonto: 60, total: 120 });
    expect(aceptar.body.solapamientosMantenidos).toEqual([]);
    expect((await como(CAJERA, 'delete', `/solapamientos/${r.id}`)).status).toBe(403);
  });
});
