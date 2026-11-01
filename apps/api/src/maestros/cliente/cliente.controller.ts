import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../../comun/acceso';
import { PrismaService } from '../../comun/prisma.service';
import { choqueUnico, empresaDe, texto } from '../../comun/validacion';
import { PAISES } from '../paises';
import { normalizarPlaca } from '../vehiculo/vehiculo.reglas';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIPOS_DOCUMENTO = ['DNI', 'CARNET_EXTRANJERIA', 'RUC'];

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
    const d: Record<string, unknown> = {};
    const viene = (k: string) => b[k] !== undefined;
    if (!parcial || viene('tipoDocumento')) {
      const t = b.tipoDocumento === undefined || b.tipoDocumento === '' ? 'DNI' : String(b.tipoDocumento);
      if (!TIPOS_DOCUMENTO.includes(t)) throw new BadRequestException('Elige el tipo de documento: DNI, Carné de extranjería o RUC.');
      d.tipoDocumento = t;
    }
    if (!parcial || viene('documento')) {
      const doc = texto(b.documento, 20)?.toUpperCase();
      if (!doc) throw new BadRequestException('Escribe el número de documento (hasta 20 caracteres).');
      d.documento = doc;
    }
    if (!parcial || viene('nombre')) {
      const n = texto(b.nombre, 150);
      if (!n) throw new BadRequestException('Escribe el nombre o la razón social.');
      d.nombre = n;
    }
    if (!parcial || viene('pais')) {
      const p = (texto(b.pais) ?? paisBase).toUpperCase();
      if (!PAISES.some((x) => x.codigo === p)) throw new BadRequestException('El país no es válido.');
      d.pais = p;
    }
    if (!parcial || viene('movil')) {
      const m = String(b.movil ?? '').replace(/[\s-]/g, '');
      d.movil = m === '' ? null : m;
    }
    if (!parcial || viene('email')) {
      const e = texto(b.email);
      if (e && !CORREO.test(e)) throw new BadRequestException('El correo no es válido.');
      d.email = e;
    }
    for (const k of ['nombreComercial', 'direccionFiscal', 'ubigeo', 'comentario']) if (!parcial || viene(k)) d[k] = texto(b[k]);
    return d;
  }

  /** El móvil se escribe sin prefijo: en Perú son 9 dígitos y en otros países entre 6 y 15. */
  private validarMovil(pais: string, movil: string | null | undefined) {
    if (!movil) return;
    if (!/^\d+$/.test(movil)) throw new BadRequestException('El móvil solo lleva números, sin el prefijo del país.');
    if (pais === 'PE' ? movil.length !== 9 : movil.length < 6 || movil.length > 15) {
      throw new BadRequestException(pais === 'PE' ? 'El móvil de Perú lleva 9 dígitos.' : 'El móvil debe tener entre 6 y 15 dígitos.');
    }
  }

  @Get('maestros/config')
  @Requiere('clientes', 'V')
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
    this.validarMovil(d.pais as string, d.movil as string | null);
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
    this.validarMovil((d.pais as string | undefined) ?? actual.pais, d.movil !== undefined ? (d.movil as string | null) : actual.movil);
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
}
