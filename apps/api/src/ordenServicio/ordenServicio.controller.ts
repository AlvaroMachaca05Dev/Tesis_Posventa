import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma, PrismaClient } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { KM_MAXIMO } from '../vehiculo/vehiculo.reglas';
import { calcularServicio, claveSolape, evaluarSolapamientos, Nivel, TipoRegla } from '../maestros/maestros.reglas';
import { aServicio, aSolape } from '../maestros/maestros.controller';

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
/** «Otro» necesita un texto propio; los demás tipos no lo usan (se guarda null). */
function tipoAtencionYDetalle(valor: unknown, detalle: unknown) {
  const t = String(valor ?? '').trim();
  if (!TIPOS_ATENCION.includes(t)) throw new BadRequestException('Elige un tipo de atención de la lista.');
  if (t === 'Otro') {
    const d = String(detalle ?? '').trim();
    if (!d) throw new BadRequestException('Escribe el tipo de atención (elegiste «Otro»).');
    if (d.length > 120) throw new BadRequestException('El tipo de atención escrito es demasiado largo (120 caracteres).');
    return { tipoAtencion: t, tipoAtencionDetalle: d };
  }
  return { tipoAtencion: t, tipoAtencionDetalle: null };
}
export const DECISIONES = ['Pendiente de aprobación', 'Aprobada para cotizar', 'Aprobada para comprar', 'No aprobada'];
export const ESTADOS = [
  { id: 'Recepcion', nombre: 'Recepción' },
  { id: 'EnProceso', nombre: 'En proceso' },
  { id: 'Entrega', nombre: 'Entrega' },
  { id: 'Cerrada', nombre: 'Cerrado' },
];
const METODOS = ['Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta', 'Otro'];
const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const r6 = (x: number) => Math.round((x + Number.EPSILON) * 1e6) / 1e6;
const r3 = (x: number) => Math.round((x + Number.EPSILON) * 1000) / 1000;
const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? null : Number(d));

const INCLUIR = {
  cliente: true,
  vehiculo: { include: { grupo: true } },
  tecnico: true,
  jefeTaller: true,
  creadoPor: true,
  detalles: { orderBy: { posicion: 'asc' as const } },
  abonos: { orderBy: { fecha: 'asc' as const } },
  bitacora: { orderBy: { fecha: 'desc' as const }, include: { actor: true } },
  evidencias: { orderBy: { creadoEn: 'asc' as const }, select: { id: true, nombre: true, tipo: true, tamano: true, creadoEn: true } },
  solicitudes: { orderBy: { creadoEn: 'desc' as const }, include: { solicitadaPor: true, resueltaPor: true } },
  notas: { orderBy: { creadoEn: 'desc' as const }, include: { detalles: { orderBy: { posicion: 'asc' as const } }, local: true } },
};
// RF-018: quiénes autorizan la corrección o la reapertura de una ODS cerrada, y qué datos admite una corrección.
const AUTORIZAN = ['Jefe de taller', 'Administrador', 'Superadministrador'];
const CAMPOS_CORRECCION: Record<string, string> = { observaciones: 'Observaciones', recomendaciones: 'Recomendaciones', km: 'Kilometraje', tecnicoId: 'Técnico', jefeTallerId: 'Jefe de taller' };
// Evidencias de ingreso (RF-015): solo fotos, opcionales, hasta 25 MB cada una y 5 por ODS.
const EVIDENCIA_MAX_BYTES = 25 * 1024 * 1024;
const EVIDENCIA_MAX_POR_ODS = 5;
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
    servicioId: d.servicioId, productoId: d.productoId, horas: num(d.horas), precioGrupo: num(d.precioGrupo),
    // RF-101: el precio cambiado en la línea respecto al del grupo queda marcado
    precioModificado: d.precioGrupo != null && Number(d.precioGrupo) !== Number(d.precio),
    trazaPrecio: (d.trazaPrecio ?? null) as string[] | null, descuentoMonto: num(d.descuentoMonto) ?? 0, solapamientoId: d.solapamientoId,
  }));
  const total = r2(detalles.reduce((a, d) => a + (d.total ?? 0), 0));
  const abonos = o.abonos.map((a) => ({ id: a.id, fecha: a.fecha.toISOString(), metodo: a.metodo, concepto: a.concepto, valor: num(a.valor) as number }));
  const totalAbonos = r2(abonos.reduce((a, x) => a + x.valor, 0));
  const ultima = o.bitacora[0];
  return {
    id: o.id, codigo: o.codigo, externa: o.externa, estado: o.estado, decision: o.decision, tipoAtencion: o.tipoAtencion, tipoAtencionDetalle: o.tipoAtencionDetalle,
    fechaInicio: o.fechaInicio.toISOString(), fechaCierre: o.fechaCierre?.toISOString() ?? null, km: o.km,
    observaciones: o.observaciones, recomendaciones: o.recomendaciones,
    cliente: { id: o.cliente.id, nombre: o.cliente.nombre, documento: o.cliente.documento, tipoDocumento: o.cliente.tipoDocumento, movil: o.cliente.movil, direccionFiscal: o.cliente.direccionFiscal, pais: o.cliente.pais },
    vehiculo: { id: o.vehiculo.id, grupo: o.vehiculo.grupo?.activo ? o.vehiculo.grupo.codigo : null, placa: o.vehiculo.placa, marca: o.vehiculo.marca, modelo: o.vehiculo.modelo, anio: o.vehiculo.anio, color: o.vehiculo.color, nroSerie: o.vehiculo.nroSerie, nroVin: o.vehiculo.nroVin, nroMotor: o.vehiculo.nroMotor },
    tecnico: persona(o.tecnico), jefeTaller: persona(o.jefeTaller), creadoPor: persona(o.creadoPor),
    detalles, total, abonos, totalAbonos, pendiente: r2(total - totalAbonos), solapamientosMantenidos: o.solapamientosMantenidos,
    horas: r2(detalles.reduce((a, d) => a + (d.tipo === 'servicio' ? d.horas ?? 0 : 0), 0)),
    estadoVehiculo: (o.estadoVehiculo ?? null) as Record<string, string | string[]> | null,
    evidencias: o.evidencias.map((e) => ({ id: e.id, nombre: e.nombre, tipo: e.tipo, tamano: e.tamano, fecha: e.creadoEn.toISOString() })),
    // Comprobantes vigentes de la orden: por ahora la nota de venta (RF-088); la boleta y la factura llegan después.
    comprobantes: o.notas.filter((x) => x.estado === 'EMITIDA').map((x) => x.codigo), conComprobante: o.notas.some((x) => x.estado === 'EMITIDA'),
    notaVenta: (() => {
      const x = o.notas.find((y) => y.estado === 'EMITIDA');
      if (!x) return null;
      return {
        id: x.id, codigo: x.codigo, condicion: x.condicion, fechaEmision: x.fechaEmision.toISOString(), fechaVencimiento: x.fechaVencimiento?.toISOString() ?? null, local: x.local.nombre,
        observaciones: x.observaciones, comentario: x.comentario,
        detalles: x.detalles.map((d) => ({ id: d.id, tipo: d.tipo, descripcion: d.descripcion, referencia: d.referencia, cantidad: Number(d.cantidad), precio: Number(d.precio), descuentoPct: Number(d.descuentoPct), tipoIgv: d.tipoIgv, total: Number(d.total) })),
        exonerada: Number(x.exonerada), inafecta: Number(x.inafecta), gravada: Number(x.gravada), igv: Number(x.igv), total: Number(x.total),
        conDetraccion: x.conDetraccion, detraccionPct: Number(x.detraccionPct), detraccion: Number(x.detraccion),
      };
    })(),
    ultimaBitacora: ultima ? { texto: ultima.texto, fecha: ultima.fecha.toISOString(), actor: ultima.actor.nombre } : null,
    bitacora: o.bitacora.slice(0, 20).map((b) => ({ texto: b.texto, fecha: b.fecha.toISOString(), actor: b.actor.nombre })),
    // RF-018: solicitudes de corrección o reapertura de la ODS cerrada, de la más reciente a la más antigua.
    solicitudes: o.solicitudes.map((q) => ({
      id: q.id, tipo: q.tipo, motivo: q.motivo, estadoDestino: q.estadoDestino, cambios: (q.cambios ?? null) as Record<string, unknown> | null, estado: q.estado,
      solicitadaPor: q.solicitadaPor.nombre, resueltaPor: q.resueltaPor?.nombre ?? null, respuesta: q.respuesta,
      fecha: q.creadoEn.toISOString(), resuelta: q.resueltoEn?.toISOString() ?? null,
    })),
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
  // Con 6 decimales: un descuento en soles (solapamiento o total editado) se guarda como porcentaje y da el total exacto.
  const descuentoPct = r6(Number(d.descuentoPct ?? 0));
  const costo = d.costo === undefined || d.costo === null || d.costo === '' ? null : r3(Number(d.costo));
  const rentabilidadPct = d.rentabilidadPct === undefined || d.rentabilidadPct === null || d.rentabilidadPct === '' ? null : r3(Number(d.rentabilidadPct));
  if (![cantidad, precio, descuentoPct].every(Number.isFinite) || cantidad <= 0 || cantidad > 100000 || precio < 0 || precio > 10_000_000 || descuentoPct < 0 || descuentoPct > 100 || (costo != null && (!Number.isFinite(costo) || costo < 0))) {
    throw new BadRequestException(`Ítem ${i + 1}: cantidad, precio, costo o descuento no válidos.`);
  }
  const impuesto = d.impuesto === 'NINGUNO' ? 'NINGUNO' : 'IGV';
  const total = r2((tipo === 'servicio' ? 1 : cantidad) * precio * (1 - descuentoPct / 100));
  const id = (k: string) => (typeof d[k] === 'string' && d[k] ? (d[k] as string) : null);
  return {
    id: typeof d.id === 'string' ? d.id : undefined, posicion: i, tipo, descripcion, referencia: String(d.referencia ?? '').trim() || null, cantidad, precio, descuentoPct, costo, rentabilidadPct, impuesto, total,
    tecnicoId: id('tecnicoId'),
    // Del catálogo (S5). El servidor recalcula el precio del grupo, las horas y el descuento por solapamiento.
    servicioId: tipo === 'servicio' ? id('servicioId') : null, productoId: tipo === 'producto' ? id('productoId') : null,
    horas: null as number | null, precioGrupo: null as number | null, trazaPrecio: Prisma.DbNull as typeof Prisma.DbNull | string[],
    // Lo que trae la línea como descuento por solapamiento (ya incluido en el porcentaje); el servidor lo vuelve a calcular.
    descuentoMonto: Math.max(0, Number(d.descuentoMonto) || 0), solapamientoId: id('solapamientoId'),
  };
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

  /** El técnico debe tener rol Técnico o Jefe de taller; el jefe, rol Jefe de taller; el responsable de un producto, rol Cajera o Logístico. */
  private async persona(organizacionId: string, id: unknown, cual: 'técnico' | 'jefe de taller' | 'responsable de productos') {
    if (id === null || id === '') return null;
    const roles = cual === 'técnico' ? ['Técnico', 'Jefe de taller'] : cual === 'responsable de productos' ? ['Cajera', 'Logístico'] : ['Jefe de taller'];
    const u = await this.prisma.usuario.findFirst({ where: { id: String(id), organizacionId, activo: true, roles: { some: { rol: { nombre: { in: roles } } } } } });
    if (!u) throw new BadRequestException(`Elige un ${cual} válido de la empresa.`);
    return u.id;
  }

  /** Datos de la empresa para la cabecera y el pie de los PDF de la orden. */
  private async datosEmpresa(organizacionId: string) {
    const e = await this.prisma.organizacion.findUniqueOrThrow({ where: { id: organizacionId } });
    return { nombre: e.nombre, razonSocial: e.razonSocial, ruc: e.ruc, direccion: e.direccion, telefono: e.telefono, correo: e.correo, lema: e.lema, cuentasBancarias: e.cuentasBancarias, terminosRecepcion: e.terminosRecepcion, pieTicket: e.pieTicket, anchoTicketMm: e.anchoTicketMm };
  }

  @Get('catalogos')
  @Requiere('ods', 'V')
  async catalogos(@SesionActual() s: Sesion) {
    const organizacionId = this.empresa(s);
    const usuarios = await this.prisma.usuario.findMany({ where: { organizacionId, activo: true }, include: { roles: { include: { rol: true } } }, orderBy: { nombre: 'asc' } });
    const con = (nombre: string) => usuarios.filter((u) => u.roles.some((r) => r.rol.nombre === nombre)).map((u) => ({ id: u.id, nombre: u.nombre }));
    return { tiposAtencion: TIPOS_ATENCION, decisiones: DECISIONES, estados: ESTADOS, metodosPago: METODOS, tecnicos: [...con('Técnico'), ...con('Jefe de taller')], jefes: con('Jefe de taller'), logisticos: con('Logístico'), cajeras: con('Cajera'), empresa: await this.datosEmpresa(organizacionId) };
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
    const { tipoAtencion, tipoAtencionDetalle } = tipoAtencionYDetalle(b.tipoAtencion, b.tipoAtencionDetalle);
    const localId = s.localId ?? (await this.prisma.local.findFirst({ where: { organizacionId }, orderBy: { nombre: 'asc' } }))?.id;
    if (!localId) throw new BadRequestException('La empresa no tiene locales.');
    const tecnicoId = b.tecnicoId ? await this.persona(organizacionId, b.tecnicoId, 'técnico') : null;
    const jefeTallerId = b.jefeTallerId ? await this.persona(organizacionId, b.jefeTallerId, 'jefe de taller') : null;
    const km = kmValido(b.km);
    const observaciones = textoLibre(b.observaciones);
    const recomendaciones = textoLibre(b.recomendaciones);
    // Al crear se puede mandar la orden directo al estado y la decisión que corresponden, sin pasar por Recepción.
    const estado = b.estado === undefined || b.estado === '' ? 'Recepcion' : String(b.estado);
    if (!ESTADOS.some((x) => x.id === estado)) throw new BadRequestException('Estado no válido.');
    const decision = b.decision === undefined || b.decision === '' ? DECISIONES[0] : String(b.decision);
    if (!DECISIONES.includes(decision)) throw new BadRequestException('Decisión no válida.');
    if (estado === 'Cerrada' && decision !== 'No aprobada') {
      throw new ConflictException('Para cerrar sin nota de venta, la decisión del cliente debe ser «No aprobada». Emite la nota de venta o cambia la decisión.');
    }
    // El número lo da el servidor en una transacción: gana quien presiona «Crear» primero y ningún número se repite ni se reutiliza.
    const o = await this.prisma.$transaction(async (tx) => {
      if (estado !== 'Cerrada') await this.limiteVehiculo(v.id, tipoAtencion, undefined, tx);
      const c = await tx.correlativoODS.upsert({ where: { organizacionId }, create: { organizacionId, ultimo: 1 }, update: { ultimo: { increment: 1 } } });
      const hoy = new Date();
      const fecha = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;
      const nueva = await tx.ordenServicio.create({
        data: {
          organizacionId, vehiculoId: v.id, clienteId: v.clienteId, localId, codigo: fecha + String(c.ultimo).padStart(5, '0'), correlativo: c.ultimo, tipoAtencion, tipoAtencionDetalle, km, tecnicoId, jefeTallerId,
          creadoPorId: real.id, observaciones, recomendaciones, estado, decision, fechaCierre: estado === 'Cerrada' ? hoy : null,
        },
      });
      const nombreEstado = ESTADOS.find((x) => x.id === estado)?.nombre ?? estado;
      await this.bitacora(tx, nueva.id, real, `ODS ${nueva.codigo} creada (${tipoAtencion}) en ${nombreEstado}, ${decision}.`);
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
    // RN-13: una ODS cerrada no se edita de forma ordinaria. Solo queda la corrección de fechas del Superadministrador;
    // lo demás pasa por una solicitud de corrección o de reapertura (RF-018).
    if (o.estado === 'Cerrada') {
      const cambia = Object.keys(b ?? {}).some((k) => !['fechaInicio', 'fechaCierre'].includes(k) && !((k === 'estado' && b[k] === o.estado) || (k === 'decision' && b[k] === o.decision)));
      if (cambia) throw new ConflictException('La ODS está cerrada: solicita su corrección o su reapertura para cambiarla.');
    }
    if (b.decision !== undefined) {
      if (!DECISIONES.includes(String(b.decision))) throw new BadRequestException('Decisión no válida.');
      const quedaCerrada = (b.estado ?? o.estado) === 'Cerrada';
      if (quedaCerrada && b.decision !== 'No aprobada') throw new ConflictException('Una ODS cerrada sin nota de venta debe seguir «No aprobada». Reábrela antes de cambiar la decisión.');
      if (b.decision !== o.decision) { d.decision = String(b.decision); notas.push(`Decisión del cliente: ${o.decision} → ${b.decision}.`); }
    }
    if (b.tipoAtencion !== undefined && (b.tipoAtencion !== o.tipoAtencion || (b.tipoAtencion === 'Otro' && b.tipoAtencionDetalle !== o.tipoAtencionDetalle))) {
      const { tipoAtencion: t, tipoAtencionDetalle: td } = tipoAtencionYDetalle(b.tipoAtencion, b.tipoAtencionDetalle);
      if (o.estado !== 'Cerrada') await this.limiteVehiculo(o.vehiculoId, t, o.id);
      d.tipoAtencion = t;
      d.tipoAtencionDetalle = td;
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
      // Sin nota de venta solo se cierra una ODS «No aprobada» (DEC-72); con una nota vigente se cierra con cualquier decisión (RF-088).
      if (e === 'Cerrada' && (d.decision ?? o.decision) !== 'No aprobada' && !o.notas.some((x) => x.estado === 'EMITIDA')) {
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

  /** RF-018: pide reabrir una ODS cerrada (a qué estado vuelve) o corregir sus datos; queda pendiente hasta que alguien la autorice. */
  @Post(':id/solicitudes')
  @Requiere('ods', 'E')
  async solicitar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = this.empresa(s);
    const o = await this.cargar(id, organizacionId);
    if (o.estado !== 'Cerrada') throw new ConflictException('Solo una ODS cerrada necesita una solicitud; esta se puede editar directamente.');
    if (o.solicitudes.some((q) => q.estado === 'PENDIENTE')) throw new ConflictException('Esta ODS ya tiene una solicitud pendiente de autorizar.');
    const motivo = textoLibre(b?.motivo, 500);
    if (!motivo) throw new BadRequestException('Escribe el motivo de la solicitud.');
    const tipo = String(b?.tipo ?? '');
    let estadoDestino: string | null = null;
    let cambios: Record<string, unknown> | null = null;
    if (tipo === 'REAPERTURA') {
      estadoDestino = String(b?.estadoDestino ?? '');
      if (!ESTADOS.some((x) => x.id === estadoDestino && x.id !== 'Cerrada')) throw new BadRequestException('Elige a qué estado vuelve la ODS: Recepción, En proceso o Entrega.');
    } else if (tipo === 'CORRECCION') {
      const c = (b?.cambios ?? {}) as Record<string, unknown>;
      cambios = {};
      if (c.observaciones !== undefined) cambios.observaciones = textoLibre(c.observaciones);
      if (c.recomendaciones !== undefined) cambios.recomendaciones = textoLibre(c.recomendaciones);
      if (c.km !== undefined) cambios.km = kmValido(c.km);
      if (c.tecnicoId !== undefined) cambios.tecnicoId = await this.persona(organizacionId, c.tecnicoId, 'técnico');
      if (c.jefeTallerId !== undefined) cambios.jefeTallerId = await this.persona(organizacionId, c.jefeTallerId, 'jefe de taller');
      const actual = o as unknown as Record<string, unknown>;
      for (const k of Object.keys(cambios)) if ((cambios[k] ?? null) === (actual[k] ?? null)) delete cambios[k];
      if (Object.keys(cambios).length === 0) throw new BadRequestException('Indica al menos un dato que cambie: observaciones, recomendaciones, kilometraje, técnico o jefe de taller.');
    } else {
      throw new BadRequestException('Elige el tipo de solicitud: reapertura o corrección.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.solicitudOds.create({ data: { ordenId: id, tipo, motivo, estadoDestino, cambios: (cambios ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull, solicitadaPorId: real.id } });
      await this.bitacora(tx, id, real, `Solicitud de ${tipo === 'REAPERTURA' ? 'reapertura' : 'corrección'}: ${motivo}`);
    });
    return resumen(await this.cargar(id, organizacionId));
  }

  /** RF-018: autoriza o rechaza la solicitud. Al autorizar se aplica el cambio; queda el antes y el después con los dos responsables. */
  @Post(':id/solicitudes/:sid/resolver')
  @Requiere('ods', 'E')
  async resolver(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Param('sid') sid: string, @Body() b: Record<string, unknown>) {
    const organizacionId = this.empresa(s);
    if (!s.roles.some((r) => AUTORIZAN.includes(r))) throw new ForbiddenException('Solo el Jefe de taller, el Administrador o el Superadministrador autorizan esta solicitud.');
    const o = await this.cargar(id, organizacionId);
    const q = o.solicitudes.find((x) => x.id === sid);
    if (!q) throw new NotFoundException('Solicitud no encontrada.');
    if (q.estado !== 'PENDIENTE') throw new ConflictException('Esta solicitud ya fue resuelta.');
    const aprobar = b?.aprobar === true;
    const respuesta = textoLibre(b?.respuesta, 500);
    if (!aprobar && !respuesta) throw new BadRequestException('Escribe por qué se rechaza la solicitud.');
    const nombreEstado = (x: string) => ESTADOS.find((y) => y.id === x)?.nombre ?? x;
    const cual = q.tipo === 'REAPERTURA' ? 'reapertura' : 'corrección';
    const notas: string[] = [];
    const d: Prisma.OrdenServicioUncheckedUpdateInput = {};
    if (aprobar && q.tipo === 'REAPERTURA') {
      if (o.estado !== 'Cerrada') throw new ConflictException('La ODS ya no está cerrada.');
      await this.limiteVehiculo(o.vehiculoId, o.tipoAtencion, o.id);
      d.estado = q.estadoDestino as string;
      d.fechaCierre = null;
      notas.push(`ODS reabierta: Cerrado → ${nombreEstado(q.estadoDestino as string)} (se borró la fecha de cierre). Solicitó ${q.solicitadaPor.nombre}; motivo: ${q.motivo}`);
    } else if (aprobar) {
      const cambios = (q.cambios ?? {}) as Record<string, unknown>;
      const personas = await this.prisma.usuario.findMany({ where: { id: { in: [cambios.tecnicoId, cambios.jefeTallerId, o.tecnicoId, o.jefeTallerId].filter((x): x is string => typeof x === 'string') } } });
      const ver = (k: string, v: unknown) => (k.endsWith('Id') ? personas.find((u) => u.id === v)?.nombre ?? '—' : v === null || v === undefined || v === '' ? '—' : String(v));
      const actual = o as unknown as Record<string, unknown>;
      for (const k of Object.keys(cambios)) {
        if (!(k in CAMPOS_CORRECCION)) continue;
        (d as Record<string, unknown>)[k] = cambios[k];
        notas.push(`Corrección autorizada · ${CAMPOS_CORRECCION[k]}: ${ver(k, actual[k])} → ${ver(k, cambios[k])}.`);
      }
      notas.push(`Solicitó ${q.solicitadaPor.nombre}; motivo: ${q.motivo}`);
    } else {
      notas.push(`Solicitud de ${cual} rechazada: ${respuesta}`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.solicitudOds.update({ where: { id: sid }, data: { estado: aprobar ? 'APROBADA' : 'RECHAZADA', resueltaPorId: real.id, respuesta, resueltoEn: new Date() } });
      if (aprobar) await tx.ordenServicio.update({ where: { id }, data: d });
      for (const t of notas) await this.bitacora(tx, id, real, t);
    });
    const res = resumen(await this.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'orden_servicio', id, resumen(o), res, aprobar ? `Solicitud de ${cual} autorizada` : `Solicitud de ${cual} rechazada`);
    return res;
  }

  /** Reemplaza los ítems. Un ítem nuevo, o el cambio del precio de un producto, devuelve la decisión a «Pendiente de aprobación» (DEC-72). */
  @Put(':id/detalles')
  @Requiere('ods', 'E')
  async detalles(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: { detalles?: Record<string, unknown>[]; solapamientosMantenidos?: unknown }) {
    const organizacionId = this.empresa(s);
    const o = await this.cargar(id, organizacionId);
    if (o.estado === 'Cerrada') throw new ConflictException('La ODS está cerrada: reábrela para cambiar sus ítems.');
    // Con una nota de venta vigente los ítems ya están facturados: para cambiarlos hay que anular la nota.
    if (o.notas.some((x) => x.estado === 'EMITIDA')) throw new ConflictException('La ODS tiene una nota de venta vigente: anúlala para cambiar sus ítems.');
    if (!Array.isArray(b?.detalles) || b.detalles.length > 300) throw new BadRequestException('Envía la lista de ítems (hasta 300).');
    const nuevas = b.detalles.map(linea);
    const solape = await this.catalogoYSolapes(organizacionId, o, nuevas, b);
    // El responsable de un servicio es un técnico o el jefe de taller; el de un producto, una cajera o un logístico (activos de la empresa).
    for (const l of nuevas) if (l.tecnicoId) await this.persona(organizacionId, l.tecnicoId, l.tipo === 'producto' ? 'responsable de productos' : 'técnico');
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
    notas.push(...solape.notas);
    await this.prisma.$transaction(async (tx) => {
      await tx.detalleODS.deleteMany({ where: { ordenId: id } });
      for (const l of nuevas) {
        const { id: lid, ...datos } = l;
        await tx.detalleODS.create({ data: { ...datos, ...(lid && antes.has(lid) ? { id: lid } : {}), ordenId: id } });
      }
      if (decision !== o.decision || solape.mantenidos.join() !== o.solapamientosMantenidos.join()) await tx.ordenServicio.update({ where: { id }, data: { decision, solapamientosMantenidos: solape.mantenidos } });
      for (const t of notas) await this.bitacora(tx, id, real, t);
    });
    const res = resumen(await this.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'orden_servicio', id, { detalles: resumen(o).detalles }, { detalles: res.detalles }, 'Ítems de la ODS');
    return res;
  }

  /**
   * S5. Líneas del catálogo: el servicio toma las horas y el precio del grupo del vehículo (RN-09) y guarda la traza;
   * el producto debe existir. Solapamiento (RF-102): con los dos servicios en la ODS, el segundo reduce sus horas en lo compartido
   * y lleva el descuento en soles: automático siempre; opcional solo si la cajera lo aceptó (la línea trae la regla).
   */
  private async catalogoYSolapes(organizacionId: string, o: Orden, nuevas: ReturnType<typeof linea>[], b: { solapamientosMantenidos?: unknown }) {
    const notas: string[] = [];
    const grupo = o.vehiculo.grupo?.activo ? o.vehiculo.grupo.codigo : null;
    const idsSv = [...new Set(nuevas.map((l) => l.servicioId).filter(Boolean))] as string[];
    const idsPr = [...new Set(nuevas.map((l) => l.productoId).filter(Boolean))] as string[];
    const [servicios, productos, reglas, solapes] = await Promise.all([
      this.prisma.servicio.findMany({ where: { organizacionId, id: { in: idsSv } } }),
      this.prisma.producto.findMany({ where: { organizacionId, id: { in: idsPr } } }),
      this.prisma.reglaPrecio.findMany({ where: { organizacionId }, include: { grupo: true } }),
      this.prisma.solapamiento.findMany({ where: { organizacionId, activo: true } }),
    ]);
    if (servicios.length !== idsSv.length || productos.length !== idsPr.length) throw new BadRequestException('Hay un servicio o producto que no es del catálogo de la empresa.');
    const rs = reglas.map((r) => ({ codigo: r.codigo, nivel: r.nivel as Nivel, tipo: r.tipo as TipoRegla, grupo: r.grupo?.codigo ?? null, servicios: r.servicios, horas: num(r.horas), precio: num(r.precio), porcentaje: num(r.porcentaje), precioDesde: num(r.precioDesde), precioHasta: num(r.precioHasta), activa: r.activa, orden: r.orden }));
    for (const l of nuevas) {
      const sv = servicios.find((x) => x.id === l.servicioId);
      if (!sv) continue;
      const c = calcularServicio(aServicio(sv), grupo ?? '', rs);
      if (!c.disponible) throw new BadRequestException(`«${sv.nombre}» no aplica para el grupo ${grupo}.`);
      l.horas = c.horas;
      l.precioGrupo = c.precio;
      l.trazaPrecio = c.traza;
    }
    // El descuento por solapamiento va dentro del porcentaje. Se separa lo manual (lo que la cajera puso) del solapamiento anterior.
    const baseDe = (l: (typeof nuevas)[number]) => (l.tipo === 'servicio' ? 1 : l.cantidad) * l.precio;
    const manual = nuevas.map((l) => Math.max(0, r2(baseDe(l) * (l.descuentoPct / 100) - (l.solapamientoId || l.descuentoMonto ? l.descuentoMonto : 0))));
    const sinSolape = nuevas.map((l, i) => r2(Math.max(0, baseDe(l) - manual[i])));
    const hallados = evaluarSolapamientos(nuevas.map((l, i) => ({ indice: i, servicioId: l.servicioId, total: sinSolape[i] })), solapes.map(aSolape), grupo);
    const pedidos = new Map(nuevas.map((l, i) => [i, l.solapamientoId]));
    const antes = new Set(o.detalles.filter((d) => d.solapamientoId).map((d) => `${d.servicioId}:${d.solapamientoId}`));
    nuevas.forEach((l, i) => {
      // sin solapamiento: vuelve a su descuento manual
      const base = baseDe(l);
      l.descuentoMonto = 0;
      l.solapamientoId = null;
      l.descuentoPct = base > 0 ? r6((manual[i] / base) * 100) : 0;
      l.total = sinSolape[i];
    });
    for (const h of hallados) {
      if (h.indiceReducido < 0) continue;
      const l = nuevas[h.indiceReducido];
      const compartidas = num(solapes.find((x) => x.id === h.regla.id)?.horasCompartidas);
      if (compartidas && l.horas != null) l.horas = Math.max(0.25, r2(l.horas - compartidas));
      const aplicar = h.regla.modo === 'AUTOMATICO' || pedidos.get(h.indiceReducido) === h.regla.id;
      if (!aplicar) continue;
      const base = baseDe(l);
      const total = r2(Math.max(0, sinSolape[h.indiceReducido] - h.monto));
      l.descuentoMonto = h.monto;
      l.solapamientoId = h.regla.id;
      l.descuentoPct = base > 0 ? r6((1 - total / base) * 100) : 0;
      l.total = total;
      if (!antes.has(`${l.servicioId}:${h.regla.id}`)) notas.push(`Descuento por solapamiento ${h.regla.codigo}: S/ ${h.monto.toFixed(2)} en «${l.descripcion}».`);
    }
    // «Mantener montos» vale mientras estén los mismos servicios: si se quita uno, la decisión se pierde y la alerta vuelve.
    const opcionales = hallados.filter((h) => h.indiceReducido >= 0 && h.regla.modo === 'OPCIONAL' && !nuevas[h.indiceReducido].solapamientoId).map((h) => h.clave);
    const pedidosMantener = Array.isArray(b.solapamientosMantenidos) ? b.solapamientosMantenidos.map(String) : o.solapamientosMantenidos;
    const mantenidos = opcionales.filter((x) => pedidosMantener.includes(x));
    for (const m of mantenidos) if (!o.solapamientosMantenidos.includes(m)) notas.push(`Solapamiento ${hallados.find((h) => h.clave === m)?.regla.codigo}: se mantienen los montos.`);
    void claveSolape;
    return { notas, mantenidos };
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
    if (!f) throw new BadRequestException('Adjunta una foto.');
    if (!/^image\//.test(f.mimetype)) throw new BadRequestException('Solo se aceptan fotos.');
    if (o.evidencias.length >= EVIDENCIA_MAX_POR_ODS) throw new ConflictException(`La ODS ya tiene ${EVIDENCIA_MAX_POR_ODS} fotos (máximo).`);
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
