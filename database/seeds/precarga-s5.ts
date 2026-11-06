// Precarga del slice S5: grupos G1 a G4, familias de motor, 135 servicios con su precio por grupo, reglas de solapamiento,
// proveedores y productos con stock, y vehículos de prueba de cada grupo.
// Fuente: precarga/s5/catalogo_g.json, generado con herramientas/s5/generar_precarga_g.py a partir de la reunión de precios
// (referencia Autodata en combinación con datos del taller RSA). Sin datos personales: clientes, placas y productos son sintéticos.
// Es idempotente: no pisa lo que se editó después. Quita una sola vez la precarga anterior de grupos N1 a N5.
import { Prisma, PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

interface Catalogo {
  grupos: { codigo: string; nombre: string; descripcion: string }[];
  servicios: { codigo: string; nombre: string; categoria: string; externo: boolean; trabajoMayor: boolean; precios: Record<string, number | null>; precioEstandar: number; horas: number | null; horasGrupo: Record<string, number> | null; repuestos: string[] }[];
  solapamientos: { codigo: string; tipo: string; modo: string; base: string[]; reducidos: string[]; minimo: number; estandar: number; descuentos: Record<string, number>; alerta: string | null; estado: string; nota: string | null }[];
  familias: { codigo: string; codigos: string[]; combustible: string | null; litros: string | null; turbo: boolean; grupo: string | null }[];
}
const leer = <T>(f: string) => JSON.parse(readFileSync(new URL(`./precarga/s5/${f}`, import.meta.url), 'utf8')) as T;
const normalizarPlaca = (p: string) => p.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

/** La precarga anterior usaba grupos N1 a N5 y 15 servicios: se retira antes de cargar la nueva (solo datos de demostración). */
async function quitarPrecargaN(prisma: PrismaClient, organizacionId: string) {
  const viejos = await prisma.grupoVehicular.findMany({ where: { organizacionId, codigo: { in: ['N1', 'N2', 'N3', 'N4', 'N5'] } } });
  if (!viejos.length) return;
  const ids = viejos.map((g) => g.id);
  await prisma.vehiculo.updateMany({ where: { grupoId: { in: ids } }, data: { grupoId: null, grupoFuente: null } });
  await prisma.reglaPrecio.deleteMany({ where: { organizacionId } });
  await prisma.reglaAsignacionModelo.deleteMany({ where: { organizacionId } });
  await prisma.familiaMotor.deleteMany({ where: { organizacionId } });
  await prisma.solapamiento.deleteMany({ where: { organizacionId } });
  await prisma.servicio.deleteMany({ where: { organizacionId, codigo: { in: ['ACE', 'AFI', 'BOM', 'BUJ', 'CAB', 'CAD', 'CMP', 'COR', 'EMB', 'ETB', 'IAC', 'MOT', 'RAD', 'REF', 'SCN'] } } });
  await prisma.grupoVehicular.deleteMany({ where: { id: { in: ids } } });
}

export async function precargaS5(prisma: PrismaClient, organizacionId: string) {
  const c = leer<Catalogo>('catalogo_g.json');
  await quitarPrecargaN(prisma, organizacionId);

  const idGrupo: Record<string, string> = {};
  for (const g of c.grupos) {
    const f = await prisma.grupoVehicular.upsert({ where: { organizacionId_codigo: { organizacionId, codigo: g.codigo } }, update: {}, create: { organizacionId, ...g } });
    idGrupo[g.codigo] = f.id;
  }
  for (const f of c.familias) {
    await prisma.familiaMotor.upsert({
      where: { organizacionId_codigo: { organizacionId, codigo: f.codigo } },
      update: {},
      create: { organizacionId, codigo: f.codigo, codigos: f.codigos, combustible: f.combustible, litros: f.litros, turbo: f.turbo, grupoId: f.grupo ? idGrupo[f.grupo] : null },
    });
  }

  // Proveedores y productos sintéticos para demostrar el catálogo y el inventario.
  const proveedores = [
    { documento: '20000000001', nombre: 'Lubricantes Demo S.A.C.', rubro: 'Lubricantes y filtros' },
    { documento: '20000000002', nombre: 'Tornería Demo E.I.R.L.', rubro: 'Tornería (servicio externo)' },
  ];
  const idProv: Record<string, string> = {};
  for (const p of proveedores) {
    const f = await prisma.proveedor.upsert({ where: { organizacionId_documento: { organizacionId, documento: p.documento } }, update: {}, create: { organizacionId, tipoDocumento: 'RUC', ...p } });
    idProv[p.documento] = f.id;
  }
  const locales = await prisma.local.findMany({ where: { organizacionId }, orderBy: { nombre: 'asc' } });
  const productos = [
    { codigo: 'P0001', nombre: 'Aceite de motor 10W-30 (1 galón)', unidad: 'GL', categoria: 'ACEITES', marca: 'Demo', precio: 95, costo: 70, stock: [12, 6] },
    { codigo: 'P0002', nombre: 'Filtro de aceite de motor', unidad: 'UND', categoria: 'FILTROS', marca: 'Demo', precio: 25, costo: 14, stock: [20, 8] },
    { codigo: 'P0003', nombre: 'Bujía de encendido', unidad: 'UND', categoria: 'AFINAMIENTO', marca: 'Demo', precio: 18, costo: 10, stock: [40, 16] },
    { codigo: 'P0004', nombre: 'Elemento del filtro de aire', unidad: 'UND', categoria: 'FILTROS', marca: 'Demo', precio: 35, costo: 20, stock: [10, 4] },
    { codigo: 'P0005', nombre: 'Refrigerante (1 galón)', unidad: 'GL', categoria: 'REFRIGERACION', marca: 'Demo', precio: 40, costo: 26, stock: [8, 3] },
    { codigo: 'P0006', nombre: 'Bomba de agua', unidad: 'UND', categoria: 'REFRIGERACION', marca: 'Demo', precio: 180, costo: 120, stock: [2, 1] },
  ];
  for (const { stock, ...p } of productos) {
    const f = await prisma.producto.upsert({ where: { organizacionId_codigo: { organizacionId, codigo: p.codigo } }, update: {}, create: { organizacionId, ...p, proveedorId: idProv['20000000001'] } });
    for (const [i, l] of locales.entries()) {
      await prisma.stockProducto.upsert({ where: { productoId_localId: { productoId: f.id, localId: l.id } }, update: {}, create: { productoId: f.id, localId: l.id, cantidad: stock[i] ?? 0 } });
    }
  }

  const idServ: Record<string, string> = {};
  for (const x of c.servicios) {
    const f = await prisma.servicio.upsert({
      where: { organizacionId_codigo: { organizacionId, codigo: x.codigo } },
      update: {},
      create: {
        organizacionId, codigo: x.codigo, nombre: x.nombre, categoria: x.categoria, externo: x.externo, trabajoMayor: x.trabajoMayor,
        proveedorId: x.externo && x.nombre.startsWith('Torneria') ? idProv['20000000002'] : null,
        horasEstandar: x.horas ?? 1, horasFuente: x.horas == null ? 'PREDETERMINADA' : 'AUTODATA', precioEstandar: x.precioEstandar,
        preciosGrupo: x.precios, horasGrupo: x.horasGrupo ?? Prisma.DbNull, repuestos: x.repuestos,
      },
    });
    idServ[x.codigo] = f.id;
  }

  // Ejemplo de regla general (inactiva): 5 % de descuento a los servicios de más de S/ 100 en todos los grupos.
  await prisma.reglaPrecio.upsert({
    where: { organizacionId_codigo: { organizacionId, codigo: 'EJ-GLOBAL-DESC5' } }, update: {},
    create: { organizacionId, codigo: 'EJ-GLOBAL-DESC5', nivel: 'GLOBAL', tipo: 'PORCENTAJE', porcentaje: -5, precioDesde: 101, activa: false, nota: 'Ejemplo: 5 % de descuento a los servicios de más de 100 soles' },
  });

  for (const r of c.solapamientos) {
    await prisma.solapamiento.upsert({
      where: { organizacionId_codigo: { organizacionId, codigo: r.codigo } },
      update: {},
      create: {
        organizacionId, codigo: r.codigo, tipo: r.tipo, modo: r.modo, minimo: r.minimo, serviciosBase: r.base.map((x) => idServ[x]), serviciosReducidos: r.reducidos.map((x) => idServ[x]),
        descuentoEstandar: r.estandar, descuentos: r.descuentos, alerta: r.alerta, nota: r.nota, estado: r.estado,
      },
    });
  }

  // Vehículos de prueba: uno o dos por grupo, con el código de motor que define su grupo, y uno sin motor conocido.
  const cliente = await prisma.cliente.upsert({
    where: { organizacionId_documento: { organizacionId, documento: '10000001' } }, update: {},
    create: { organizacionId, documento: '10000001', tipoDocumento: 'DNI', nombre: 'Cliente Demo Grupos', comentario: 'Cliente sintético para probar los grupos G1 a G4.' },
  });
  const demo = [
    ['DEM-101', 'KIA', 'PICANTO', 2017, 'G3LA'], ['DEM-102', 'DAEWOO', 'TICO', 1998, 'F8CV'],
    ['DEM-201', 'HYUNDAI', 'ACCENT', 2015, 'G4FC'],
    ['DEM-301', 'KIA', 'SPORTAGE', 2012, 'G4KD'], ['DEM-302', 'HYUNDAI', 'SANTA FE', 2010, 'G4KE'],
    ['DEM-401', 'HYUNDAI', 'H-1', 2012, 'D4CB'], ['DEM-402', 'MITSUBISHI', 'L200', 2014, '4D56'],
    ['DEM-500', 'TOYOTA', 'YARIS', 2016, null],
  ] as const;
  const fams = await prisma.familiaMotor.findMany({ where: { organizacionId, grupoId: { not: null } } });
  for (const [placa, marca, modelo, anio, motor] of demo) {
    const f = motor ? fams.find((x) => x.codigos.includes(motor)) : undefined;
    await prisma.vehiculo.upsert({
      where: { organizacionId_placaNorm: { organizacionId, placaNorm: normalizarPlaca(placa) } }, update: {},
      create: { organizacionId, clienteId: cliente.id, placa, placaNorm: normalizarPlaca(placa), marca, modelo, anio, nroMotor: motor ? `${motor}H123456` : null, codigoMotor: motor, grupoId: f?.grupoId ?? null, grupoFuente: f ? 'FAMILIA_MOTOR' : null, comentario: 'Vehículo de prueba del grupo' },
    });
  }

  // Vehículos sin grupo: se asignan por la familia de su código de motor (si falta, se toma el número de motor cuando es un código conocido).
  for (const v of await prisma.vehiculo.findMany({ where: { organizacionId, grupoId: null } })) {
    const codigo = (v.codigoMotor ?? v.nroMotor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const f = codigo ? fams.find((x) => x.codigos.includes(codigo)) : undefined;
    if (f) await prisma.vehiculo.update({ where: { id: v.id }, data: { codigoMotor: codigo, grupoId: f.grupoId, grupoFuente: 'FAMILIA_MOTOR' } });
  }
  return { grupos: c.grupos.length, familias: c.familias.length, servicios: c.servicios.length, reglas: 1, solapamientos: c.solapamientos.length, productos: productos.length, proveedores: proveedores.length };
}
