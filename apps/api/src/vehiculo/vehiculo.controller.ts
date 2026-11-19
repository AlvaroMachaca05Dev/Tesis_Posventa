import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { aNumero, choqueUnico, eliminarRegistro, empresaDe, texto } from '../comun/validacion';
import { KM_MAXIMO, normalizarPlaca } from './vehiculo.reglas';
import { asignarGrupo } from '../maestros/maestros.reglas';
import { codigoPlan, combustibleDeGrupo } from '../plan/plan.controller';

type VehiculoFila = Prisma.VehiculoGetPayload<{ include: { cliente: true; lecturas: true; grupo: true; plan: true } }>;

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
    grupoId: v.grupoId,
    grupo: v.grupo?.codigo ?? null,
    grupoFuente: v.grupoFuente,
    codigoMotor: v.codigoMotor,
    uso: v.uso,
    aceite: v.aceite,
    planId: v.planId,
    plan: v.plan?.nombre ?? null,
    planCodigo: v.plan?.codigo ?? null,
    creadoEn: v.creadoEn.toISOString(),
    kmActual: v.lecturas[0]?.km ?? null,
    cliente: { id: v.cliente.id, nombre: v.cliente.nombre, documento: v.cliente.documento, tipoDocumento: v.cliente.tipoDocumento },
  };
}

const INCLUIR_VEHICULO = { cliente: true, grupo: true, plan: true, lecturas: { orderBy: { fecha: 'desc' as const }, take: 1 } };

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
      const a = b.anio === undefined || b.anio === null || b.anio === '' ? null : aNumero(b.anio);
      if (a !== null && (!Number.isInteger(a) || a < 1900 || a > 2100)) throw new BadRequestException('El año no es válido.');
      d.anio = a;
    }
    const largo: Record<string, number> = { marca: 60, modelo: 60, color: 40, nroSerie: 40, nroVin: 40, nroMotor: 40, comentario: 500 };
    for (const k of Object.keys(largo)) if (!parcial || viene(k)) d[k] = texto(b[k], largo[k]);
    if (viene('uso')) { const u = texto(b.uso, 20); if (u && !['Particular', 'Profesional'].includes(u)) throw new BadRequestException('El uso es particular o profesional.'); d.uso = u; }
    if (viene('aceite')) { const a = texto(b.aceite, 30); if (a && !['Mineral', 'Semisintético', 'Sintético', 'Full sintético'].includes(a)) throw new BadRequestException('El tipo de aceite no es válido.'); d.aceite = a; }
    if (!parcial || viene('codigoMotor')) d.codigoMotor = texto(b.codigoMotor, 20)?.toUpperCase().replace(/\s+/g, '') ?? null;
    return d;
  }

  /**
   * Grupo del vehículo (RF-100). Elegido a mano: se respeta (MANUAL). Vacío o sin elegir: por familia de motor;
   * si no se conoce el motor, por marca + modelo + año (solo reglas automáticas); si no, sin grupo.
   */
  private async grupoDe(organizacionId: string, b: Record<string, unknown>, v: { codigoMotor?: unknown; marca?: unknown; modelo?: unknown; anio?: unknown }) {
    if (b.grupoId) {
      const g = await this.prisma.grupoVehicular.findFirst({ where: { id: String(b.grupoId), organizacionId, activo: true } });
      if (!g) throw new BadRequestException('Elige un grupo activo de la empresa.');
      return { grupoId: g.id, grupoFuente: 'MANUAL' };
    }
    const [familias, modelos] = await Promise.all([
      this.prisma.familiaMotor.findMany({ where: { organizacionId }, include: { grupo: true } }),
      this.prisma.reglaAsignacionModelo.findMany({ where: { organizacionId }, include: { grupo: true } }),
    ]);
    const r = asignarGrupo(
      { codigoMotor: v.codigoMotor as string, marca: v.marca as string, modelo: v.modelo as string, anio: v.anio as number },
      familias.filter((f) => f.grupo?.activo).map((f) => ({ codigo: f.codigo, codigos: f.codigos, grupo: f.grupo!.id })),
      modelos.filter((m) => m.grupo.activo).map((m) => ({ ...m, grupo: m.grupoId })),
    );
    return r.grupo && !r.sugerido ? { grupoId: r.grupo, grupoFuente: r.fuente } : { grupoId: null, grupoFuente: null };
  }

  /**
   * La marca y el modelo del vehículo quedan en «Marcas de vehículo»: si la marca ya existe se usa su nombre tal cual
   * (sin duplicar por mayúsculas) y si no, se registra; el modelo se agrega a la marca si faltaba.
   */
  private async asegurarMarca(organizacionId: string, d: Record<string, unknown>, modeloActual: string | null) {
    const marca = typeof d.marca === 'string' ? d.marca : null;
    if (!marca) return;
    const modelo = typeof d.modelo === 'string' ? d.modelo : d.modelo === undefined ? modeloActual : null;
    const m = await this.prisma.marcaVehiculo.findFirst({ where: { organizacionId, nombre: { equals: marca, mode: 'insensitive' } } });
    if (m) {
      d.marca = m.nombre;
      if (modelo && !m.modelos.some((x) => x.toLowerCase() === modelo.toLowerCase()) && m.modelos.length < 300) await this.prisma.marcaVehiculo.update({ where: { id: m.id }, data: { modelos: [...m.modelos, modelo] } });
    } else {
      try { await this.prisma.marcaVehiculo.create({ data: { organizacionId, nombre: marca, modelos: modelo ? [modelo] : [] } }); } catch { /* otra petición la creó a la vez */ }
    }
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

  /** Crea una marca desde el formulario de vehículos; no se repite dentro de la empresa (sin distinguir mayúsculas). */
  @Post('marcas-vehiculo')
  @Requiere('vehiculos', 'E')
  async crearMarca(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const nombre = texto(b?.nombre, 60);
    if (!nombre) throw new BadRequestException('Escribe el nombre de la marca.');
    const igual = await this.prisma.marcaVehiculo.findFirst({ where: { organizacionId, nombre: { equals: nombre, mode: 'insensitive' } } });
    if (igual) throw new ConflictException(`La marca «${igual.nombre}» ya existe.`);
    try {
      const m = await this.prisma.marcaVehiculo.create({ data: { organizacionId, nombre, modelos: [] } });
      const res = { id: m.id, nombre: m.nombre, modelos: m.modelos };
      await auditar(this.prisma, real, s, 'marcaVehiculo', m.id, null, res, 'Marca creada');
      return res;
    } catch (e) {
      return choqueUnico(e, 'Esa marca ya existe.');
    }
  }

  /** Cambia el nombre y los modelos de una marca; al renombrarla, sus vehículos siguen con la marca nueva. */
  @Patch('marcas-vehiculo/:id')
  @Requiere('marcasv', 'E')
  async editarMarca(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const antes = await this.prisma.marcaVehiculo.findFirst({ where: { id, organizacionId } });
    if (!antes) throw new NotFoundException('Marca no encontrada.');
    const nombre = b?.nombre === undefined ? antes.nombre : texto(b.nombre, 60);
    if (!nombre) throw new BadRequestException('Escribe el nombre de la marca.');
    const igual = await this.prisma.marcaVehiculo.findFirst({ where: { organizacionId, id: { not: id }, nombre: { equals: nombre, mode: 'insensitive' } } });
    if (igual) throw new ConflictException(`La marca «${igual.nombre}» ya existe.`);
    let modelos = antes.modelos;
    if (b?.modelos !== undefined) {
      if (!Array.isArray(b.modelos)) throw new BadRequestException('Los modelos van en una lista.');
      if (b.modelos.length > 300) throw new BadRequestException('Una marca admite hasta 300 modelos.');
      const vistos = new Set<string>();
      modelos = (b.modelos as unknown[]).map((m) => texto(m, 60)).filter((m): m is string => !!m && !vistos.has(m.toLowerCase()) && !!vistos.add(m.toLowerCase()));
    }
    const m = await this.prisma.$transaction(async (tx) => {
      const x = await tx.marcaVehiculo.update({ where: { id }, data: { nombre, modelos } });
      if (nombre !== antes.nombre) await tx.vehiculo.updateMany({ where: { organizacionId, marca: antes.nombre }, data: { marca: nombre } });
      return x;
    });
    const res = { id: m.id, nombre: m.nombre, modelos: m.modelos };
    await auditar(this.prisma, real, s, 'marcaVehiculo', id, { nombre: antes.nombre, modelos: antes.modelos }, res, 'Marca editada');
    return res;
  }

  /** Una marca con vehículos no se elimina: se conserva para no dejarlos sin marca. */
  @Delete('marcas-vehiculo/:id')
  @Requiere('marcasv', 'A')
  async eliminarMarca(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string) {
    const organizacionId = empresaDe(s);
    const m = await this.prisma.marcaVehiculo.findFirst({ where: { id, organizacionId } });
    if (!m) throw new NotFoundException('Marca no encontrada.');
    const usados = await this.prisma.vehiculo.count({ where: { organizacionId, marca: m.nombre } });
    if (usados > 0) throw new ConflictException(`La marca «${m.nombre}» tiene ${usados} vehículo${usados === 1 ? '' : 's'}: no se puede eliminar.`);
    await this.prisma.marcaVehiculo.delete({ where: { id } });
    await auditar(this.prisma, real, s, 'marcaVehiculo', id, { nombre: m.nombre, modelos: m.modelos }, null, 'Marca eliminada');
    return { ok: true };
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

  /** Plan que corresponde al combustible (del grupo), el uso y el aceite del vehículo. */
  private async planDerivado(organizacionId: string, grupoId: string | null | undefined, uso: unknown, aceite: unknown) {
    const g = grupoId ? await this.prisma.grupoVehicular.findFirst({ where: { id: grupoId } }) : null;
    const comb = combustibleDeGrupo(g?.codigo) ?? 'Gasolina';
    const p = await this.prisma.planPreventivo.findFirst({ where: { organizacionId, codigo: codigoPlan(comb, uso as string, aceite as string), activo: true } });
    return p?.id ?? null;
  }

  /** Plan preventivo elegido en el formulario: undefined = no tocar, null = sin plan. */
  private async planDe(organizacionId: string, v: unknown) {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    const p = await this.prisma.planPreventivo.findFirst({ where: { id: String(v), organizacionId, activo: true } });
    if (!p) throw new BadRequestException('El plan preventivo no existe o está inactivo.');
    return p.id;
  }

  @Post('vehiculos')
  @Requiere('vehiculos', 'E')
  async crearVehiculo(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const cuerpo = b ?? {};
    const d = this.datosVehiculo(cuerpo, false);
    await this.clienteDeEmpresa(organizacionId, cuerpo.clienteId);
    await this.placaRepetida(organizacionId, d.placaNorm as string);
    await this.asegurarMarca(organizacionId, d, null);
    const planId = await this.planDe(organizacionId, cuerpo.planId);
    try {
      const g = await this.grupoDe(organizacionId, cuerpo, d);
      const plan = planId !== undefined ? planId : await this.planDerivado(organizacionId, (g as { grupoId?: string | null }).grupoId, d.uso, d.aceite);
      const v = await this.prisma.vehiculo.create({ data: { ...(d as Prisma.VehiculoUncheckedCreateInput), ...g, ...(plan ? { planId: plan } : {}), organizacionId, clienteId: String(cuerpo.clienteId) }, include: INCLUIR_VEHICULO });
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
    const planId = await this.planDe(organizacionId, cuerpo.planId);
    if (planId !== undefined) d.planId = planId;
    if (d.marca !== undefined || d.modelo !== undefined) {
      const x: Record<string, unknown> = { marca: d.marca !== undefined ? d.marca : actual.marca, modelo: d.modelo };
      await this.asegurarMarca(organizacionId, x, actual.modelo);
      if (d.marca !== undefined) d.marca = x.marca;
    }
    // El grupo se recalcula si se pidió (grupoId vacío = automático) o si cambió el motor, la marca, el modelo o el año de un vehículo sin grupo manual.
    const tocaGrupo = cuerpo.grupoId !== undefined || (actual.grupoFuente !== 'MANUAL' && ['codigoMotor', 'marca', 'modelo', 'anio'].some((k) => cuerpo[k] !== undefined));
    if (tocaGrupo) Object.assign(d, await this.grupoDe(organizacionId, cuerpo, { codigoMotor: actual.codigoMotor, marca: actual.marca, modelo: actual.modelo, anio: actual.anio, ...d }));
    if (planId === undefined && (d.uso !== undefined || d.aceite !== undefined || d.grupoId !== undefined))
      d.planId = await this.planDerivado(organizacionId, d.grupoId !== undefined ? (d.grupoId as string | null) : actual.grupoId, d.uso !== undefined ? d.uso : actual.uso, d.aceite !== undefined ? d.aceite : actual.aceite);
    // Cambiar el plan de un vehículo que ya tenía uso y aceite asignados pide confirmación y queda como tramo nuevo de la línea de tiempo.
    let cambio: { antes: string; despues: string } | null = null;
    if (d.planId !== undefined && d.planId !== actual.planId && actual.uso && actual.aceite && actual.plan) {
      const nuevo = d.planId ? await this.prisma.planPreventivo.findFirst({ where: { id: d.planId as string } }) : null;
      if (nuevo && nuevo.codigo !== actual.plan.codigo) {
        if (cuerpo.confirmarCambioPlan !== true) throw new ConflictException(`El plan del vehículo pasa de ${actual.plan.codigo} a ${nuevo.codigo}. Lo anterior queda congelado con ${actual.plan.codigo} y, desde la última visita, se aplica ${nuevo.codigo}.`);
        cambio = { antes: actual.plan.codigo, despues: nuevo.codigo };
      }
    }
    try {
      const v = await this.prisma.vehiculo.update({ where: { id }, data: d as Prisma.VehiculoUncheckedUpdateInput, include: INCLUIR_VEHICULO });
      if (cambio) {
        const ult = await this.prisma.ordenServicio.findFirst({ where: { vehiculoId: id, eliminada: false }, orderBy: [{ fechaCierre: 'desc' }, { fechaInicio: 'desc' }] });
        await this.prisma.cambioPlanVehiculo.create({ data: { organizacionId, vehiculoId: id, antes: cambio.antes, despues: cambio.despues, corte: (ult?.fechaCierre ?? ult?.fechaInicio ?? new Date()).toISOString().slice(0, 10), km: v.lecturas[0]?.km ?? ult?.km ?? null, usuarioId: real.id, usuario: real.nombre } });
      }
      const res = resumenVehiculo(v);
      const motivo = traspaso ? 'Traspaso de titular' : d.placa !== undefined && d.placa !== actual.placa ? 'Corrección de placa' : 'Vehículo modificado';
      await auditar(this.prisma, real, s, 'vehiculo', v.id, resumenVehiculo(actual), res, motivo);
      return res;
    } catch (e) {
      return choqueUnico(e, 'Esa placa ya existe en el sistema.');
    }
  }

  /** Un vehículo sin órdenes, comprobantes ni cotizaciones se borra con sus lecturas de kilometraje; con historial no. */
  @Delete('vehiculos/:id')
  @Requiere('vehiculos', 'E')
  async eliminarVehiculo(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string) {
    const organizacionId = empresaDe(s);
    const v = await this.prisma.vehiculo.findFirst({ where: { id, organizacionId }, include: INCLUIR_VEHICULO });
    if (!v) throw new NotFoundException('Vehículo no encontrado.');
    const r = await eliminarRegistro(
      () => this.prisma.$transaction([this.prisma.lecturaKm.deleteMany({ where: { vehiculoId: id } }), this.prisma.vehiculo.delete({ where: { id } })]),
      null,
      `El vehículo ${v.placa} tiene órdenes, comprobantes o cotizaciones: no se puede eliminar.`,
    );
    await auditar(this.prisma, real, s, 'vehiculo', id, resumenVehiculo(v), null, 'Vehículo eliminado');
    return r;
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
    const km = aNumero(b?.km);
    if (b?.km === undefined || b?.km === null || b?.km === '' || !Number.isInteger(km) || km < 0 || km > KM_MAXIMO) throw new BadRequestException('El kilometraje debe ser un número entero entre 0 y 3 000 000.');
    const fecha = b?.fecha ? new Date(String(b.fecha)) : new Date();
    if (Number.isNaN(fecha.getTime()) || fecha.getTime() > Date.now() + 86_400_000) throw new BadRequestException('La fecha no es válida (no puede ser futura).');
    const l = await this.prisma.lecturaKm.create({ data: { vehiculoId: id, km, fecha, fuente: ['Llamada', 'WhatsApp', 'En taller', 'Otro'].includes(String(b?.fuente)) ? String(b?.fuente) : 'manual', observacion: texto(b?.observacion) } });
    const res = { id: l.id, km: l.km, fecha: l.fecha.toISOString(), fuente: l.fuente, observacion: l.observacion };
    await auditar(this.prisma, real, s, 'lectura_km', l.id, null, { vehiculoId: id, ...res }, 'Lectura de kilometraje');
    return res;
  }
}
