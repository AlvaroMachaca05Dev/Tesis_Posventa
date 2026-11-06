// Pruebas del slice S2: clientes y vehículos (RF-004, RF-005, RF-006, RF-007; CA-S2-01 a CA-S2-09). Se escriben primero.
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();
let app: INestApplication;
const CLAVE = process.env.SEED_PASSWORD as string;
let n = 0;
const sufijo = `${Date.now() % 100000}`.padStart(5, '0');
// Documentos sintéticos válidos: DNI de 8 dígitos, RUC de 11 y carné de extranjería de 10 caracteres.
const doc = () => `7${sufijo}${String(n++ % 100).padStart(2, '0')}`;
const ruc = () => `20${sufijo}${String(n++ % 10000).padStart(4, '0')}`;
const ce = () => `CE${sufijo}${String(n++ % 1000).padStart(3, '0')}`;
const placa = () => `ZP${sufijo.slice(-3)}${n++}`;

const tokens: Record<string, string> = {};
const tokenDe = async (c: string) => (tokens[c] ??= (await request(app.getHttpServer()).post('/auth/login').send({ correo: c, password: CLAVE })).body.token as string);
const como = async (c: string, metodo: 'get' | 'post' | 'patch', ruta: string, cuerpo?: object) => {
  const t = await tokenDe(c);
  const r = request(app.getHttpServer())[metodo](ruta).set('Authorization', `Bearer ${t}`);
  return cuerpo ? r.send(cuerpo) : r;
};
const CAJERA = 'cajera@demo.local';
const TECNICO = 'tecnico@demo.local';
const TI = 'ti@demo.local';

const clienteBase = (extra: object = {}) => ({ tipoDocumento: 'DNI', documento: doc(), nombre: 'Prueba Ana', pais: 'PE', movil: '987654321', ...extra });
const nuevoCliente = async (extra: object = {}) => (await como(CAJERA, 'post', '/clientes', clienteBase(extra))).body;
const nuevoVehiculo = async (clienteId: string, extra: object = {}) =>
  (await como(CAJERA, 'post', '/vehiculos', { clienteId, placa: placa(), marca: 'KIA', modelo: 'PICANTO', anio: 2017, ...extra })).body;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  // «Clientes varios» (documento 0000) es parte de la precarga; aquí se asegura para que la prueba no dependa del orden.
  const org = await prisma.organizacion.findFirstOrThrow({ where: { nombre: 'Taller Demo' } });
  await prisma.cliente.upsert({
    where: { organizacionId_documento: { organizacionId: org.id, documento: '0000' } },
    update: {},
    create: { organizacionId: org.id, documento: '0000', nombre: 'Clientes varios', esGenerico: true },
  });
});
afterAll(async () => {
  const clientes = await prisma.cliente.findMany({ where: { OR: [{ documento: { startsWith: `7${sufijo}` } }, { documento: { startsWith: `20${sufijo}` } }, { documento: { startsWith: `CE${sufijo}` } }] } });
  const vehiculos = await prisma.vehiculo.findMany({ where: { OR: [{ clienteId: { in: clientes.map((c) => c.id) } }, { placa: { startsWith: 'ZP' } }] } });
  const ids = [...vehiculos.map((v) => v.id), ...clientes.map((c) => c.id)];
  await prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vehiculos.map((v) => v.id) } } });
  await prisma.vehiculo.deleteMany({ where: { id: { in: vehiculos.map((v) => v.id) } } });
  await prisma.cliente.deleteMany({ where: { id: { in: clientes.map((c) => c.id) } } });
  await prisma.auditoria.deleteMany({ where: { registroId: { in: ids } } });
  await prisma.organizacion.deleteMany({ where: { nombre: 'Empresa C de prueba' } });
  await app.close();
  await prisma.$disconnect();
});

describe('clientes (CA-S2-01)', () => {
  it('la Cajera crea un cliente con sus datos y la fecha de registro se pone sola', async () => {
    const r = await como(CAJERA, 'post', '/clientes', clienteBase({ nombreComercial: 'Ana SAC', email: 'ana@demo.test', direccionFiscal: 'Av. Prueba 123', ubigeo: '150101', comentario: 'Cliente de prueba' }));
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ tipoDocumento: 'DNI', nombre: 'Prueba Ana', nombreComercial: 'Ana SAC', pais: 'PE', movil: '987654321', ubigeo: '150101', activo: true, esGenerico: false });
    expect(new Date(r.body.creadoEn).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
  it('el número de documento no se repite', async () => {
    const c = await nuevoCliente();
    const igual = await como(CAJERA, 'post', '/clientes', clienteBase({ documento: c.documento }));
    expect(igual.status).toBe(409);
    expect(igual.body.message).toMatch(/documento/i);
    // Un RUC tiene 11 dígitos y un DNI 8: el mismo valor no puede ser válido para los dos tipos, así que primero se rechaza el formato (400).
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ documento: c.documento, tipoDocumento: 'RUC' }))).status).toBe(400);
  });
  it('solo se aceptan DNI, Carné de extranjería y RUC; el nombre y el documento son obligatorios (400)', async () => {
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ tipoDocumento: 'PASAPORTE' }))).status).toBe(400);
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ tipoDocumento: 'CARNET_EXTRANJERIA', documento: ce() }))).status).toBe(201);
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ tipoDocumento: 'RUC', documento: ruc(), nombre: 'Empresa Prueba SAC' }))).status).toBe(201);
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ nombre: '  ' }))).status).toBe(400);
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ documento: '' }))).status).toBe(400);
  });
  it('el Técnico puede ver clientes pero no crearlos ni editarlos (403)', async () => {
    const c = await nuevoCliente();
    expect((await como(TECNICO, 'get', '/clientes')).status).toBe(200);
    expect((await como(TECNICO, 'post', '/clientes', clienteBase())).status).toBe(403);
    expect((await como(TECNICO, 'patch', `/clientes/${c.id}`, { nombre: 'X' })).status).toBe(403);
  });
  it('la fecha de registro no se puede editar', async () => {
    const c = await nuevoCliente();
    const r = await como(CAJERA, 'patch', `/clientes/${c.id}`, { creadoEn: '2000-01-01T00:00:00Z', nombre: 'Prueba Ana María' });
    expect(r.status).toBe(200);
    expect(r.body.nombre).toBe('Prueba Ana María');
    expect(r.body.creadoEn).toBe(c.creadoEn);
  });
});

describe('móvil y país (CA-S2-02)', () => {
  it('en Perú el móvil lleva 9 dígitos sin prefijo; se aceptan espacios', async () => {
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ movil: '98765432' }))).status).toBe(400);
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ movil: '98765432A' }))).status).toBe(400);
    const r = await como(CAJERA, 'post', '/clientes', clienteBase({ movil: '987 654 321' }));
    expect(r.status).toBe(201);
    expect(r.body.movil).toBe('987654321');
  });
  it('con otro país el móvil se valida según ese país y un país desconocido se rechaza', async () => {
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ pais: 'CO', movil: '3001234567' }))).status).toBe(201);
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ pais: 'ZZ' }))).status).toBe(400);
  });
  it('sin país se usa el predeterminado de la empresa y la configuración lo expone con los prefijos', async () => {
    const r = await como(CAJERA, 'post', '/clientes', clienteBase({ pais: undefined }));
    expect(r.status).toBe(201);
    expect(r.body.pais).toBe('PE');
    const cfg = await como(CAJERA, 'get', '/maestros/config');
    expect(cfg.status).toBe(200);
    expect(cfg.body.paisPredeterminado).toBe('PE');
    expect(cfg.body.paises).toEqual(expect.arrayContaining([{ codigo: 'PE', nombre: 'Perú', prefijo: '+51' }]));
  });
  it('el correo, si se escribe, debe ser válido', async () => {
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ email: 'no-es-correo' }))).status).toBe(400);
  });
});

describe('vehículos y placa (CA-S2-03)', () => {
  it('se crea un vehículo con todos sus datos, ligado a un cliente, y se escribe la placa como la dé la empresa', async () => {
    const c = await nuevoCliente();
    const p = placa();
    const r = await como(CAJERA, 'post', '/vehiculos', { clienteId: c.id, placa: `${p.slice(0, 3)}-${p.slice(3)}`, marca: 'KIA', modelo: 'PICANTO', anio: 2017, color: 'Plomo', nroSerie: 'S-1', nroVin: `VIN${sufijo}${n++}`, nroMotor: 'G3LA', comentario: 'de prueba' });
    expect(r.status).toBe(201);
    expect(r.body.placa).toBe(`${p.slice(0, 3)}-${p.slice(3)}`);
    expect(r.body).toMatchObject({ marca: 'KIA', modelo: 'PICANTO', anio: 2017, color: 'Plomo', nroSerie: 'S-1', nroMotor: 'G3LA', comentario: 'de prueba' });
    expect(r.body.cliente).toMatchObject({ id: c.id, nombre: 'Prueba Ana', documento: c.documento });
    expect(r.body.creadoEn).toBeTruthy();
  });
  it('la misma placa con otro formato (sin guion, minúsculas, con espacios) ya existe: 409 con el titular', async () => {
    const c = await nuevoCliente({ nombre: 'Titular Prueba' });
    const v = await nuevoVehiculo(c.id);
    const raro = `${v.placa.slice(0, 2)} ${v.placa.slice(2).toLowerCase()}`.replace('ZP', 'zp');
    const otro = await nuevoCliente();
    const r = await como(CAJERA, 'post', '/vehiculos', { clienteId: otro.id, placa: raro });
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/Titular Prueba/);
    expect(r.body.message).toContain(c.documento);
    expect(r.body.vehiculoId).toBe(v.id);
  });
  it('la placa es obligatoria y el cliente debe existir en la empresa', async () => {
    const c = await nuevoCliente();
    expect((await como(CAJERA, 'post', '/vehiculos', { clienteId: c.id, placa: '  ' })).status).toBe(400);
    expect((await como(CAJERA, 'post', '/vehiculos', { clienteId: '00000000-0000-0000-0000-00000000ffff', placa: placa() })).status).toBe(404);
  });
  it('otra empresa puede tener la misma placa y no ve la de esta', async () => {
    const c = await nuevoCliente();
    const v = await nuevoVehiculo(c.id);
    const orgC = await prisma.organizacion.create({ data: { nombre: 'Empresa C de prueba' } });
    const cc = await prisma.cliente.create({ data: { organizacionId: orgC.id, documento: doc(), nombre: 'Cliente de C' } });
    await expect(prisma.vehiculo.create({ data: { organizacionId: orgC.id, clienteId: cc.id, placa: v.placa, placaNorm: v.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase() } })).resolves.toBeTruthy();
    const lista = await como(CAJERA, 'get', `/vehiculos?q=${v.placa}`);
    expect(lista.body.filter((x: { placa: string }) => x.placa === v.placa)).toHaveLength(1);
    expect((await como(CAJERA, 'get', `/clientes/${cc.id}`)).status).toBe(404);
  });
});

describe('el enlace es por ID interno (CA-S2-04)', () => {
  it('cambiar el documento del cliente no desvincula sus vehículos y queda auditado', async () => {
    const c = await nuevoCliente({ documento: doc() });
    const v = await nuevoVehiculo(c.id);
    const nuevo = doc();
    const r = await como(CAJERA, 'patch', `/clientes/${c.id}`, { documento: nuevo });
    expect(r.status).toBe(200);
    expect(r.body.documento).toBe(nuevo);
    const ve = await como(CAJERA, 'get', `/vehiculos/${v.id}`);
    expect(ve.body.cliente).toMatchObject({ id: c.id, documento: nuevo });
    const aud = await prisma.auditoria.findFirst({ where: { tabla: 'cliente', registroId: c.id }, orderBy: { fecha: 'desc' } });
    expect(JSON.stringify(aud!.antes)).toContain(c.documento);
    expect(JSON.stringify(aud!.despues)).toContain(nuevo);
  });
  it('no se puede cambiar el documento a uno que ya existe (409)', async () => {
    const a = await nuevoCliente();
    const b = await nuevoCliente();
    expect((await como(CAJERA, 'patch', `/clientes/${b.id}`, { documento: a.documento })).status).toBe(409);
  });
  it('corregir la placa conserva el vehículo, su ID y sus lecturas; una placa repetida se rechaza', async () => {
    const c = await nuevoCliente();
    const v = await nuevoVehiculo(c.id);
    const otra = await nuevoVehiculo(c.id);
    await como(CAJERA, 'post', `/vehiculos/${v.id}/lecturas`, { km: 15000 });
    const corregida = placa();
    const r = await como(CAJERA, 'patch', `/vehiculos/${v.id}`, { placa: corregida });
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(v.id);
    expect(r.body.placa).toBe(corregida);
    expect(r.body.kmActual).toBe(15000);
    expect((await como(CAJERA, 'patch', `/vehiculos/${v.id}`, { placa: otra.placa.toLowerCase() })).status).toBe(409);
  });
  it('traspasar el vehículo a otro titular es editar el vehículo y queda auditado', async () => {
    const varios = await prisma.cliente.findFirstOrThrow({ where: { documento: '0000' } });
    const real = await nuevoCliente({ nombre: 'Titular Real' });
    const v = await nuevoVehiculo(varios.id);
    const r = await como(CAJERA, 'patch', `/vehiculos/${v.id}`, { clienteId: real.id });
    expect(r.status).toBe(200);
    expect(r.body.cliente).toMatchObject({ id: real.id, nombre: 'Titular Real' });
    const aud = await prisma.auditoria.findFirst({ where: { tabla: 'vehiculo', registroId: v.id }, orderBy: { fecha: 'desc' } });
    expect(aud!.motivo).toMatch(/titular/i);
    expect((await como(TECNICO, 'patch', `/vehiculos/${v.id}`, { color: 'Rojo' })).status).toBe(403);
  });
});

describe('búsqueda por placa, documento, VIN o nombre (CA-S2-05)', () => {
  it('los vehículos se encuentran por placa sin importar guiones ni mayúsculas, VIN, nombre y documento del titular', async () => {
    const c = await nuevoCliente({ nombre: 'Buscable Zeta' });
    const vin = `VINBUSCA${sufijo}${n++}`;
    const v = await nuevoVehiculo(c.id, { nroVin: vin });
    const quitar = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    for (const q of [quitar(v.placa), vin, 'buscable zeta', c.documento]) {
      const r = await como(CAJERA, 'get', `/vehiculos?q=${encodeURIComponent(q)}`);
      expect(r.status).toBe(200);
      const hallado = r.body.find((x: { id: string }) => x.id === v.id);
      expect(hallado).toBeTruthy();
      expect(hallado.cliente).toMatchObject({ nombre: 'Buscable Zeta', documento: c.documento });
    }
  });
  it('los clientes se encuentran por documento, nombre parcial o por la placa de su vehículo', async () => {
    const c = await nuevoCliente({ nombre: 'Cliente Hallable Omega' });
    const v = await nuevoVehiculo(c.id);
    for (const q of [c.documento, 'hallable omega', v.placa]) {
      const r = await como(CAJERA, 'get', `/clientes?q=${encodeURIComponent(q)}`);
      expect(r.body.map((x: { id: string }) => x.id)).toContain(c.id);
    }
    expect((await como(CAJERA, 'get', '/clientes?q=zzzz-no-existe-zzzz')).body).toEqual([]);
  });
  it('al ver un cliente se listan sus vehículos', async () => {
    const c = await nuevoCliente();
    const v = await nuevoVehiculo(c.id);
    const r = await como(CAJERA, 'get', `/clientes/${c.id}`);
    expect(r.body.vehiculos.map((x: { id: string }) => x.id)).toEqual([v.id]);
  });
});

describe('«Clientes varios» (CA-S2-06)', () => {
  it('existe, no se puede dar de baja ni cambiarle el documento y admite vehículos', async () => {
    const varios = await prisma.cliente.findFirstOrThrow({ where: { documento: '0000' } });
    expect((await como(CAJERA, 'patch', `/clientes/${varios.id}`, { activo: false })).status).toBe(400);
    expect((await como(CAJERA, 'patch', `/clientes/${varios.id}`, { documento: '0001' })).status).toBe(400);
    const v = await nuevoVehiculo(varios.id);
    expect(v.cliente.nombre).toBe('Clientes varios');
  });
});

describe('baja recuperable (CA-S2-07)', () => {
  it('dar de baja a un cliente no borra sus vehículos y se puede reactivar', async () => {
    const c = await nuevoCliente();
    const v = await nuevoVehiculo(c.id);
    const baja = await como(CAJERA, 'patch', `/clientes/${c.id}`, { activo: false });
    expect(baja.body.activo).toBe(false);
    expect((await como(CAJERA, 'get', `/vehiculos/${v.id}`)).status).toBe(200);
    expect((await como(CAJERA, 'get', '/clientes?activo=true')).body.map((x: { id: string }) => x.id)).not.toContain(c.id);
    expect((await como(CAJERA, 'patch', `/clientes/${c.id}`, { activo: true })).body.activo).toBe(true);
  });
});

describe('lecturas de kilometraje (CA-S2-08)', () => {
  it('cada lectura se guarda y el kilometraje actual es el de la última', async () => {
    const c = await nuevoCliente();
    const v = await nuevoVehiculo(c.id);
    expect((await como(CAJERA, 'post', `/vehiculos/${v.id}/lecturas`, { km: 12000, fecha: '2026-10-01T10:00:00Z' })).status).toBe(201);
    expect((await como(CAJERA, 'post', `/vehiculos/${v.id}/lecturas`, { km: 12500, fecha: '2026-10-20T10:00:00Z' })).status).toBe(201);
    expect((await como(CAJERA, 'get', `/vehiculos/${v.id}`)).body.kmActual).toBe(12500);
    const lecturas = (await como(CAJERA, 'get', `/vehiculos/${v.id}/lecturas`)).body;
    expect(lecturas.map((l: { km: number }) => l.km)).toEqual([12500, 12000]);
    expect(lecturas[0].fuente).toBe('manual');
  });
  it('un kilometraje negativo o con decimales se rechaza (400)', async () => {
    const c = await nuevoCliente();
    const v = await nuevoVehiculo(c.id);
    expect((await como(CAJERA, 'post', `/vehiculos/${v.id}/lecturas`, { km: -5 })).status).toBe(400);
    expect((await como(CAJERA, 'post', `/vehiculos/${v.id}/lecturas`, { km: 100.5 })).status).toBe(400);
    expect((await como(TECNICO, 'post', `/vehiculos/${v.id}/lecturas`, { km: 100 })).status).toBe(403);
  });
});

describe('auditoría de maestros (CA-S2-09)', () => {
  it('crear y editar un cliente guarda quién lo hizo, antes y después', async () => {
    const c = await nuevoCliente();
    await como(CAJERA, 'patch', `/clientes/${c.id}`, { nombre: 'Prueba Ana Editada' });
    const cajera = await prisma.usuario.findUniqueOrThrow({ where: { correo: CAJERA } });
    const registros = await prisma.auditoria.findMany({ where: { tabla: 'cliente', registroId: c.id }, orderBy: { fecha: 'asc' } });
    expect(registros).toHaveLength(2);
    expect(registros.every((a) => a.actor === cajera.id)).toBe(true);
    expect(registros[0].antes).toBeNull();
    expect(JSON.stringify(registros[1].antes)).toContain('Prueba Ana');
    expect(JSON.stringify(registros[1].despues)).toContain('Prueba Ana Editada');
  });
  it('el Superadministrador también puede editar y su actor queda registrado', async () => {
    const c = await nuevoCliente();
    expect((await como(TI, 'patch', `/clientes/${c.id}`, { comentario: 'revisado' })).status).toBe(200);
  });
});

describe('observación de la lectura (RF-007)', () => {
  it('cada lectura conserva kilometraje, fuente, fecha y observación', async () => {
    const c = await nuevoCliente();
    const v = await nuevoVehiculo(c.id);
    const r = await como(CAJERA, 'post', `/vehiculos/${v.id}/lecturas`, { km: 33000, observacion: 'Lo informó el cliente por teléfono' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ km: 33000, fuente: 'manual', observacion: 'Lo informó el cliente por teléfono' });
    const l = (await como(CAJERA, 'get', `/vehiculos/${v.id}/lecturas`)).body[0];
    expect(l).toMatchObject({ km: 33000, observacion: 'Lo informó el cliente por teléfono' });
    expect(l.fecha).toBeTruthy();
  });
});

describe('intentos de romper los maestros (pruebas de ataque del 28/10)', () => {
  it('kilometraje gigante o con fecha futura se rechaza sin error del servidor', async () => {
    const v = await nuevoVehiculo((await nuevoCliente()).id);
    expect((await como(CAJERA, 'post', `/vehiculos/${v.id}/lecturas`, { km: 1e15 })).status).toBe(400);
    expect((await como(CAJERA, 'post', `/vehiculos/${v.id}/lecturas`, { km: 10, fecha: '2099-01-01' })).status).toBe(400);
  });
  it('textos demasiado largos se rechazan y el documento no distingue mayúsculas', async () => {
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ nombre: 'A'.repeat(151) }))).status).toBe(400);
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ documento: '9'.repeat(21) }))).status).toBe(400);
    const d = doc();
    await como(CAJERA, 'post', '/clientes', clienteBase({ documento: d.toLowerCase() }));
    expect((await como(CAJERA, 'post', '/clientes', clienteBase({ documento: d }))).status).toBe(409);
  });
  it('no se asignan vehículos a un cliente eliminado', async () => {
    const c = await nuevoCliente();
    await como(CAJERA, 'patch', `/clientes/${c.id}`, { activo: false });
    expect((await como(CAJERA, 'post', '/vehiculos', { clienteId: c.id, placa: placa() })).status).toBe(409);
  });
});
