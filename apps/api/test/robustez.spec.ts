// Robustez (ISO/IEC 25010: fiabilidad y seguridad): cada ruta que recibe datos se bombardea con valores hostiles
// (tipos equivocados, inyección SQL y HTML, textos enormes, números extremos, objetos anidados, __proto__) campo por campo.
// Ninguna respuesta puede ser un error 500 ni tardar más de 3 s, y al final el sistema debe seguir respondiendo.
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

jest.setTimeout(900_000);
const prisma = new PrismaClient();
let app: INestApplication;
const CLAVE = process.env.SEED_PASSWORD as string;
const tokens: Record<string, string> = {};
const ADMIN = 'admin@demo.local', TI = 'ti@demo.local';
const tokenDe = async (c: string) => (tokens[c] ??= (await request(app.getHttpServer()).post('/auth/login').send({ correo: c, password: CLAVE })).body.token as string);
const sx = `${Date.now() % 100000}`;
const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), hoy = new Date().toISOString().slice(0, 10);
const anidado = (n: number): unknown => (n === 0 ? 'fondo' : { a: anidado(n - 1) });

export const HOSTILES: [string, unknown][] = [
  ['null', null], ['vacío', ''], ['espacios', '   '], ['negativo', -1], ['cero', 0], ['enorme', 1e308], ['texto NaN', 'NaN'], ['texto Infinity', 'Infinity'],
  ['exponente', '1e400'], ['booleano', true], ['arreglo', [1, 2]], ['objeto', { a: 1 }], ['operador', { $gt: '' }],
  ['SQL', "' OR 1=1; DROP TABLE \"Cliente\"; --"], ['HTML', '<img src=x onerror=alert(1)>'], ['texto 100 mil', 'x'.repeat(100_000)],
  ['byte nulo', 'a\u0000b'], ['emojis', '😀'.repeat(2000)], ['anidado', anidado(400)], ['arreglo 5 mil', Array(5000).fill('x')],
  ['__proto__', JSON.parse('{"__proto__":{"admin":true},"constructor":{"prototype":{"x":1}}}')], ['fecha imposible', '2026-13-45'], ['decimal largo', 0.1234567891234],
];

interface Caso { nombre: string; metodo: 'post' | 'patch' | 'put'; ruta: () => string; cuerpo: () => Record<string, unknown>; quien?: string }
// Cada alta lleva valores únicos: si no, desde la segunda petición todo sería «ya existe» y no se probaría nada.
let k = 0;
const u = () => `${sx}${++k}`;
const dni = () => String(10_000_000 + ((Number(sx) * 1000 + ++k) % 89_999_999));
const ruc = () => `20${String((Number(sx) * 1000 + ++k) % 1_000_000_000).padStart(9, '0')}`;
const fallas: string[] = [];
const aceptados: Record<string, string[]> = {};
let lento = { ms: 0, donde: '' };
const ids: Record<string, string> = {};
const creados: Record<string, string[]> = {};
let originales: { empresa?: Record<string, unknown>; local?: Record<string, unknown>; marcas?: { id: string; modelos: string[] }[] } = {};

/** Borra todo lo que creó la batería (y lo que colgó de ello), para no alterar las demás pruebas. */
async function limpiar() {
  const de = (r: string) => creados[r] ?? [];
  const borrar = async (f: () => Promise<unknown>) => { try { await f(); } catch (e) { console.log('limpieza:', (e as Error).message.split('\n').slice(-1)[0]); } };
  const clientes = [ids.cliente, ...de('POST /clientes')];
  const ordenes = (await prisma.ordenServicio.findMany({ where: { clienteId: { in: clientes } } })).map((o) => o.id);
  const notas = (await prisma.notaVenta.findMany({ where: { clienteId: { in: clientes } } })).map((x) => x.id);
  const vehiculos = (await prisma.vehiculo.findMany({ where: { clienteId: { in: clientes } } })).map((v) => v.id);
  const productos = [ids.producto, ...de('POST /productos')];
  const proveedores = [ids.proveedor, ...de('POST /proveedores')];
  const compras = (await prisma.compra.findMany({ where: { proveedorId: { in: proveedores } } })).map((c) => c.id);
  const usuarios = de('POST /usuarios');
  await borrar(() => prisma.abono.deleteMany({ where: { OR: [{ ordenId: { in: ordenes } }, { notaId: { in: notas } }] } }));
  await borrar(() => prisma.notaVenta.deleteMany({ where: { id: { in: notas } } }));
  for (const t of ['solicitudOds', 'evidenciaIngreso', 'detalleODS', 'bitacora'] as const) await borrar(() => (prisma[t] as unknown as { deleteMany: (a: object) => Promise<unknown> }).deleteMany({ where: { ordenId: { in: ordenes } } }));
  await borrar(() => prisma.ordenServicio.deleteMany({ where: { id: { in: ordenes } } }));
  await borrar(() => prisma.cotizacion.deleteMany({ where: { clienteId: { in: clientes } } }));
  await borrar(() => prisma.lecturaKm.deleteMany({ where: { vehiculoId: { in: vehiculos } } }));
  await borrar(() => prisma.vehiculo.deleteMany({ where: { id: { in: vehiculos } } }));
  await borrar(() => prisma.cliente.deleteMany({ where: { id: { in: clientes } } }));
  await borrar(() => prisma.compra.deleteMany({ where: { id: { in: compras } } }));
  await borrar(() => prisma.movimientoInventario.deleteMany({ where: { productoId: { in: productos } } }));
  await borrar(() => prisma.stockProducto.deleteMany({ where: { productoId: { in: productos } } }));
  await borrar(() => prisma.producto.deleteMany({ where: { id: { in: productos } } }));
  await borrar(() => prisma.servicio.deleteMany({ where: { id: { in: de('POST /servicios') } } }));
  await borrar(() => prisma.reglaPrecio.deleteMany({ where: { id: { in: de('POST /reglas-precio') } } }));
  await borrar(() => prisma.grupoVehicular.deleteMany({ where: { id: { in: de('POST /grupos') } } }));
  await borrar(() => prisma.proveedor.deleteMany({ where: { id: { in: proveedores } } }));
  await borrar(() => prisma.usuarioRol.deleteMany({ where: { usuarioId: { in: usuarios } } }));
  await borrar(() => prisma.usuario.deleteMany({ where: { id: { in: usuarios } } }));
  // Marcas: se borran las nuevas y las de antes recuperan sus modelos.
  const antes = new Map((originales.marcas ?? []).map((m) => [m.id, m.modelos]));
  const ahora = await prisma.marcaVehiculo.findMany({ where: { organizacionId: (originales.empresa as { id: string }).id } });
  for (const m of ahora) {
    if (!antes.has(m.id)) await borrar(() => prisma.marcaVehiculo.delete({ where: { id: m.id } }));
    else if (JSON.stringify(antes.get(m.id)) !== JSON.stringify(m.modelos)) await borrar(() => prisma.marcaVehiculo.update({ where: { id: m.id }, data: { modelos: antes.get(m.id) } }));
  }
  const todos = [...Object.values(ids), ...Object.values(creados).flat(), ...ordenes, ...notas, ...vehiculos, ...compras];
  await borrar(() => prisma.auditoria.deleteMany({ where: { registroId: { in: todos } } }));
}

async function enviar(c: Caso, cuerpo: unknown, etiqueta: string) {
  const t = await tokenDe(c.quien ?? ADMIN);
  const ini = Date.now();
  const r = await request(app.getHttpServer())[c.metodo](c.ruta()).set('Authorization', `Bearer ${t}`).send(cuerpo as object);
  const ms = Date.now() - ini;
  if (ms > lento.ms) lento = { ms, donde: `${c.nombre} · ${etiqueta}` };
  if (r.status < 300 && etiqueta.includes(' = ')) (aceptados[c.nombre] ??= []).push(etiqueta);
  if (r.status < 300 && c.metodo === 'post' && typeof r.body?.id === 'string') (creados[c.nombre] ??= []).push(r.body.id);
  if (r.status >= 500) fallas.push(`${c.nombre} · ${etiqueta} → ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
  if (ms > 3000) fallas.push(`${c.nombre} · ${etiqueta} → lento (${ms} ms)`);
  return r;
}

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  // El token se pide antes de armar la petición: dos peticiones a la vez sobre el mismo servidor de prueba lo cierran.
  const como = async (m: 'post' | 'put', ruta: string, b: object, quien = ADMIN) => { const t = await tokenDe(quien); return (await request(app.getHttpServer())[m](ruta).set('Authorization', `Bearer ${t}`).send(b)).body; };
  const admin = await prisma.usuario.findUniqueOrThrow({ where: { correo: ADMIN }, include: { organizacion: true, local: true } });
  ids.local = admin.localId as string;
  originales = { empresa: { ...admin.organizacion }, local: { ...admin.local }, marcas: (await prisma.marcaVehiculo.findMany({ where: { organizacionId: admin.organizacionId as string } })).map((m) => ({ id: m.id, modelos: m.modelos })) };
  ids.cliente = (await como('post', '/clientes', { tipoDocumento: 'DNI', documento: `8${sx.padStart(5, '0')}31`, nombre: 'Cliente Robustez' })).id;
  ids.vehiculo = (await como('post', '/vehiculos', { clienteId: ids.cliente, placa: `RB${sx}` })).id;
  ids.orden = (await como('post', '/ordenes', { vehiculoId: ids.vehiculo, tipoAtencion: 'Mantenimiento correctivo' })).id;
  await como('put', `/ordenes/${ids.orden}/detalles`, { detalles: [{ tipo: 'servicio', descripcion: 'Servicio', precio: 1000, cantidad: 1 }] });
  ids.producto = (await como('post', '/productos', { codigo: `RBP${sx}`, nombre: 'Producto robustez', precio: 10 })).id;
  ids.proveedor = (await como('post', '/proveedores', { tipoDocumento: 'RUC', documento: `20${sx.padStart(5, '0')}0099`, nombre: 'Proveedor Robustez' })).id;
  ids.nota = (await como('post', '/notas-venta', { clienteId: ids.cliente, items: [{ tipo: 'servicio', descripcion: 'S', cantidad: 1, precio: 100000, tipoIgv: 'GRAVADO' }], condicion: 'CREDITO', fechaVencimiento: manana })).id;
  ids.cotizacion = (await como('post', '/cotizaciones', { clienteId: ids.cliente, items: [{ tipo: 'servicio', descripcion: 'S', cantidad: 1, precio: 10 }] })).id;
  ids.compra = (await como('post', '/compras', { proveedorId: ids.proveedor, localId: ids.local, serie: 'F001', numero: `9${sx}`, fecha: hoy, condicion: 'CREDITO', fechaVencimiento: manana, items: [{ productoId: ids.producto, cantidad: 1, costo: 100000 }] })).id;
  ids.marca = (await como('post', '/marcas-vehiculo', { nombre: `RBMARCA${sx}` })).id;
  ids.rol = (await prisma.rol.findFirstOrThrow({ where: { organizacionId: admin.organizacionId, nombre: 'Cajera' } })).id;
});

afterAll(async () => {
  // Devuelve la empresa y el local a como estaban: algunos valores raros pueden haberse aceptado como texto.
  if (originales.empresa) {
    const e = originales.empresa as Record<string, unknown>;
    await prisma.organizacion.update({ where: { id: e.id as string }, data: { nombre: e.nombre as string, razonSocial: e.razonSocial as string | null, telefono: e.telefono as string | null, correo: e.correo as string | null, lema: e.lema as string | null, direccion: e.direccion as string | null, anchoTicketMm: e.anchoTicketMm as number, logoJpeg: null, logoAncho: null, logoAlto: null } });
  }
  if (originales.local) {
    const l = originales.local as Record<string, unknown>;
    await prisma.local.update({ where: { id: l.id as string }, data: { nombre: l.nombre as string, serieNotaVenta: l.serieNotaVenta as string | null, serieBoleta: l.serieBoleta as string | null, serieFactura: l.serieFactura as string | null, direccion: l.direccion as string | null, telefono: l.telefono as string | null } });
  }
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

const item = { tipo: 'servicio', descripcion: 'S', cantidad: 1, precio: 10, tipoIgv: 'GRAVADO' };
const CASOS: Caso[] = [
  { nombre: 'POST /auth/login', metodo: 'post', ruta: () => '/auth/login', cuerpo: () => ({ correo: 'nadie@robustez.pe', password: 'x' }) },
  { nombre: 'POST /clientes', metodo: 'post', ruta: () => '/clientes', cuerpo: () => ({ tipoDocumento: 'DNI', documento: dni(), nombre: 'X', movil: '987654321', email: 'a@b.pe', pais: 'PE' }) },
  { nombre: 'PATCH /clientes/:id', metodo: 'patch', ruta: () => `/clientes/${ids.cliente}`, cuerpo: () => ({ nombre: 'Cliente Robustez', movil: '987654321', email: 'a@b.pe', direccionFiscal: 'Av. 1' }) },
  { nombre: 'POST /vehiculos', metodo: 'post', ruta: () => '/vehiculos', cuerpo: () => ({ clienteId: ids.cliente, placa: `Z${u()}`, marca: 'KIA', modelo: 'RIO', anio: 2020, color: 'Rojo' }) },
  { nombre: 'PATCH /vehiculos/:id', metodo: 'patch', ruta: () => `/vehiculos/${ids.vehiculo}`, cuerpo: () => ({ color: 'Azul', anio: 2019, marca: 'KIA', modelo: 'RIO' }) },
  { nombre: 'POST /vehiculos/:id/lecturas', metodo: 'post', ruta: () => `/vehiculos/${ids.vehiculo}/lecturas`, cuerpo: () => ({ km: 20000 }) },
  { nombre: 'POST /marcas-vehiculo', metodo: 'post', ruta: () => '/marcas-vehiculo', cuerpo: () => ({ nombre: `RBN${u()}` }) },
  { nombre: 'PATCH /marcas-vehiculo/:id', metodo: 'patch', ruta: () => `/marcas-vehiculo/${ids.marca}`, cuerpo: () => ({ nombre: `RBMARCA${sx}`, modelos: ['A', 'B'] }) },
  { nombre: 'POST /ordenes', metodo: 'post', ruta: () => '/ordenes', cuerpo: () => ({ vehiculoId: ids.vehiculo, tipoAtencion: 'Mantenimiento correctivo', km: 1000, observaciones: 'x' }) },
  { nombre: 'PATCH /ordenes/:id', metodo: 'patch', ruta: () => `/ordenes/${ids.orden}`, cuerpo: () => ({ observaciones: 'x', decision: 'Aprobada', km: 1500 }) },
  { nombre: 'PUT /ordenes/:id/detalles', metodo: 'put', ruta: () => `/ordenes/${ids.orden}/detalles`, cuerpo: () => ({ detalles: [{ tipo: 'servicio', descripcion: 'Servicio', precio: 1000, cantidad: 1 }] }) },
  { nombre: 'POST /ordenes/:id/abonos', metodo: 'post', ruta: () => `/ordenes/${ids.orden}/abonos`, cuerpo: () => ({ metodo: 'Efectivo', valor: 1, concepto: 'x' }) },
  { nombre: 'POST /ordenes/:id/descuento', metodo: 'post', ruta: () => `/ordenes/${ids.orden}/descuento`, cuerpo: () => ({ porcentaje: 5 }) },
  { nombre: 'POST /ordenes/:id/solicitudes', metodo: 'post', ruta: () => `/ordenes/${ids.orden}/solicitudes`, cuerpo: () => ({ tipo: 'CORRECCION', motivo: 'x', cambios: { observaciones: 'y' } }) },
  { nombre: 'POST /notas-venta', metodo: 'post', ruta: () => '/notas-venta', cuerpo: () => ({ clienteId: ids.cliente, items: [item], condicion: 'CONTADO', pagos: [{ metodo: 'Efectivo', valor: 1 }], observaciones: 'x' }) },
  { nombre: 'POST /notas-venta/:id/cobros', metodo: 'post', ruta: () => `/notas-venta/${ids.nota}/cobros`, cuerpo: () => ({ metodo: 'Efectivo', valor: 1, concepto: 'x' }) },
  { nombre: 'POST /cotizaciones', metodo: 'post', ruta: () => '/cotizaciones', cuerpo: () => ({ clienteId: ids.cliente, items: [item], formaPago: 'Yape', validaHasta: manana, conIgv: true }) },
  { nombre: 'PATCH /cotizaciones/:id', metodo: 'patch', ruta: () => `/cotizaciones/${ids.cotizacion}`, cuerpo: () => ({ clienteId: ids.cliente, items: [item], validaHasta: manana }) },
  { nombre: 'POST /compras', metodo: 'post', ruta: () => '/compras', cuerpo: () => ({ proveedorId: ids.proveedor, localId: ids.local, tipoDocumento: 'FACTURA', serie: 'F002', numero: u(), fecha: hoy, condicion: 'CONTADO', metodo: 'Efectivo', items: [{ productoId: ids.producto, cantidad: 1, costo: 1, descuento: 0 }] }) },
  { nombre: 'POST /compras/:id/pagos', metodo: 'post', ruta: () => `/compras/${ids.compra}/pagos`, cuerpo: () => ({ metodo: 'Efectivo', valor: 1, concepto: 'x' }) },
  { nombre: 'POST /productos', metodo: 'post', ruta: () => '/productos', cuerpo: () => ({ codigo: `RBP${u()}`, nombre: 'P', precio: 10, costo: 5, unidad: 'UND', proveedorId: ids.proveedor }) },
  { nombre: 'PATCH /productos/:id', metodo: 'patch', ruta: () => `/productos/${ids.producto}`, cuerpo: () => ({ nombre: 'Producto robustez', precio: 11, costo: 6 }) },
  { nombre: 'POST /proveedores', metodo: 'post', ruta: () => '/proveedores', cuerpo: () => ({ tipoDocumento: 'RUC', documento: ruc(), nombre: 'Prov', email: 'a@b.pe', movil: '987654321' }) },
  { nombre: 'PATCH /proveedores/:id', metodo: 'patch', ruta: () => `/proveedores/${ids.proveedor}`, cuerpo: () => ({ nombre: 'Proveedor Robustez', email: 'a@b.pe' }) },
  { nombre: 'POST /servicios', metodo: 'post', ruta: () => '/servicios', cuerpo: () => ({ codigo: `RBS${u()}`, nombre: 'S', categoria: 'MOTOR', horasEstandar: 1, precioEstandar: 50 }) },
  { nombre: 'POST /grupos', metodo: 'post', ruta: () => '/grupos', cuerpo: () => ({ codigo: `RBG${u()}`, nombre: 'G' }) },
  { nombre: 'POST /reglas-precio', metodo: 'post', ruta: () => '/reglas-precio', cuerpo: () => ({ codigo: `RBR${u()}`, nivel: 'GLOBAL', tipo: 'PORCENTAJE', porcentaje: 5 }) },
  { nombre: 'PATCH /empresa', metodo: 'patch', ruta: () => '/empresa', quien: TI, cuerpo: () => ({ nombre: 'Taller Demo', telefono: '999888777', anchoTicketMm: 80, correo: 'a@b.pe' }) },
  { nombre: 'PATCH /empresa/locales/:id', metodo: 'patch', ruta: () => `/empresa/locales/${ids.local}`, quien: TI, cuerpo: () => ({ direccion: 'Av. Prohogar 506', telefono: '01 444 5555', serieNotaVenta: 'NV01' }) },
  { nombre: 'POST /usuarios', metodo: 'post', ruta: () => '/usuarios', cuerpo: () => ({ nombre: 'U', correo: `rb${u()}@x.pe`, password: 'Clave123!', rolIds: [ids.rol], localId: ids.local }) },
];

describe('robustez: valores hostiles campo por campo', () => {
  it.each(CASOS.map((c) => [c.nombre, c] as const))('%s', async (_n, c) => {
    const base = c.cuerpo();
    for (const [nombre, v] of [['cuerpo arreglo', []], ['cuerpo texto', 'hola'], ['cuerpo vacío', {}]] as const) await enviar(c, v, nombre);
    for (const campo of Object.keys(base)) for (const [h, v] of HOSTILES) await enviar(c, { ...c.cuerpo(), [campo]: v }, `${campo} = ${h}`);
    // Cada campo extra desconocido o con __proto__ no debe cambiar nada.
    await enviar(c, { ...base, extra: 'x', isAdmin: true, organizacionId: 'otra' }, 'campos extra');
  });

  it('las rutas con id aguantan ids hostiles y las búsquedas aguantan filtros hostiles', async () => {
    const t = await tokenDe(ADMIN);
    const idsMalos = ["' OR '1'='1", '../../etc/passwd', 'x'.repeat(5000), '%00', '😀', '1;DROP TABLE x'];
    for (const id of idsMalos) {
      for (const ruta of ['/clientes/', '/vehiculos/', '/ordenes/', '/notas-venta/', '/cotizaciones/', '/compras/']) {
        const ini = Date.now();
        const r = await request(app.getHttpServer()).get(ruta + encodeURIComponent(id)).set('Authorization', `Bearer ${t}`);
        if (r.status >= 500 || Date.now() - ini > 3000) fallas.push(`GET ${ruta}<${id.slice(0, 20)}> → ${r.status}`);
      }
    }
    const qs = ["' OR 1=1 --", '%', '_', '\\', 'x'.repeat(20000), '<script>', '2026-99-99'];
    for (const q of qs) {
      for (const ruta of ['/clientes?q=', '/notas-venta?q=', '/notas-venta?desde=', '/ordenes?q=', '/vehiculos?q=', '/notas-venta?estado=']) {
        const ini = Date.now();
        const r = await request(app.getHttpServer()).get(ruta + encodeURIComponent(q)).set('Authorization', `Bearer ${t}`);
        if (r.status >= 500 || Date.now() - ini > 3000) fallas.push(`GET ${ruta}<${q.slice(0, 20)}> → ${r.status} ${Date.now() - ini} ms`);
      }
    }
  });

  it('ningún campo acepta listas, objetos, verdadero/falso o textos de 100 mil caracteres donde no corresponde', () => {
    // Campos que sí son listas, opcionales que se ignoran si no son del tipo, o que admiten «sí/no».
    const LISTAS = ['items', 'detalles', 'pagos', 'modelos', 'rolIds', 'cambios'];
    const NO_VALEN = ['booleano', 'arreglo', 'objeto', 'operador', 'anidado', '__proto__', 'arreglo 5 mil', 'texto 100 mil'];
    const malos: string[] = [];
    for (const [ruta, lista] of Object.entries(aceptados)) for (const e of lista) {
      const [campo, valor] = e.split(' = ');
      if (!NO_VALEN.includes(valor)) continue;
      if (LISTAS.includes(campo) && ['arreglo', 'arreglo 5 mil'].includes(valor)) continue;
      if (['conIgv', 'conDetraccion', 'activo'].includes(campo) && valor === 'booleano') continue;
      malos.push(`${ruta} · ${e}`);
    }
    expect(malos).toEqual([]);
  });

  it('sin errores 500 ni respuestas lentas, y el sistema sigue respondiendo', async () => {
    const me = await request(app.getHttpServer()).get('/me').set('Authorization', `Bearer ${await tokenDe(ADMIN)}`);
    expect(me.status).toBe(200);
    console.log(`Respuesta más lenta: ${lento.ms} ms en ${lento.donde}`);
    if (process.env.INFORME_ACEPTADOS) require('fs').writeFileSync(process.env.INFORME_ACEPTADOS, JSON.stringify(aceptados, null, 1));
    expect(fallas).toEqual([]);
  });
});
