import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { auditar, esPlataformaPropia, ORDEN, puedeGestionarNivel, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { CATALOGO_MODULOS } from '../comun/catalogo-modulos';
import { PrismaService } from '../comun/prisma.service';
import { eliminarRegistro, texto } from '../comun/validacion';

type RolFila = { id: string; nombre: string; ambito: string; organizacionId: string | null; nivel: number };
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Contraseña: texto de 8 a 128 caracteres (un texto enorme no se procesa con bcrypt). */
function claveValida(v: unknown) {
  if (typeof v !== 'string' || v.length < 8) throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
  if (v.length > 128) throw new BadRequestException('La contraseña no puede pasar de 128 caracteres.');
}
/** Un id que viene del formulario debe ser texto; un objeto ahí rompería la consulta. */
function idOpcional(v: unknown, campo: string) {
  if (v !== undefined && v !== null && (typeof v !== 'string' || v.length > 64)) throw new BadRequestException(`El ${campo} no es válido.`);
}

@Controller()
export class UsuariosController {
  constructor(private prisma: PrismaService) {}

  /** Un usuario solo gestiona roles de nivel inferior al suyo (el Superadministrador, también del suyo); el rol Desarrollador es exclusivo de la plataforma. */
  private asignable(r: RolFila, s: Sesion, real: Sesion) {
    if (esPlataformaPropia(s, real)) return true;
    return r.ambito === 'empresa' && r.organizacionId === s.organizacionId && puedeGestionarNivel(r.nivel, s);
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
    const nombre = texto(b?.nombre, 120);
    const correo = (texto(b?.correo, 120) ?? '').toLowerCase();
    if (!nombre) throw new BadRequestException('Escribe el nombre.');
    if (!CORREO.test(correo)) throw new BadRequestException('El correo no es válido.');
    claveValida(b?.password);
    idOpcional(b?.localId, 'local'); idOpcional(b?.organizacionId, 'empresa');
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
    if (!propia && !puedeGestionarNivel(nivelT, s)) throw new ForbiddenException('No puedes modificar a un usuario de tu nivel o superior.');
    if (b?.activo === false && t.id === s.id) throw new BadRequestException('No puedes desactivarte a ti mismo.');
    const antes = this.resumen(t);
    const datos: Record<string, unknown> = {};
    if (b?.nombre !== undefined) {
      const n = texto(b.nombre, 120);
      if (!n) throw new BadRequestException('Escribe el nombre.');
      datos.nombre = n;
    }
    if (b?.activo !== undefined && typeof b.activo !== 'boolean') throw new BadRequestException('«Activo» es sí o no.');
    idOpcional(b?.localId, 'local');
    if (b?.activo !== undefined) datos.activo = !!b.activo;
    if (b?.password !== undefined) {
      claveValida(b.password);
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

  /** Un usuario sin movimientos se borra; si ya registró algo (órdenes, pagos, bitácora) queda desactivado. */
  @Delete('usuarios/:id')
  @Requiere('usuarios', 'E')
  async eliminar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string) {
    const t = await this.prisma.usuario.findUnique({ where: { id }, include: { roles: { include: { rol: true } } } });
    const propia = esPlataformaPropia(s, real);
    if (!t || (!propia && (t.organizacionId !== s.organizacionId || t.roles.some((r) => r.rol.ambito === 'plataforma')))) throw new NotFoundException('Usuario no encontrado.');
    if (t.id === s.id || t.id === real.id) throw new BadRequestException('No puedes eliminarte a ti mismo.');
    const nivelT = Math.max(0, ...t.roles.map((r) => r.rol.nivel));
    if (!propia && !puedeGestionarNivel(nivelT, s)) throw new ForbiddenException('No puedes eliminar a un usuario de tu nivel o superior.');
    const r = await eliminarRegistro(
      () => this.prisma.$transaction([this.prisma.usuarioRol.deleteMany({ where: { usuarioId: id } }), this.prisma.usuario.delete({ where: { id } })]),
      () => this.prisma.usuario.update({ where: { id }, data: { activo: false } }),
      'El usuario tiene movimientos.',
    );
    await auditar(this.prisma, real, s, 'usuario', id, this.resumen(t), null, r.eliminado ? 'Usuario eliminado' : 'Usuario desactivado (tenía movimientos)');
    return r;
  }

  /** Los roles los gestionan solo el Superadministrador y el Desarrollador; el Administrador agrega usuarios pero no toca roles. */
  private soloRoles(s: Sesion, real: Sesion) {
    if (!(esPlataformaPropia(s, real) || s.roles.includes('Superadministrador'))) throw new ForbiddenException('Los roles solo los gestiona el Superadministrador.');
  }

  /** Valida los permisos pedidos: módulos conocidos y habilitados, niveles válidos y nunca más de lo que tiene quien los da. */
  private async validarPermisos(permisos: unknown, organizacionId: string, s: Sesion, real: Sesion) {
    if (!Array.isArray(permisos) || permisos.length === 0) throw new BadRequestException('Elige al menos un módulo.');
    const propia = esPlataformaPropia(s, real);
    const habilitados = new Set((await this.prisma.moduloHabilitado.findMany({ where: { organizacionId } })).map((m) => m.modulo));
    const conocidos = new Set(CATALOGO_MODULOS.map((m) => m.id));
    const lista = permisos as { modulo: string; nivel: string }[];
    for (const p of lista) {
      if (!p || typeof p.modulo !== 'string' || !conocidos.has(p.modulo) || !['A', 'E', 'V'].includes(p.nivel)) throw new BadRequestException('Módulo o nivel no válido.');
      if (!habilitados.has(p.modulo)) throw new BadRequestException(`El módulo «${p.modulo}» no está habilitado para la empresa.`);
      if (!propia && (!s.permisos[p.modulo] || ORDEN[s.permisos[p.modulo]] < ORDEN[p.nivel])) throw new ForbiddenException('No puedes dar un permiso mayor al que tú tienes.');
    }
    return lista.map((p) => ({ modulo: p.modulo, nivel: p.nivel }));
  }

  private async guardarPermisos(rolId: string, permisos: { modulo: string; nivel: string }[]) {
    await this.prisma.rolPermiso.deleteMany({ where: { rolId } });
    for (const p of permisos) {
      const permiso = await this.prisma.permiso.upsert({ where: { modulo_accion: { modulo: p.modulo, accion: p.nivel } }, update: {}, create: { modulo: p.modulo, accion: p.nivel } });
      await this.prisma.rolPermiso.create({ data: { rolId, permisoId: permiso.id } });
    }
  }

  /** Rol propio: módulos y niveles a elección. Solo módulos de su empresa y nunca más de lo que quien lo crea tiene. */
  @Post('roles')
  @Requiere('usuarios', 'A')
  async crearRol(
    @SesionActual() s: Sesion,
    @SesionReal() real: Sesion,
    @Body() b: { nombre?: string; permisos?: { modulo: string; nivel: string }[]; organizacionId?: string; asignableAServicios?: boolean },
  ) {
    this.soloRoles(s, real);
    const nombre = texto(b?.nombre, 60);
    if (!nombre) throw new BadRequestException('Escribe el nombre del rol.');
    const propia = esPlataformaPropia(s, real);
    const organizacionId = propia ? (b.organizacionId ?? null) : s.organizacionId;
    if (!organizacionId) throw new BadRequestException('Indica la empresa del rol.');
    const permisos = await this.validarPermisos(b?.permisos, organizacionId, s, real);
    if (await this.prisma.rol.findFirst({ where: { organizacionId, nombre } })) throw new ConflictException('Ya existe un rol con ese nombre.');
    const rol = await this.prisma.rol.create({ data: { organizacionId, nombre, ambito: 'empresa', esBase: false, nivel: 1, asignableAServicios: !!b.asignableAServicios } });
    await this.guardarPermisos(rol.id, permisos);
    const res = { id: rol.id, nombre: rol.nombre, nivel: rol.nivel, asignable: true, permisos };
    await auditar(this.prisma, real, s, 'rol', rol.id, null, res, 'Rol propio creado');
    return res;
  }

  /** Un rol de la empresa (propio o base) se puede renombrar y cambiar de permisos; los roles de plataforma y el Superadministrador, no. */
  private async rolEditable(id: string, s: Sesion, real: Sesion) {
    const r = await this.prisma.rol.findFirst({ where: { id, ...(esPlataformaPropia(s, real) ? {} : { organizacionId: s.organizacionId }) }, include: { permisos: { include: { permiso: true } }, _count: { select: { usuarios: true } } } });
    if (!r) throw new NotFoundException('Rol no encontrado.');
    if (r.ambito === 'plataforma' || r.nombre === 'Superadministrador') throw new ForbiddenException('Ese rol no se puede modificar.');
    return r;
  }

  @Patch('roles/:id')
  @Requiere('usuarios', 'A')
  async editarRol(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: { nombre?: string; permisos?: { modulo: string; nivel: string }[]; asignableAServicios?: boolean }) {
    this.soloRoles(s, real);
    const r = await this.rolEditable(id, s, real);
    const antes = { nombre: r.nombre, permisos: r.permisos.map((p) => ({ modulo: p.permiso.modulo, nivel: p.permiso.accion })) };
    const datos: { nombre?: string; asignableAServicios?: boolean } = {};
    if (b?.nombre !== undefined) {
      const nombre = texto(b.nombre, 60);
      if (!nombre) throw new BadRequestException('Escribe el nombre del rol.');
      if (nombre !== r.nombre && (await this.prisma.rol.findFirst({ where: { organizacionId: r.organizacionId, nombre } }))) throw new ConflictException('Ya existe un rol con ese nombre.');
      datos.nombre = nombre;
    }
    if (b?.asignableAServicios !== undefined) datos.asignableAServicios = !!b.asignableAServicios;
    const permisos = b?.permisos !== undefined && r.organizacionId ? await this.validarPermisos(b.permisos, r.organizacionId, s, real) : null;
    if (Object.keys(datos).length) await this.prisma.rol.update({ where: { id }, data: datos });
    if (permisos) await this.guardarPermisos(id, permisos);
    const res = { id, nombre: datos.nombre ?? r.nombre, permisos: permisos ?? antes.permisos };
    await auditar(this.prisma, real, s, 'rol', id, antes, res, 'Rol modificado');
    return res;
  }

  @Delete('roles/:id')
  @Requiere('usuarios', 'A')
  async eliminarRol(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string) {
    this.soloRoles(s, real);
    const r = await this.rolEditable(id, s, real);
    if (r._count.usuarios > 0) throw new ConflictException(`El rol lo tienen ${r._count.usuarios} usuario(s): cámbiales el rol antes de eliminarlo.`);
    await this.prisma.rolPermiso.deleteMany({ where: { rolId: id } });
    await this.prisma.rol.delete({ where: { id } });
    await auditar(this.prisma, real, s, 'rol', id, { nombre: r.nombre }, null, 'Rol eliminado');
    return { ok: true };
  }
}
