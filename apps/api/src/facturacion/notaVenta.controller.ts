import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { aNumero, empresaDe, texto } from '../comun/validacion';
import { parsearItems } from './lineas';
import { codigoNota, detraccionDe, proponeDetraccion, TIPOS_IGV, TipoIgv, tipoIgvPorDefecto, totalesNota } from './notaVenta.reglas';

export const INCLUIR_NOTA = { detalles: { orderBy: { posicion: 'asc' as const } }, local: true, emitidaPor: true, anuladaPor: true, cliente: true, vehiculo: true, abonos: true, orden: { include: { abonos: true } } };
type Nota = Prisma.NotaVentaGetPayload<{ include: typeof INCLUIR_NOTA }>;
const n = (d: Prisma.Decimal | number) => Number(d);
const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const METODOS = ['Efectivo', 'Yape', 'Transferencia', 'Tarjeta', 'Otro'];

export function resumenNota(x: Nota) {
  // Los pagos son los abonos de la ODS enlazada (RF-089) más los registrados en la propia nota (venta directa).
  const pagado = x.estado === 'EMITIDA' ? r2([...(x.orden?.abonos ?? []), ...x.abonos].reduce((a, b) => a + n(b.valor), 0)) : 0;
  return {
    id: x.id, codigo: x.codigo, serie: x.serie, numero: x.numero, estado: x.estado, condicion: x.condicion,
    fechaEmision: x.fechaEmision.toISOString(), fechaVencimiento: x.fechaVencimiento?.toISOString() ?? null,
    local: { id: x.localId, nombre: x.local.nombre }, observaciones: x.observaciones, comentario: x.comentario,
    orden: x.orden ? { id: x.orden.id, codigo: x.orden.codigo, km: x.orden.km } : null,
    cliente: { id: x.cliente.id, nombre: x.cliente.nombre, documento: x.cliente.documento, tipoDocumento: x.cliente.tipoDocumento, direccionFiscal: x.cliente.direccionFiscal, movil: x.cliente.movil },
    vehiculo: x.vehiculo ? { id: x.vehiculo.id, placa: x.vehiculo.placa, marca: x.vehiculo.marca, modelo: x.vehiculo.modelo } : null,
    detalles: x.detalles.map((d) => ({ id: d.id, tipo: d.tipo, descripcion: d.descripcion, referencia: d.referencia, cantidad: n(d.cantidad), precio: n(d.precio), descuentoPct: n(d.descuentoPct), tipoIgv: d.tipoIgv, total: n(d.total), servicioId: d.servicioId, productoId: d.productoId })),
    exonerada: n(x.exonerada), inafecta: n(x.inafecta), gravada: n(x.gravada), igv: n(x.igv), total: n(x.total),
    conDetraccion: x.conDetraccion, detraccionPct: n(x.detraccionPct), detraccionExacta: n(x.detraccionExacta), detraccion: n(x.detraccion),
    // La detracción la deposita la empresa: el saldo es el total menos lo pagado (DEC-82).
    pagado, saldo: x.estado === 'EMITIDA' ? r2(n(x.total) - pagado) : 0,
    pagos: [...(x.orden?.abonos ?? []), ...x.abonos].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()).map((a) => ({ id: a.id, fecha: a.fecha.toISOString(), metodo: a.metodo, concepto: a.concepto, valor: n(a.valor) })),
    emitidaPor: x.emitidaPor.nombre, anuladaPor: x.anuladaPor?.nombre ?? null, motivoAnulacion: x.motivoAnulacion, anuladaEn: x.anuladaEn?.toISOString() ?? null,
  };
}

interface Linea { posicion: number; tipo: string; descripcion: string; referencia: string | null; cantidad: number | Prisma.Decimal; precio: number | Prisma.Decimal; descuentoPct: number | Prisma.Decimal; tipoIgv: TipoIgv; total: number; servicioId: string | null; productoId: string | null }

/** Nota de venta interna (RF-088): se emite desde una ODS o directo por mostrador, con la serie del local, número consecutivo, tipo de IGV por ítem y detracción. */
@Controller()
export class NotaVentaController {
  constructor(private prisma: PrismaService) {}

  private async cargar(id: string, organizacionId: string) {
    const x = await this.prisma.notaVenta.findFirst({ where: { id, organizacionId }, include: INCLUIR_NOTA });
    if (!x) throw new NotFoundException('Nota de venta no encontrada.');
    return x;
  }

  /** Núcleo común: serie del local del usuario, número, totales, detracción, stock, pagos iniciales y bitácora. */
  private async crear(s: Sesion, real: Sesion, p: { ordenId: string | null; clienteId: string; vehiculoId: string | null; lineas: Linea[]; b: Record<string, unknown> }) {
    const { b, lineas } = p;
    const organizacionId = empresaDe(s);
    if (!s.localId) throw new ConflictException('Tu usuario no tiene un local asignado: la serie sale del local, así que no puedes emitir.');
    const local = await this.prisma.local.findFirst({ where: { id: s.localId, organizacionId } });
    if (!local) throw new BadRequestException('Elige un local de la empresa.');
    if (!local.serieNotaVenta) throw new ConflictException(`El local «${local.nombre}» no tiene serie de nota de venta. Asígnala en Empresa y parámetros.`);
    const serie = local.serieNotaVenta;

    const condicion = b?.condicion === undefined || b.condicion === '' ? 'CONTADO' : String(b.condicion);
    if (!['CONTADO', 'CREDITO'].includes(condicion)) throw new BadRequestException('La condición es contado o crédito.');
    // El vencimiento se puede elegir siempre; si no llega, es la fecha de emisión (hoy). A crédito es obligatorio y no puede ser anterior a hoy.
    let fechaVencimiento: Date | null = b?.fechaVencimiento ? new Date(String(b.fechaVencimiento)) : null;
    if (fechaVencimiento && Number.isNaN(fechaVencimiento.getTime())) throw new BadRequestException('La fecha de vencimiento no es válida.');
    if (condicion === 'CREDITO' && !fechaVencimiento) throw new BadRequestException('A crédito hay que indicar la fecha de vencimiento.');
    if (fechaVencimiento && fechaVencimiento.getTime() < Date.now() - 86_400_000) throw new BadRequestException('La fecha de vencimiento no puede ser anterior a hoy.');
    if (!fechaVencimiento) fechaVencimiento = new Date();
    const t = totalesNota(lineas);
    if (t.total <= 0) throw new ConflictException('El total es cero: no se emite nota de venta.');
    const conDetraccion = b?.conDetraccion === undefined ? proponeDetraccion(lineas, t.total) : b.conDetraccion === true;
    const det = conDetraccion ? detraccionDe(t.total) : { pct: 0, exacta: 0, redondeada: 0 };

    // Pagos que se registran al emitir (adelantos o cobro), validados contra el total.
    if (b?.pagos !== undefined && b?.pagos !== null && !Array.isArray(b.pagos)) throw new BadRequestException('Los pagos van en una lista.');
    if (Array.isArray(b?.pagos) && b.pagos.length > 50) throw new BadRequestException('Se admiten hasta 50 pagos al emitir.');
    const pagos = (Array.isArray(b?.pagos) ? b.pagos : []).map((x: unknown) => {
      const q = x as { metodo?: unknown; valor?: unknown; concepto?: unknown };
      const valor = r2(aNumero(q?.valor));
      if (!METODOS.includes(String(q?.metodo))) throw new BadRequestException('Elige el método de pago.');
      if (!Number.isFinite(valor) || valor <= 0) throw new BadRequestException('El valor de cada pago debe ser mayor a cero.');
      return { metodo: String(q.metodo), valor, concepto: texto(q.concepto, 200) ?? 'Pago' };
    });
    const previos = p.ordenId ? r2((await this.prisma.abono.findMany({ where: { ordenId: p.ordenId } })).reduce((a, x) => a + n(x.valor), 0)) : 0;
    if (r2(previos + pagos.reduce((a, x) => a + x.valor, 0)) > t.total) throw new BadRequestException('Los pagos superan el total de la nota.');

    // El número lo da el servidor en la misma transacción: consecutivo por serie, sin saltos ni repetidos (RN-03).
    const notaId = await this.prisma.$transaction(async (tx) => {
      const c = await tx.correlativoSerie.upsert({ where: { organizacionId_serie: { organizacionId, serie } }, create: { organizacionId, serie, ultimo: 1 }, update: { ultimo: { increment: 1 } } });
      const codigo = codigoNota(serie, c.ultimo);
      const nota = await tx.notaVenta.create({
        data: {
          organizacionId, localId: local.id, ordenId: p.ordenId, clienteId: p.clienteId, vehiculoId: p.vehiculoId, serie, numero: c.ultimo, codigo, condicion, fechaVencimiento,
          observaciones: texto(b?.observaciones, 1000), comentario: texto(b?.comentario, 1000),
          ...t, conDetraccion, detraccionPct: det.pct, detraccionExacta: det.exacta, detraccion: det.redondeada, emitidaPorId: real.id,
          detalles: { create: lineas },
        },
      });
      for (const pg of pagos) await tx.abono.create({ data: { ...(p.ordenId ? { ordenId: p.ordenId } : { notaId: nota.id }), metodo: pg.metodo, concepto: pg.concepto, valor: pg.valor, registradoPorId: real.id } });
      // El stock baja solo al emitir la nota y puede quedar negativo (DEC-76); cada salida queda en el kárdex con el código de la nota.
      for (const l of lineas.filter((x) => x.tipo === 'producto' && x.productoId)) {
        const clave = { productoId_localId: { productoId: l.productoId as string, localId: local.id } };
        const antes = n((await tx.stockProducto.findUnique({ where: clave }))?.cantidad ?? 0);
        const saldo = Math.round((antes - n(l.cantidad)) * 1000) / 1000;
        await tx.stockProducto.upsert({ where: clave, update: { cantidad: saldo }, create: { productoId: l.productoId as string, localId: local.id, cantidad: saldo } });
        await tx.movimientoInventario.create({ data: { productoId: l.productoId as string, localId: local.id, tipo: 'Venta', entrada: 0, salida: l.cantidad, saldo, motivo: `Nota de venta ${codigo}`, usuarioId: real.id } });
      }
      if (p.ordenId) await tx.bitacora.create({ data: { ordenId: p.ordenId, actorId: real.id, texto: `Nota de venta ${codigo} emitida por S/ ${t.total.toFixed(2)}${conDetraccion ? ` (detracción S/ ${det.redondeada.toFixed(2)})` : ''}.` } });
      return nota.id;
    });
    const res = resumenNota(await this.cargar(notaId, organizacionId));
    await auditar(this.prisma, real, s, 'nota_venta', notaId, null, res, 'Nota de venta emitida');
    return res;
  }

  private async ordenEmisible(id: string, organizacionId: string) {
    const o = await this.prisma.ordenServicio.findFirst({ where: { id, organizacionId, eliminada: false }, include: { detalles: { orderBy: { posicion: 'asc' } }, notas: true } });
    if (!o) throw new NotFoundException('Orden de servicio no encontrada.');
    if (o.estado === 'Cerrada') throw new ConflictException('La ODS está cerrada: reábrela para emitir su nota de venta.');
    if (o.decision === 'No aprobada') throw new ConflictException('El cliente no aprobó la orden: no se emite nota de venta.');
    if (o.tipoAtencion === 'Garantía') throw new ConflictException('Una ODS de garantía no se factura: lo que se cobre va en otra orden de servicio.');
    if (o.notas.some((x) => x.estado === 'EMITIDA')) throw new ConflictException('Esta ODS ya tiene una nota de venta vigente.');
    return o;
  }

  @Post('ordenes/:id/nota-venta')
  @Requiere('ods', 'E')
  async emitir(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const o = await this.ordenEmisible(id, empresaDe(s));
    if (o.detalles.length === 0) throw new ConflictException('La ODS no tiene ítems: agrega servicios o productos antes de emitir.');
    const tipos = (b?.tiposIgv ?? {}) as Record<string, unknown>;
    // Con aprobación por ítem activada, el comprobante lleva solo los ítems aprobados (los no aprobados quedan en la ODS).
    const org = await this.prisma.organizacion.findUnique({ where: { id: empresaDe(s) }, select: { aprobacionPorItem: true } });
    const detalles = org?.aprobacionPorItem ? o.detalles.filter((d) => d.aprobado) : o.detalles;
    if (detalles.length === 0) throw new ConflictException('No hay ítems aprobados para emitir el comprobante.');
    const lineas: Linea[] = detalles.map((d, i) => {
      const pedido = tipos[d.id];
      if (pedido !== undefined && !TIPOS_IGV.includes(String(pedido) as TipoIgv)) throw new BadRequestException('El tipo de IGV es Gravado, Exonerado o Inafecto.');
      return {
        posicion: i, tipo: d.tipo, descripcion: d.descripcion, referencia: d.referencia, cantidad: d.cantidad, precio: d.precio, descuentoPct: d.descuentoPct,
        tipoIgv: (pedido !== undefined ? String(pedido) : tipoIgvPorDefecto(d.impuesto)) as TipoIgv, total: n(d.total), servicioId: d.servicioId, productoId: d.productoId,
      };
    });
    return this.crear(s, real, { ordenId: o.id, clienteId: o.clienteId, vehiculoId: o.vehiculoId, lineas, b });
  }

  /** Venta directa por mostrador: ítems propios y, si se quiere, enlazada a una ODS (que aporta sus abonos). */
  @Post('notas-venta')
  @Requiere('notas', 'E')
  async emitirDirecta(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    let clienteId = String(b?.clienteId ?? ''), vehiculoId: string | null = b?.vehiculoId ? String(b.vehiculoId) : null;
    let ordenId: string | null = null;
    if (b?.ordenId) {
      const o = await this.ordenEmisible(String(b.ordenId), organizacionId);
      ordenId = o.id; clienteId = o.clienteId; vehiculoId = o.vehiculoId;
    }
    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, organizacionId } });
    if (!cliente) throw new BadRequestException('Elige el cliente de la nota de venta.');
    if (vehiculoId && !(await this.prisma.vehiculo.findFirst({ where: { id: vehiculoId, organizacionId } }))) throw new BadRequestException('El vehículo no existe.');
    const lineas: Linea[] = parsearItems(b?.items);
    if (lineas.length === 0) throw new ConflictException('Agrega al menos un ítem a la nota de venta.');
    return this.crear(s, real, { ordenId, clienteId, vehiculoId, lineas, b });
  }

  @Get('notas-venta')
  @Requiere('ods', 'V')
  async lista(@SesionActual() s: Sesion, @Query() f: { estado?: string; q?: string; desde?: string; hasta?: string }) {
    const where: Prisma.NotaVentaWhereInput = { organizacionId: empresaDe(s) };
    if (f.estado === 'EMITIDA' || f.estado === 'ANULADA') where.estado = f.estado;
    const fecha = (v: string | undefined, fin: boolean) => {
      if (!v) return null;
      const d = new Date(`${v}T${fin ? '23:59:59.999' : '00:00:00'}-05:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const desde = fecha(f.desde, false), hasta = fecha(f.hasta, true);
    if (desde || hasta) where.fechaEmision = { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) };
    const q = String(f.q ?? '').trim();
    if (q) {
      const c = { contains: q, mode: 'insensitive' as const };
      where.OR = [{ codigo: c }, { orden: { codigo: c } }, { cliente: { nombre: c } }, { cliente: { documento: c } }];
    }
    const lista = await this.prisma.notaVenta.findMany({ where, include: INCLUIR_NOTA, orderBy: { creadoEn: 'desc' }, take: 200 });
    return lista.map(resumenNota);
  }

  @Get('notas-venta/:id')
  @Requiere('ods', 'V')
  async una(@SesionActual() s: Sesion, @Param('id') id: string) {
    return resumenNota(await this.cargar(id, empresaDe(s)));
  }

  /** La nota no se borra: queda anulada con su motivo, y el stock vuelve al local (DEC-76). */
  @Post('notas-venta/:id/anular')
  @Requiere('ods', 'A')
  async anular(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const x = await this.cargar(id, organizacionId);
    if (x.estado !== 'EMITIDA') throw new ConflictException('Esta nota de venta ya fue eliminada.');
    if (x.ordenId && (await this.prisma.ordenServicio.findFirst({ where: { id: x.ordenId, estado: 'Cerrada' } }))) throw new ConflictException('La ODS está cerrada: reábrela antes de eliminar su nota de venta.');
    const motivo = texto(b?.motivo, 500);
    if (!motivo) throw new BadRequestException('Escribe el motivo de la eliminación.');
    await this.prisma.$transaction(async (tx) => {
      await tx.notaVenta.update({ where: { id }, data: { estado: 'ANULADA', anuladaPorId: real.id, motivoAnulacion: motivo, anuladaEn: new Date() } });
      for (const l of x.detalles.filter((d) => d.tipo === 'producto' && d.productoId)) {
        const clave = { productoId_localId: { productoId: l.productoId as string, localId: x.localId } };
        const antes = n((await tx.stockProducto.findUnique({ where: clave }))?.cantidad ?? 0);
        const saldo = Math.round((antes + n(l.cantidad)) * 1000) / 1000;
        await tx.stockProducto.upsert({ where: clave, update: { cantidad: saldo }, create: { productoId: l.productoId as string, localId: x.localId, cantidad: saldo } });
        await tx.movimientoInventario.create({ data: { productoId: l.productoId as string, localId: x.localId, tipo: 'Venta eliminada', entrada: l.cantidad, salida: 0, saldo, motivo: `Nota de venta ${x.codigo} eliminada`, usuarioId: real.id } });
      }
      if (x.ordenId) await tx.bitacora.create({ data: { ordenId: x.ordenId, actorId: real.id, texto: `Nota de venta ${x.codigo} eliminada: ${motivo}. Sus pagos quedan registrados.` } });
    });
    const res = resumenNota(await this.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'nota_venta', id, resumenNota(x), res, 'Nota de venta anulada');
    return res;
  }
}
