import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { choqueUnico, empresaDe, texto } from '../comun/validacion';
import { KM_MAXIMO, normalizarPlaca } from './vehiculo.reglas';

type VehiculoFila = Prisma.VehiculoGetPayload<{ include: { cliente: true; lecturas: true } }>;

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
export class VehiculoController {
  constructor(private prisma: PrismaService) {}

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
    const m = await this.prisma.marcaVehiculo.findMany({ where: { organizacionId: empresaDe(s) }, orderBy: { nombre: 'asc' } });
    return m.map((x) => ({ id: x.id, nombre: x.nombre, modelos: x.modelos }));
  }

  @Get('vehiculos')
  @Requiere('vehiculos', 'V')
  async vehiculos(@SesionActual() s: Sesion, @Query('q') q?: string) {
    const organizacionId = empresaDe(s);
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
    const v = await this.prisma.vehiculo.findFirst({ where: { id, organizacionId: empresaDe(s) }, include: INCLUIR_VEHICULO });
    if (!v) throw new NotFoundException('Vehículo no encontrado.');
    return resumenVehiculo(v);
  }

  @Post('vehiculos')
  @Requiere('vehiculos', 'E')
  async crearVehiculo(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
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
      return choqueUnico(e, 'Esa placa ya existe en el sistema.');
    }
  }

  @Patch('vehiculos/:id')
  @Requiere('vehiculos', 'E')
  async editarVehiculo(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
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
      return choqueUnico(e, 'Esa placa ya existe en el sistema.');
    }
  }

  // ───────── Lecturas de kilometraje ─────────
  @Get('vehiculos/:id/lecturas')
  @Requiere('vehiculos', 'V')
  async lecturas(@SesionActual() s: Sesion, @Param('id') id: string) {
    const v = await this.prisma.vehiculo.findFirst({ where: { id, organizacionId: empresaDe(s) } });
    if (!v) throw new NotFoundException('Vehículo no encontrado.');
    const l = await this.prisma.lecturaKm.findMany({ where: { vehiculoId: id }, orderBy: { fecha: 'desc' } });
    return l.map((x) => ({ id: x.id, km: x.km, fecha: x.fecha.toISOString(), fuente: x.fuente, observacion: x.observacion }));
  }

  @Post('vehiculos/:id/lecturas')
  @Requiere('vehiculos', 'E')
  async registrarLectura(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: { km?: unknown; fecha?: unknown; observacion?: unknown; fuente?: unknown }) {
    const v = await this.prisma.vehiculo.findFirst({ where: { id, organizacionId: empresaDe(s) } });
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
