// Migración inicial (S4, RN-11): pruebas del procedimiento de carga con datos SINTÉTICOS (placas DEM-xxx, «Cliente demo …»).
// Cubre conteos, idempotencia, clave de origen y rechazo de filas inválidas. Corre sobre «posventa_test» (test/base-pruebas.ts).
import { PrismaClient } from '@prisma/client';
import { cargarStaging, fechaLima, Staging } from './tuulapp.carga';

const prisma = new PrismaClient();
const SISTEMA = 'sintetico-prueba';

function staging(): Staging {
  return {
    sistema: SISTEMA,
    personas: [
      { clave: 'p-asesora', nombre: 'Asesora demo', correo: 'asesora.migracion@demo.local', roles: ['Cajera'], local: 'Union', activo: true },
      { clave: 'p-tecnico', nombre: 'Técnico demo', correo: 'tecnico.migracion@demo.local', roles: ['Técnico'], local: 'Prohogar', activo: false },
      { clave: 'p-malo', nombre: 'Rol inventado', correo: 'malo.migracion@demo.local', roles: ['Astronauta'], local: null },
    ],
    clientes: [
      { clave: 'c1', tipoDocumento: 'DNI', documento: '90000001', nombre: 'Cliente demo uno', comentario: 'sintético' },
      { clave: 'c2', tipoDocumento: 'RUC', documento: '20900000002', nombre: 'Cliente demo dos' },
      { clave: 'c-sin-doc', tipoDocumento: 'DNI', documento: '', nombre: 'Cliente demo sin documento' },
      { clave: 'c-dup', tipoDocumento: 'DNI', documento: '90000001', nombre: 'Cliente demo repetido' },
    ],
    vehiculos: [
      { clave: 'v1', cliente: 'c1', placa: 'DEM-901', placaNorm: 'DEM901', marca: 'Marca demo', anio: 2015 },
      { clave: 'v2', cliente: 'c2', placa: 'DEM-902', placaNorm: 'DEM902' },
      { clave: 'v-huerfano', cliente: 'no-existe', placa: 'DEM-903', placaNorm: 'DEM903' },
    ],
    ordenes: [
      { clave: 'o1', codigo: 'DEMMIG0001', cliente: 'c1', vehiculo: 'v1', local: 'Union', estado: 'Cerrada', fechaInicio: '2025-03-01T09:00:00', fechaCierre: '2025-03-01T17:00:00',
        km: 50000, tecnico: 'p-tecnico', jefeTaller: null, creadoPor: 'p-asesora', observaciones: 'sintética',
        detalles: [
          { clave: 'o1:1', posicion: 1, tipo: 'servicio', descripcion: 'Servicio demo', cantidad: 1, precio: 30, total: 30, servicioCodigo: 'NO-EXISTE' },
          { clave: 'o1:2', posicion: 2, tipo: 'repuesto', descripcion: 'Repuesto demo', cantidad: 2, precio: 10, total: 20 },
          { clave: 'o1:3', posicion: 3, tipo: 'repuesto', descripcion: 'Cantidad inválida', cantidad: 0, total: 0 },
        ] },
      { clave: 'o2', codigo: 'DEMMIG0002', cliente: 'c2', vehiculo: 'v2', local: 'Prohogar', estado: 'EnProceso', fechaInicio: '2025-04-01', km: null, creadoPor: 'p-asesora', detalles: [] },
      { clave: 'o-sin-fecha', codigo: 'DEMMIG0003', cliente: 'c1', vehiculo: 'v1', local: 'Union', estado: 'Cerrada', fechaInicio: 'ayer', creadoPor: 'p-asesora', detalles: [] },
      { clave: 'o-sin-creador', codigo: 'DEMMIG0004', cliente: 'c1', vehiculo: 'v1', local: 'Union', estado: 'Cerrada', fechaInicio: '2025-05-01', creadoPor: 'p-malo', detalles: [] },
    ],
    lecturas: [
      { clave: 'o1', vehiculo: 'v1', km: 50000, fecha: '2025-03-01T09:00:00', observacion: null },
      { clave: 'l-fuera', vehiculo: 'v1', km: 991342397, fecha: '2025-03-02' },
    ],
    notas: [
      { clave: '900001', numero: 900001, local: 'Union', orden: 'o1', cliente: 'c1', vehiculo: 'v1', fechaEmision: '2025-03-01T17:00:00', condicion: 'CONTADO', total: 50,
        emitidaPor: 'p-asesora', detalles: [{ clave: '900001:1', posicion: 1, tipo: 'servicio', descripcion: 'Servicio demo', cantidad: 1, precio: 50, total: 50 }],
        abonos: [{ clave: '900001', fecha: '2025-03-01T17:00:00', metodo: 'Efectivo', valor: 50 }] },
      { clave: '900002', numero: 900002, local: 'Prohogar', orden: null, cliente: 'c2', fechaEmision: '2025-04-02', condicion: 'CONTADO', total: 12, emitidaPor: 'p-asesora',
        detalles: [{ clave: '900002:1', posicion: 1, tipo: 'servicio', descripcion: 'Venta demo', cantidad: 1, precio: 12, total: 12 }],
        abonos: [{ clave: '900002', metodo: 'Transferencia', valor: 12 }, { clave: '900002-mal', metodo: 'Trueque', valor: 5 }] },
      { clave: '900003', numero: -3, local: 'Union', cliente: 'c1', fechaEmision: '2025-04-02', total: 1, emitidaPor: 'p-asesora', detalles: [], abonos: [] },
    ],
  };
}

/** Borra lo que dejó una corrida anterior de esta prueba (solo filas con clave de origen del sistema sintético). */
async function limpiar() {
  const k = await prisma.claveOrigen.findMany({ where: { sistema: SISTEMA } });
  const de = (t: string) => k.filter((x) => x.tabla === t).map((x) => x.registroId);
  await prisma.abono.deleteMany({ where: { id: { in: de('Abono') } } });
  await prisma.detalleNota.deleteMany({ where: { id: { in: de('DetalleNota') } } });
  await prisma.notaVenta.deleteMany({ where: { id: { in: de('NotaVenta') } } });
  await prisma.lecturaKm.deleteMany({ where: { id: { in: de('LecturaKm') } } });
  await prisma.detalleODS.deleteMany({ where: { id: { in: de('DetalleODS') } } });
  await prisma.ordenServicio.deleteMany({ where: { id: { in: de('OrdenServicio') } } });
  await prisma.vehiculo.deleteMany({ where: { id: { in: de('Vehiculo') } } });
  await prisma.cliente.deleteMany({ where: { id: { in: de('Cliente') } } });
  await prisma.usuarioRol.deleteMany({ where: { usuarioId: { in: de('Usuario') } } });
  await prisma.usuario.deleteMany({ where: { id: { in: de('Usuario') } } });
  await prisma.claveOrigen.deleteMany({ where: { sistema: SISTEMA } });
}

describe('Migración inicial: carga idempotente con clave de origen (RN-11)', () => {
  let primera: Awaited<ReturnType<typeof cargarStaging>>;
  beforeAll(async () => {
    await limpiar();
    primera = await cargarStaging(prisma, staging(), { claveUsuarios: 'clave-sintetica', lote: 2 });
  });
  afterAll(async () => {
    await limpiar();
    await prisma.$disconnect();
  });

  it('carga las filas válidas de cada tabla (conteos)', () => {
    const c = (t: string) => primera.tablas[t]?.creadas;
    expect(c('Usuario')).toBe(2);
    expect(c('Cliente')).toBe(2);
    expect(c('Vehiculo')).toBe(2);
    expect(c('OrdenServicio')).toBe(2);
    expect(c('DetalleODS')).toBe(2);
    expect(c('LecturaKm')).toBe(1);
    expect(c('NotaVenta')).toBe(2);
    expect(c('DetalleNota')).toBe(2);
    expect(c('Abono')).toBe(2);
  });

  it('rechaza las filas inválidas con su motivo y no las escribe', async () => {
    const motivo = (clave: string) => primera.rechazos.find((r) => r.clave === clave)?.motivo ?? '';
    expect(motivo('p-malo')).toMatch(/Rol inexistente/);
    expect(motivo('c-sin-doc')).toMatch(/Sin documento/);
    expect(motivo('c-dup')).toMatch(/repetido/);
    expect(motivo('v-huerfano')).toMatch(/Titular sin cargar/);
    expect(motivo('o-sin-fecha')).toMatch(/Fecha de ingreso/);
    expect(motivo('o-sin-creador')).toMatch(/Creador sin cargar/);
    expect(motivo('o1:3')).toMatch(/cantidad positiva/);
    expect(motivo('l-fuera')).toMatch(/Km fuera de rango/);
    expect(motivo('900003')).toMatch(/Número inválido/);
    expect(motivo('900002-mal')).toMatch(/método inválido/);
    expect(await prisma.cliente.count({ where: { nombre: 'Cliente demo sin documento' } })).toBe(0);
    expect(await prisma.ordenServicio.count({ where: { codigo: { in: ['DEMMIG0003', 'DEMMIG0004'] } } })).toBe(0);
  });

  it('cada fila cargada tiene su clave de origen (sistema + identificador) que apunta al registro', async () => {
    const k = await prisma.claveOrigen.findMany({ where: { sistema: SISTEMA } });
    expect(k).toHaveLength(2 + 2 + 2 + 2 + 2 + 1 + 2 + 2 + 2);
    const o1 = k.find((x) => x.tabla === 'OrdenServicio' && x.idOrigen === 'o1')!;
    const orden = await prisma.ordenServicio.findUnique({ where: { id: o1.registroId }, include: { detalles: true, abonos: true } });
    expect(orden?.codigo).toBe('DEMMIG0001');
    expect(orden?.detalles).toHaveLength(2);
    expect(orden?.detalles.every((d) => d.servicioId === null)).toBe(true); // servicio inexistente: queda sin enlazar
    expect(orden?.abonos).toHaveLength(1); // el pago de una nota con ODS va a la ODS
    expect(primera.avisos.join(' ')).toMatch(/sin enlazar/);
  });

  it('respeta sede, serie del local, correlativo, roles, usuario inactivo y fecha de Lima', async () => {
    const nota = await prisma.notaVenta.findFirst({ where: { numero: 900002 }, include: { local: true, abonos: true } });
    expect(nota?.serie).toBe(nota?.local.serieNotaVenta);
    expect(nota?.codigo).toBe(`${nota?.serie}-900002`);
    expect(nota?.abonos).toHaveLength(1); // venta directa: el pago va a la nota
    const corr = await prisma.correlativoSerie.findUnique({ where: { organizacionId_serie: { organizacionId: nota!.organizacionId, serie: nota!.serie } } });
    expect(corr!.ultimo).toBeGreaterThanOrEqual(900002);
    const tec = await prisma.usuario.findUnique({ where: { correo: 'tecnico.migracion@demo.local' }, include: { roles: { include: { rol: true } } } });
    expect(tec?.activo).toBe(false);
    expect(tec?.roles.map((r) => r.rol.nombre)).toEqual(['Técnico']);
    expect(fechaLima('2025-03-01T09:00:00')!.toISOString()).toBe('2025-03-01T14:00:00.000Z');
  });

  it('es idempotente: correrla otra vez no duplica y actualiza lo que cambió', async () => {
    const antes = await prisma.claveOrigen.count({ where: { sistema: SISTEMA } });
    const s = staging();
    s.clientes[0].nombre = 'Cliente demo uno (corregido)';
    const segunda = await cargarStaging(prisma, s, { claveUsuarios: 'otra-clave', lote: 3 });
    expect(Object.values(segunda.tablas).reduce((a, t) => a + t.creadas, 0)).toBe(0);
    expect(segunda.tablas.OrdenServicio.actualizadas).toBe(2);
    expect(segunda.tablas.DetalleODS.actualizadas).toBe(2);
    expect(await prisma.claveOrigen.count({ where: { sistema: SISTEMA } })).toBe(antes);
    expect(await prisma.ordenServicio.count({ where: { codigo: { in: ['DEMMIG0001', 'DEMMIG0002'] } } })).toBe(2);
    expect(await prisma.detalleODS.count({ where: { orden: { codigo: 'DEMMIG0001' } } })).toBe(2);
    expect(await prisma.cliente.count({ where: { documento: '90000001' } })).toBe(1);
    expect((await prisma.cliente.findFirst({ where: { documento: '90000001' } }))?.nombre).toBe('Cliente demo uno (corregido)');
  });

  it('no pisa datos que no vienen del sistema de origen (documento ya existente)', async () => {
    const org = await prisma.organizacion.findFirstOrThrow({ where: { activa: true }, orderBy: { nombre: 'asc' } });
    const ajeno = await prisma.cliente.create({ data: { organizacionId: org.id, documento: '90000099', nombre: 'Cliente demo ajeno' } });
    try {
      const s = staging();
      s.clientes.push({ clave: 'c-ajeno', tipoDocumento: 'DNI', documento: '90000099', nombre: 'Intento de pisar' });
      const r = await cargarStaging(prisma, s, { claveUsuarios: 'x' });
      expect(r.rechazos.find((x) => x.clave === 'c-ajeno')?.motivo).toMatch(/ya existe en la base/);
      expect((await prisma.cliente.findUnique({ where: { id: ajeno.id } }))?.nombre).toBe('Cliente demo ajeno');
    } finally {
      await prisma.cliente.delete({ where: { id: ajeno.id } });
    }
  });

  it('se niega a cargar un archivo sin sistema de origen', async () => {
    await expect(cargarStaging(prisma, { ...staging(), sistema: '' }, { claveUsuarios: 'x' })).rejects.toThrow(/sistema/);
  });
});
