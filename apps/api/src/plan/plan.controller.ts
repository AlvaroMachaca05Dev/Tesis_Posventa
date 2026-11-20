import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { aNumero, empresaDe, texto } from '../comun/validacion';
import { A_ELEGIR, categoria, columnasPasadas, Linea, OdsLT, ritmo, sumarMeses, visitasFuturas } from './lineaTemporal';

/** Ciclo de un plan: paso del aceite (km o meses, lo que ocurra primero), secuencia de paquetes y ciclos que muestra la línea de tiempo. */
interface Ciclo { km: number; meses: number; secuencia: string[]; horizonte: number; patron: string }

/** El grupo G4 es diésel; G1 a G3 son gasolina. Sin grupo no se puede sugerir el combustible. */
export const combustibleDeGrupo = (grupo: string | null | undefined) => (grupo === 'G4' ? 'Diésel' : grupo ? 'Gasolina' : null);

/** Tipo de aceite por su nombre: «semi» primero (contiene «sintético»), luego sintético / full / 100 %, luego mineral; si no dice nada, null. */
export function tipoAceite(t: string | null | undefined): 'M' | 'S' | null {
  const s = String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (!s.trim()) return null;
  if (/semi/.test(s)) return 'M';
  if (/sintetico/.test(s)) return 'S';
  if (/mineral/.test(s)) return 'M';
  return null;
}

/** Código del plan: combustible (G/D) + uso (P/R) + aceite (M/S). Sin uso ni aceite: particular y mineral o semisintético. */
export const codigoPlan = (combustible: string | null | undefined, uso: string | null | undefined, aceite: string | null | undefined) =>
  `${combustible === 'Diésel' ? 'D' : 'G'}${uso === 'Profesional' ? 'R' : 'P'}-${tipoAceite(aceite) ?? 'M'}`;

const TOKENS = ['SV094', 'SV095', 'SV096'];

type PlanFila = Prisma.PlanPreventivoGetPayload<{ include: { _count: { select: { vehiculos: true } } } }>;
const resumenPlan = (p: PlanFila, nombres: Map<string, string>) => {
  const c = p.ciclo as unknown as Ciclo;
  return {
    id: p.id, codigo: p.codigo, nombre: p.nombre, combustible: p.combustible, uso: p.uso, aceite: p.aceite, activo: p.activo, vehiculos: p._count.vehiculos,
    km: c.km, meses: c.meses, horizonte: c.horizonte, patron: c.patron, ciclo: c,
    visitas: c.secuencia.map((t) => { const cod = t.replace('+AF', ''); return { codigo: cod, nombre: nombres.get(cod) ?? cod, afinamiento: t.endsWith('+AF') }; }),
  };
};

@Controller()
export class PlanController {
  constructor(private prisma: PrismaService) {}

  private async nombres(organizacionId: string) {
    const sv = await this.prisma.servicio.findMany({ where: { organizacionId, codigo: { startsWith: 'SV' } }, select: { codigo: true, nombre: true } });
    return new Map(sv.map((x) => [x.codigo, x.nombre]));
  }

  /** Los 8 planes (combustible × uso × aceite) con su ciclo de visitas. */
  @Get('planes-preventivos')
  @Requiere('planes', 'V')
  async planes(@SesionActual() s: Sesion) {
    const organizacionId = empresaDe(s);
    const [lista, nombres] = await Promise.all([
      this.prisma.planPreventivo.findMany({ where: { organizacionId }, include: { _count: { select: { vehiculos: true } } }, orderBy: { codigo: 'asc' } }),
      this.nombres(organizacionId),
    ]);
    return lista.map((p) => resumenPlan(p, nombres));
  }

  /** Vehículos sin plan, con el plan que les corresponde por su combustible (grupo), uso y aceite. */
  @Get('planes-preventivos/sin-plan')
  @Requiere('planes', 'V')
  async sinPlan(@SesionActual() s: Sesion) {
    const organizacionId = empresaDe(s);
    const [vehiculos, planes] = await Promise.all([
      this.prisma.vehiculo.findMany({ where: { organizacionId, planId: null }, include: { grupo: true, cliente: true }, orderBy: { placa: 'asc' }, take: 500 }),
      this.prisma.planPreventivo.findMany({ where: { organizacionId, activo: true } }),
    ]);
    return vehiculos.map((v) => {
      const comb = combustibleDeGrupo(v.grupo?.codigo);
      const p = comb ? planes.find((x) => x.codigo === codigoPlan(comb, v.uso, v.aceite)) : undefined;
      return {
        vehiculoId: v.id, placa: v.placa, marca: v.marca, modelo: v.modelo, anio: v.anio, grupo: v.grupo?.codigo ?? null, cliente: v.cliente.nombre,
        sugerencia: p ? { planId: p.id, codigo: p.codigo, nombre: p.nombre } : null,
      };
    });
  }

  /** Editar el plan (nombre y estado) o sus reglas: paso del aceite, secuencia (con afinamiento solo en menor o mayor de gasolina), ciclos y mini patrón. */
  @Patch('planes-preventivos/:id')
  @Requiere('planes', 'E')
  async editar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const antes = await this.prisma.planPreventivo.findFirst({ where: { id, organizacionId } });
    if (!antes) throw new NotFoundException('Plan no encontrado.');
    const d: Prisma.PlanPreventivoUpdateInput = {};
    if (b?.nombre !== undefined) { const n = texto(b.nombre, 80); if (!n) throw new BadRequestException('Escribe el nombre del plan.'); d.nombre = n; }
    if (b?.activo !== undefined) {
      if (typeof b.activo !== 'boolean') throw new BadRequestException('Activo es sí o no.');
      d.activo = b.activo;
    }
    if (b?.ciclo !== undefined) {
      const c = (b.ciclo ?? {}) as Record<string, unknown>;
      const actual = antes.ciclo as unknown as Ciclo;
      const entero = (v: unknown, campo: string, min: number, max: number) => { const n = aNumero(v); if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${campo} no es válido.`); return n; };
      const km = entero(c.km ?? actual.km, 'El kilometraje de la visita', 1000, 50000);
      const meses = entero(c.meses ?? actual.meses, 'Los meses de la visita', 1, 24);
      const horizonte = entero(c.horizonte ?? actual.horizonte, 'Los ciclos de la línea de tiempo', 1, 2);
      const sec = c.secuencia ?? actual.secuencia;
      if (!Array.isArray(sec) || !sec.length || sec.length > 12) throw new BadRequestException('La secuencia lleva de 1 a 12 visitas.');
      const secuencia = sec.map(String);
      for (const t of secuencia) {
        const m = /^(SV09[456])(\+AF)?$/.exec(t), cod = m?.[1] ?? '', af = m?.[2];
        if (!m || !TOKENS.includes(cod)) throw new BadRequestException('La secuencia usa solo servicio express, mantenimiento menor y mantenimiento mayor.');
        if (af && cod === 'SV094') throw new BadRequestException('El afinamiento nunca va con el servicio express.');
        if (af && antes.combustible === 'Diésel') throw new BadRequestException('El diésel no lleva afinamiento.');
      }
      if (meses * secuencia.length * horizonte > 24) throw new BadRequestException('Los ciclos de la línea de tiempo no pueden pasar de 24 meses.');
      d.ciclo = { km, meses, secuencia, horizonte, patron: c.patron !== undefined ? (texto(c.patron, 300) ?? '') : actual.patron } as unknown as Prisma.InputJsonValue;
    }
    const x = await this.prisma.planPreventivo.update({ where: { id }, data: d });
    await auditar(this.prisma, real, s, 'planPreventivo', id, { nombre: antes.nombre, activo: antes.activo, ciclo: antes.ciclo }, { nombre: x.nombre, activo: x.activo, ciclo: x.ciclo }, 'Plan preventivo modificado');
    return { id };
  }

  /** Copia un plan (mismo combustible, uso, aceite y reglas) para probar otra versión sin tocar el original. */
  @Post('planes-preventivos/:id/duplicar')
  @Requiere('planes', 'E')
  async duplicar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string) {
    const organizacionId = empresaDe(s);
    const o = await this.prisma.planPreventivo.findFirst({ where: { id, organizacionId } });
    if (!o) throw new NotFoundException('Plan no encontrado.');
    const base = o.codigo.replace(/-COPIA\d*$/, '');
    let n = 1, codigo = `${base}-COPIA`;
    let x: Awaited<ReturnType<typeof this.prisma.planPreventivo.create>> | null = null;
    // Dos copias simultáneas pueden elegir el mismo código: si el índice único lo rechaza, se prueba el siguiente.
    for (let intento = 0; !x && intento < 25; intento++) {
      while (await this.prisma.planPreventivo.findFirst({ where: { organizacionId, codigo } })) codigo = `${base}-COPIA${++n}`;
      try {
        x = await this.prisma.planPreventivo.create({ data: { organizacionId, codigo, nombre: `${o.nombre.replace(/ \(copia( \d+)?\)$/, '')} (copia${n > 1 ? ' ' + n : ''})`, combustible: o.combustible, uso: o.uso, aceite: o.aceite, ciclo: o.ciclo as Prisma.InputJsonValue, activo: true } });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        codigo = `${base}-COPIA${++n}`;
      }
    }
    if (!x) throw new ConflictException('No se pudo copiar el plan: intenta de nuevo.');
    await auditar(this.prisma, real, s, 'planPreventivo', x.id, null, { codigo: x.codigo, desde: o.codigo }, 'Plan preventivo duplicado');
    return { id: x.id, codigo: x.codigo };
  }

  @Delete('planes-preventivos/:id')
  @Requiere('planes', 'E')
  async eliminar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string) {
    const antes = await this.prisma.planPreventivo.findFirst({ where: { id, organizacionId: empresaDe(s) }, include: { _count: { select: { vehiculos: true } } } });
    if (!antes) throw new NotFoundException('Plan no encontrado.');
    if (antes._count.vehiculos > 0) throw new ConflictException(`El plan lo usan ${antes._count.vehiculos} vehículo(s): cámbiales el uso o el aceite antes de eliminarlo.`);
    await this.prisma.planPreventivo.delete({ where: { id } });
    await auditar(this.prisma, real, s, 'planPreventivo', id, { nombre: antes.nombre }, null, 'Plan preventivo eliminado');
    return { ok: true };
  }

  /** Asigna (o quita) el plan vigente de un vehículo. */
  @Patch('vehiculos/:id/plan')
  @Requiere('planes', 'E')
  async asignar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const v = await this.prisma.vehiculo.findFirst({ where: { id, organizacionId } });
    if (!v) throw new NotFoundException('Vehículo no encontrado.');
    const planId = b?.planId == null || b.planId === '' ? null : String(b.planId);
    if (planId) {
      const p = await this.prisma.planPreventivo.findFirst({ where: { id: planId, organizacionId, activo: true } });
      if (!p) throw new BadRequestException('El plan no existe o está inactivo.');
    }
    await this.prisma.vehiculo.update({ where: { id }, data: { planId } });
    await auditar(this.prisma, real, s, 'vehiculo', id, { planId: v.planId }, { planId }, planId ? 'Plan preventivo asignado' : 'Plan preventivo quitado');
    return { id, planId };
  }

  /** Línea de tiempo del vehículo: visitas reales por mes y visitas del plan proyectadas, con lo que lleva cada una y su precio por paquete. */
  @Get('vehiculos/:id/linea-temporal')
  @Requiere('timeline', 'V')
  async lineaTemporal(@SesionActual() s: Sesion, @Param('id') id: string, @Query('uso') usoB?: string, @Query('aceite') aceiteB?: string) {
    const organizacionId = empresaDe(s);
    const v = await this.prisma.vehiculo.findFirst({ where: { id, organizacionId }, include: { grupo: true, plan: true, cliente: true, lecturas: { orderBy: { fecha: 'desc' }, take: 10 } } });
    if (!v) throw new NotFoundException('Vehículo no encontrado.');
    const sv = await this.prisma.servicio.findMany({ where: { organizacionId, codigo: { in: ['SV094', 'SV095', 'SV096', 'SV071', 'SV072'] } } });
    const lista = (cod: string): Linea[] => ((sv.find((x) => x.codigo === cod)?.subservicios as { nombre: string; horas: number }[] | null) ?? []).map((x) => ({ n: x.nombre, h: x.horas, c: categoria(x.nombre) }));
    const paquetes: Record<string, Linea[]> = { SV094: lista('SV094'), SV095: lista('SV095'), SV096: lista('SV096') };
    const afin: Linea[] = [];
    for (const l of [...lista('SV071'), ...lista('SV072')]) if (!afin.some((a) => a.n === l.n)) afin.push({ ...l, ...(A_ELEGIR.includes(l.n) ? { alt: 'afin' } : {}) });
    const grupo = v.grupo?.codigo ?? null;
    const precio = (cod: string) => { const x = sv.find((y) => y.codigo === cod); if (!x) return null; const pg = (x.preciosGrupo ?? {}) as Record<string, number | null>; return { id: x.id, codigo: x.codigo, nombre: x.nombre, horas: Number(x.horasEstandar ?? 0), precio: (grupo && pg[grupo] != null ? pg[grupo] : Number(x.precioEstandar ?? 0)) as number } };
    const ordenes = await this.prisma.ordenServicio.findMany({ where: { organizacionId, vehiculoId: id, eliminada: false }, include: { detalles: { orderBy: { posicion: 'asc' } } }, orderBy: { fechaInicio: 'asc' } });
    const ods: OdsLT[] = ordenes.map((o) => ({ id: o.id, codigo: o.codigo, fecha: (o.fechaCierre ?? o.fechaInicio).toISOString().slice(0, 10), km: o.km, servicios: o.detalles.filter((d) => d.tipo === 'servicio').map((d) => d.descripcion), productos: o.detalles.filter((d) => d.tipo !== 'servicio').map((d) => d.descripcion) }));
    const pasadas = columnasPasadas(ods, paquetes);
    const visitas = pasadas.filter((c) => c.paquete && c.km != null), ult = visitas.at(-1) ?? pasadas.filter((c) => c.km != null).at(-1) ?? null;
    const puntos = [...ods.filter((o) => o.km != null).map((o) => ({ km: o.km as number, fecha: o.fecha })), ...v.lecturas.map((l) => ({ km: l.km, fecha: l.fecha.toISOString().slice(0, 10) }))];
    const rate = ritmo(puntos), hoy = new Date().toISOString().slice(0, 10);
    const ultimo = puntos.sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1) ?? null;
    const kmHoy = ultimo ? Math.round(ultimo.km + (rate * (new Date(hoy).getTime() - new Date(ultimo.fecha).getTime())) / 86400000 / 30.4375) : 0;
    // Sin plan guardado: el que corresponde a su combustible (grupo), uso y aceite; queda «por confirmar».
    // Borrador (solo si el vehículo aún no tiene uso y aceite guardados): recalcula con lo que la cajera está probando, sin guardar.
    const borrador = !(v.uso && v.aceite) && (usoB !== undefined || aceiteB !== undefined);
    if (borrador && ((usoB && !['Particular', 'Profesional'].includes(usoB)) || (aceiteB && !['Mineral', 'Semisintético', 'Sintético', 'Full sintético'].includes(aceiteB)))) throw new BadRequestException('El uso o el tipo de aceite no es válido.');
    const p = borrador ? await this.prisma.planPreventivo.findFirst({ where: { organizacionId, activo: true, codigo: codigoPlan(combustibleDeGrupo(grupo) ?? 'Gasolina', usoB || v.uso, aceiteB || v.aceite) } })
      : v.plan ?? (await this.prisma.planPreventivo.findFirst({ where: { organizacionId, activo: true, codigo: codigoPlan(combustibleDeGrupo(grupo) ?? 'Gasolina', v.uso, v.aceite) } }));
    const ciclo = p ? (p.ciclo as unknown as Ciclo) : null;
    const futuras = p && ciclo && ult ? visitasFuturas({ codigo: p.codigo, km: ciclo.km, meses: ciclo.meses, secuencia: ciclo.secuencia, horizonte: ciclo.horizonte }, { aceite0: { km: ult.km as number, fecha: ult.fecha }, paqueteUltimo: ult.paquete, rate, hoy, kmHoy, uso: p.uso })
      .map((x) => { const base = paquetes[x.paquete] ?? []; return { ...x, nombre: sv.find((y) => y.codigo === x.paquete)?.nombre ?? x.paquete, lineas: x.afinamiento ? [...base, ...afin.filter((a) => !base.some((b) => b.n === a.n))] : base }; }) : [];
    const ultOds = ods.filter((o) => o.km != null).at(-1) ?? null;
    // Tramos: el plan inicial y cada cambio guardado; una columna pertenece al tramo cuyo corte es anterior a su fecha.
    const cambios = await this.prisma.cambioPlanVehiculo.findMany({ where: { vehiculoId: id }, orderBy: { creadoEn: 'asc' } });
    const ini = pasadas[0];
    const tramos = [{ codigo: cambios[0]?.antes ?? p?.codigo ?? null, desde: ini ? { fecha: ini.fecha, km: ini.km } : null, corte: null as string | null, por: null as string | null, hasta: null as string | null },
      ...cambios.map((c) => ({ codigo: c.despues, desde: { fecha: c.creadoEn.toISOString().slice(0, 10), km: c.km }, corte: c.corte, por: c.usuario, hasta: null as string | null }))];
    tramos.forEach((t, i) => { const n = tramos[i + 1]; if (n) t.hasta = ods.filter((o) => o.fecha <= (n.corte as string)).at(-1)?.codigo ?? null; });
    return {
      vehiculo: { id: v.id, placa: v.placa, marca: v.marca, modelo: v.modelo, anio: v.anio, uso: v.uso, aceite: v.aceite, grupo, cliente: { id: v.cliente.id, nombre: v.cliente.nombre, telefono: v.cliente.movil ?? null } },
      plan: p && ciclo ? { id: p.id, codigo: p.codigo, nombre: p.nombre, combustible: p.combustible, uso: p.uso, aceite: p.aceite, km: ciclo.km, meses: ciclo.meses, visitas: ciclo.secuencia.length, horizonte: ciclo.horizonte } : null,
      porConfirmar: !v.uso || !v.aceite || !v.planId,
      resumen: { ultimaVisita: ultOds ? { km: ultOds.km, fecha: ultOds.fecha, codigo: ultOds.codigo } : null, kmHoy, rate, hoy },
      pasadas, futuras, tramos,
      asignado: !!(v.uso && v.aceite),
      precios: Object.fromEntries(['SV094', 'SV095', 'SV096', 'SV071', 'SV072'].map((c) => [c, precio(c)])),
      categorias: [...new Set([...pasadas.flatMap((c) => c.esperadas), ...futuras.flatMap((f) => f.lineas)].map((l) => l.c))],
    };
  }

  /** Línea genérica de un plan (sin vehículo): arranca en 0 km o en el último cambio de aceite simulado; sirve para atender a quien aún no da sus datos. */
  @Get('planes-preventivos/:codigo/linea-generica')
  @Requiere('timeline', 'V')
  async lineaGenerica(@SesionActual() s: Sesion, @Param('codigo') codigo: string, @Query('km') kmQ?: string, @Query('aceite') aceiteQ?: string, @Query('fecha') fechaQ?: string, @Query('grupo') grupoQ?: string) {
    const organizacionId = empresaDe(s);
    if (!/^[GD][PR]-[MS]$/.test(codigo)) throw new BadRequestException('El código del plan no es válido.');
    const p = await this.prisma.planPreventivo.findFirst({ where: { organizacionId, codigo, activo: true } });
    if (!p) throw new NotFoundException('Plan no encontrado.');
    const num = (v: string | undefined, campo: string) => { if (v === undefined || v === '') return null; const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > 3_000_000) throw new BadRequestException(`${campo} no es válido.`); return n; };
    const km = num(kmQ, 'El kilometraje'), aceite = num(aceiteQ, 'El último cambio de aceite');
    if (km != null && aceite != null && aceite > km) throw new BadRequestException('El último cambio de aceite no puede ser mayor que el kilometraje actual.');
    const hoy = new Date().toISOString().slice(0, 10);
    if (fechaQ !== undefined && fechaQ !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(fechaQ) || fechaQ > hoy)) throw new BadRequestException('La fecha del cambio de aceite no es válida.');
    const c = p.ciclo as unknown as Ciclo;
    const sv = await this.prisma.servicio.findMany({ where: { organizacionId, codigo: { in: ['SV094', 'SV095', 'SV096', 'SV071', 'SV072'] } } });
    const lista = (cod: string): Linea[] => ((sv.find((x) => x.codigo === cod)?.subservicios as { nombre: string; horas: number }[] | null) ?? []).map((x) => ({ n: x.nombre, h: x.horas, c: categoria(x.nombre) }));
    const paquetes: Record<string, Linea[]> = { SV094: lista('SV094'), SV095: lista('SV095'), SV096: lista('SV096') };
    const afin: Linea[] = [];
    for (const l of [...lista('SV071'), ...lista('SV072')]) if (!afin.some((a) => a.n === l.n)) afin.push({ ...l, ...(A_ELEGIR.includes(l.n) ? { alt: 'afin' } : {}) });
    const kmAct = km ?? 0, kmAc = aceite ?? (km != null ? Math.floor(kmAct / c.km) * c.km : 0);
    const fechaAc = fechaQ || sumarMeses(hoy, -Math.max(0, kmAct - kmAc) / (c.km / c.meses));
    const pos0 = Math.round(kmAc / c.km) % c.secuencia.length;
    const sec = [...c.secuencia.slice(pos0), ...c.secuencia.slice(0, pos0)];
    const futuras = visitasFuturas({ codigo: p.codigo, km: c.km, meses: c.meses, secuencia: sec, horizonte: c.horizonte }, { aceite0: { km: kmAc, fecha: fechaAc }, paqueteUltimo: null, rate: 0, hoy, kmHoy: km ?? -1, uso: p.uso })
      .map((x) => { const base = paquetes[x.paquete] ?? []; return { ...x, nombre: sv.find((y) => y.codigo === x.paquete)?.nombre ?? x.paquete, lineas: x.afinamiento ? [...base, ...afin.filter((a) => !base.some((b) => b.n === a.n))] : base }; });
    const grupo = grupoQ && /^G[1-4]$/.test(grupoQ) ? grupoQ : p.combustible === 'Diésel' ? 'G4' : 'G1';
    const precio = (cod: string) => { const x = sv.find((y) => y.codigo === cod); if (!x) return null; const pg = (x.preciosGrupo ?? {}) as Record<string, number | null>; return { id: x.id, codigo: x.codigo, nombre: x.nombre, horas: Number(x.horasEstandar ?? 0), precio: (pg[grupo] ?? Number(x.precioEstandar ?? 0)) as number }; };
    return {
      vehiculo: null,
      plan: { id: p.id, codigo: p.codigo, nombre: p.nombre, combustible: p.combustible, uso: p.uso, aceite: p.aceite, km: c.km, meses: c.meses, visitas: c.secuencia.length, horizonte: c.horizonte },
      porConfirmar: false, asignado: true,
      resumen: { ultimaVisita: null, ultimoAceite: { km: kmAc, fecha: fechaAc }, kmHoy: kmAct, rate: 0, hoy, simulado: km != null },
      pasadas: [], futuras, tramos: [{ codigo: p.codigo, desde: { fecha: fechaAc, km: kmAc }, corte: null, por: null, hasta: null }],
      precios: Object.fromEntries(['SV094', 'SV095', 'SV096', 'SV071', 'SV072'].map((x) => [x, precio(x)])),
      categorias: [...new Set(futuras.flatMap((f) => f.lineas).map((l) => l.c))],
    };
  }
}
