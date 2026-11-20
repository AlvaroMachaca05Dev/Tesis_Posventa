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

/** Solo un número o un texto numérico es número: verdadero/falso, listas, objetos, vacío o espacios dan NaN (no 0 ni 1). */
// Solo cifras: «0x10», «1e3», «true» o «[3]» no valen como número (antes Number() los aceptaba).
export const aNumero = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(v.trim()) ? Number(v.trim().replace(',', '.')) : NaN);

/**
 * «Eliminar» de una tabla: si el registro no tiene uso se borra; si la base lo impide porque tiene historial
 * (llave foránea) y se puede desactivar, sale de la lista activa (se puede restaurar); si no, 409 con el motivo.
 */
export async function eliminarRegistro(borrar: () => Promise<unknown>, desactivar: (() => Promise<unknown>) | null, conUso: string) {
  try {
    await borrar();
    return { ok: true, eliminado: true };
  } catch (e) {
    // P2003/P2014 de Prisma, o el error crudo de Postgres por RESTRICT (23001) o llave foránea (23503).
    const llave = ['P2003', 'P2014'].includes((e as { code?: string })?.code ?? '') || /violates (RESTRICT setting|foreign key)|"2300[13]"/.test(String((e as Error)?.message));
    if (!llave) throw e;
    if (!desactivar) throw new ConflictException(conUso);
    await desactivar();
    return { ok: true, eliminado: false };
  }
}

/** Convierte el choque de un índice único (P2002) en un 409 con mensaje propio. */
export function choqueUnico(e: unknown, mensaje: string): never {
  if ((e as { code?: string })?.code === 'P2002') throw new ConflictException(mensaje);
  throw e;
}

/** Un texto llega como texto (o número): listas, objetos y verdadero/falso se rechazan en vez de guardarse como «[object Object]». */
export const texto = (v: unknown, max = 500) => {
  if (v !== null && v !== undefined && typeof v !== 'string' && typeof v !== 'number') throw new BadRequestException('Un campo de texto trae un valor que no es texto.');
  const t = String(v ?? '').trim();
  if (t.length > max) throw new BadRequestException(`El texto supera los ${max} caracteres.`);
  return t === '' ? null : t;
};
