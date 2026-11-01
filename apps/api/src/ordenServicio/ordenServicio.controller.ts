import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma, PrismaClient } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { KM_MAXIMO } from '../vehiculo/vehiculo.reglas';

const fechaFiltro = (t: string | undefined, fin: boolean) => {
  if (!t) return undefined;
  const f = new Date(t + (fin ? 'T23:59:59.999' : 'T00:00:00'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(f.getTime())) throw new BadRequestException('Fecha de filtro no válida (usa AAAA-MM-DD).');
  return f;
};
const kmValido = (v: unknown) => {
  if (v === undefined || v === null || v === '') return null;
  const km = Number(v);
  if (!Number.isInteger(km) || km < 0 || km > KM_MAXIMO) throw new BadRequestException('El kilometraje debe ser un número entero entre 0 y 3 000 000.');
  return km;
};
const textoLibre = (v: unknown, max = 1000) => {
  const t = String(v ?? '').trim();
  if (t.length > max) throw new BadRequestException(`El texto supera los ${max} caracteres.`);
  return t || null;
};

export const TIPOS_ATENCION = ['Mantenimiento preventivo', 'Mantenimiento correctivo', 'Preventivo y correctivo', 'Auxilio mecánico', 'Evaluación y diagnóstico', 'Garantía', 'Siniestro', 'Inspección 360', 'Inspección por compra', 'Otro'];
export const DECISIONES = ['Pendiente de aprobación', 'Aprobada para cotizar', 'Aprobada para comprar', 'No aprobada'];
export const ESTADOS = [
  { id: 'Recepcion', nombre: 'Recepción' },
  { id: 'EnProceso', nombre: 'En proceso' },
  { id: 'Entrega', nombre: 'Entrega' },
  { id: 'Cerrada', nombre: 'Cerrado' },
];
const METODOS = ['Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta', 'Otro'];
const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const r3 = (x: number) => Math.round((x + Number.EPSILON) * 1000) / 1000;
const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? null : Number(d));

const INCLUIR = {
  cliente: true,
  vehiculo: true,
  tecnico: true,
  jefeTaller: true,
  creadoPor: true,
  detalles: { orderBy: { posicion: 'asc' as const } },
  abonos: { orderBy: { fecha: 'asc' as const } },
  bitacora: { orderBy: { fecha: 'desc' as const }, include: { actor: true } },
  evidencias: { orderBy: { creadoEn: 'asc' as const }, select: { id: true, nombre: true, tipo: true, tamano: true, creadoEn: true } },
};
// Evidencias de ingreso (RF-015): fotos y videos, hasta 25 MB cada uno y 20 por ODS.
const EVIDENCIA_MAX_BYTES = 25 * 1024 * 1024;
const EVIDENCIA_MAX_POR_ODS = 20;
/** Lista de chequeo del estado del vehículo: solo textos cortos, sí/no y listas de opciones. */
function estadoVehiculoValido(v: unknown) {
  if (v === null) return Prisma.DbNull;
  if (typeof v !== 'object' || Array.isArray(v) || JSON.stringify(v).length > 5000) throw new BadRequestException('El estado del vehículo no es válido.');
  const limpio: Record<string, string | string[]> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[a-zA-Z]{1,30}$/.test(k)) continue;
    if (typeof x === 'string') limpio[k] = x.slice(0, 500);
    else if (Array.isArray(x)) limpio[k] = x.filter((y) => typeof y === 'string').slice(0, 30).map((y) => (y as string).slice(0, 60));
  }
  return limpio;
}
type Orden = Prisma.OrdenServicioGetPayload<{ include: typeof INCLUIR }>;
const persona = (u: { id: string; nombre: string } | null) => (u ? { id: u.id, nombre: u.nombre } : null);

function resumen(o: Orden) {
  const detalles = o.detalles.map((d) => ({
    id: d.id, tipo: d.tipo, descripcion: d.descripcion, referencia: d.referencia, cantidad: num(d.cantidad), costo: num(d.costo), rentabilidadPct: num(d.rentabilidadPct),
    precio: num(d.precio), descuentoPct: num(d.descuentoPct), impuesto: d.impuesto, total: num(d.total), tecnicoId: d.tecnicoId,
  }));
  const total = r2(detalles.reduce((a, d) => a + (d.total ?? 0), 0));
  const abonos = o.abonos.map((a) => ({ id: a.id, fecha: a.fecha.toISOString(), metodo: a.metodo, concepto: a.concepto, valor: num(a.valor) as number }));
  const totalAbonos = r2(abonos.reduce((a, x) => a + x.valor, 0));
  const ultima = o.bitacora[0];
  return {
    id: o.id, codigo: o.codigo, externa: o.externa, estado: o.estado, decision: o.decision, tipoAtencion: o.tipoAtencion,
    fechaInicio: o.fechaInicio.toISOString(), fechaCierre: o.fechaCierre?.toISOString() ?? null, km: o.km,
    observaciones: o.observaciones, recomendaciones: o.recomendaciones,
    cliente: { id: o.cliente.id, nombre: o.cliente.nombre, documento: o.cliente.documento, tipoDocumento: o.cliente.tipoDocumento },
    vehiculo: { id: o.vehiculo.id, placa: o.vehiculo.placa, marca: o.vehiculo.marca, modelo: o.vehiculo.modelo, anio: o.vehiculo.anio, color: o.vehiculo.color, nroSerie: o.vehiculo.nroSerie, nroVin: o.vehiculo.nroVin, nroMotor: o.vehiculo.nroMotor },
    tecnico: persona(o.tecnico), jefeTaller: persona(o.jefeTaller), creadoPor: persona(o.creadoPor),
    detalles, total, abonos, totalAbonos, pendiente: r2(total - totalAbonos),
    estadoVehiculo: (o.estadoVehiculo ?? null) as Record<string, string | string[]> | null,
    evidencias: o.evidencias.map((e) => ({ id: e.id, nombre: e.nombre, tipo: e.tipo, tamano: e.tamano, fecha: e.creadoEn.toISOString() })),
    // Los comprobantes (notas de venta, boletas y facturas) llegan con el slice comercial.
    comprobantes: [] as string[], conComprobante: false,
    ultimaBitacora: ultima ? { texto: ultima.texto, fecha: ultima.fecha.toISOString(), actor: ultima.actor.nombre } : null,
    bitacora: o.bitacora.slice(0, 20).map((b) => ({ texto: b.texto, fecha: b.fecha.toISOString(), actor: b.actor.nombre })),
  };
}

/** Línea de la ODS: precio final con el impuesto incluido. En un servicio la cantidad son H-H y no multiplican el precio (decisión R5);
 *  en un producto, total = cantidad × precio. Siempre menos el descuento y a 2 decimales. */
function linea(d: Record<string, unknown>, i: number) {
  const descripcion = String(d.descripcion ?? '').trim();
  if (!descripcion || descripcion.length > 300) throw new BadRequestException(`Ítem ${i + 1}: escribe el detalle (hasta 300 caracteres).`);
  const tipo = d.tipo === 'producto' ? 'producto' : 'servicio';
  const cantidad = r3(Number(d.cantidad ?? 1));
  const precio = r3(Number(d.precio ?? 0));
  const descuentoPct = r3(Number(d.descuentoPct ?? 0));
  const costo = d.costo === undefined || d.costo === null || d.costo === '' ? null : r3(Number(d.costo));
  const rentabilidadPct = d.rentabilidadPct === undefined || d.rentabilidadPct === null || d.rentabilidadPct === '' ? null : r3(Number(d.rentabilidadPct));
  if (![cantidad, precio, descuentoPct].every(Number.isFinite) || cantidad <= 0 || cantidad > 100000 || precio < 0 || precio > 10_000_000 || descuentoPct < 0 || descuentoPct > 100 || (costo != null && (!Number.isFinite(costo) || costo < 0))) {
    throw new BadRequestException(`Ítem ${i + 1}: cantidad, precio, costo o descuento no válidos.`);
  }
  const impuesto = d.impuesto === 'NINGUNO' ? 'NINGUNO' : 'IGV';
  const total = r2((tipo === 'servicio' ? 1 : cantidad) * precio * (1 - descuentoPct / 100));
  return { id: typeof d.id === 'string' ? d.id : undefined, posicion: i, tipo, descripcion, referencia: String(d.referencia ?? '').trim() || null, cantidad, precio, descuentoPct, costo, rentabilidadPct, impuesto, total, tecnicoId: typeof d.tecnicoId === 'string' && d.tecnicoId ? d.tecnicoId : null };
}

@Controller('ordenes')
export class OrdenesController {
  constructor(private prisma: PrismaService) {}

  private empresa(s: Sesion) {
    if (!s.organizacionId) throw new BadRequestException('Esta acción es de una empresa. Usa «Ver como…» para entrar como un usuario de la empresa.');
    return s.organizacionId;
  }

  private async cargar(id: string, organizacionId: string) {
    const o = await this.prisma.ordenServicio.findFirst({ where: { id, organizacionId, eliminada: false }, include: INCLUIR });
    if (!o) throw new NotFoundException('Orden de servicio no encontrada.');
    return o;
  }

  private bitacora(db: Prisma.TransactionClient | PrismaClient, ordenId: string, real: Sesion, texto: string) {
    return db.bitacora.create({ data: { ordenId, actorId: real.id, texto } });
  }

  /** Hasta dos ODS abiertas por vehículo y, como máximo, una de Garantía (DEC-71). Dentro de una transacción se bloquea el vehículo para que dos pedidos simultáneos no pasen el límite. */
  private async limiteVehiculo(vehiculoId: string, tipoAtencion: string, exceptoId?: string, db: Prisma.TransactionClient | PrismaClient = this.prisma) {
    if (db !== this.prisma) await db.$queryRaw`SELECT id FROM "Vehiculo" WHERE id = ${vehiculoId} FOR UPDATE`;
    const abiertas = await db.ordenServicio.findMany({ where: { vehiculoId, eliminada: false, estado: { not: 'Cerrada' }, ...(exceptoId ? { id: { not: exceptoId } } : {}) } });
    if (tipoAtencion === 'Garantía' && abiertas.some((o) => o.tipoAtencion === 'Garantía')) {
      throw new ConflictException('Por si acaso, ya existe una orden de servicio de tipo Garantía abierta para este vehículo: solo puedes crear una de cualquier otro tipo de atención.');
    }
    if (abiertas.length >= 2) throw new ConflictException('El vehículo ya tiene dos órdenes de servicio abiertas. Cierra una antes de crear otra.');
    if (abiertas.length === 1 && tipoAtencion !== 'Garantía' && abiertas[0].tipoAtencion !== 'Garantía') {
      throw new ConflictException(`El vehículo ya tiene abierta la ODS ${abiertas[0].codigo}. Una segunda orden abierta solo puede ser de tipo Garantía.`);
    }
  }

  /** El técnico debe tener rol Técnico o Jefe de taller; el jefe, rol Jefe de taller. */
  private async persona(organizacionId: string, id: unknown, cual: 'técnico' | 'jefe de taller') {
    if (id === null || id === '') return null;
    const roles = cual === 'técnico' ? ['Técnico', 'Jefe de taller'] : ['Jefe de taller'];
    const u = await this.prisma.usuario.findFirst({ where: { id: String(id), organizacionId, activo: true, roles: { some: { rol: { nombre: { in: roles } } } } } });
    if (!u) throw new BadRequestException(`Elige un ${cual} válido de la empresa.`);
    return u.id;
  }

  @Get('catalogos')
  @Requiere('ods', 'V')
  async catalogos(@SesionActual() s: Sesion) {
    const organizacionId = this.empresa(s);
    const usuarios = await this.prisma.usuario.findMany({ where: { organizacionId, activo: true }, include: { roles: { include: { rol: true } } }, orderBy: { nombre: 'asc' } });
    const con = (nombre: string) => usuarios.filter((u) => u.roles.some((r) => r.rol.nombre === nombre)).map((u) => ({ id: u.id, nombre: u.nombre }));
    return { tiposAtencion: TIPOS_ATENCION, decisiones: DECISIONES, estados: ESTADOS, metodosPago: METODOS, tecnicos: [...con('Técnico'), ...con('Jefe de taller')], jefes: con('Jefe de taller') };
  }

  @Get()
  @Requiere('ods', 'V')
  async lista(@SesionActual() s: Sesion, @Query() f: { estado?: string; q?: string; clienteId?: string; vehiculoId?: string; desde?: string; hasta?: string; n?: string }) {
    const organizacionId = this.empresa(s);
    const where: Prisma.OrdenServicioWhereInput = { organizacionId, eliminada: false };
    if (f.estado) where.estado = f.estado;
    if (f.clienteId) where.clienteId = f.clienteId;
    if (f.vehiculoId) where.vehiculoId = f.vehiculoId;
    const desde = fechaFiltro(f.desde, false), hasta = fechaFiltro(f.hasta, true);
    if (desde || hasta) where.fechaInicio = { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) };
    const q = String(f.q ?? '').trim();
    if (q) {
      const c = { contains: q, mode: 'insensitive' as const };
      where.OR = [{ codigo: c }, { cliente: { nombre: c } }, { cliente: { documento: c } }, { vehiculo: { placaNorm: { contains: q.replace(/[^A-Za-z0-9]/g, '').toUpperCase() } } }];
    }
    const lista = await this.prisma.ordenServicio.findMany({ where, include: INCLUIR, orderBy: { fechaInicio: 'desc' }, take: Math.min(Number(f.n) || 50, 200) });
    return lista.map(resumen);
  }

  @Get(':id')
  @Requiere('ods', 'V')
  async una(@SesionActual() s: Sesion, @Param('id') id: string) {
    return resumen(await this.cargar(id, this.empresa(s)));
  }

  @Post()
  @Requiere('ods', 'E')
  async crear(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = this.empresa(s);
    const v = b?.vehiculoId ? await this.prisma.vehiculo.findFirst({ where: { id: String(b.vehiculoId), organizacionId } }) : null;
    if (!v) throw new NotFoundException('Vehículo no encontrado.');
    const tipoAtencion = String(b.tipoAtencion ?? '').trim();
    if (!TIPOS_ATENCION.includes(tipoAtencion)) throw new BadRequestException('Elige un tipo de atención de la lista.');
    const localId = s.localId ?? (await this.prisma.local.findFirst({ where: { organizacionId }, orderBy: { nombre: 'asc' } }))?.id;
    if (!localId) throw new BadRequestException('La empresa no tiene locales.');
    const tecnicoId = b.tecnicoId ? await this.persona(organizacionId, b.tecnicoId, 'técnico') : null;
    const jefeTallerId = b.jefeTallerId ? await this.persona(organizacionId, b.jefeTallerId, 'jefe de taller') : null;
    const km = kmValido(b.km);
    const observaciones = textoLibre(b.observaciones);
    const recomendaciones = textoLibre(b.recomendaciones);
    // El número lo da el servidor en una transacción: gana quien presiona «Crear» primero y ningún número se repite ni se reutiliza.
    const o = await this.prisma.$transaction(async (tx) => {
      await this.limiteVehiculo(v.id, tipoAtencion, undefined, tx);
      const c = await tx.correlativoODS.upsert({ where: { organizacionId }, create: { organizacionId, ultimo: 1 }, update: { ultimo: { increment: 1 } } });
      const hoy = new Date();
      const fecha = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;
      const nueva = await tx.ordenServicio.create({
        data: {
          organizacionId, vehiculoId: v.id, clienteId: v.clienteId, localId, codigo: fecha + String(c.ultimo).padStart(5, '0'), correlativo: c.ultimo, tipoAtencion, km, tecnicoId, jefeTallerId,
          creadoPorId: real.id, observaciones, recomendaciones,
        },
      });
      await this.bitacora(tx, nueva.id, real, `ODS ${nueva.codigo} creada (${tipoAtencion}).`);
      if (km !== null) await tx.lecturaKm.create({ data: { vehiculoId: v.id, km, fecha: hoy, fuente: 'ODS', observacion: `ODS ${nueva.codigo}` } });
      return nueva;
    });
    const res = resumen(await this.cargar(o.id, organizacionId));
    await auditar(this.prisma, real, s, 'orden_servicio', o.id, null, { codigo: res.codigo, vehiculo: res.vehiculo.placa }, 'ODS creada');
    return res;
  }

  @Patch(':id')
  @Requiere('ods', 'E')
  async editar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = this.empresa(s);
    const o = await this.cargar(id, organizacionId);
    const d: Prisma.OrdenServicioUncheckedUpdateInput = {};
    const notas: string[] = [];
    if (b.decision !== undefined) {
      if (!DECISIONES.includes(String(b.decision))) throw new BadRequestException('Decisión no válida.');
      const quedaCerrada = (b.estado ?? o.estado) === 'Cerrada';
      if (quedaCerrada && b.decision !== 'No aprobada') throw new ConflictException('Una ODS cerrada sin nota de venta debe seguir «No aprobada». Reábrela antes de cambiar la decisión.');
      if (b.decision !== o.decision) { d.decision = String(b.decision); notas.push(`Decisión del cliente: ${o.decision} → ${b.decision}.`); }
    }
    if (b.tipoAtencion !== undefined && b.tipoAtencion !== o.tipoAtencion) {
      const t = String(b.tipoAtencion).trim();
      if (!TIPOS_ATENCION.includes(t)) throw new BadRequestException('Elige un tipo de atención de la lista.');
      if (o.estado !== 'Cerrada') await this.limiteVehiculo(o.vehiculoId, t, o.id);
      d.tipoAtencion = t;
    }
    if (b.vehiculoId !== undefined && b.vehiculoId !== o.vehiculoId) {
      const v = await this.prisma.vehiculo.findFirst({ where: { id: String(b.vehiculoId), organizacionId } });
      if (!v) throw new NotFoundException('Vehículo no encontrado.');
      await this.limiteVehiculo(v.id, String(d.tipoAtencion ?? o.tipoAtencion), o.id);
      d.vehiculoId = v.id;
      d.clienteId = v.clienteId;
    }
    if (b.km !== undefined) {
      d.km = kmValido(b.km);
    }
    if (b.tecnicoId !== undefined) d.tecnicoId = await this.persona(organizacionId, b.tecnicoId, 'técnico');
    if (b.jefeTallerId !== undefined) d.jefeTallerId = await this.persona(organizacionId, b.jefeTallerId, 'jefe de taller');
    for (const k of ['observaciones', 'recomendaciones'] as const) if (b[k] !== undefined) d[k] = textoLibre(b[k]);
    if (b.estadoVehiculo !== undefined) {
      d.estadoVehiculo = estadoVehiculoValido(b.estadoVehiculo);
      notas.push('Estado del vehículo actualizado.');
    }
    // Corregir la fecha de inicio o de cierre (orden creada o cerrada tarde) es solo del Superadministrador; queda en la bitácora.
    if (b.fechaInicio !== undefined || b.fechaCierre !== undefined) {
      if (!s.roles.includes('Superadministrador')) throw new ForbiddenException('Solo el Superadministrador corrige las fechas de inicio y de cierre.');
      const leer = (v: unknown, nombre: string) => {
        const f = new Date(String(v));
        if (Number.isNaN(f.getTime()) || f.getTime() > Date.now() + 86_400_000) throw new BadRequestException(`La fecha de ${nombre} no es válida.`);
        return f;
      };
      const ini = b.fechaInicio !== undefined ? leer(b.fechaInicio, 'inicio') : o.fechaInicio;
      let cie = o.fechaCierre;
      if (b.fechaCierre !== undefined) {
        if (o.estado !== 'Cerrada') throw new ConflictException('La fecha de cierre solo se corrige en una ODS cerrada.');
        cie = leer(b.fechaCierre, 'cierre');
      }
      if (cie && cie < ini) throw new BadRequestException('La fecha de cierre no puede ser anterior a la de inicio.');
      const f = (x: Date | null) => (x ? x.toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }) : '—');
      if (ini.getTime() !== o.fechaInicio.getTime()) { d.fechaInicio = ini; notas.push(`Fecha de inicio corregida: ${f(o.fechaInicio)} → ${f(ini)}.`); }
      if (cie?.getTime() !== o.fechaCierre?.getTime()) { d.fechaCierre = cie; notas.push(`Fecha de cierre corregida: ${f(o.fechaCierre)} → ${f(cie)}.`); }
    }
    if (b.estado !== undefined && b.estado !== o.estado) {
      const e = String(b.estado);
      if (!ESTADOS.some((x) => x.id === e)) throw new BadRequestException('Estado no válido.');
      // Sin nota de venta (llega con el slice comercial) solo se cierra una ODS «No aprobada» (DEC-72).
      if (e === 'Cerrada' && (d.decision ?? o.decision) !== 'No aprobada') {
        throw new ConflictException('Para cerrar sin nota de venta, la decisión del cliente debe ser «No aprobada». Emite la nota de venta o cambia la decisión.');
      }
      if (o.estado === 'Cerrada') await this.limiteVehiculo(o.vehiculoId, String(d.tipoAtencion ?? o.tipoAtencion), o.id);
      d.estado = e;
      d.fechaCierre = e === 'Cerrada' ? new Date() : null;
      const nombre = (x: string) => ESTADOS.find((y) => y.id === x)?.nombre ?? x;
      notas.push(`Estado: ${nombre(o.estado)} → ${nombre(e)}${e === 'Cerrada' ? ' (se asignó la fecha de cierre)' : o.estado === 'Cerrada' ? ' (se borró la fecha de cierre)' : ''}.`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.ordenServicio.update({ where: { id }, data: d });
      for (const t of notas) await this.bitacora(tx, id, real, t);
    });
    const res = resumen(await this.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'orden_servicio', id, resumen(o), res, notas.join(' ') || 'ODS modificada');
    return res;
  }

  /** Reemplaza los ítems. Un ítem nuevo, o el cambio del precio de un producto, devuelve la decisión a «Pendiente de aprobación» (DEC-72). */
  @Put(':id/detalles')
  @Requiere('ods', 'E')
  async detalles(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: { detalles?: Record<string, unknown>[] }) {
    const organizacionId = this.empresa(s);
    const o = await this.cargar(id, organizacionId);
    if (o.estado === 'Cerrada') throw new ConflictException('La ODS está cerrada: reábrela para cambiar sus ítems.');
    if (!Array.isArray(b?.detalles) || b.detalles.length > 300) throw new BadRequestException('Envía la lista de ítems (hasta 300).');
    const nuevas = b.detalles.map(linea);
    // El responsable de cada ítem debe ser un técnico o jefe de taller activo de la empresa.
    const responsables = [...new Set(nuevas.map((l) => l.tecnicoId).filter((x): x is string => !!x))];
    for (const r of responsables) await this.persona(organizacionId, r, 'técnico');
    const antes = new Map(o.detalles.map((d) => [d.id, d]));
    const agregados = nuevas.filter((l) => !l.id || !antes.has(l.id));
    const cambioPrecio = nuevas.some((l) => l.id && antes.has(l.id) && l.tipo === 'producto' && Number(antes.get(l.id)!.precio) !== l.precio);
    let decision = o.decision;
    const notas: string[] = [];
    if (o.decision !== 'Pendiente de aprobación' && o.decision !== 'No aprobada') {
      if (agregados.length || (cambioPrecio && o.decision === 'Aprobada para cotizar')) {
        decision = 'Pendiente de aprobación';
        notas.push(`Decisión del cliente: ${o.decision} → Pendiente de aprobación (${agregados.length ? 'ítem nuevo: ' + agregados.map((a) => a.descripcion).join(', ') : 'cambió el precio de un producto'}).`);
      }
    }
    const nuevoTotal = r2(nuevas.reduce((a, l) => a + l.total, 0));
    const abonado = r2(o.abonos.reduce((a, x) => a + Number(x.valor), 0));
    if (nuevoTotal < abonado) throw new ConflictException(`El total (S/ ${nuevoTotal.toFixed(2)}) no puede quedar por debajo de lo ya abonado (S/ ${abonado.toFixed(2)}).`);
    const quitados = o.detalles.filter((d) => !nuevas.some((l) => l.id === d.id));
    if (quitados.length) notas.push(`Ítems quitados: ${quitados.map((q) => q.descripcion).join(', ')}.`);
    if (agregados.length && !notas.some((n) => n.includes('ítem nuevo'))) notas.push(`Ítems agregados: ${agregados.map((a) => a.descripcion).join(', ')}.`);
    await this.prisma.$transaction(async (tx) => {
      await tx.detalleODS.deleteMany({ where: { ordenId: id } });
      for (const l of nuevas) {
        const { id: lid, ...datos } = l;
        await tx.detalleODS.create({ data: { ...datos, ...(lid && antes.has(lid) ? { id: lid } : {}), ordenId: id } });
      }
      if (decision !== o.decision) await tx.ordenServicio.update({ where: { id }, data: { decision } });
      for (const t of notas) await this.bitacora(tx, id, real, t);
    });
    const res = resumen(await this.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'orden_servicio', id, { detalles: resumen(o).detalles }, { detalles: res.detalles }, 'Ítems de la ODS');
    return res;
  }

  @Post(':id/descuento')
  @Requiere('ods', 'E')
  async descuento(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: { porcentaje?: unknown }) {
    const p = Number(b?.porcentaje);
    if (!Number.isFinite(p) || p < 0 || p > 100) throw new BadRequestException('El porcentaje debe estar entre 0 y 100.');
    const o = await this.cargar(id, this.empresa(s));
    return this.detalles(s, real, id, { detalles: resumen(o).detalles.map((d) => ({ ...d, descuentoPct: p })) });
  }

  @Post(':id/abonos')
  @Requiere('ods', 'E')
  async abono(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: { metodo?: string; concepto?: string; valor?: unknown }) {
    const organizacionId = this.empresa(s);
    const actual = await this.cargar(id, organizacionId);
    if (actual.estado === 'Cerrada') throw new ConflictException('La ODS está cerrada: no admite abonos.');
    const valor = r2(Number(b?.valor));
    if (!Number.isFinite(valor) || valor <= 0) throw new BadRequestException('El valor del abono debe ser mayor a cero.');
    const metodo = METODOS.includes(String(b?.metodo)) ? String(b?.metodo) : null;
    if (!metodo) throw new BadRequestException('Elige el método de pago.');
    const concepto = textoLibre(b?.concepto, 200) ?? 'Abono';
    // Se bloquea la ODS y se recalcula lo pendiente dentro de la transacción: dos abonos simultáneos no pueden pasar del total.
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "OrdenServicio" WHERE id = ${id} FOR UPDATE`;
      const det = await tx.detalleODS.findMany({ where: { ordenId: id } });
      const abs = await tx.abono.findMany({ where: { ordenId: id } });
      const pendiente = r2(det.reduce((a, d) => a + Number(d.total), 0) - abs.reduce((a, x) => a + Number(x.valor), 0));
      if (valor > pendiente) throw new BadRequestException(`El abono supera lo pendiente por pagar (S/ ${pendiente.toFixed(2)}).`);
      const a = await tx.abono.create({ data: { ordenId: id, metodo, concepto, valor, registradoPorId: real.id } });
      await this.bitacora(tx, id, real, `Abono de S/ ${valor.toFixed(2)} (${metodo}).`);
      return a;
    });
    const res = resumen(await this.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'abono', id, null, { valor, metodo }, 'Abono registrado');
    return res;
  }

  @Post(':id/evidencias')
  @Requiere('ods', 'E')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: EVIDENCIA_MAX_BYTES, files: 1 } }))
  async subirEvidencia(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @UploadedFile() f?: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    const organizacionId = this.empresa(s);
    const o = await this.cargar(id, organizacionId);
    if (!f) throw new BadRequestException('Adjunta una foto o un video.');
    if (!/^(image|video)\//.test(f.mimetype)) throw new BadRequestException('Solo se aceptan fotos o videos.');
    if (o.evidencias.length >= EVIDENCIA_MAX_POR_ODS) throw new ConflictException(`La ODS ya tiene ${EVIDENCIA_MAX_POR_ODS} evidencias.`);
    const nombre = (Buffer.from(f.originalname, 'latin1').toString('utf8') || 'evidencia').slice(0, 120);
    await this.prisma.$transaction(async (tx) => {
      await tx.evidenciaIngreso.create({ data: { ordenId: id, nombre, tipo: f.mimetype, tamano: f.size, datos: f.buffer, subidoPorId: real.id } });
      await this.bitacora(tx, id, real, `Evidencia de ingreso agregada: ${nombre}.`);
    });
    await auditar(this.prisma, real, s, 'evidencia_ingreso', id, null, { nombre, tamano: f.size }, 'Evidencia agregada');
    return resumen(await this.cargar(id, organizacionId));
  }

  @Get(':id/evidencias/:eid')
  @Requiere('ods', 'V')
  async verEvidencia(@SesionActual() s: Sesion, @Param('id') id: string, @Param('eid') eid: string, @Res({ passthrough: true }) res: { set: (h: Record<string, string>) => void }) {
    const organizacionId = this.empresa(s);
    await this.cargar(id, organizacionId);
    const e = await this.prisma.evidenciaIngreso.findFirst({ where: { id: eid, ordenId: id } });
    if (!e) throw new NotFoundException('Evidencia no encontrada.');
    res.set({ 'Content-Type': e.tipo, 'Content-Disposition': `inline; filename="${encodeURIComponent(e.nombre)}"` });
    return new StreamableFile(Buffer.from(e.datos));
  }

  @Delete(':id/evidencias/:eid')
  @Requiere('ods', 'E')
  async quitarEvidencia(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Param('eid') eid: string) {
    const organizacionId = this.empresa(s);
    const o = await this.cargar(id, organizacionId);
    if (o.estado === 'Cerrada') throw new ConflictException('La ODS está cerrada: no se quitan evidencias.');
    const e = o.evidencias.find((x) => x.id === eid);
    if (!e) throw new NotFoundException('Evidencia no encontrada.');
    await this.prisma.$transaction(async (tx) => {
      await tx.evidenciaIngreso.delete({ where: { id: eid } });
      await this.bitacora(tx, id, real, `Evidencia de ingreso quitada: ${e.nombre}.`);
    });
    await auditar(this.prisma, real, s, 'evidencia_ingreso', id, { nombre: e.nombre }, null, 'Evidencia quitada');
    return resumen(await this.cargar(id, organizacionId));
  }

  /** Eliminar no reutiliza el número; queda auditado con su motivo. */
  @Delete(':id')
  @Requiere('ods', 'A')
  async eliminar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: { motivo?: string }) {
    const organizacionId = this.empresa(s);
    const o = await this.cargar(id, organizacionId);
    if (o.abonos.length) throw new ConflictException('La ODS tiene abonos: no se puede eliminar.');
    const motivo = String(b?.motivo ?? '').trim() || 'Sin motivo';
    await this.prisma.ordenServicio.update({ where: { id }, data: { eliminada: true, motivoEliminacion: motivo } });
    await auditar(this.prisma, real, s, 'orden_servicio', id, { codigo: o.codigo }, { eliminada: true }, `ODS eliminada: ${motivo}`);
    return { ok: true };
  }
}
