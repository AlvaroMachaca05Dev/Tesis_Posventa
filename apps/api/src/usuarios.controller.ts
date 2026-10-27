import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { auditar, esPlataformaPropia, ORDEN, Requiere, Sesion, SesionActual, SesionReal } from './acceso';
import { CATALOGO_MODULOS } from './catalogo-modulos';
import { PrismaService } from './prisma.service';

type RolFila = { id: string; nombre: string; ambito: string; organizacionId: string | null; nivel: number };
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Controller()
export class UsuariosController {
  constructor(private prisma: PrismaService) {}

  /** Un usuario solo gestiona roles de nivel inferior al suyo; el rol Desarrollador es exclusivo de la plataforma. */
  private asignable(r: RolFila, s: Sesion, real: Sesion) {
    if (esPlataformaPropia(s, real)) return true;
    return r.ambito === 'empresa' && r.organizacionId === s.organizacionId && r.nivel < s.nivelMax;
  }

  private async validarRoles(rolIds: unknown, s: Sesion, real: Sesion) {
    if (!Array.isArray(rolIds) || rolIds.length === 0) throw new BadRequestException('Elige al menos un rol.');
    const roles = await this.prisma.rol.findMany({ where: { id: { in: rolIds.map(String) } } });
    if (roles.length !== new Set(rolIds).size) throw new NotFoundException('Rol no encontrado.');
    for (const r of roles) {
      // El rol de plataforma no existe para las empresas: ni se ve ni se asigna.
      if (r.ambito === 'plataforma' && !esPlataformaPropia(s, real)) throw new NotFoundException('Rol no encontrado.');
      if (!this.asignable(r, s, real)) throw new ForbiddenException('Solo puedes asignar roles de nivel inferior al tuyo.');
    }
    return roles;
  }

  private resumen(u: { id: string; nombre: string; correo: string; activo: boolean; localId: string | null; roles: { rol: { nombre: string } }[] }) {
    return { id: u.id, nombre: u.nombre, correo: u.correo, activo: u.activo, localId: u.localId, roles: u.roles.map((r) => r.rol.nombre) };
  }

  @Get('locales')
  @Requiere('usuarios', 'V')
  async locales(@SesionActual() s: Sesion, @SesionReal() real: Sesion) {
    const l = await this.prisma.local.findMany({ where: esPlataformaPropia(s, real) ? {} : { organizacionId: s.organizacionId ?? undefined }, orderBy: { nombre: 'asc' } });
    return l.map((x) => ({ id: x.id, nombre: x.nombre, organizacionId: x.organizacionId }));
  }

  /** Roles visibles, con sus módulos. El rol Desarrollador es exclusivo de la plataforma: las empresas nunca lo ven. */
  @Get('roles')
  @Requiere('usuarios', 'V')
  async roles(@SesionActual() s: Sesion, @SesionReal() real: Sesion) {
    const where = esPlataformaPropia(s, real) ? {} : { ambito: 'empresa', organizacionId: s.organizacionId };
    const roles = await this.prisma.rol.findMany({ where, include: { permisos: { include: { permiso: true } } }, orderBy: [{ nivel: 'desc' }, { nombre: 'asc' }] });
    return roles.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      ambito: r.ambito,
      nivel: r.nivel,
      esBase: r.esBase,
      asignable: this.asignable(r, s, real),
      permisos: r.permisos.map((p) => ({ modulo: p.permiso.modulo, nivel: p.permiso.accion })),
    }));
  }

  @Post('usuarios')
  @Requiere('usuarios', 'E')
  async crear(
    @SesionActual() s: Sesion,
    @SesionReal() real: Sesion,
    @Body() b: { nombre?: string; correo?: string; password?: string; rolIds?: string[]; localId?: string; organizacionId?: string },
  ) {
    const nombre = String(b?.nombre ?? '').trim();
    const correo = String(b?.correo ?? '').trim().toLowerCase();
    if (!nombre) throw new BadRequestException('Escribe el nombre.');
    if (!CORREO.test(correo)) throw new BadRequestException('El correo no es válido.');
    if (String(b?.password ?? '').length < 8) throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
    const roles = await this.validarRoles(b?.rolIds, s, real);
    const soloPlataforma = roles.every((r) => r.ambito === 'plataforma');
    const organizacionId = esPlataformaPropia(s, real) ? (soloPlataforma ? null : (b?.organizacionId ?? null)) : s.organizacionId;
    if (!soloPlataforma && !organizacionId) throw new BadRequestException('Indica la empresa del usuario.');
    if (await this.prisma.usuario.findUnique({ where: { correo } })) throw new ConflictException('Ese correo ya existe.');
    let localId: string | null = soloPlataforma ? null : (b?.localId ?? s.localId ?? null);
    if (localId) {
      const l = await this.prisma.local.findFirst({ where: { id: localId, organizacionId: organizacionId ?? undefined } });
      if (!l) throw new BadRequestException('El local no pertenece a la empresa.');
    } else if (organizacionId) {
      localId = (await this.prisma.local.findFirst({ where: { organizacionId }, orderBy: { nombre: 'asc' } }))?.id ?? null;
    }
    const u = await this.prisma.usuario.create({
      data: { nombre, correo, passwordHash: await bcrypt.hash(String(b.password), 10), activo: true, organizacionId, localId, roles: { create: roles.map((r) => ({ rolId: r.id })) } },
      include: { roles: { include: { rol: true } } },
    });
    const res = this.resumen(u);
    await auditar(this.prisma, real, s, 'usuario', u.id, null, { ...res }, 'Usuario creado');
    return res;
  }

  @Patch('usuarios/:id')
  @Requiere('usuarios', 'E')
  async editar(
    @SesionActual() s: Sesion,
    @SesionReal() real: Sesion,
    @Param('id') id: string,
    @Body() b: { nombre?: string; activo?: boolean; rolIds?: string[]; password?: string; localId?: string },
  ) {
    const t = await this.prisma.usuario.findUnique({ where: { id }, include: { roles: { include: { rol: true } } } });
    const propia = esPlataformaPropia(s, real);
    // Lo que está fuera de tu empresa, o es de la plataforma, no existe para ti.
    if (!t || (!propia && (t.organizacionId !== s.organizacionId || t.roles.some((r) => r.rol.ambito === 'plataforma')))) throw new NotFoundException('Usuario no encontrado.');
    const nivelT = Math.max(0, ...t.roles.map((r) => r.rol.nivel));
    if (!propia && nivelT >= s.nivelMax) throw new ForbiddenException('No puedes modificar a un usuario de tu nivel o superior.');
    if (b?.activo === false && t.id === s.id) throw new BadRequestException('No puedes desactivarte a ti mismo.');
    const antes = this.resumen(t);
    const datos: Record<string, unknown> = {};
    if (b?.nombre !== undefined) {
      if (!String(b.nombre).trim()) throw new BadRequestException('Escribe el nombre.');
      datos.nombre = String(b.nombre).trim();
    }
    if (b?.activo !== undefined) datos.activo = !!b.activo;
    if (b?.password !== undefined) {
      if (String(b.password).length < 8) throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
      datos.passwordHash = await bcrypt.hash(String(b.password), 10);
    }
    if (b?.localId !== undefined) {
      const l = await this.prisma.local.findFirst({ where: { id: b.localId, organizacionId: t.organizacionId ?? undefined } });
      if (!l) throw new BadRequestException('El local no pertenece a la empresa.');
      datos.localId = b.localId;
    }
    if (b?.rolIds !== undefined) {
      const roles = await this.validarRoles(b.rolIds, s, real);
      await this.prisma.usuarioRol.deleteMany({ where: { usuarioId: t.id } });
      await this.prisma.usuarioRol.createMany({ data: roles.map((r) => ({ usuarioId: t.id, rolId: r.id })) });
    }
    const u = await this.prisma.usuario.update({ where: { id: t.id }, data: datos, include: { roles: { include: { rol: true } } } });
    const res = this.resumen(u);
    await auditar(this.prisma, real, s, 'usuario', u.id, antes, res, 'Usuario modificado');
    return res;
  }

  /** Rol propio: el Superadministrador elige módulos y niveles. Solo módulos de su empresa y nunca más de lo que él mismo tiene. */
  @Post('roles')
  @Requiere('usuarios', 'A')
  async crearRol(
    @SesionActual() s: Sesion,
    @SesionReal() real: Sesion,
    @Body() b: { nombre?: string; permisos?: { modulo: string; nivel: string }[]; organizacionId?: string; asignableAServicios?: boolean },
  ) {
    const nombre = String(b?.nombre ?? '').trim();
    if (!nombre) throw new BadRequestException('Escribe el nombre del rol.');
    if (!Array.isArray(b?.permisos) || b.permisos.length === 0) throw new BadRequestException('Elige al menos un módulo.');
    const propia = esPlataformaPropia(s, real);
    const organizacionId = propia ? (b.organizacionId ?? null) : s.organizacionId;
    if (!organizacionId) throw new BadRequestException('Indica la empresa del rol.');
    const habilitados = new Set((await this.prisma.moduloHabilitado.findMany({ where: { organizacionId } })).map((m) => m.modulo));
    const conocidos = new Set(CATALOGO_MODULOS.map((m) => m.id));
    for (const p of b.permisos) {
      if (!conocidos.has(p.modulo) || !['A', 'E', 'V'].includes(p.nivel)) throw new BadRequestException('Módulo o nivel no válido.');
      if (!habilitados.has(p.modulo)) throw new BadRequestException(`El módulo «${p.modulo}» no está habilitado para la empresa.`);
      if (!propia && (!s.permisos[p.modulo] || ORDEN[s.permisos[p.modulo]] < ORDEN[p.nivel])) throw new ForbiddenException('No puedes dar un permiso mayor al que tú tienes.');
    }
    if (await this.prisma.rol.findFirst({ where: { organizacionId, nombre } })) throw new ConflictException('Ya existe un rol con ese nombre.');
    const rol = await this.prisma.rol.create({ data: { organizacionId, nombre, ambito: 'empresa', esBase: false, nivel: 1, asignableAServicios: !!b.asignableAServicios } });
    for (const p of b.permisos) {
      const permiso = await this.prisma.permiso.upsert({ where: { modulo_accion: { modulo: p.modulo, accion: p.nivel } }, update: {}, create: { modulo: p.modulo, accion: p.nivel } });
      await this.prisma.rolPermiso.create({ data: { rolId: rol.id, permisoId: permiso.id } });
    }
    const res = { id: rol.id, nombre: rol.nombre, nivel: rol.nivel, asignable: true, permisos: b.permisos };
    await auditar(this.prisma, real, s, 'rol', rol.id, null, res, 'Rol propio creado');
    return res;
  }
}
