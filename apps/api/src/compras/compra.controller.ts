import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { empresaDe, texto } from '../comun/validacion';

export const METODOS_PAGO = ['Efectivo', 'Yape', 'Transferencia', 'Tarjeta', 'Otro'];
export const TIPOS_COMPRA = ['FACTURA', 'BOLETA', 'NOTA_COMPRA'];
const MAX_ITEMS = 200;
const INCLUIR = { detalles: { orderBy: { posicion: 'asc' as const } }, pagos: { orderBy: { fecha: 'asc' as const }, include: { registradoPor: true } }, proveedor: true, local: true, registradaPor: true, anuladaPor: true };
type CompraCompleta = Prisma.CompraGetPayload<{ include: typeof INCLUIR }>;
const n = (d: Prisma.Decimal | number) => Number(d);
export const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

export function resumenCompra(c: CompraCompleta) {
  const pagado = r2(c.pagos.reduce((a, p) => a + n(p.valor), 0));
  return {
    id: c.id, tipoDocumento: c.tipoDocumento, serie: c.serie, numero: c.numero, codigo: `${c.serie}-${c.numero}`,
    fecha: c.fecha.toISOString(), condicion: c.condicion, fechaVencimiento: c.fechaVencimiento?.toISOString() ?? null,
    observaciones: c.observaciones, estado: c.estado, total: n(c.total), pagado,
    saldo: c.estado === 'REGISTRADA' ? Math.max(0, r2(n(c.total) - pagado)) : 0,
    local: { id: c.localId, nombre: c.local.nombre },
    proveedor: { id: c.proveedor.id, nombre: c.proveedor.nombre, documento: c.proveedor.documento, tipoDocumento: c.proveedor.tipoDocumento },
    detalles: c.detalles.map((d) => ({ id: d.id, productoId: d.productoId, descripcion: d.descripcion, cantidad: n(d.cantidad), costo: n(d.costo), descuento: n(d.descuento), total: n(d.total) })),
    pagos: c.pagos.map((p) => ({ id: p.id, fecha: p.fecha.toISOString(), metodo: p.metodo, concepto: p.concepto, valor: n(p.valor), registradoPor: p.registradoPor.nombre })),
    registradaPor: c.registradaPor.nombre, anuladaPor: c.anuladaPor?.nombre ?? null, motivoAnulacion: c.motivoAnulacion, anuladaEn: c.anuladaEn?.toISOString() ?? null,
  };
}

/** Número finito dentro de un rango; si no, 400 con el nombre del campo. */
export function numero(v: unknown, campo: string, min: number, max: number) {
  const x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(x) || x < min || x > max) throw new BadRequestException(`${campo}: escribe un número entre ${min} y ${max}.`);
  return x;
}

/** Fecha «AAAA-MM-DD» (o ISO) válida, entre el año 2000 y mañana como máximo cuando `hastaHoy`. */
export function fechaValida(v: unknown, campo: string, hastaHoy: boolean) {
  const t = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(t)) throw new BadRequestException(`${campo}: la fecha no es válida.`);
  const d = new Date(t.length === 10 ? `${t}T12:00:00-05:00` : t);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2100) throw new BadRequestException(`${campo}: la fecha no es válida.`);
  if (hastaHoy && d.getTime() > Date.now() + 86_400_000) throw new BadRequestException(`${campo}: no puede ser una fecha futura.`);
  return d;
}

/** Un pago (cobro o pago a proveedor): método conocido, valor con dos decimales mayor a cero y concepto corto. */
export function leerPago(b: Record<string, unknown> | undefined) {
  const metodo = String(b?.metodo ?? '');
  if (!METODOS_PAGO.includes(metodo)) throw new BadRequestException('Elige el método de pago.');
  const valor = r2(numero(b?.valor, 'Importe', 0.01, 10_000_000));
  return { metodo, valor, concepto: texto(b?.concepto, 200) };
}

/** Compras a proveedores: suben el stock del local y, a crédito, pasan a Cuentas por pagar. */
@Controller('compras')
export class CompraController {
  constructor(private prisma: PrismaService) {}

  async cargar(id: string, organizacionId: string) {
    const c = await this.prisma.compra.findFirst({ where: { id, organizacionId }, include: INCLUIR });
    if (!c) throw new NotFoundException('Compra no encontrada.');
    return c;
  }

  async listaInterna(organizacionId: string, extra: Prisma.CompraWhereInput = {}) {
    const filas = await this.prisma.compra.findMany({ where: { organizacionId, ...extra }, include: INCLUIR, orderBy: { creadoEn: 'desc' }, take: 2000 });
    return filas.map(resumenCompra);
  }

  @Get()
  @Requiere('compras', 'V')
  async lista(@SesionActual() s: Sesion) {
    return this.listaInterna(empresaDe(s));
  }

  /** Lo que necesita el formulario de compra, sin depender de los permisos de Proveedores o Catálogo. */
  @Get('catalogos')
  @Requiere('compras', 'V')
  async catalogos(@SesionActual() s: Sesion) {
    const organizacionId = empresaDe(s);
    const [proveedores, productos, locales] = await Promise.all([
      this.prisma.proveedor.findMany({ where: { organizacionId, activo: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.producto.findMany({ where: { organizacionId, activo: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.local.findMany({ where: { organizacionId }, orderBy: { nombre: 'asc' } }),
    ]);
    return {
      proveedores: proveedores.map((p) => ({ id: p.id, nombre: p.nombre, documento: p.documento })),
      productos: productos.map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, costo: p.costo === null ? null : n(p.costo), unidad: p.unidad })),
      locales: locales.map((l) => ({ id: l.id, nombre: l.nombre })),
      localId: s.localId, metodos: METODOS_PAGO,
    };
  }

  @Get(':id')
  @Requiere('compras', 'V')
  async una(@SesionActual() s: Sesion, @Param('id') id: string) {
    return resumenCompra(await this.cargar(id, empresaDe(s)));
  }

  @Post()
  @Requiere('compras', 'E')
  async crear(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const proveedor = await this.prisma.proveedor.findFirst({ where: { id: String(b?.proveedorId ?? ''), organizacionId, activo: true } });
    if (!proveedor) throw new BadRequestException('Elige el proveedor.');
    const localId = String(b?.localId ?? s.localId ?? '');
    const local = localId ? await this.prisma.local.findFirst({ where: { id: localId, organizacionId } }) : null;
    if (!local) throw new BadRequestException('Elige el local donde entra la compra.');
    const tipoDocumento = String(b?.tipoDocumento ?? 'FACTURA');
    if (!TIPOS_COMPRA.includes(tipoDocumento)) throw new BadRequestException('El tipo de comprobante es factura, boleta o nota de compra.');
    if (typeof b?.serie !== 'string' || !['string', 'number'].includes(typeof b?.numero)) throw new BadRequestException('Escribe la serie y el número del comprobante.');
    const serie = String(b?.serie ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{1,4}$/.test(serie)) throw new BadRequestException('La serie lleva de 1 a 4 letras o números (p. ej. F001).');
    const num = String(b?.numero ?? '').trim();
    if (!/^\d{1,10}$/.test(num)) throw new BadRequestException('El número del comprobante lleva solo dígitos (hasta 10).');
    const fecha = fechaValida(b?.fecha, 'Fecha de compra', true);
    const condicion = String(b?.condicion ?? 'CONTADO');
    if (!['CONTADO', 'CREDITO'].includes(condicion)) throw new BadRequestException('La condición es contado o crédito.');
    let fechaVencimiento: Date | null = null;
    if (condicion === 'CREDITO') {
      fechaVencimiento = fechaValida(b?.fechaVencimiento, 'Fecha de vencimiento', false);
      if (fechaVencimiento.getTime() < fecha.getTime()) throw new BadRequestException('El vencimiento no puede ser anterior a la fecha de compra.');
    }
    const metodo = condicion === 'CONTADO' ? String(b?.metodo ?? 'Efectivo') : null;
    if (metodo && !METODOS_PAGO.includes(metodo)) throw new BadRequestException('Elige el método de pago.');

    if (!Array.isArray(b?.items) || b.items.length === 0) throw new BadRequestException('Agrega al menos un producto a la compra.');
    if (b.items.length > MAX_ITEMS) throw new BadRequestException(`Una compra admite hasta ${MAX_ITEMS} ítems.`);
    const ids = [...new Set(b.items.map((x) => (x as { productoId?: unknown })?.productoId).filter((x): x is string => typeof x === 'string' && x !== ''))];
    const productos = new Map((await this.prisma.producto.findMany({ where: { id: { in: ids }, organizacionId } })).map((p) => [p.id, p]));
    const lineas = b.items.map((x, i) => {
      const it = (x ?? {}) as Record<string, unknown>;
      const productoId = typeof it.productoId === 'string' && it.productoId ? it.productoId : null;
      if (productoId && !productos.has(productoId)) throw new BadRequestException(`Ítem ${i + 1}: el producto no existe.`);
      const descripcion = texto(it.descripcion, 300) ?? (productoId ? productos.get(productoId)!.nombre : null);
      if (!descripcion) throw new BadRequestException(`Ítem ${i + 1}: escribe la descripción o elige un producto.`);
      const cantidad = Math.round(numero(it.cantidad, `Ítem ${i + 1} · cantidad`, 0.001, 1_000_000) * 1000) / 1000;
      const costo = r2(numero(it.costo, `Ítem ${i + 1} · costo`, 0, 1_000_000));
      const bruto = r2(cantidad * costo);
      const descuento = r2(numero(it.descuento ?? 0, `Ítem ${i + 1} · descuento`, 0, 1_000_000));
      if (descuento > bruto) throw new BadRequestException(`Ítem ${i + 1}: el descuento supera el subtotal.`);
      return { posicion: i, productoId, descripcion, cantidad, costo, descuento, total: r2(bruto - descuento) };
    });
    const total = r2(lineas.reduce((a, l) => a + l.total, 0));
    if (total <= 0) throw new BadRequestException('El total de la compra debe ser mayor a cero.');

    let compraId = '';
    try {
      compraId = await this.prisma.$transaction(async (tx) => {
        const c = await tx.compra.create({
          data: {
            organizacionId, localId: local.id, proveedorId: proveedor.id, tipoDocumento, serie, numero: num, fecha, condicion, fechaVencimiento,
            observaciones: texto(b?.observaciones, 1000), total, registradaPorId: real.id, detalles: { create: lineas },
          },
        });
        const codigo = `${serie}-${num}`;
        if (metodo) await tx.pagoCompra.create({ data: { compraId: c.id, metodo, concepto: 'Pago al contado', valor: total, registradoPorId: real.id } });
        // Cada producto entra al stock del local y queda en el kárdex; su costo pasa a ser el de esta compra.
        for (const l of lineas.filter((x) => x.productoId)) {
          const clave = { productoId_localId: { productoId: l.productoId as string, localId: local.id } };
          const antes = n((await tx.stockProducto.findUnique({ where: clave }))?.cantidad ?? 0);
          const saldo = Math.round((antes + l.cantidad) * 1000) / 1000;
          await tx.stockProducto.upsert({ where: clave, update: { cantidad: saldo }, create: { productoId: l.productoId as string, localId: local.id, cantidad: saldo } });
          await tx.movimientoInventario.create({ data: { productoId: l.productoId as string, localId: local.id, tipo: 'Compra', entrada: l.cantidad, salida: 0, saldo, motivo: `Compra ${codigo} · ${proveedor.nombre}`.slice(0, 300), usuarioId: real.id } });
          await tx.producto.update({ where: { id: l.productoId as string }, data: { costo: r2(l.total / l.cantidad) } });
        }
        return c.id;
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') throw new ConflictException('Ese comprobante del proveedor ya está registrado.');
      throw e;
    }
    const res = resumenCompra(await this.cargar(compraId, organizacionId));
    await auditar(this.prisma, real, s, 'compra', compraId, null, res, 'Compra registrada');
    return res;
  }

  /** La compra no se borra: se anula con motivo y el stock sale del local (puede quedar negativo, como en las ventas). */
  @Post(':id/anular')
  @Requiere('compras', 'A')
  async anular(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const c = await this.cargar(id, organizacionId);
    if (c.estado !== 'REGISTRADA') throw new ConflictException('Esta compra ya fue eliminada.');
    const motivo = texto(b?.motivo, 500);
    if (!motivo) throw new BadRequestException('Escribe el motivo de la eliminación.');
    const codigo = `${c.serie}-${c.numero}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.compra.update({ where: { id }, data: { estado: 'ANULADA', anuladaPorId: real.id, motivoAnulacion: motivo, anuladaEn: new Date() } });
      for (const l of c.detalles.filter((d) => d.productoId)) {
        const clave = { productoId_localId: { productoId: l.productoId as string, localId: c.localId } };
        const antes = n((await tx.stockProducto.findUnique({ where: clave }))?.cantidad ?? 0);
        const saldo = Math.round((antes - n(l.cantidad)) * 1000) / 1000;
        await tx.stockProducto.upsert({ where: clave, update: { cantidad: saldo }, create: { productoId: l.productoId as string, localId: c.localId, cantidad: saldo } });
        await tx.movimientoInventario.create({ data: { productoId: l.productoId as string, localId: c.localId, tipo: 'Compra eliminada', entrada: 0, salida: l.cantidad, saldo, motivo: `Compra ${codigo} eliminada`, usuarioId: real.id } });
      }
    });
    const res = resumenCompra(await this.cargar(id, organizacionId));
    await auditar(this.prisma, real, s, 'compra', id, resumenCompra(c), res, 'Compra anulada');
    return res;
  }
}
