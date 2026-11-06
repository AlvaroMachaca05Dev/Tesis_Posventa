// Slice S5: proveedores (RF-008), servicios (RF-009), productos (RF-010), grupos (RF-100), precios por grupo (RF-101)
// y solapamiento de servicios (RF-102). Las reglas puras están en maestros.reglas.ts.
import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { choqueUnico, empresaDe, texto } from '../comun/validacion';
import { calcularServicio, errorDocumento, errorTelefono, evaluarSolapamientos, HORAS_PREDETERMINADAS, Nivel, Regla, ReglaSolape, TipoRegla, validarRegla } from './maestros.reglas';

const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? null : Number(d));
const TIPOS_DOCUMENTO = ['DNI', 'CARNET_EXTRANJERIA', 'RUC'];
const UNIDADES = ['UND', 'LT', 'GL', 'KG', 'MT', 'JGO', 'PAR', 'KIT'];

/** Número opcional: vacío = null; si viene, debe ser finito y estar en el rango. */
function numero(v: unknown, campo: string, min = 0, max = 10_000_000): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw new BadRequestException(`${campo}: el valor no es válido.`);
  return Math.round(n * 1000) / 1000;
}
const requerido = (v: unknown, campo: string, max = 150) => {
  const t = texto(v, max);
  if (!t) throw new BadRequestException(`Escribe ${campo}.`);
  return t;
};
const codigo = (v: unknown, campo = 'el código') => requerido(v, campo, 20).toUpperCase().replace(/\s+/g, '');

// ─────────── formas de respuesta ───────────
const proveedorRes = (p: Prisma.ProveedorGetPayload<object>) => ({
  id: p.id, tipoDocumento: p.tipoDocumento, documento: p.documento, nombre: p.nombre, contacto: p.contacto, telefono: p.telefono,
  correo: p.correo, direccion: p.direccion, rubro: p.rubro, activo: p.activo, creadoEn: p.creadoEn.toISOString(),
});
const INCLUIR_PRODUCTO = { proveedor: true, stock: true } as const;
const productoRes = (p: Prisma.ProductoGetPayload<{ include: typeof INCLUIR_PRODUCTO }>) => {
  const stock = Object.fromEntries(p.stock.map((x) => [x.localId, Number(x.cantidad)]));
  return {
    id: p.id, codigo: p.codigo, nombre: p.nombre, referencia: p.referencia, unidad: p.unidad, categoria: p.categoria, marca: p.marca,
    precio: num(p.precio) as number, costo: num(p.costo), proveedorId: p.proveedorId, proveedor: p.proveedor?.nombre ?? null, activo: p.activo,
    stock, stockTotal: Math.round(Object.values(stock).reduce((a, x) => a + x, 0) * 1000) / 1000,
  };
};
const servicioRes = (s: Prisma.ServicioGetPayload<{ include: { proveedor: true } }>) => ({
  id: s.id, codigo: s.codigo, nombre: s.nombre, categoria: s.categoria, descripcion: s.descripcion, trabajoMayor: s.trabajoMayor, externo: s.externo,
  proveedorId: s.proveedorId, proveedor: s.proveedor?.nombre ?? null, horasEstandar: num(s.horasEstandar) as number, horasFuente: s.horasFuente,
  precioEstandar: num(s.precioEstandar) as number, repuestos: s.repuestos, activo: s.activo,
  preciosGrupo: (s.preciosGrupo ?? {}) as Record<string, number | null>, horasGrupo: (s.horasGrupo ?? {}) as Record<string, number>,
});
const grupoRes = (g: Prisma.GrupoVehicularGetPayload<{ include: { _count: { select: { vehiculos: true; reglas: true; familias: true } } } }>) => ({
  id: g.id, codigo: g.codigo, nombre: g.nombre, descripcion: g.descripcion, activo: g.activo,
  vehiculos: g._count.vehiculos, reglas: g._count.reglas, familias: g._count.familias,
});
type ReglaFila = Prisma.ReglaPrecioGetPayload<{ include: { grupo: true } }>;
const reglaRes = (r: ReglaFila) => ({
  id: r.id, codigo: r.codigo, nivel: r.nivel, tipo: r.tipo, grupoId: r.grupoId, grupo: r.grupo?.codigo ?? null, servicios: r.servicios,
  horas: num(r.horas), precio: num(r.precio), porcentaje: num(r.porcentaje), precioDesde: num(r.precioDesde), precioHasta: num(r.precioHasta),
  orden: r.orden, activa: r.activa, nota: r.nota,
});
const aRegla = (r: ReglaFila): Regla => ({
  codigo: r.codigo, nivel: r.nivel as Nivel, tipo: r.tipo as TipoRegla, grupo: r.grupo?.codigo ?? null, servicios: r.servicios,
  horas: num(r.horas), precio: num(r.precio), porcentaje: num(r.porcentaje), precioDesde: num(r.precioDesde), precioHasta: num(r.precioHasta), activa: r.activa, orden: r.orden,
});
type SolapeFila = Prisma.SolapamientoGetPayload<object>;
const solapeRes = (x: SolapeFila, nombres: Map<string, string>) => ({
  id: x.id, codigo: x.codigo, tipo: x.tipo, minimo: x.minimo, serviciosBase: x.serviciosBase, serviciosReducidos: x.serviciosReducidos,
  base: x.serviciosBase.map((i) => nombres.get(i) ?? '—'), reducidos: x.serviciosReducidos.map((i) => nombres.get(i) ?? '—'),
  modo: x.modo, descuentoEstandar: num(x.descuentoEstandar) as number, descuentos: (x.descuentos ?? {}) as Record<string, number>,
  horasCompartidas: num(x.horasCompartidas), alerta: x.alerta, nota: x.nota, estado: x.estado, activo: x.activo,
});
export const aSolape = (x: SolapeFila): ReglaSolape => ({
  id: x.id, codigo: x.codigo, tipo: x.tipo === 'CONJUNTO' ? 'CONJUNTO' : 'PAR', base: x.serviciosBase, reducidos: x.serviciosReducidos, minimo: x.minimo,
  modo: x.modo as ReglaSolape['modo'], descuentoEstandar: Number(x.descuentoEstandar), descuentos: (x.descuentos ?? null) as Record<string, number> | null, alerta: x.alerta, activo: x.activo,
});
/** Servicio de la base a la forma de las reglas puras (con su tabla por grupo). */
export const aServicio = (x: Prisma.ServicioGetPayload<object>) => ({
  codigo: x.codigo, horas: Number(x.horasEstandar), precio: Number(x.precioEstandar), trabajoMayor: x.trabajoMayor,
  preciosGrupo: (x.preciosGrupo ?? null) as Record<string, number | null> | null, horasGrupo: (x.horasGrupo ?? null) as Record<string, number> | null,
});

@Controller()
export class MaestrosController {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  // ═══════════════ Proveedores (RF-008) ═══════════════
  private datosProveedor(b: Record<string, unknown>, parcial: boolean) {
    const d: Record<string, unknown> = {};
    const viene = (k: string) => !parcial || b[k] !== undefined;
    if (viene('tipoDocumento')) {
      const t = String(b.tipoDocumento ?? 'RUC') || 'RUC';
      if (!TIPOS_DOCUMENTO.includes(t)) throw new BadRequestException('Elige el tipo de documento: DNI, Carné de extranjería o RUC.');
      d.tipoDocumento = t;
    }
    if (viene('documento')) d.documento = requerido(b.documento, 'el número de documento', 20).toUpperCase().replace(/\s+/g, '');
    if (viene('nombre')) d.nombre = requerido(b.nombre, 'la razón social o el nombre');
    for (const k of ['contacto', 'direccion', 'rubro']) if (viene(k)) d[k] = texto(b[k], 150);
    if (viene('telefono')) {
      const t = String(b.telefono ?? '').replace(/[\s-]/g, '') || null;
      const e = errorTelefono(t);
      if (e) throw new BadRequestException(e);
      d.telefono = t;
    }
    if (viene('correo')) {
      const c = texto(b.correo, 150);
      if (c && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) throw new BadRequestException('El correo no es válido.');
      d.correo = c;
    }
    if (b.activo !== undefined) d.activo = !!b.activo;
    return d;
  }

  @Get('proveedores')
  @Requiere('proveedores', 'V')
  async proveedores(@SesionActual() s: Sesion) {
    return (await this.prisma.proveedor.findMany({ where: { organizacionId: empresaDe(s) }, orderBy: { nombre: 'asc' } })).map(proveedorRes);
  }

  @Post('proveedores')
  @Requiere('proveedores', 'E')
  async crearProveedor(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    try {
      const d = this.datosProveedor(b ?? {}, false);
      const e = errorDocumento(String(d.tipoDocumento), String(d.documento));
      if (e) throw new BadRequestException(e);
      const p = await this.prisma.proveedor.create({ data: { ...(d as Prisma.ProveedorUncheckedCreateInput), organizacionId } });
      await auditar(this.prisma, real, s, 'proveedor', p.id, null, proveedorRes(p), 'Proveedor creado');
      return proveedorRes(p);
    } catch (e) {
      return choqueUnico(e, 'Ya existe un proveedor con ese documento.');
    }
  }

  @Patch('proveedores/:id')
  @Requiere('proveedores', 'E')
  async editarProveedor(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const antes = await this.prisma.proveedor.findFirst({ where: { id, organizacionId: empresaDe(s) } });
    if (!antes) throw new NotFoundException('Proveedor no encontrado.');
    try {
      const d = this.datosProveedor(b ?? {}, true);
      const e = errorDocumento(String(d.tipoDocumento ?? antes.tipoDocumento), String(d.documento ?? antes.documento));
      if (e && (d.tipoDocumento !== undefined || d.documento !== undefined)) throw new BadRequestException(e);
      const p = await this.prisma.proveedor.update({ where: { id }, data: d });
      await auditar(this.prisma, real, s, 'proveedor', id, proveedorRes(antes), proveedorRes(p), 'Proveedor modificado');
      return proveedorRes(p);
    } catch (e) {
      return choqueUnico(e, 'Ya existe un proveedor con ese documento.');
    }
  }

  private async proveedorDe(organizacionId: string, id: unknown) {
    if (id === undefined) return undefined;
    if (id === null || id === '') return null;
    const p = await this.prisma.proveedor.findFirst({ where: { id: String(id), organizacionId } });
    if (!p) throw new BadRequestException('Elige un proveedor de la empresa.');
    return p.id;
  }

  // ═══════════════ Productos (RF-010) ═══════════════
  private async datosProducto(organizacionId: string, b: Record<string, unknown>, parcial: boolean) {
    const d: Record<string, unknown> = {};
    const viene = (k: string) => !parcial || b[k] !== undefined;
    if (viene('codigo')) d.codigo = codigo(b.codigo);
    if (viene('nombre')) d.nombre = requerido(b.nombre, 'el nombre del producto', 200);
    for (const k of ['referencia', 'categoria', 'marca']) if (viene(k)) d[k] = texto(b[k], 100);
    if (viene('unidad')) {
      const u = String(b.unidad ?? 'UND').toUpperCase() || 'UND';
      if (!UNIDADES.includes(u)) throw new BadRequestException(`La unidad debe ser una de: ${UNIDADES.join(', ')}.`);
      d.unidad = u;
    }
    if (viene('precio')) {
      const p = numero(b.precio, 'Precio');
      if (p === null) throw new BadRequestException('Escribe el precio de venta.');
      d.precio = p;
    }
    if (viene('costo')) d.costo = numero(b.costo, 'Costo');
    const prov = await this.proveedorDe(organizacionId, b.proveedorId);
    if (prov !== undefined) d.proveedorId = prov;
    if (b.activo !== undefined) d.activo = !!b.activo;
    return d;
  }

  @Get('productos')
  @Requiere('catalogo', 'V')
  async productos(@SesionActual() s: Sesion) {
    return (await this.prisma.producto.findMany({ where: { organizacionId: empresaDe(s) }, include: INCLUIR_PRODUCTO, orderBy: { codigo: 'asc' } })).map(productoRes);
  }

  @Post('productos')
  @Requiere('catalogo', 'E')
  async crearProducto(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const d = await this.datosProducto(organizacionId, b ?? {}, false);
    try {
      const p = await this.prisma.producto.create({ data: { ...(d as Prisma.ProductoUncheckedCreateInput), organizacionId }, include: INCLUIR_PRODUCTO });
      await auditar(this.prisma, real, s, 'producto', p.id, null, productoRes(p), 'Producto creado');
      return productoRes(p);
    } catch (e) {
      return choqueUnico(e, 'Ya existe un producto con ese código.');
    }
  }

  @Patch('productos/:id')
  @Requiere('catalogo', 'E')
  async editarProducto(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const antes = await this.prisma.producto.findFirst({ where: { id, organizacionId }, include: INCLUIR_PRODUCTO });
    if (!antes) throw new NotFoundException('Producto no encontrado.');
    const d = await this.datosProducto(organizacionId, b ?? {}, true);
    try {
      const p = await this.prisma.producto.update({ where: { id }, data: d, include: INCLUIR_PRODUCTO });
      await auditar(this.prisma, real, s, 'producto', id, productoRes(antes), productoRes(p), 'Producto modificado');
      return productoRes(p);
    } catch (e) {
      return choqueUnico(e, 'Ya existe un producto con ese código.');
    }
  }

  // ═══════════════ Servicios (RF-009) ═══════════════
  private async datosServicio(organizacionId: string, b: Record<string, unknown>, parcial: boolean) {
    const d: Record<string, unknown> = {};
    const viene = (k: string) => !parcial || b[k] !== undefined;
    if (viene('codigo')) d.codigo = codigo(b.codigo);
    if (viene('nombre')) d.nombre = requerido(b.nombre, 'el nombre del servicio', 200);
    if (viene('categoria')) d.categoria = requerido(b.categoria, 'la categoría técnica', 60).toUpperCase();
    if (viene('descripcion')) d.descripcion = texto(b.descripcion, 500);
    if (viene('trabajoMayor')) d.trabajoMayor = !!b.trabajoMayor;
    if (viene('externo')) d.externo = !!b.externo;
    // RN-08: sin tiempo de AutoData, 1 h.
    if (viene('horasEstandar')) {
      const h = numero(b.horasEstandar, 'Horas', 0.25, 200);
      if (h !== null && Math.round(h * 100) % 25 !== 0) throw new BadRequestException('Las horas van de 0,25 h en 0,25 h.');
      d.horasEstandar = h ?? HORAS_PREDETERMINADAS;
      d.horasFuente = h === null ? 'PREDETERMINADA' : 'AUTODATA';
    }
    if (viene('precioEstandar')) {
      const p = numero(b.precioEstandar, 'Precio');
      if (p === null) throw new BadRequestException('Escribe el precio estándar.');
      d.precioEstandar = p;
    }
    if (viene('preciosGrupo')) d.preciosGrupo = this.tablaGrupo(b.preciosGrupo, 'Precio', true);
    if (viene('horasGrupo')) d.horasGrupo = this.tablaGrupo(b.horasGrupo, 'Horas', false);
    if (viene('repuestos')) {
      const r = Array.isArray(b.repuestos) ? b.repuestos : String(b.repuestos ?? '').split(/[,;\n]/);
      d.repuestos = r.map((x) => String(x).trim()).filter(Boolean).slice(0, 20).map((x) => x.slice(0, 100));
    }
    const prov = await this.proveedorDe(organizacionId, b.proveedorId);
    if (prov !== undefined) d.proveedorId = prov;
    if (b.activo !== undefined) d.activo = !!b.activo;
    return d;
  }

  /** Tabla por grupo: { G1: 15, G4: null }. Vacío = usa el estándar; «NA», «No aplica» o null = no aplica (solo precios). */
  private tablaGrupo(v: unknown, campo: string, permiteNoAplica: boolean) {
    if (v === undefined || v === null || v === '') return Prisma.DbNull;
    if (typeof v !== 'object' || Array.isArray(v)) throw new BadRequestException(`${campo} por grupo no válido.`);
    const out: Record<string, number | null> = {};
    for (const [g, x] of Object.entries(v as Record<string, unknown>)) {
      if (!/^[A-Z0-9-]{1,10}$/i.test(g)) continue;
      const t = String(x ?? '').trim();
      if (t === '') continue;
      if (permiteNoAplica && (x === null || /^(na|n\/a|no aplica)$/i.test(t))) { out[g.toUpperCase()] = null; continue; }
      const n = numero(t, `${campo} de ${g}`, 0, campo === 'Horas' ? 200 : 1_000_000);
      if (n !== null) out[g.toUpperCase()] = n;
    }
    return Object.keys(out).length ? out : Prisma.DbNull;
  }

  @Get('servicios')
  @Requiere('catalogo', 'V')
  async servicios(@SesionActual() s: Sesion) {
    return (await this.prisma.servicio.findMany({ where: { organizacionId: empresaDe(s) }, include: { proveedor: true }, orderBy: { codigo: 'asc' } })).map(servicioRes);
  }

  @Post('servicios')
  @Requiere('catalogo', 'E')
  async crearServicio(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const d = await this.datosServicio(organizacionId, b ?? {}, false);
    if (d.externo && !d.proveedorId) throw new BadRequestException('Un servicio externo necesita su proveedor.');
    try {
      const x = await this.prisma.servicio.create({ data: { ...(d as Prisma.ServicioUncheckedCreateInput), organizacionId }, include: { proveedor: true } });
      await auditar(this.prisma, real, s, 'servicio', x.id, null, servicioRes(x), 'Servicio creado');
      return servicioRes(x);
    } catch (e) {
      return choqueUnico(e, 'Ya existe un servicio con ese código.');
    }
  }

  @Patch('servicios/:id')
  @Requiere('catalogo', 'E')
  async editarServicio(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const antes = await this.prisma.servicio.findFirst({ where: { id, organizacionId }, include: { proveedor: true } });
    if (!antes) throw new NotFoundException('Servicio no encontrado.');
    const d = await this.datosServicio(organizacionId, b ?? {}, true);
    const externo = d.externo ?? antes.externo;
    const prov = d.proveedorId !== undefined ? d.proveedorId : antes.proveedorId;
    if (externo && !prov) throw new BadRequestException('Un servicio externo necesita su proveedor.');
    try {
      const x = await this.prisma.servicio.update({ where: { id }, data: d, include: { proveedor: true } });
      await auditar(this.prisma, real, s, 'servicio', id, servicioRes(antes), servicioRes(x), 'Servicio modificado');
      return servicioRes(x);
    } catch (e) {
      return choqueUnico(e, 'Ya existe un servicio con ese código.');
    }
  }

  // ═══════════════ Grupos de vehículos (RF-100) ═══════════════
  private readonly conteo = { _count: { select: { vehiculos: true, reglas: true, familias: true } } } as const;

  @Get('grupos')
  @Requiere('vehiculos', 'V')
  async grupos(@SesionActual() s: Sesion) {
    return (await this.prisma.grupoVehicular.findMany({ where: { organizacionId: empresaDe(s) }, include: this.conteo, orderBy: { codigo: 'asc' } })).map(grupoRes);
  }

  @Post('grupos')
  @Requiere('grupos', 'E')
  async crearGrupo(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    try {
      const g = await this.prisma.grupoVehicular.create({ data: { organizacionId, codigo: codigo(b?.codigo), nombre: requerido(b?.nombre, 'el nombre del grupo', 80), descripcion: texto(b?.descripcion, 300) }, include: this.conteo });
      await auditar(this.prisma, real, s, 'grupo', g.id, null, grupoRes(g), 'Grupo creado');
      return grupoRes(g);
    } catch (e) {
      return choqueUnico(e, 'Ya existe un grupo con ese código.');
    }
  }

  /** Renombrar o quitar (desactivar) un grupo no rehace los datos: sus vehículos y reglas se conservan. */
  @Patch('grupos/:id')
  @Requiere('grupos', 'E')
  async editarGrupo(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const antes = await this.prisma.grupoVehicular.findFirst({ where: { id, organizacionId: empresaDe(s) }, include: this.conteo });
    if (!antes) throw new NotFoundException('Grupo no encontrado.');
    const d: Prisma.GrupoVehicularUpdateInput = {};
    if (b?.codigo !== undefined) d.codigo = codigo(b.codigo);
    if (b?.nombre !== undefined) d.nombre = requerido(b.nombre, 'el nombre del grupo', 80);
    if (b?.descripcion !== undefined) d.descripcion = texto(b.descripcion, 300);
    if (b?.activo !== undefined) d.activo = !!b.activo;
    try {
      const g = await this.prisma.grupoVehicular.update({ where: { id }, data: d, include: this.conteo });
      await auditar(this.prisma, real, s, 'grupo', id, grupoRes(antes), grupoRes(g), b?.activo === false ? 'Grupo quitado' : 'Grupo modificado');
      return grupoRes(g);
    } catch (e) {
      return choqueUnico(e, 'Ya existe un grupo con ese código.');
    }
  }

  @Get('familias-motor')
  @Requiere('grupos', 'V')
  async familias(@SesionActual() s: Sesion) {
    const f = await this.prisma.familiaMotor.findMany({ where: { organizacionId: empresaDe(s) }, include: { grupo: true }, orderBy: { codigo: 'asc' } });
    return f.map((x) => ({ id: x.id, codigo: x.codigo, codigos: x.codigos, combustible: x.combustible, litros: x.litros, turbo: x.turbo, grupoId: x.grupoId, grupo: x.grupo?.codigo ?? null }));
  }

  // ═══════════════ Reglas de precio por grupo (RF-101, RN-09) ═══════════════
  private async datosRegla(organizacionId: string, b: Record<string, unknown>, actual?: ReglaFila) {
    const nivel = String(b.nivel ?? actual?.nivel ?? '') as Nivel;
    const tipo = String(b.tipo ?? actual?.tipo ?? '') as TipoRegla;
    let grupoId = b.grupoId !== undefined ? (b.grupoId ? String(b.grupoId) : null) : actual?.grupoId ?? null;
    if (nivel === 'GLOBAL') grupoId = null;
    let grupoCodigo: string | null = null;
    if (grupoId) {
      const g = await this.prisma.grupoVehicular.findFirst({ where: { id: grupoId, organizacionId } });
      if (!g) throw new BadRequestException('Elige un grupo de la empresa.');
      grupoCodigo = g.codigo;
    }
    const tomar = (k: 'horas' | 'precio' | 'porcentaje' | 'precioDesde' | 'precioHasta', min: number, max: number) =>
      b[k] !== undefined ? numero(b[k], k, min, max) : num(actual?.[k]);
    let servicios = actual?.servicios ?? [];
    if (b.servicios !== undefined) {
      const lista = Array.isArray(b.servicios) ? b.servicios : String(b.servicios ?? '').split(/[,;\s]+/);
      servicios = [...new Set(lista.map((x) => String(x).trim().toUpperCase()).filter(Boolean))];
      if (servicios.length) {
        const hay = await this.prisma.servicio.findMany({ where: { organizacionId, codigo: { in: servicios } }, select: { codigo: true } });
        const faltan = servicios.filter((c) => !hay.some((h) => h.codigo === c));
        if (faltan.length) throw new BadRequestException(`Servicios que no existen: ${faltan.join(', ')}.`);
      }
    }
    const r = {
      nivel, tipo, grupoId, servicios,
      horas: tomar('horas', -200, 200), precio: tomar('precio', -100000, 100000), porcentaje: tomar('porcentaje', -100, 1000),
      precioDesde: tomar('precioDesde', 0, 10_000_000), precioHasta: tomar('precioHasta', 0, 10_000_000),
      orden: b.orden !== undefined ? Math.trunc(Number(b.orden) || 0) : actual?.orden ?? 0,
      activa: b.activa !== undefined ? !!b.activa : actual?.activa ?? true,
      nota: b.nota !== undefined ? texto(b.nota, 300) : actual?.nota ?? null,
    };
    const errores = validarRegla({ ...r, grupo: grupoCodigo });
    if (r.precioDesde != null && r.precioHasta != null && r.precioDesde > r.precioHasta) errores.push('el rango de precios está invertido');
    if (errores.length) throw new BadRequestException(`Regla no válida: ${errores.join('; ')}.`);
    return r;
  }

  @Get('reglas-precio')
  @Requiere('grupos', 'V')
  async reglas(@SesionActual() s: Sesion) {
    return (await this.prisma.reglaPrecio.findMany({ where: { organizacionId: empresaDe(s) }, include: { grupo: true }, orderBy: [{ nivel: 'asc' }, { orden: 'asc' }, { codigo: 'asc' }] })).map(reglaRes);
  }

  @Post('reglas-precio')
  @Requiere('grupos', 'E')
  async crearRegla(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const d = await this.datosRegla(organizacionId, b ?? {});
    const cod = b?.codigo ? codigo(b.codigo) : `RP-${String((await this.prisma.reglaPrecio.count({ where: { organizacionId } })) + 1).padStart(3, '0')}`;
    try {
      const r = await this.prisma.reglaPrecio.create({ data: { ...d, codigo: cod, organizacionId }, include: { grupo: true } });
      await auditar(this.prisma, real, s, 'regla_precio', r.id, null, reglaRes(r), 'Regla de precio creada');
      return reglaRes(r);
    } catch (e) {
      return choqueUnico(e, 'Ya existe una regla con ese código.');
    }
  }

  @Patch('reglas-precio/:id')
  @Requiere('grupos', 'E')
  async editarRegla(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const antes = await this.prisma.reglaPrecio.findFirst({ where: { id, organizacionId }, include: { grupo: true } });
    if (!antes) throw new NotFoundException('Regla no encontrada.');
    const d = await this.datosRegla(organizacionId, b ?? {}, antes);
    const r = await this.prisma.reglaPrecio.update({ where: { id }, data: d, include: { grupo: true } });
    await auditar(this.prisma, real, s, 'regla_precio', id, reglaRes(antes), reglaRes(r), 'Regla de precio modificada');
    return reglaRes(r);
  }

  @Delete('reglas-precio/:id')
  @Requiere('grupos', 'A')
  async eliminarRegla(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string) {
    const antes = await this.prisma.reglaPrecio.findFirst({ where: { id, organizacionId: empresaDe(s) }, include: { grupo: true } });
    if (!antes) throw new NotFoundException('Regla no encontrada.');
    await this.prisma.reglaPrecio.delete({ where: { id } });
    await auditar(this.prisma, real, s, 'regla_precio', id, reglaRes(antes), null, 'Regla de precio eliminada');
    return { ok: true };
  }

  /** Tabla de precios: cada servicio con su estándar y su precio en cada grupo (para revisar las reglas). */
  @Get('precios-por-grupo')
  @Requiere('grupos', 'V')
  async tablaPrecios(@SesionActual() s: Sesion) {
    const organizacionId = empresaDe(s);
    const [servicios, grupos, reglas] = await Promise.all([
      this.prisma.servicio.findMany({ where: { organizacionId, activo: true }, orderBy: { codigo: 'asc' } }),
      this.prisma.grupoVehicular.findMany({ where: { organizacionId, activo: true }, orderBy: { codigo: 'asc' } }),
      this.prisma.reglaPrecio.findMany({ where: { organizacionId }, include: { grupo: true } }),
    ]);
    const rs = reglas.map(aRegla);
    return {
      grupos: grupos.map((g) => g.codigo),
      filas: servicios.map((x) => {
        const base = aServicio(x);
        const est = calcularServicio(base, '', rs);
        return { servicioId: x.id, codigo: x.codigo, nombre: x.nombre, categoria: x.categoria, estandar: { horas: est.horas, precio: est.precio }, porGrupo: Object.fromEntries(grupos.map((g) => { const c = calcularServicio(base, g.codigo, rs); return [g.codigo, c.disponible ? { horas: c.horas, precio: c.precio } : null]; })) };
      }),
    };
  }

  // ═══════════════ Solapamiento de servicios (RF-102) ═══════════════
  private async nombresServicio(organizacionId: string) {
    const sv = await this.prisma.servicio.findMany({ where: { organizacionId }, select: { id: true, codigo: true, nombre: true } });
    return new Map(sv.map((x) => [x.id, `${x.codigo} · ${x.nombre}`]));
  }

  private async datosSolape(organizacionId: string, b: Record<string, unknown>, actual?: SolapeFila) {
    const lista = (k: 'serviciosBase' | 'serviciosReducidos') => (b[k] !== undefined ? (Array.isArray(b[k]) ? (b[k] as unknown[]) : String(b[k] ?? '').split(',')).map((x) => String(x).trim()).filter(Boolean) : actual?.[k] ?? []);
    const tipo = String(b.tipo ?? actual?.tipo ?? 'PAR') === 'CONJUNTO' ? 'CONJUNTO' : 'PAR';
    const base = tipo === 'CONJUNTO' ? [] : [...new Set(lista('serviciosBase'))];
    const red = [...new Set(lista('serviciosReducidos'))];
    if (tipo === 'PAR' && (!base.length || !red.length)) throw new BadRequestException('Elige el servicio base y el servicio que lleva el descuento.');
    if (tipo === 'CONJUNTO' && red.length < 2) throw new BadRequestException('Un conjunto necesita al menos dos servicios.');
    if (base.some((x) => red.includes(x))) throw new BadRequestException('Un servicio no puede ser base y llevar el descuento a la vez.');
    const n = await this.prisma.servicio.count({ where: { organizacionId, id: { in: [...base, ...red] } } });
    if (n !== base.length + red.length) throw new BadRequestException('Los servicios deben ser del catálogo de la empresa.');
    const modo = String(b.modo ?? actual?.modo ?? 'OPCIONAL');
    if (!['AUTOMATICO', 'OPCIONAL', 'AVISO'].includes(modo)) throw new BadRequestException('El modo es Automático, Opcional o Aviso.');
    const minimo = b.minimo !== undefined && b.minimo !== '' ? Math.trunc(Number(b.minimo)) : actual?.minimo ?? 2;
    if (!Number.isInteger(minimo) || minimo < 2 || minimo > 10) throw new BadRequestException('El mínimo de servicios va de 2 a 10.');
    const est = b.descuentoEstandar !== undefined ? numero(b.descuentoEstandar, 'Descuento') : num(actual?.descuentoEstandar);
    if (modo !== 'AVISO' && (est === null || Math.round(est * 100) % 500 !== 0)) throw new BadRequestException('El descuento va en soles redondos, múltiplo de 5.');
    let descuentos = (actual?.descuentos ?? {}) as Record<string, number>;
    if (b.descuentos !== undefined) {
      if (b.descuentos === null || typeof b.descuentos !== 'object' || Array.isArray(b.descuentos)) throw new BadRequestException('Los descuentos por grupo no son válidos.');
      descuentos = {};
      for (const [g, v] of Object.entries(b.descuentos as Record<string, unknown>)) {
        const m = numero(v, `Descuento ${g}`);
        if (m === null) continue;
        if (Math.round(m * 100) % 500 !== 0) throw new BadRequestException(`El descuento de ${g} debe ser múltiplo de 5.`);
        descuentos[g.toUpperCase()] = m;
      }
    }
    return {
      tipo, serviciosBase: base, serviciosReducidos: red, minimo, modo, descuentoEstandar: est ?? 0, descuentos,
      horasCompartidas: b.horasCompartidas !== undefined ? numero(b.horasCompartidas, 'Horas compartidas', 0, 200) : num(actual?.horasCompartidas),
      alerta: b.alerta !== undefined ? texto(b.alerta, 300) : actual?.alerta ?? null,
      nota: b.nota !== undefined ? texto(b.nota, 300) : actual?.nota ?? null,
      estado: b.estado !== undefined ? (b.estado === 'Decidido' ? 'Decidido' : 'Propuesto') : actual?.estado ?? 'Propuesto',
      activo: b.activo !== undefined ? !!b.activo : actual?.activo ?? true,
    };
  }

  @Get('solapamientos')
  @Requiere('solapes', 'V')
  async solapamientos(@SesionActual() s: Sesion) {
    const organizacionId = empresaDe(s);
    const [lista, nombres] = await Promise.all([this.prisma.solapamiento.findMany({ where: { organizacionId }, orderBy: { codigo: 'asc' } }), this.nombresServicio(organizacionId)]);
    return lista.map((x) => solapeRes(x, nombres));
  }

  @Post('solapamientos')
  @Requiere('solapes', 'E')
  async crearSolape(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const d = await this.datosSolape(organizacionId, b ?? {});
    const cod = b?.codigo ? codigo(b.codigo) : `SOL-${String((await this.prisma.solapamiento.count({ where: { organizacionId } })) + 1).padStart(2, '0')}`;
    try {
      const x = await this.prisma.solapamiento.create({ data: { ...d, codigo: cod, organizacionId } });
      const res = solapeRes(x, await this.nombresServicio(organizacionId));
      await auditar(this.prisma, real, s, 'solapamiento', x.id, null, res, 'Solapamiento creado');
      return res;
    } catch (e) {
      return choqueUnico(e, 'Ya existe una regla con ese código.');
    }
  }

  @Patch('solapamientos/:id')
  @Requiere('solapes', 'E')
  async editarSolape(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const antes = await this.prisma.solapamiento.findFirst({ where: { id, organizacionId } });
    if (!antes) throw new NotFoundException('Regla de solapamiento no encontrada.');
    const d = await this.datosSolape(organizacionId, b ?? {}, antes);
    const x = await this.prisma.solapamiento.update({ where: { id }, data: d });
    const nombres = await this.nombresServicio(organizacionId);
    await auditar(this.prisma, real, s, 'solapamiento', id, solapeRes(antes, nombres), solapeRes(x, nombres), 'Solapamiento modificado');
    return solapeRes(x, nombres);
  }

  @Delete('solapamientos/:id')
  @Requiere('solapes', 'A')
  async eliminarSolape(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string) {
    const organizacionId = empresaDe(s);
    const antes = await this.prisma.solapamiento.findFirst({ where: { id, organizacionId } });
    if (!antes) throw new NotFoundException('Regla de solapamiento no encontrada.');
    await this.prisma.solapamiento.delete({ where: { id } });
    await auditar(this.prisma, real, s, 'solapamiento', id, solapeRes(antes, await this.nombresServicio(organizacionId)), null, 'Solapamiento eliminado');
    return { ok: true };
  }

  // ═══════════════ Uso en la ODS (cajera) ═══════════════
  /** Servicios y productos activos para elegirlos al agregar un ítem. */
  @Get('catalogo-ods')
  @Requiere('ods', 'V')
  async catalogoOds(@SesionActual() s: Sesion, @Query('vehiculoId') vehiculoId?: string) {
    const organizacionId = empresaDe(s);
    const grupo = await this.grupoDeVehiculo(organizacionId, vehiculoId);
    const [sv, pr, reglas] = await Promise.all([
      this.prisma.servicio.findMany({ where: { organizacionId, activo: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.producto.findMany({ where: { organizacionId, activo: true }, include: { stock: true }, orderBy: { nombre: 'asc' } }),
      grupo ? this.prisma.reglaPrecio.findMany({ where: { organizacionId }, include: { grupo: true } }) : Promise.resolve([]),
    ]);
    const rs = reglas.map(aRegla);
    // Si el vehículo pertenece a un grupo, se muestra el precio y las horas de ESE grupo (no el estándar), con su
    // etiqueta; si no pertenece a ninguno, se muestra el precio estándar marcado como tal (RF-100/RN-09).
    return {
      servicios: sv
        .map((x) => {
          const c = grupo ? calcularServicio(aServicio(x), grupo, rs) : null;
          if (c && c.disponible === false) return null;
          return {
            id: x.id, codigo: x.codigo, nombre: x.nombre, categoria: x.categoria,
            horas: c ? c.horas : Number(x.horasEstandar), precio: c ? c.precio : Number(x.precioEstandar),
            grupo: grupo ?? null, repuestos: x.repuestos,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
      productos: pr.map((x) => ({
        id: x.id, codigo: x.codigo, nombre: x.nombre, referencia: x.referencia, unidad: x.unidad, marca: x.marca, precio: Number(x.precio), costo: num(x.costo),
        stockTotal: Math.round(x.stock.reduce((a, y) => a + Number(y.cantidad), 0) * 1000) / 1000,
      })),
    };
  }

  /** RN-09: precio y horas del servicio para el grupo del vehículo, con la traza de las reglas aplicadas. */
  @Get('precio-servicio')
  @Requiere('ods', 'V')
  async precioServicio(@SesionActual() s: Sesion, @Query('servicioId') servicioId: string, @Query('vehiculoId') vehiculoId?: string) {
    const organizacionId = empresaDe(s);
    const sv = await this.prisma.servicio.findFirst({ where: { id: String(servicioId ?? ''), organizacionId } });
    if (!sv) throw new NotFoundException('Servicio no encontrado.');
    const grupo = await this.grupoDeVehiculo(organizacionId, vehiculoId);
    const reglas = (await this.prisma.reglaPrecio.findMany({ where: { organizacionId }, include: { grupo: true } })).map(aRegla);
    const r = calcularServicio(aServicio(sv), grupo ?? '', reglas);
    return { servicioId: sv.id, codigo: sv.codigo, nombre: sv.nombre, grupo, ...r };
  }

  private async grupoDeVehiculo(organizacionId: string, vehiculoId?: string) {
    if (!vehiculoId) return null;
    const v = await this.prisma.vehiculo.findFirst({ where: { id: vehiculoId, organizacionId }, include: { grupo: true } });
    if (!v) throw new NotFoundException('Vehículo no encontrado.');
    return v.grupo?.activo ? v.grupo.codigo : null;
  }

  /** Alertas de solapamiento para las líneas que la cajera tiene en pantalla (antes de guardar). */
  @Post('solapamientos/evaluar')
  @Requiere('ods', 'V')
  async evaluar(@SesionActual() s: Sesion, @Body() b: { vehiculoId?: string; lineas?: { servicioId?: string | null; total?: number }[] }) {
    const organizacionId = empresaDe(s);
    if (!Array.isArray(b?.lineas) || b.lineas.length > 300) throw new BadRequestException('Envía las líneas de la orden.');
    const grupo = await this.grupoDeVehiculo(organizacionId, b.vehiculoId);
    const reglas = (await this.prisma.solapamiento.findMany({ where: { organizacionId, activo: true } })).map(aSolape);
    const lineas = b.lineas.map((l, i) => ({ indice: i, servicioId: l.servicioId ?? null, total: Number(l.total) || 0 }));
    return evaluarSolapamientos(lineas, reglas, grupo).map((h) => ({ solapamientoId: h.regla.id, codigo: h.regla.codigo, modo: h.regla.modo, indiceBase: h.indiceBase, indiceReducido: h.indiceReducido, monto: h.monto, alerta: h.alerta, clave: h.clave }));
  }

  // ═══════════════ Inventario: stock por local y ajuste (base del kárdex, RF-092) ═══════════════
  /** Para ajustar el inventario se confirma la contraseña de quien lo hace; vale 15 minutos. */
  @Post('inventario/verificar')
  @Requiere('catalogo', 'A')
  async verificarInventario(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: { password?: unknown }) {
    const u = await this.prisma.usuario.findUnique({ where: { id: real.id } });
    if (!u || !b?.password || !(await bcrypt.compare(String(b.password), u.passwordHash))) throw new UnauthorizedException('Contraseña incorrecta.');
    return { token: await this.jwt.signAsync({ sub: real.id, alcance: 'inventario', org: empresaDe(s) }, { expiresIn: '15m' }) };
  }

  @Post('productos/:id/ajuste')
  @Requiere('catalogo', 'A')
  async ajustarStock(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: { localId?: unknown; cantidad?: unknown; motivo?: unknown; token?: unknown }) {
    const organizacionId = empresaDe(s);
    let permiso: { sub?: string; alcance?: string; org?: string };
    try { permiso = await this.jwt.verifyAsync(String(b?.token ?? '')); } catch { throw new ForbiddenException('Confirma tu contraseña para ajustar el inventario.'); }
    if (permiso.alcance !== 'inventario' || permiso.sub !== real.id || permiso.org !== organizacionId) throw new ForbiddenException('Confirma tu contraseña para ajustar el inventario.');
    const p = await this.prisma.producto.findFirst({ where: { id, organizacionId } });
    if (!p) throw new NotFoundException('Producto no encontrado.');
    const local = await this.prisma.local.findFirst({ where: { id: String(b?.localId ?? ''), organizacionId } });
    if (!local) throw new BadRequestException('Elige un local de la empresa.');
    const nueva = numero(b?.cantidad, 'Cantidad', 0, 10_000_000);
    if (nueva === null) throw new BadRequestException('Escribe la cantidad en stock.');
    const motivo = texto(b?.motivo, 300);
    const res = await this.prisma.$transaction(async (tx) => {
      const actual = await tx.stockProducto.findUnique({ where: { productoId_localId: { productoId: id, localId: local.id } } });
      const antes = Number(actual?.cantidad ?? 0);
      const dif = Math.round((nueva - antes) * 1000) / 1000;
      if (!dif) return null;
      await tx.stockProducto.upsert({ where: { productoId_localId: { productoId: id, localId: local.id } }, update: { cantidad: nueva }, create: { productoId: id, localId: local.id, cantidad: nueva } });
      return tx.movimientoInventario.create({ data: { productoId: id, localId: local.id, tipo: 'Ajuste de inventario', entrada: dif > 0 ? dif : 0, salida: dif < 0 ? -dif : 0, saldo: nueva, motivo: motivo ?? `De ${antes} a ${nueva}`, usuarioId: real.id } });
    });
    if (res) await auditar(this.prisma, real, s, 'stock_producto', id, null, { localId: local.id, cantidad: nueva, movimientoId: res.id }, 'Ajuste de inventario');
    return productoRes((await this.prisma.producto.findFirst({ where: { id }, include: INCLUIR_PRODUCTO }))!);
  }

  /** Locales (almacenes) de la empresa, para ver el stock por local. */
  @Get('inventario/locales')
  @Requiere('catalogo', 'V')
  async localesInventario(@SesionActual() s: Sesion) {
    return (await this.prisma.local.findMany({ where: { organizacionId: empresaDe(s) }, orderBy: { nombre: 'asc' } })).map((l) => ({ id: l.id, nombre: l.nombre }));
  }

  @Get('productos/:id/movimientos')
  @Requiere('catalogo', 'V')
  async movimientos(@SesionActual() s: Sesion, @Param('id') id: string) {
    const p = await this.prisma.producto.findFirst({ where: { id, organizacionId: empresaDe(s) } });
    if (!p) throw new NotFoundException('Producto no encontrado.');
    const m = await this.prisma.movimientoInventario.findMany({ where: { productoId: id }, include: { local: true }, orderBy: { fecha: 'desc' }, take: 100 });
    return m.map((x) => ({ id: x.id, fecha: x.fecha.toISOString(), local: x.local.nombre, tipo: x.tipo, entrada: Number(x.entrada), salida: Number(x.salida), saldo: Number(x.saldo), motivo: x.motivo }));
  }
}
