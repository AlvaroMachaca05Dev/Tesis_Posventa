import { BadRequestException, ConflictException } from '@nestjs/common';
import { Sesion } from './acceso';

/** Los datos de negocio son de una empresa: quien no tiene empresa (el Desarrollador) debe elegir a quién «ver como». */
export function empresaDe(s: Sesion) {
  if (!s.organizacionId) throw new BadRequestException('Esta acción es de una empresa. Usa «Ver como…» para entrar como un usuario de la empresa.');
  return s.organizacionId;
}

/** Convierte el choque de un índice único (P2002) en un 409 con mensaje propio. */
export function choqueUnico(e: unknown, mensaje: string): never {
  if ((e as { code?: string })?.code === 'P2002') throw new ConflictException(mensaje);
  throw e;
}

export const texto = (v: unknown, max = 500) => {
  const t = String(v ?? '').trim();
  if (t.length > max) throw new BadRequestException(`El texto supera los ${max} caracteres.`);
  return t === '' ? null : t;
};
