import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { empresaDe, texto } from '../comun/validacion';
import { codigoNota, detraccionDe, proponeDetraccion, TIPOS_IGV, TipoIgv, tipoIgvPorDefecto, totalesNota } from './notaVenta.reglas';

const INCLUIR_NOTA = { detalles: { orderBy: { posicion: 'asc' as const } }, local: true, emitidaPor: true, anuladaPor: true, orden: { include: { cliente: true, vehiculo: true, abonos: true } } };
type Nota = Prisma.NotaVentaGetPayload<{ include: typeof INCLUIR_NOTA }>;
const n = (d: Prisma.Decimal | number) => Number(d);
const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

export function resumenNota(x: Nota) {
  const pagado = x.estado === 'EMITIDA' ? r2(x.orden.abonos.reduce((a, b) => a + n(b.valor), 0)) : 0;
  return {
    id: x.id, codigo: x.codigo, serie: x.serie, numero: x.numero, estado: x.estado, condicion: x.condicion,
    fechaEmision: x.fechaEmision.toISOString(), fechaVencimiento: x.fechaVencimiento?.toISOString() ?? null,
    local: { id: x.localId, nombre: x.local.nombre }, observaciones: x.observaciones, comentario: x.comentario,
    orden: { id: x.ordenId, codigo: x.orden.codigo, km: x.orden.km },
    cliente: { id: x.orden.cliente.id, nombre: x.orden.cliente.nombre, documento: x.orden.cliente.documento, tipoDocumento: x.orden.cliente.tipoDocumento, direccionFiscal: x.orden.cliente.direccionFiscal, movil: x.orden.cliente.movil },
    vehiculo: { placa: x.orden.vehiculo.placa, marca: x.orden.vehiculo.marca, modelo: x.orden.vehiculo.modelo },
    detalles: x.detalles.map((d) => ({ id: d.id, tipo: d.tipo, descripcion: d.descripcion, referencia: d.referencia, cantidad: n(d.cantidad), precio: n(d.precio), descuentoPct: n(d.descuentoPct), tipoIgv: d.tipoIgv, total: n(d.total) })),
    exonerada: n(x.exonerada), inafecta: n(x.inafecta), gravada: n(x.gravada), igv: n(x.igv), total: n(x.total),
    conDetraccion: x.conDetraccion, detraccionPct: n(x.detraccionPct), detraccionExacta: n(x.detraccionExacta), detraccion: n(x.detraccion),
    // La detracción la deposita la empresa: el saldo es el total menos lo pagado (DEC-82).
    pagado, saldo: x.estado === 'EMITIDA' ? r2(n(x.total) - pagado) : 0,
    emitidaPor: x.emitidaPor.nombre, anuladaPor: x.anuladaPor?.nombre ?? null, motivoAnulacion: x.motivoAnulacion, anuladaEn: x.anuladaEn?.toISOString() ?? null,
  };
}

/** Nota de venta interna (RF-088): se emite desde la ODS, con la serie del local, número consecutivo, tipo de IGV por ítem y detracción. */
@Controller()
export class NotaVentaController {
  constructor(private prisma: PrismaService) {}

  private async cargar(id: string, organizacionId: string) {
    const x = await this.prisma.notaVenta.findFirst({ where: { id, organizacionId }, include: INCLUIR_NOTA });
    if (!x) throw new NotFoundException('Nota de venta no encontrada.');
    return x;
  }

  @Post('ordenes/:id/nota-venta')
  @Requiere('ods', 'E')
  async emitir(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const o = await this.prisma.ordenServicio.findFirst({ where: { id, organizacionId, eliminada: false }, include: { detalles: { orderBy: { posicion: 'asc' } }, notas: true } });
    if (!o) throw new NotFoundException('Orden de servicio no encontrada.');
    if (o.estado === 'Cerrada') throw new ConflictException('La ODS está cerrada: reábrela para emitir su nota de venta.');
    if (o.decision === 'No aprobada') throw new ConflictException('El cliente no aprobó la orden: no se emite nota de venta.');
    if (o.notas.some((x) => x.estado === 'EMITIDA')) throw new ConflictException('Esta ODS ya tiene una nota de venta vigente.');
    if (o.detalles.length === 0) throw new ConflictException('La ODS no tiene ítems: agrega servicios o productos antes de emitir.');

    const localId = String(b?.localId ?? s.localId ?? o.localId);
    const local = await this.prisma.local.findFirst({ where: { id: localId, organizacionId } });
    if (!local) throw new BadRequestException('Elige un local de la empresa.');
    if (!local.serieNotaVenta) throw new ConflictException(`El local «${local.nombre}» no tiene serie de nota de venta. Asígnala en Empresa y parámetros.`);
    const serie = local.serieNotaVenta;

    const condicion = b?.condicion === undefined || b.condicion === '' ? 'CONTADO' : String(b.condicion);
    if (!['CONTADO', 'CREDITO'].includes(condicion)) throw new BadRequestException('La condición es contado o crédito.');
    let fechaVencimiento: Date | null = null;
    if (condicion === 'CREDITO') {
      fechaVencimiento = new Date(String(b?.fechaVencimiento ?? ''));
      if (Number.isNaN(fechaVencimiento.getTime())) throw new BadRequestException('A crédito hay que indicar la fecha de vencimiento.');
      if (fechaVencimiento.getTime() < Date.now() - 86_400_000) throw new BadRequestException('La fecha de vencimiento no puede ser anterior a hoy.');
    }
    const tipos = (b?.tiposIgv ?? {}) as Record<string, unknown>;
    const lineas = o.detalles.map((d, i) => {
      const pedido = tipos[d.id];
      if (pedido !== undefined && !TIPOS_IGV.includes(String(pedido) as TipoIgv)) throw new BadRequestException('El tipo de IGV es Gravado, Exonerado o Inafecto.');
      return {
        posicion: i, tipo: d.tipo, descripcion: d.descripcion, referencia: d.referencia, cantidad: d.cantidad, precio: d.precio, descuentoPct: d.descuentoPct,
        tipoIgv: (pedido !== undefined ? String(pedido) : tipoIgvPorDefecto(d.impuesto)) as TipoIgv, total: n(d.total), servicioId: d.servicioId, productoId: d.productoId,
      };
    });
    const t = totalesNota(lineas);
    if (t.total <= 0) throw new ConflictException('El total de la ODS es cero: no se emite nota de venta.');
    const conDetraccion = b?.conDetraccion === undefined ? proponeDetraccion(lineas, t.total) : b.conDetraccion === true;
    const det = conDetraccion ? detraccionDe(t.total) : { pct: 0, exacta: 0, redondeada: 0 };

    // El número lo da el servidor en la misma transacción: consecutivo por serie, sin saltos ni repetidos (RN-03).
    const notaId = await this.prisma.$transaction(async (tx) => {
      const c = await tx.correlativoSerie.upsert({ where: { organizacionId_serie: { organizacionId, serie } }, create: { organizacionId, serie, ultimo: 1 }, update: { ultimo: { increment: 1 } } });
      const codigo = codigoNota(serie, c.ultimo);
      const nota = await tx.notaVenta.create({
        data: {
          organizacionId, localId: local.id, ordenId: o.id, clienteId: o.clienteId, serie, numero: c.ultimo, codigo, condicion, fechaVencimiento,
          observaciones: texto(b?.observaciones, 1000), comentario: texto(b?.comentario, 1000),
          ...t, conDetraccion, detraccionPct: det.pct, detraccionExacta: det.exacta, detraccion: det.redondeada, emitidaPorId: real.id,
          detalles: { create: lineas },
        },
      });
      // El stock baja solo al emitir la nota y puede quedar negativo (DEC-76); cada salida queda en el kárdex con el código de la nota.
      for (const l of lineas.filter((x) => x.tipo === 'producto' && x.productoId)) {
        const clave = { productoId_localId: { productoId: l.productoId as string, localId: local.id } };
        const antes = n((await tx.stockProducto.findUnique({ where: clave }))?.cantidad ?? 0);
        const saldo = Math.round((antes - n(l.cantidad)) * 1000) / 1000;
        await tx.stockProducto.upsert({ where: clave, update: { cantidad: saldo }, create: { productoId: l.productoId as string, localId: local.id, cantidad: saldo } });
        await tx.movimientoInventario.create({ data: { productoId: l.productoId as string, localId: local.id, tipo: 'Venta', entrada: 0, salida: l.cantidad, saldo, motivo: `Nota de venta ${codigo}`, usuarioId: real.id } });
      }
      await tx.bitacora.create({ data: { ordenId: o.id, actorId: real.id, texto: `Nota de venta ${codigo} emitida por S/ ${t.total.toFixed(2)}${conDetraccion ? ` (detracción S/ ${det.redondeada.toFixed(2)})` : ''}.` } });
      return nota.id;
    });
    const res = resumenNota(await this.cargar(notaId, organizacionId));
    await auditar(this.prisma, real, s, 'nota_venta', notaId, null, res, 'Nota de venta emitida');
    return res;
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
      where.OR = [{ codigo: c }, { orden: { codigo: c } }, { orden: { cliente: { nombre: c } } }, { orden: { cliente: { documento: c } } }];
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
    if (x.estado !== 'EMITIDA') throw new ConflictException('Esta nota de venta ya está anulada.');
    const cerrada = await this.prisma.ordenServicio.findFirst({ where: { id: x.ordenId, estado: 'Cerrada' } });
    if (cerrada) throw new ConflictException('La ODS está cerrada: reábrela antes de anular su nota de venta.');
    const motivo = texto(b?.motivo, 500);
    if (!motivo) throw new BadRequestException('Escribe el motivo de la anulación.');
    await this.prisma.$transaction(async (tx) => {
      await tx.notaVenta.update({ where: { id }, data: { estado: 'ANULADA', anuladaPorId: real.id, motivoAnulacion: motivo, anuladaEn: new Date() } });
      for (const l of x.detalles.filter((d) => d.tipo === 'producto' && d.productoId)) {
        const clave = { productoId_localId: { productoId: l.productoId as string, localId: x.localId } };
        const antes = n((await tx.stockProducto.findUnique({ where: clave }))?.cantidad ?? 0);
        const saldo = Math.round((antes + n(l.cantidad)) * 1000) / 1000;
        await tx.stockProducto.upsert({ where: clave, update: { cantidad: saldo }, create: { productoId: l.productoId as string, localId: x.localId, cantidad: saldo } });
        await tx.movimientoInventario.create({ data: { productoId: l.productoId as string, localId: x.localId, tipo: 'Anulación de venta', entrada: l.cantidad, salida: 0, saldo, motivo: `Nota de venta ${x.codigo} anulada`, usuarioId: real.id } });
      }
      await tx.bitacora.create({ data: { ordenId: x.ordenId, actorId: real.id, texto: `Nota de venta ${x.codigo} anulada: ${motivo}` } });
    });
    const res = resumenNota(await this.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'nota_venta', id, resumenNota(x), res, 'Nota de venta anulada');
    return res;
  }
}
