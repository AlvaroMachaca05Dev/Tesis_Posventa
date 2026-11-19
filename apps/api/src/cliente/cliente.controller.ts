import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { choqueUnico, eliminarRegistro, empresaDe, texto } from '../comun/validacion';
import { datosTercero, revisarMovil } from '../comun/tercero';
import { PAISES } from './paises';
import { normalizarPlaca } from '../vehiculo/vehiculo.reglas';
import { errorDocumento } from '../maestros/maestros.reglas';

type ClienteFila = Prisma.ClienteGetPayload<object>;

function resumenCliente(c: ClienteFila) {
  return {
    id: c.id,
    tipoDocumento: c.tipoDocumento,
    documento: c.documento,
    nombre: c.nombre,
    nombreComercial: c.nombreComercial,
    pais: c.pais,
    movil: c.movil,
    direccionFiscal: c.direccionFiscal,
    email: c.email,
    contacto: c.contacto,
    ubigeo: c.ubigeo,
    comentario: c.comentario,
    esGenerico: c.esGenerico,
    activo: c.activo,
    creadoEn: c.creadoEn.toISOString(),
  };
}

@Controller()
export class ClienteController {
  constructor(private prisma: PrismaService) {}

  /** Valida y normaliza los datos del cliente que llegan; con `parcial` solo revisa lo que vino. */
  private datosCliente(b: Record<string, unknown>, paisBase: string, parcial: boolean) {
    // En un cliente solo el tipo y el número de documento son obligatorios; el nombre puede quedar vacío.
    const d = datosTercero(b, { tipoPorDefecto: 'DNI', paisBase, parcial, nombreOpcional: true });
    if (!parcial || b.ubigeo !== undefined) d.ubigeo = texto(b.ubigeo);
    return d;
  }

  // Los países y el país predeterminado los usan los formularios de clientes y de proveedores: basta con haber ingresado.
  @Get('maestros/config')
  async config(@SesionActual() s: Sesion) {
    const org = await this.prisma.organizacion.findUniqueOrThrow({ where: { id: empresaDe(s) } });
    return { paisPredeterminado: org.paisPredeterminado, paises: PAISES };
  }

  @Get('clientes')
  @Requiere('clientes', 'V')
  async clientes(@SesionActual() s: Sesion, @Query('q') q?: string, @Query('activo') activo?: string) {
    const organizacionId = empresaDe(s);
    const busca = String(q ?? '').trim();
    const placa = normalizarPlaca(busca);
    const where: Prisma.ClienteWhereInput = { organizacionId };
    if (activo === 'true' || activo === 'false') where.activo = activo === 'true';
    if (busca) {
      const contiene = { contains: busca, mode: 'insensitive' as const };
      where.OR = [{ documento: contiene }, { nombre: contiene }, { nombreComercial: contiene }, { email: contiene }, { movil: contiene }, ...(placa ? [{ vehiculos: { some: { placaNorm: { contains: placa } } } }] : [])];
    }
    const lista = await this.prisma.cliente.findMany({ where, orderBy: { nombre: 'asc' }, take: 100, include: { _count: { select: { vehiculos: true } } } });
    return lista.map((c) => ({ ...resumenCliente(c), vehiculos: c._count.vehiculos }));
  }

  @Get('clientes/:id')
  @Requiere('clientes', 'V')
  async cliente(@SesionActual() s: Sesion, @Param('id') id: string) {
    const c = await this.prisma.cliente.findFirst({ where: { id, organizacionId: empresaDe(s) }, include: { vehiculos: { orderBy: { placa: 'asc' } } } });
    if (!c) throw new NotFoundException('Cliente no encontrado.');
    return { ...resumenCliente(c), vehiculos: c.vehiculos.map((v) => ({ id: v.id, placa: v.placa, marca: v.marca, modelo: v.modelo, anio: v.anio })) };
  }

  @Post('clientes')
  @Requiere('clientes', 'E')
  async crearCliente(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const org = await this.prisma.organizacion.findUniqueOrThrow({ where: { id: organizacionId } });
    const d = this.datosCliente(b ?? {}, org.paisPredeterminado, false);
    revisarMovil(d);
    const errDoc = errorDocumento(String(d.tipoDocumento), String(d.documento));
    if (errDoc) throw new BadRequestException(errDoc);
    const igual = await this.prisma.cliente.findUnique({ where: { organizacionId_documento: { organizacionId, documento: d.documento as string } } });
    if (igual) throw new ConflictException(`Ese documento ya existe en el sistema (${igual.nombre}).`);
    try {
      const c = await this.prisma.cliente.create({ data: { ...(d as Prisma.ClienteUncheckedCreateInput), organizacionId } });
      const res = resumenCliente(c);
      await auditar(this.prisma, real, s, 'cliente', c.id, null, res, 'Cliente creado');
      return res;
    } catch (e) {
      return choqueUnico(e, 'Ese documento ya existe en el sistema.');
    }
  }

  @Patch('clientes/:id')
  @Requiere('clientes', 'E')
  async editarCliente(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const actual = await this.prisma.cliente.findFirst({ where: { id, organizacionId } });
    if (!actual) throw new NotFoundException('Cliente no encontrado.');
    const cuerpo = b ?? {};
    const d = this.datosCliente(cuerpo, actual.pais, true);
    if (cuerpo.activo !== undefined) d.activo = !!cuerpo.activo;
    if (actual.esGenerico) {
      if (d.activo === false) throw new BadRequestException('«Clientes varios» no se puede dar de baja.');
      if (d.documento !== undefined && d.documento !== actual.documento) throw new BadRequestException('«Clientes varios» no puede cambiar de documento.');
    }
    revisarMovil(d, actual);
    if (!actual.esGenerico && (d.tipoDocumento !== undefined || d.documento !== undefined)) {
      const errDoc = errorDocumento(String(d.tipoDocumento ?? actual.tipoDocumento), String(d.documento ?? actual.documento));
      if (errDoc) throw new BadRequestException(errDoc);
    }
    if (d.documento !== undefined && d.documento !== actual.documento) {
      const igual = await this.prisma.cliente.findUnique({ where: { organizacionId_documento: { organizacionId, documento: d.documento as string } } });
      if (igual) throw new ConflictException(`Ese documento ya existe en el sistema (${igual.nombre}).`);
    }
    try {
      const c = await this.prisma.cliente.update({ where: { id }, data: d as Prisma.ClienteUncheckedUpdateInput });
      const res = resumenCliente(c);
      const motivo = d.documento !== undefined && d.documento !== actual.documento ? 'Cambio de documento' : d.activo !== undefined && d.activo !== actual.activo ? (d.activo ? 'Cliente reactivado' : 'Cliente dado de baja') : 'Cliente modificado';
      await auditar(this.prisma, real, s, 'cliente', c.id, resumenCliente(actual), res, motivo);
      return res;
    } catch (e) {
      return choqueUnico(e, 'Ese documento ya existe en el sistema.');
    }
  }

  /** Sin vehículos, órdenes ni comprobantes se borra; con historial sale de la lista activa y se puede restaurar. */
  @Delete('clientes/:id')
  @Requiere('clientes', 'E')
  async eliminarCliente(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string) {
    const organizacionId = empresaDe(s);
    const c = await this.prisma.cliente.findFirst({ where: { id, organizacionId } });
    if (!c) throw new NotFoundException('Cliente no encontrado.');
    if (c.esGenerico) throw new BadRequestException('«Clientes varios» no se puede eliminar.');
    const r = await eliminarRegistro(() => this.prisma.cliente.delete({ where: { id } }), () => this.prisma.cliente.update({ where: { id }, data: { activo: false } }), 'El cliente tiene historial.');
    await auditar(this.prisma, real, s, 'cliente', id, resumenCliente(c), null, r.eliminado ? 'Cliente eliminado' : 'Cliente dado de baja (tenía historial)');
    return r;
  }
}
