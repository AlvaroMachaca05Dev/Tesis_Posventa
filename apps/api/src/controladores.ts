import { Body, Controller, Get, Post, UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { Publico, Requiere, Sesion, SesionActual, SesionReal } from './acceso';
import { CATALOGO_MODULOS } from './catalogo-modulos';
import { PrismaService } from './prisma.service';

@Controller('auth')
export class AuthController {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  @Publico()
  @Post('login')
  async login(@Body() body: { correo?: string; password?: string }) {
    const correo = String(body?.correo ?? '').trim().toLowerCase();
    const u = correo ? await this.prisma.usuario.findUnique({ where: { correo }, include: { roles: { include: { rol: true } } } }) : null;
    // Mismo error si no existe, está desactivado o la contraseña no coincide.
    if (!u || !u.activo || !(await bcrypt.compare(String(body?.password ?? ''), u.passwordHash))) throw new UnauthorizedException('Credenciales inválidas.');
    const token = await this.jwt.signAsync({ sub: u.id });
    return { token, usuario: { id: u.id, nombre: u.nombre, roles: u.roles.map((r) => r.rol.nombre) } };
  }
}

@Controller()
export class SesionController {
  constructor(private prisma: PrismaService) {}

  /** Quién soy, con qué roles y qué módulos puedo usar (alimenta el menú). */
  @Get('me')
  me(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Req() req: { actuandoComo: boolean }) {
    return {
      usuario: { id: s.id, nombre: s.nombre, correo: s.correo, organizacionId: s.organizacionId },
      roles: s.roles,
      permisos: s.permisos,
      // Menú: solo los módulos permitidos, en el orden del prototipo, con etiqueta, grupo y nivel.
      menu: CATALOGO_MODULOS.filter((m) => s.permisos[m.id]).map((m) => ({ ...m, nivel: s.permisos[m.id] })),
      actuandoComo: req.actuandoComo,
      esPlataforma: real.esPlataforma,
      real: { id: real.id, nombre: real.nombre },
    };
  }

  /** Inicio de «Ver como…»: solo el Desarrollador; queda auditado. Después se envía X-Ver-Como en cada petición. */
  @Post('ver-como')
  async verComo(@SesionReal() real: Sesion, @Body() body: { usuarioId?: string }) {
    if (!real.esPlataforma) throw new ForbiddenException('Solo el Desarrollador puede usar «Ver como».');
    if (!body?.usuarioId) throw new BadRequestException('Indica el usuario.');
    const t = await this.prisma.usuario.findUnique({ where: { id: body.usuarioId }, include: { roles: { include: { rol: true } } } });
    if (!t || !t.activo) throw new NotFoundException('Usuario no encontrado.');
    await this.prisma.auditoria.create({
      data: {
        organizacionId: t.organizacionId,
        tabla: 'ver_como',
        registroId: t.id,
        actor: real.id,
        actuandoComo: t.id,
        despues: { roles: t.roles.map((r) => r.rol.nombre) },
        motivo: 'Inicio de «Ver como…»',
      },
    });
    return { ok: true, usuario: { id: t.id, nombre: t.nombre, roles: t.roles.map((r) => r.rol.nombre) } };
  }

  /** Ruta de prueba de un módulo restringido (bancos). */
  @Get('bancos/ping')
  @Requiere('bancos', 'V')
  bancos() {
    return { ok: true };
  }

  /** Roles visibles. El rol Desarrollador es exclusivo de la plataforma: las empresas nunca lo ven. */
  @Get('roles')
  @Requiere('usuarios', 'V')
  async roles(@SesionActual() s: Sesion, @SesionReal() real: Sesion) {
    const where = real.esPlataforma && s.id === real.id ? {} : { ambito: 'empresa', organizacionId: s.organizacionId };
    const roles = await this.prisma.rol.findMany({ where, orderBy: [{ nivel: 'desc' }, { nombre: 'asc' }] });
    return roles.map((r) => ({ id: r.id, nombre: r.nombre, ambito: r.ambito, nivel: r.nivel, esBase: r.esBase }));
  }

  /** Usuarios visibles. Una empresa ve solo los suyos y nunca a quien tenga el rol Desarrollador. */
  @Get('usuarios')
  @Requiere('usuarios', 'V')
  async usuarios(@SesionActual() s: Sesion, @SesionReal() real: Sesion) {
    const todos = real.esPlataforma && s.id === real.id;
    const lista = await this.prisma.usuario.findMany({
      where: todos ? {} : { organizacionId: s.organizacionId, roles: { none: { rol: { ambito: 'plataforma' } } } },
      include: { roles: { include: { rol: true } } },
      orderBy: { nombre: 'asc' },
    });
    return lista.map((u) => ({ id: u.id, nombre: u.nombre, correo: u.correo, activo: u.activo, roles: u.roles.map((r) => r.rol.nombre) }));
  }
}
