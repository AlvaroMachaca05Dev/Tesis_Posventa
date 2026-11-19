import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { empresaDe, texto } from '../comun/validacion';
import { parsearItems } from './lineas';
import { proponeDetraccion, totalesNota } from './notaVenta.reglas';

const INCLUIR = { detalles: { orderBy: { posicion: 'asc' as const } }, local: true, cliente: true, vehiculo: true, creadaPor: true, anuladaPor: true };
type Cot = Prisma.CotizacionGetPayload<{ include: typeof INCLUIR }>;
const n = (d: Prisma.Decimal | number) => Number(d);
const METODOS = ['Efectivo', 'Yape', 'Transferencia', 'Tarjeta', 'Otro'];
const inicioDeHoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export function resumenCotizacion(x: Cot) {
  // «Vencida» no se guarda: sale de comparar «válida hasta» con hoy.
  const estado = x.estado === 'ANULADA' ? 'ANULADA' : x.validaHasta.getTime() < inicioDeHoy().getTime() ? 'VENCIDA' : 'VIGENTE';
  return {
    id: x.id, codigo: x.codigo, estado, fechaEmision: x.fechaEmision.toISOString(), validaHasta: x.validaHasta.toISOString(),
    condicion: x.condicion, formaPago: x.formaPago, conIgv: x.conIgv, conDetraccion: x.conDetraccion, observaciones: x.observaciones, comentario: x.comentario,
    local: { id: x.localId, nombre: x.local.nombre },
    cliente: { id: x.cliente.id, nombre: x.cliente.nombre, documento: x.cliente.documento, tipoDocumento: x.cliente.tipoDocumento, direccionFiscal: x.cliente.direccionFiscal, movil: x.cliente.movil },
    vehiculo: x.vehiculo ? { id: x.vehiculo.id, placa: x.vehiculo.placa, marca: x.vehiculo.marca, modelo: x.vehiculo.modelo } : null,
    detalles: x.detalles.map((d) => ({ id: d.id, tipo: d.tipo, descripcion: d.descripcion, referencia: d.referencia, cantidad: n(d.cantidad), precio: n(d.precio), descuentoPct: n(d.descuentoPct), tipoIgv: d.tipoIgv, total: n(d.total), servicioId: d.servicioId, productoId: d.productoId })),
    exonerada: n(x.exonerada), inafecta: n(x.inafecta), gravada: n(x.gravada), igv: n(x.igv), total: n(x.total),
    creadaPor: x.creadaPor.nombre, anuladaPor: x.anuladaPor?.nombre ?? null, motivoAnulacion: x.motivoAnulacion,
  };
}

/** Cotización: como la nota de venta pero no toca caja, pagos ni stock; el vehículo es opcional y vale hasta una fecha. */
@Controller('cotizaciones')
export class CotizacionController {
  constructor(private prisma: PrismaService) {}

  private async cargar(id: string, organizacionId: string) {
    const x = await this.prisma.cotizacion.findFirst({ where: { id, organizacionId }, include: INCLUIR });
    if (!x) throw new NotFoundException('Cotización no encontrada.');
    return x;
  }

  /** Valida y arma los datos de una cotización (los mismos al crearla y al editarla). */
  private async leer(organizacionId: string, b: Record<string, unknown>) {
    const cliente = await this.prisma.cliente.findFirst({ where: { id: String(b?.clienteId ?? ''), organizacionId } });
    if (!cliente) throw new BadRequestException('Elige el cliente de la cotización.');
    const vehiculoId = b?.vehiculoId ? String(b.vehiculoId) : null;
    if (vehiculoId && !(await this.prisma.vehiculo.findFirst({ where: { id: vehiculoId, organizacionId } }))) throw new BadRequestException('El vehículo no existe.');
    const lineas = parsearItems(b?.items);
    if (lineas.length === 0) throw new ConflictException('Agrega al menos un ítem a la cotización.');
    const validaHasta = b?.validaHasta ? new Date(String(b.validaHasta)) : new Date();
    if (Number.isNaN(validaHasta.getTime())) throw new BadRequestException('La fecha «válida hasta» no es válida.');
    if (validaHasta.getTime() < inicioDeHoy().getTime()) throw new BadRequestException('La cotización no puede vencer antes de hoy.');
    const condicion = b?.condicion === 'CREDITO' ? 'CREDITO' : 'CONTADO';
    const formaPago = b?.formaPago ? String(b.formaPago) : null;
    if (formaPago && !METODOS.includes(formaPago)) throw new BadRequestException('La forma de pago no es válida.');
    const t = totalesNota(lineas);
    for (const k of ['conIgv', 'conDetraccion']) if (b?.[k] !== undefined && typeof b[k] !== 'boolean') throw new BadRequestException(`«${k === 'conIgv' ? 'Incluir IGV' : 'Detracción'}» es sí o no.`);
    const conDetraccion = b?.conDetraccion === undefined ? proponeDetraccion(lineas, t.total) : b.conDetraccion === true;
    return { clienteId: cliente.id, vehiculoId, lineas, validaHasta, condicion, formaPago, conIgv: b?.conIgv !== false, conDetraccion, observaciones: texto(b?.observaciones, 1000), comentario: texto(b?.comentario, 1000), t };
  }

  @Post()
  @Requiere('cotizaciones', 'E')
  async crear(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    if (!s.localId) throw new ConflictException('Tu usuario no tiene un local asignado: la cotización se emite desde un local.');
    const { lineas, t, ...d } = await this.leer(organizacionId, b);
    const id = await this.prisma.$transaction(async (tx) => {
      const c = await tx.correlativoSerie.upsert({ where: { organizacionId_serie: { organizacionId, serie: 'COT' } }, create: { organizacionId, serie: 'COT', ultimo: 1 }, update: { ultimo: { increment: 1 } } });
      const x = await tx.cotizacion.create({ data: { organizacionId, localId: s.localId as string, ...d, serie: 'COT', numero: c.ultimo, codigo: `COT-${String(c.ultimo).padStart(6, '0')}`, ...t, creadaPorId: real.id, detalles: { create: lineas } } });
      return x.id;
    });
    const res = resumenCotizacion(await this.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'cotizacion', id, null, res, 'Cotización emitida');
    return res;
  }

  /** Una cotización no es un comprobante: se puede editar (mientras no esté anulada) y conserva su código. */
  @Patch(':id')
  @Requiere('cotizaciones', 'E')
  async editar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const antes = await this.cargar(id, organizacionId);
    if (antes.estado === 'ANULADA') throw new ConflictException('La cotización está anulada: no se puede editar.');
    const { lineas, t, ...d } = await this.leer(organizacionId, b);
    await this.prisma.$transaction(async (tx) => {
      await tx.detalleCotizacion.deleteMany({ where: { cotizacionId: id } });
      await tx.cotizacion.update({ where: { id }, data: { ...d, ...t, detalles: { create: lineas } } });
    });
    const res = resumenCotizacion(await this.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'cotizacion', id, resumenCotizacion(antes), res, 'Cotización editada');
    return res;
  }

  @Delete(':id')
  @Requiere('cotizaciones', 'A')
  async eliminar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string) {
    const x = await this.cargar(id, empresaDe(s));
    await this.prisma.cotizacion.delete({ where: { id } });
    await auditar(this.prisma, real, s, 'cotizacion', id, resumenCotizacion(x), null, 'Cotización eliminada');
    return { ok: true };
  }

  @Get()
  @Requiere('cotizaciones', 'V')
  async lista(@SesionActual() s: Sesion, @Query() f: { q?: string }) {
    const where: Prisma.CotizacionWhereInput = { organizacionId: empresaDe(s) };
    const q = String(f.q ?? '').trim();
    if (q) { const c = { contains: q, mode: 'insensitive' as const }; where.OR = [{ codigo: c }, { cliente: { nombre: c } }, { cliente: { documento: c } }]; }
    return (await this.prisma.cotizacion.findMany({ where, include: INCLUIR, orderBy: { creadoEn: 'desc' }, take: 200 })).map(resumenCotizacion);
  }

  @Get(':id')
  @Requiere('cotizaciones', 'V')
  async una(@SesionActual() s: Sesion, @Param('id') id: string) {
    return resumenCotizacion(await this.cargar(id, empresaDe(s)));
  }

  @Post(':id/anular')
  @Requiere('cotizaciones', 'A')
  async anular(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const x = await this.cargar(id, organizacionId);
    if (x.estado === 'ANULADA') throw new ConflictException('Esta cotización ya está anulada.');
    const motivo = texto(b?.motivo, 500);
    if (!motivo) throw new BadRequestException('Escribe el motivo de la anulación.');
    await this.prisma.cotizacion.update({ where: { id }, data: { estado: 'ANULADA', anuladaPorId: real.id, motivoAnulacion: motivo } });
    const res = resumenCotizacion(await this.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'cotizacion', id, resumenCotizacion(x), res, 'Cotización anulada');
    return res;
  }
}
