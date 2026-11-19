import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { empresaDe } from '../comun/validacion';
import { INCLUIR_NOTA, resumenNota } from '../facturacion/notaVenta.controller';
import { CompraController, leerPago, r2, resumenCompra } from './compra.controller';

/** Cuentas por cobrar (notas de venta con saldo) y por pagar (compras con saldo): solo lo pendiente (DEC-44). */
@Controller()
export class CuentasController {
  constructor(private prisma: PrismaService) {}

  @Get('cuentas-cobrar')
  @Requiere('cobrar', 'V')
  async porCobrar(@SesionActual() s: Sesion) {
    const notas = await this.prisma.notaVenta.findMany({ where: { organizacionId: empresaDe(s), estado: 'EMITIDA' }, include: INCLUIR_NOTA, orderBy: { fechaEmision: 'asc' }, take: 2000 });
    return notas.map(resumenNota).filter((x) => x.saldo > 0);
  }

  /** Cobro de una nota: va a la ODS si la tiene (así la orden ve el pago, aunque ya esté cerrada) o a la propia nota. */
  @Post('notas-venta/:id/cobros')
  @Requiere('cobrar', 'E')
  async cobrar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const pago = leerPago(b);
    const nota = await this.prisma.notaVenta.findFirst({ where: { id, organizacionId } });
    if (!nota) throw new NotFoundException('Nota de venta no encontrada.');
    if (nota.estado !== 'EMITIDA') throw new ConflictException('La nota de venta fue eliminada: no admite cobros.');
    // Se bloquea la nota y se recalcula el saldo dentro de la transacción: dos cobros a la vez no pasan del total.
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "NotaVenta" WHERE id = ${id} FOR UPDATE`;
      const abonos = await tx.abono.findMany({ where: { OR: [{ notaId: id }, ...(nota.ordenId ? [{ ordenId: nota.ordenId }] : [])] } });
      const saldo = r2(Number(nota.total) - abonos.reduce((a, x) => a + Number(x.valor), 0));
      if (pago.valor > saldo) throw new BadRequestException(`El importe supera el saldo (S/ ${saldo.toFixed(2)}).`);
      await tx.abono.create({ data: { ...(nota.ordenId ? { ordenId: nota.ordenId } : { notaId: id }), metodo: pago.metodo, concepto: pago.concepto ?? `Cobro ${nota.codigo}`, valor: pago.valor, registradoPorId: real.id } });
      if (nota.ordenId) await tx.bitacora.create({ data: { ordenId: nota.ordenId, actorId: real.id, texto: `Cobro de S/ ${pago.valor.toFixed(2)} (${pago.metodo}) a la nota ${nota.codigo}.` } });
    });
    const res = resumenNota((await this.prisma.notaVenta.findUniqueOrThrow({ where: { id }, include: INCLUIR_NOTA })));
    await auditar(this.prisma, real, s, 'cobro', id, null, pago, 'Cobro registrado');
    return res;
  }

  @Get('cuentas-pagar')
  @Requiere('pagar', 'V')
  async porPagar(@SesionActual() s: Sesion) {
    const filas = await new CompraController(this.prisma).listaInterna(empresaDe(s), { estado: 'REGISTRADA' });
    return filas.filter((x) => x.saldo > 0);
  }

  @Post('compras/:id/pagos')
  @Requiere('pagar', 'E')
  async pagar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const pago = leerPago(b);
    const compras = new CompraController(this.prisma);
    const c = await compras.cargar(id, organizacionId);
    if (c.estado !== 'REGISTRADA') throw new ConflictException('La compra fue eliminada: no admite pagos.');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Compra" WHERE id = ${id} FOR UPDATE`;
      const pagos = await tx.pagoCompra.findMany({ where: { compraId: id } });
      const saldo = r2(Number(c.total) - pagos.reduce((a, x) => a + Number(x.valor), 0));
      if (pago.valor > saldo) throw new BadRequestException(`El importe supera el saldo (S/ ${saldo.toFixed(2)}).`);
      await tx.pagoCompra.create({ data: { compraId: id, metodo: pago.metodo, concepto: pago.concepto ?? `Pago ${c.serie}-${c.numero}`, valor: pago.valor, registradoPorId: real.id } });
    });
    const res = resumenCompra(await compras.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'pago_compra', id, null, pago, 'Pago a proveedor registrado');
    return res;
  }
}
