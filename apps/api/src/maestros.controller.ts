import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from './acceso';
import { PAISES } from './paises';
import { PrismaService } from './prisma.service';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIPOS_DOCUMENTO = ['DNI', 'CARNET_EXTRANJERIA', 'RUC'];
/** La placa sin guiones, espacios ni minúsculas: así «abc-123», «ABC 123» y «ABC123» son la misma. */
export const normalizarPlaca = (p: string) => p.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

type ClienteFila = Prisma.ClienteGetPayload<object>;
type VehiculoFila = Prisma.VehiculoGetPayload<{ include: { cliente: true; lecturas: true } }>;

const texto = (v: unknown, max = 500) => {
  const t = String(v ?? '').trim();
  if (t.length > max) throw new BadRequestException(`El texto supera los ${max} caracteres.`);
  return t === '' ? null : t;
};
export const KM_MAXIMO = 3_000_000;

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

function resumenVehiculo(v: VehiculoFila) {
  return {
    id: v.id,
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    anio: v.anio,
    color: v.color,
    nroSerie: v.nroSerie,
    nroVin: v.nroVin,
    nroMotor: v.nroMotor,
    comentario: v.comentario,
    grupo: v.grupo,
    creadoEn: v.creadoEn.toISOString(),
    kmActual: v.lecturas[0]?.km ?? null,
    cliente: { id: v.cliente.id, nombre: v.cliente.nombre, documento: v.cliente.documento, tipoDocumento: v.cliente.tipoDocumento },
  };
}

const INCLUIR_VEHICULO = { cliente: true, lecturas: { orderBy: { fecha: 'desc' as const }, take: 1 } };

@Controller()
export class MaestrosController {
  constructor(private prisma: PrismaService) {}

  /** Los datos de negocio son de una empresa: quien no tiene empresa (el Desarrollador) debe elegir a quién «ver como». */
  private empresa(s: Sesion) {
    if (!s.organizacionId) throw new BadRequestException('Esta acción es de una empresa. Usa «Ver como…» para entrar como un usuario de la empresa.');
    return s.organizacionId;
  }

  private choqueUnico(e: unknown, mensaje: string): never {
    if ((e as { code?: string })?.code === 'P2002') throw new ConflictException(mensaje);
    throw e;
  }

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
    const org = await this.prisma.organizacion.findUniqueOrThrow({ where: { id: this.empresa(s) } });
    return { paisPredeterminado: org.paisPredeterminado, paises: PAISES };
  }

  // ───────── Clientes ─────────
  @Get('clientes')
  @Requiere('clientes', 'V')
  async clientes(@SesionActual() s: Sesion, @Query('q') q?: string, @Query('activo') activo?: string) {
    const organizacionId = this.empresa(s);
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
    const c = await this.prisma.cliente.findFirst({ where: { id, organizacionId: this.empresa(s) }, include: { vehiculos: { orderBy: { placa: 'asc' } } } });
    if (!c) throw new NotFoundException('Cliente no encontrado.');
    return { ...resumenCliente(c), vehiculos: c.vehiculos.map((v) => ({ id: v.id, placa: v.placa, marca: v.marca, modelo: v.modelo, anio: v.anio })) };
  }

  @Post('clientes')
  @Requiere('clientes', 'E')
  async crearCliente(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = this.empresa(s);
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
      return this.choqueUnico(e, 'Ese documento ya existe en el sistema.');
    }
  }

  @Patch('clientes/:id')
  @Requiere('clientes', 'E')
  async editarCliente(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = this.empresa(s);
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
      return this.choqueUnico(e, 'Ese documento ya existe en el sistema.');
    }
  }

  // ───────── Vehículos ─────────
  private datosVehiculo(b: Record<string, unknown>, parcial: boolean) {
    const d: Record<string, unknown> = {};
    const viene = (k: string) => b[k] !== undefined;
    if (!parcial || viene('placa')) {
      const placa = texto(b.placa, 15);
      if (!placa || !normalizarPlaca(placa)) throw new BadRequestException('Escribe la placa.');
      d.placa = placa;
      d.placaNorm = normalizarPlaca(placa);
    }
    if (!parcial || viene('anio')) {
      const a = b.anio === undefined || b.anio === null || b.anio === '' ? null : Number(b.anio);
      if (a !== null && (!Number.isInteger(a) || a < 1900 || a > 2100)) throw new BadRequestException('El año no es válido.');
      d.anio = a;
    }
    for (const k of ['marca', 'modelo', 'color', 'nroSerie', 'nroVin', 'nroMotor', 'comentario', 'grupo']) if (!parcial || viene(k)) d[k] = texto(b[k]);
    return d;
  }

  private async placaRepetida(organizacionId: string, placaNorm: string, exceptoId?: string) {
    const v = await this.prisma.vehiculo.findUnique({ where: { organizacionId_placaNorm: { organizacionId, placaNorm } }, include: { cliente: true } });
    if (v && v.id !== exceptoId) {
      throw new ConflictException({ message: `La placa ${v.placa} ya existe y pertenece a ${v.cliente.nombre} (documento ${v.cliente.documento}).`, vehiculoId: v.id, clienteId: v.clienteId });
    }
  }

  private async clienteDeEmpresa(organizacionId: string, id: unknown) {
    const c = id ? await this.prisma.cliente.findFirst({ where: { id: String(id), organizacionId } }) : null;
    if (!c) throw new NotFoundException('Cliente no encontrado.');
    if (!c.activo) throw new ConflictException('El cliente está eliminado: restáuralo antes de asignarle vehículos.');
    return c;
  }

  @Get('marcas-vehiculo')
  @Requiere('vehiculos', 'V')
  async marcas(@SesionActual() s: Sesion) {
    const m = await this.prisma.marcaVehiculo.findMany({ where: { organizacionId: this.empresa(s) }, orderBy: { nombre: 'asc' } });
    return m.map((x) => ({ id: x.id, nombre: x.nombre, modelos: x.modelos }));
  }

  @Get('vehiculos')
  @Requiere('vehiculos', 'V')
  async vehiculos(@SesionActual() s: Sesion, @Query('q') q?: string) {
    const organizacionId = this.empresa(s);
    const busca = String(q ?? '').trim();
    const placa = normalizarPlaca(busca);
    const where: Prisma.VehiculoWhereInput = { organizacionId };
    if (busca) {
      const contiene = { contains: busca, mode: 'insensitive' as const };
      where.OR = [
        ...(placa ? [{ placaNorm: { contains: placa } }] : []),
        { nroVin: contiene },
        { nroSerie: contiene },
        { nroMotor: contiene },
        { cliente: { OR: [{ nombre: contiene }, { nombreComercial: contiene }, { documento: contiene }] } },
      ];
    }
    const lista = await this.prisma.vehiculo.findMany({ where, orderBy: { placa: 'asc' }, take: 100, include: INCLUIR_VEHICULO });
    return lista.map(resumenVehiculo);
  }

  @Get('vehiculos/:id')
  @Requiere('vehiculos', 'V')
  async vehiculo(@SesionActual() s: Sesion, @Param('id') id: string) {
    const v = await this.prisma.vehiculo.findFirst({ where: { id, organizacionId: this.empresa(s) }, include: INCLUIR_VEHICULO });
    if (!v) throw new NotFoundException('Vehículo no encontrado.');
    return resumenVehiculo(v);
  }

  @Post('vehiculos')
  @Requiere('vehiculos', 'E')
  async crearVehiculo(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = this.empresa(s);
    const cuerpo = b ?? {};
    const d = this.datosVehiculo(cuerpo, false);
    await this.clienteDeEmpresa(organizacionId, cuerpo.clienteId);
    await this.placaRepetida(organizacionId, d.placaNorm as string);
    try {
      const v = await this.prisma.vehiculo.create({ data: { ...(d as Prisma.VehiculoUncheckedCreateInput), organizacionId, clienteId: String(cuerpo.clienteId) }, include: INCLUIR_VEHICULO });
      const res = resumenVehiculo(v);
      await auditar(this.prisma, real, s, 'vehiculo', v.id, null, res, 'Vehículo creado');
      return res;
    } catch (e) {
      return this.choqueUnico(e, 'Esa placa ya existe en el sistema.');
    }
  }

  @Patch('vehiculos/:id')
  @Requiere('vehiculos', 'E')
  async editarVehiculo(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = this.empresa(s);
    const actual = await this.prisma.vehiculo.findFirst({ where: { id, organizacionId }, include: INCLUIR_VEHICULO });
    if (!actual) throw new NotFoundException('Vehículo no encontrado.');
    const cuerpo = b ?? {};
    const d = this.datosVehiculo(cuerpo, true);
    const traspaso = cuerpo.clienteId !== undefined && String(cuerpo.clienteId) !== actual.clienteId;
    if (traspaso) {
      await this.clienteDeEmpresa(organizacionId, cuerpo.clienteId);
      d.clienteId = String(cuerpo.clienteId);
    }
    if (d.placaNorm !== undefined) await this.placaRepetida(organizacionId, d.placaNorm as string, id);
    try {
      const v = await this.prisma.vehiculo.update({ where: { id }, data: d as Prisma.VehiculoUncheckedUpdateInput, include: INCLUIR_VEHICULO });
      const res = resumenVehiculo(v);
      const motivo = traspaso ? 'Traspaso de titular' : d.placa !== undefined && d.placa !== actual.placa ? 'Corrección de placa' : 'Vehículo modificado';
      await auditar(this.prisma, real, s, 'vehiculo', v.id, resumenVehiculo(actual), res, motivo);
      return res;
    } catch (e) {
      return this.choqueUnico(e, 'Esa placa ya existe en el sistema.');
    }
  }

  // ───────── Lecturas de kilometraje ─────────
  @Get('vehiculos/:id/lecturas')
  @Requiere('vehiculos', 'V')
  async lecturas(@SesionActual() s: Sesion, @Param('id') id: string) {
    const v = await this.prisma.vehiculo.findFirst({ where: { id, organizacionId: this.empresa(s) } });
    if (!v) throw new NotFoundException('Vehículo no encontrado.');
    const l = await this.prisma.lecturaKm.findMany({ where: { vehiculoId: id }, orderBy: { fecha: 'desc' } });
    return l.map((x) => ({ id: x.id, km: x.km, fecha: x.fecha.toISOString(), fuente: x.fuente, observacion: x.observacion }));
  }

  @Post('vehiculos/:id/lecturas')
  @Requiere('vehiculos', 'E')
  async registrarLectura(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: { km?: unknown; fecha?: unknown; observacion?: unknown; fuente?: unknown }) {
    const v = await this.prisma.vehiculo.findFirst({ where: { id, organizacionId: this.empresa(s) } });
    if (!v) throw new NotFoundException('Vehículo no encontrado.');
    const km = Number(b?.km);
    if (b?.km === undefined || b?.km === null || b?.km === '' || !Number.isInteger(km) || km < 0 || km > KM_MAXIMO) throw new BadRequestException('El kilometraje debe ser un número entero entre 0 y 3 000 000.');
    const fecha = b?.fecha ? new Date(String(b.fecha)) : new Date();
    if (Number.isNaN(fecha.getTime()) || fecha.getTime() > Date.now() + 86_400_000) throw new BadRequestException('La fecha no es válida (no puede ser futura).');
    const l = await this.prisma.lecturaKm.create({ data: { vehiculoId: id, km, fecha, fuente: ['Llamada', 'WhatsApp', 'En taller', 'Otro'].includes(String(b?.fuente)) ? String(b?.fuente) : 'manual', observacion: texto(b?.observacion) } });
    const res = { id: l.id, km: l.km, fecha: l.fecha.toISOString(), fuente: l.fuente, observacion: l.observacion };
    await auditar(this.prisma, real, s, 'lectura_km', l.id, null, { vehiculoId: id, ...res }, 'Lectura de kilometraje');
    return res;
  }
}
