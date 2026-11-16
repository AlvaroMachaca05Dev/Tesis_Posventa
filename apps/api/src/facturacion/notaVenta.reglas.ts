// Reglas de la nota de venta (RF-088, RN-15): tipo de IGV por ítem, totales y detracción. Sin base de datos, para probarlas solas.
export const TIPOS_IGV = ['GRAVADO', 'EXONERADO', 'INAFECTO'] as const;
export type TipoIgv = (typeof TIPOS_IGV)[number];
export const IGV = 0.18;
export const DETRACCION_PCT = 12;
export const DETRACCION_DESDE = 700;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** El impuesto del ítem de la ODS («IGV» o «NINGUNO») da el tipo de IGV por defecto de la nota. */
export const tipoIgvPorDefecto = (impuesto: string): TipoIgv => (impuesto === 'NINGUNO' ? 'INAFECTO' : 'GRAVADO');

export interface LineaNota { tipo: string; total: number; tipoIgv: TipoIgv }

/**
 * Totales de la nota. En un ítem gravado el precio ya incluye el IGV: la base es total / 1,18.
 * El total es la suma exacta de los ítems, sin redondeo (DEC-74); el IGV sale de la diferencia para que todo cuadre.
 */
export function totalesNota(lineas: LineaNota[]) {
  const suma = (t: TipoIgv) => r2(lineas.filter((l) => l.tipoIgv === t).reduce((a, l) => a + l.total, 0));
  const exonerada = suma('EXONERADO');
  const inafecta = suma('INAFECTO');
  const conIgv = suma('GRAVADO');
  const gravada = r2(conIgv / (1 + IGV));
  const igv = r2(conIgv - gravada);
  return { exonerada, inafecta, gravada, igv, total: r2(exonerada + inafecta + conIgv) };
}

/** Se propone la detracción si hay al menos un servicio y el total supera S/ 700 (DEC-75). */
export const proponeDetraccion = (lineas: LineaNota[], total: number) => lineas.some((l) => l.tipo === 'servicio') && total > DETRACCION_DESDE;

/** Monto exacto y monto redondeado a soles enteros (desde 0,50 sube). La deposita la empresa: no reduce lo cobrado (DEC-82). */
export function detraccionDe(total: number, pct = DETRACCION_PCT) {
  const exacta = r2((total * pct) / 100);
  return { pct, exacta, redondeada: Math.floor(exacta + 0.5) };
}

/** Código visible del comprobante: serie y número con seis dígitos (NV01-000001). */
export const codigoNota = (serie: string, numero: number) => `${serie}-${String(numero).padStart(6, '0')}`;
