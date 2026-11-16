import { BadRequestException } from '@nestjs/common';
import { PAISES } from '../cliente/paises';
import { texto, validarMovil } from './validacion';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TIPOS_DOCUMENTO = ['DNI', 'CARNET_EXTRANJERIA', 'RUC'];

/**
 * Datos comunes de un cliente y de un proveedor (formulario único): tipo y número de documento, razón social o nombre,
 * nombre comercial, país, móvil, dirección fiscal, correo, nombre de contacto y comentario.
 * Con `parcial` solo se revisa lo que vino.
 */
export function datosTercero(b: Record<string, unknown>, o: { tipoPorDefecto: 'DNI' | 'RUC'; paisBase: string; parcial: boolean; nombreOpcional?: boolean }) {
  const d: Record<string, unknown> = {};
  const viene = (k: string) => b[k] !== undefined;
  const ver = (k: string) => !o.parcial || viene(k);
  if (ver('tipoDocumento')) {
    const t = b.tipoDocumento === undefined || b.tipoDocumento === '' || b.tipoDocumento === null ? o.tipoPorDefecto : String(b.tipoDocumento);
    if (!TIPOS_DOCUMENTO.includes(t)) throw new BadRequestException('Elige el tipo de documento: DNI, Carné de extranjería o RUC.');
    d.tipoDocumento = t;
  }
  if (ver('documento')) {
    const doc = texto(b.documento, 20)?.toUpperCase().replace(/\s+/g, '');
    if (!doc) throw new BadRequestException('Escribe el número de documento (hasta 20 caracteres).');
    d.documento = doc;
  }
  if (ver('nombre')) {
    const n = texto(b.nombre, 150);
    if (!n && !o.nombreOpcional) throw new BadRequestException('Escribe el nombre o la razón social.');
    // Cuando el nombre es opcional y no se escribe, el cliente se guarda con su número de documento como nombre.
    const respaldo = n ?? (d.documento as string | undefined) ?? texto(b.documento, 20)?.toUpperCase().replace(/\s+/g, '');
    if (respaldo) d.nombre = respaldo;
  }
  if (ver('pais')) {
    const p = (texto(b.pais) ?? o.paisBase).toUpperCase();
    if (!PAISES.some((x) => x.codigo === p)) throw new BadRequestException('El país no es válido.');
    d.pais = p;
  }
  if (ver('movil')) {
    const m = String(b.movil ?? '').replace(/[\s-]/g, '');
    d.movil = m === '' ? null : m;
  }
  if (ver('email')) {
    const e = texto(b.email);
    if (e && !CORREO.test(e)) throw new BadRequestException('El correo no es válido.');
    d.email = e;
  }
  for (const k of ['nombreComercial', 'direccionFiscal', 'contacto', 'comentario']) if (ver(k)) d[k] = texto(b[k]);
  return d;
}

/** Valida el móvil con el país que quedará guardado (el nuevo o, si no cambia, el actual). */
export function revisarMovil(d: Record<string, unknown>, actual?: { pais: string; movil: string | null }) {
  validarMovil((d.pais as string | undefined) ?? actual?.pais ?? 'PE', d.movil !== undefined ? (d.movil as string | null) : (actual?.movil ?? null));
}
