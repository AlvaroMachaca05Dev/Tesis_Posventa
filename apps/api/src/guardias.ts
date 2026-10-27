import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { cargarSesion, ORDEN } from './acceso';
import { PrismaService } from './prisma.service';

/** Autentica con el token. Si el usuario real es el Desarrollador y envía X-Ver-Como, la sesión efectiva es la de esa persona. */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('publico', [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const auth: string | undefined = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(auth.slice(7));
    } catch {
      throw new UnauthorizedException();
    }
    const real = await cargarSesion(this.prisma, payload.sub);
    if (!real) throw new UnauthorizedException();
    let efectiva = real;
    const como = req.headers['x-ver-como'];
    if (como) {
      if (!real.esPlataforma) throw new ForbiddenException('Solo el Desarrollador puede usar «Ver como».');
      const t = await cargarSesion(this.prisma, String(como));
      if (!t) throw new NotFoundException('Usuario no encontrado.');
      efectiva = t;
    }
    req.real = real;
    req.sesion = efectiva;
    req.actuandoComo = efectiva.id !== real.id;
    return true;
  }
}

/** Aplica el permiso del módulo indicado con @Requiere(modulo, nivel). */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const req = this.reflector.getAllAndOverride<{ modulo: string; minimo: string } | undefined>('requiere', [ctx.getHandler(), ctx.getClass()]);
    if (!req) return true;
    const sesion = ctx.switchToHttp().getRequest().sesion;
    const nivel = sesion?.permisos?.[req.modulo];
    if (!nivel || ORDEN[nivel] < ORDEN[req.minimo]) throw new ForbiddenException('Tu rol no tiene acceso a este módulo.');
    return true;
  }
}
