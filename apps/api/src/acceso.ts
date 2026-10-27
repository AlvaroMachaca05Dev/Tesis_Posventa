import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export type Nivel = 'A' | 'E' | 'V';
// V solo ver · E ver y editar · A ver, editar y acciones sensibles
export const ORDEN: Record<string, number> = { V: 1, E: 2, A: 3 };

export interface Sesion {
  id: string;
  nombre: string;
  correo: string;
  organizacionId: string | null;
  roles: string[];
  nivelMax: number;
  esPlataforma: boolean;
  permisos: Record<string, Nivel>;
}

/** Carga al usuario con sus roles y suma los permisos: gana el nivel más alto de cada módulo.
 *  Para una empresa solo cuentan los módulos que tiene habilitados; el dueño de la plataforma no tiene empresa. */
export async function cargarSesion(prisma: PrismaClient, id: string): Promise<Sesion | null> {
  const u = await prisma.usuario.findUnique({
    where: { id },
    include: { roles: { include: { rol: { include: { permisos: { include: { permiso: true } } } } } } },
  });
  if (!u || !u.activo) return null;
  const habilitados = u.organizacionId
    ? new Set((await prisma.moduloHabilitado.findMany({ where: { organizacionId: u.organizacionId } })).map((m) => m.modulo))
    : null;
  const permisos: Record<string, Nivel> = {};
  for (const ur of u.roles) {
    for (const rp of ur.rol.permisos) {
      const { modulo, accion } = rp.permiso;
      if (habilitados && !habilitados.has(modulo)) continue;
      if (!permisos[modulo] || ORDEN[accion] > ORDEN[permisos[modulo]]) permisos[modulo] = accion as Nivel;
    }
  }
  return {
    id: u.id,
    nombre: u.nombre,
    correo: u.correo,
    organizacionId: u.organizacionId,
    roles: u.roles.map((r) => r.rol.nombre),
    nivelMax: Math.max(0, ...u.roles.map((r) => r.rol.nivel)),
    esPlataforma: u.roles.some((r) => r.rol.ambito === 'plataforma'),
    permisos,
  };
}

// Decoradores
export const Publico = () => SetMetadata('publico', true);
export const Requiere = (modulo: string, minimo: Nivel) => SetMetadata('requiere', { modulo, minimo });
export const SesionActual = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().sesion as Sesion);
export const SesionReal = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().real as Sesion);
