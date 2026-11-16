import { BadRequestException, ConflictException } from '@nestjs/common';
import { Sesion } from './acceso';

/** Los datos de negocio son de una empresa: quien no tiene empresa (el Desarrollador) debe elegir a quién «ver como». */
export function empresaDe(s: Sesion) {
  if (!s.organizacionId) throw new BadRequestException('Esta acción es de una empresa. Usa «Ver como…» para entrar como un usuario de la empresa.');
  return s.organizacionId;
}

/** El móvil se escribe sin prefijo: en Perú son 9 dígitos y en otros países entre 6 y 15. */
export function validarMovil(pais: string, movil: string | null | undefined) {
  if (!movil) return;
  if (!/^\d+$/.test(movil)) throw new BadRequestException('El móvil solo lleva números, sin el prefijo del país.');
  if (pais === 'PE' ? movil.length !== 9 : movil.length < 6 || movil.length > 15) {
    throw new BadRequestException(pais === 'PE' ? 'El móvil de Perú lleva 9 dígitos.' : 'El móvil debe tener entre 6 y 15 dígitos.');
  }
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
