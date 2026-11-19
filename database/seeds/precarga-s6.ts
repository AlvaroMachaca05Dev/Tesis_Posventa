// Precarga del slice S6: catálogo de 99 servicios (93 de la lista de precios y 6 paquetes de visita), 51 reglas de solapamiento y los 8 planes
// de mantenimiento preventivo (combustible × uso × aceite). Se armó con las decisiones del taller; Autodata se usó solo como fuente de consulta.
// Los pasos de cada servicio (acciones a realizar para el técnico) se cargan solo si existe .local/traspaso/01_servicios.json: esa carpeta no se sube a GitHub.
// Retira de uso (sin borrar) el catálogo de la precarga S5. Es idempotente: no pisa precios ni descuentos editados después.
import { Prisma, PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';

interface ServicioJson { codigo: string; nombre: string; categoria: string; etiqueta: string; lineaPlan: string; visita: string; eligeSistema: string | null; precios: Record<string, number | null>; horas: Record<string, number>; externo: boolean; trabajoMayor: boolean; subservicios: { nombre: string; horas: number }[] }
interface SolapeJson { codigo: string; tipo: string; modo: string; base: string[]; reducidos: string[]; minimo: number; porcentaje: number | null; estandar: number; alerta: string | null; estado: string; nota: string | null }
interface PlanJson { codigo: string; nombre: string; combustible: string; uso: string; aceite: string; ciclo: Prisma.InputJsonValue }
const leer = <T>(f: string) => JSON.parse(readFileSync(new URL(`./precarga/s6/${f}`, import.meta.url), 'utf8')) as T;

/** Pasos de Autodata por nombre de servicio, solo en el equipo del investigador. */
function leerPasos(): Map<string, Prisma.InputJsonValue> {
  const ruta = new URL('../../.local/traspaso/01_servicios.json', import.meta.url);
  const m = new Map<string, Prisma.InputJsonValue>();
  if (!existsSync(ruta)) return m;
  for (const s of JSON.parse(readFileSync(ruta, 'utf8')) as { servicio: string; pasos: { operacion?: string[]; pasos_incluidos?: { paso: string; accion: string; pct_fichas: number }[] }[] }[]) {
    if (s.pasos?.length) m.set(s.servicio, s.pasos.map((p) => ({ operacion: (p.operacion ?? []).join(' · '), incluye: (p.pasos_incluidos ?? []).map((x) => ({ paso: x.paso, accion: x.accion, pct: x.pct_fichas })) })));
  }
  return m;
}

export async function precargaS6(prisma: PrismaClient, organizacionId: string) {
  const { servicios } = leer<{ servicios: ServicioJson[] }>('catalogo_rmotriz.json');
  const { solapamientos } = leer<{ solapamientos: SolapeJson[] }>('solapamientos_rmotriz.json');
  const { planes } = leer<{ planes: PlanJson[] }>('planes_rmotriz.json');
  const pasos = leerPasos();

  // El catálogo de la precarga S5 (135 servicios) deja de usarse; sus ODS y notas conservan la referencia.
  const viejos = (JSON.parse(readFileSync(new URL('./precarga/s5/catalogo_g.json', import.meta.url), 'utf8')) as { servicios: { codigo: string }[] }).servicios.map((x) => x.codigo);
  await prisma.servicio.updateMany({ where: { organizacionId, codigo: { in: viejos } }, data: { activo: false } });

  const idServ: Record<string, string> = {};
  for (const x of servicios) {
    const precios = Object.fromEntries(Object.entries(x.precios));
    const lista = Object.values(x.precios).filter((v): v is number => v != null);
    const g1 = x.precios.G1 ?? lista[0] ?? 0;
    const horasEst = Math.max(...Object.values(x.horas));
    const ficha = {
      etiqueta: x.etiqueta, lineaPlan: x.lineaPlan, visita: x.visita, eligeSistema: x.eligeSistema,
      subservicios: x.subservicios.length ? (x.subservicios as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      pasos: pasos.get(x.nombre) ?? Prisma.DbNull,
    };
    const f = await prisma.servicio.upsert({
      where: { organizacionId_codigo: { organizacionId, codigo: x.codigo } },
      update: ficha,
      create: {
        organizacionId, codigo: x.codigo, nombre: x.nombre, categoria: x.categoria, externo: x.externo, trabajoMayor: x.trabajoMayor,
        horasEstandar: horasEst, horasFuente: 'PREDETERMINADA', precioEstandar: g1, preciosGrupo: precios, horasGrupo: x.horas, repuestos: [], ...ficha,
      },
    });
    idServ[x.codigo] = f.id;
  }

  for (const r of solapamientos) {
    const datos = {
      tipo: r.tipo, modo: r.modo, minimo: r.minimo, serviciosBase: r.base.map((c) => idServ[c]), serviciosReducidos: r.reducidos.map((c) => idServ[c]),
      descuentoEstandar: r.estandar, porcentaje: r.porcentaje, descuentos: Prisma.DbNull, alerta: r.alerta, nota: r.nota, estado: r.estado,
    };
    const hay = await prisma.solapamiento.findUnique({ where: { organizacionId_codigo: { organizacionId, codigo: r.codigo } } });
    // Las reglas SOL-01 a SOL-43 de la precarga S5 apuntaban a servicios retirados: se reescriben una sola vez, cuando aún no tienen porcentaje.
    if (!hay) await prisma.solapamiento.create({ data: { organizacionId, codigo: r.codigo, ...datos } });
    else if (hay.serviciosBase.every((i) => !Object.values(idServ).includes(i)) && hay.serviciosReducidos.every((i) => !Object.values(idServ).includes(i))) await prisma.solapamiento.update({ where: { id: hay.id }, data: datos });
  }

  // Ocho planes (combustible × uso × aceite). El ciclo se reescribe si aún tiene la forma anterior (sin «km»).
  for (const p of planes) {
    const hay = await prisma.planPreventivo.findUnique({ where: { organizacionId_codigo: { organizacionId, codigo: p.codigo } } });
    if (!hay) await prisma.planPreventivo.create({ data: { organizacionId, codigo: p.codigo, nombre: p.nombre, combustible: p.combustible, uso: p.uso, aceite: p.aceite, ciclo: p.ciclo } });
    else if ((hay.ciclo as { km?: number }).km === undefined) await prisma.planPreventivo.update({ where: { id: hay.id }, data: { ciclo: p.ciclo, aceite: p.aceite, uso: p.uso } });
    // Profesional con mineral o semisintético pasó a «E, E, menor, E, E, mayor»: se reescribe solo si aún tiene la secuencia anterior.
    else if (['SV094,SV095,SV094,SV095,SV094,SV096+AF', 'SV094,SV095,SV094,SV095,SV094,SV096', 'SV094,SV094,SV095,SV094,SV094,SV096+AF', 'SV094,SV095,SV096+AF', 'SV094,SV095,SV096'].includes(((hay.ciclo as { secuencia?: string[] }).secuencia ?? []).join(','))) await prisma.planPreventivo.update({ where: { id: hay.id }, data: { ciclo: p.ciclo } });
  }
  // Los 4 planes anteriores pasan a su equivalente con aceite mineral o semisintético y luego se eliminan.
  const equivalente: Record<string, [string, string]> = { 'GAS-NORMAL': ['GP-M', 'Particular'], 'GAS-SEVERO': ['GR-M', 'Profesional'], 'DIE-NORMAL': ['DP-M', 'Particular'], 'DIE-SEVERO': ['DR-M', 'Profesional'] };
  for (const [viejo, [nuevo, uso]] of Object.entries(equivalente)) {
    const pv = await prisma.planPreventivo.findUnique({ where: { organizacionId_codigo: { organizacionId, codigo: viejo } } });
    if (!pv) continue;
    const pn = await prisma.planPreventivo.findUniqueOrThrow({ where: { organizacionId_codigo: { organizacionId, codigo: nuevo } } });
    await prisma.vehiculo.updateMany({ where: { planId: pv.id, uso: null }, data: { uso } });
    await prisma.vehiculo.updateMany({ where: { planId: pv.id }, data: { planId: pn.id } });
    await prisma.planPreventivo.deleteMany({ where: { id: pv.id, vehiculos: { none: {} } } });
  }
  // Copias de los planes anteriores (…-COPIA) sin vehículos: ya no aplican.
  await prisma.planPreventivo.deleteMany({ where: { organizacionId, codigo: { contains: '-COPIA' }, vehiculos: { none: {} } } });
  // Vehículos de ejemplo con uso profesional.
  const cliente = await prisma.cliente.findFirst({ where: { organizacionId, documento: '10000001' } });
  if (cliente) {
    for (const [placa, marca, modelo, anio, grupo] of [['DEM-601', 'TOYOTA', 'HILUX', 2015, 'G4'], ['DEM-602', 'HYUNDAI', 'ACCENT', 2018, 'G2']] as const) {
      const g = await prisma.grupoVehicular.findFirst({ where: { organizacionId, codigo: grupo } });
      const norm = placa.replace(/[^A-Z0-9]/g, '');
      const plan = await prisma.planPreventivo.findFirst({ where: { organizacionId, codigo: grupo === 'G4' ? 'DR-M' : 'GR-M' } });
      await prisma.vehiculo.upsert({
        where: { organizacionId_placaNorm: { organizacionId, placaNorm: norm } }, update: {},
        create: { organizacionId, clienteId: cliente.id, placa, placaNorm: norm, marca, modelo, anio, grupoId: g?.id ?? null, grupoFuente: g ? 'MANUAL' : null, uso: 'Profesional', planId: plan?.id ?? null, comentario: 'Vehículo de prueba con uso profesional' },
      });
    }
  }
  // Vehículos con grupo y sin plan: plan provisional particular con aceite mineral o semisintético (G4 = diésel).
  for (const v of await prisma.vehiculo.findMany({ where: { organizacionId, planId: null, grupoId: { not: null } }, include: { grupo: true } })) {
    const p = await prisma.planPreventivo.findFirst({ where: { organizacionId, codigo: v.grupo?.codigo === 'G4' ? 'DP-M' : 'GP-M' } });
    if (p) await prisma.vehiculo.update({ where: { id: v.id }, data: { planId: p.id } });
  }
  // Familias de motor: el combustible sale del grupo cuando no está escrito (G4 es diésel; G1 a G3, gasolina).
  for (const f of await prisma.familiaMotor.findMany({ where: { organizacionId, combustible: null, grupoId: { not: null } }, include: { grupo: true } })) {
    await prisma.familiaMotor.update({ where: { id: f.id }, data: { combustible: f.grupo?.codigo === 'G4' ? 'Diésel' : 'Gasolina' } });
  }
  // Categorías del inventario (de productos y de servicios) a partir de lo que ya existe.
  for (const [tipo, lista] of [['servicio', await prisma.servicio.findMany({ where: { organizacionId }, select: { categoria: true }, distinct: ['categoria'] })], ['producto', await prisma.producto.findMany({ where: { organizacionId, categoria: { not: null } }, select: { categoria: true }, distinct: ['categoria'] })]] as const) {
    for (const c of lista) if (c.categoria) await prisma.categoria.upsert({ where: { organizacionId_tipo_nombre: { organizacionId, tipo, nombre: c.categoria } }, update: {}, create: { organizacionId, tipo, nombre: c.categoria } });
  }
  // El aceite no lleva viscosidad ni presentación en el nombre (depende del kilometraje y del auto; puede ser galón o cuartos).
  const aceite = await prisma.producto.findFirst({ where: { organizacionId, nombre: 'Aceite de motor 10W-30 (1 galón)' } });
  if (aceite) {
    await prisma.producto.update({ where: { id: aceite.id }, data: { nombre: 'Aceite de motor' } });
    for (const sv of await prisma.servicio.findMany({ where: { organizacionId, repuestos: { has: 'Aceite de motor 10W-30 (1 galón)' } } })) await prisma.servicio.update({ where: { id: sv.id }, data: { repuestos: sv.repuestos.map((r) => (r === 'Aceite de motor 10W-30 (1 galón)' ? 'Aceite de motor' : r)) } });
  }
  // Repuestos sugeridos por servicio, con los productos de la precarga (solo si el servicio aún no tiene).
  const sugerencias: [RegExp, string[]][] = [
    [/^Cambio de aceite de motor y filtro/, ['Aceite de motor', 'Filtro de aceite de motor']],
    [/^Cambio o limpieza de bujías/, ['Bujía de encendido']],
    [/^Cambio de filtro de aire/, ['Elemento del filtro de aire']],
    [/^Cambio de refrigerante/, ['Refrigerante (1 galón)']],
    [/^Cambio de bomba de agua/, ['Bomba de agua', 'Refrigerante (1 galón)']],
    [/^Cambio de radiador/, ['Refrigerante (1 galón)']],
  ];
  for (const sv of await prisma.servicio.findMany({ where: { organizacionId, codigo: { startsWith: 'SV' }, repuestos: { isEmpty: true } } })) {
    const r = sugerencias.find(([re]) => re.test(sv.nombre));
    if (r) await prisma.servicio.update({ where: { id: sv.id }, data: { repuestos: r[1] } });
  }
  return { servicios: servicios.length, solapamientos: solapamientos.length, planes: planes.length, conPasos: pasos.size };
}
