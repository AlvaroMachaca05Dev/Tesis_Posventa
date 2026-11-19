/**
 * Cuadre entre la ODS y su comprobante vigente: antes de cerrar la orden, lo que se cobró en el comprobante debe ser
 * lo mismo que dice la orden (total y cada ítem: tipo, detalle, cantidad y total). Si el comprobante se corrigió
 * y se volvió a emitir, este cruce evita archivar una orden cuyos montos ya no coinciden.
 */
export interface LineaCuadre { tipo: string; descripcion: string; cantidad: number; total: number }

const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const clave = (l: LineaCuadre) => `${l.tipo}|${normal(l.descripcion)}|${Math.round(l.cantidad * 1000) / 1000}|${r2(l.total).toFixed(2)}`;
const texto = (l: LineaCuadre) => `${l.descripcion} (${l.tipo === 'servicio' ? '' : `${l.cantidad} × `}S/ ${r2(l.total).toFixed(2)})`;

export interface ResultadoCuadre { cuadra: boolean; totalOrden: number; totalComprobante: number; faltanEnComprobante: string[]; sobranEnComprobante: string[] }

export function cuadreOrdenComprobante(orden: LineaCuadre[], comprobante: LineaCuadre[]): ResultadoCuadre {
  const totalOrden = r2(orden.reduce((a, l) => a + l.total, 0));
  const totalComprobante = r2(comprobante.reduce((a, l) => a + l.total, 0));
  const restantes = new Map<string, LineaCuadre[]>();
  for (const l of comprobante) restantes.set(clave(l), [...(restantes.get(clave(l)) ?? []), l]);
  const faltan: string[] = [];
  for (const l of orden) {
    const k = clave(l), lista = restantes.get(k);
    if (lista?.length) lista.pop(); else faltan.push(texto(l));
  }
  const sobran = [...restantes.values()].flat().map(texto);
  return { cuadra: totalOrden === totalComprobante && faltan.length === 0 && sobran.length === 0, totalOrden, totalComprobante, faltanEnComprobante: faltan, sobranEnComprobante: sobran };
}

/** Mensaje para la cajera: qué no coincide entre la orden y el comprobante. */
export function mensajeCuadre(codigoComprobante: string, r: ResultadoCuadre) {
  const partes: string[] = [];
  if (r.totalOrden !== r.totalComprobante) partes.push(`el total de la orden es S/ ${r.totalOrden.toFixed(2)} y el del comprobante S/ ${r.totalComprobante.toFixed(2)}`);
  if (r.faltanEnComprobante.length) partes.push(`falta en el comprobante: ${r.faltanEnComprobante.slice(0, 3).join('; ')}`);
  if (r.sobranEnComprobante.length) partes.push(`sobra en el comprobante: ${r.sobranEnComprobante.slice(0, 3).join('; ')}`);
  return `La orden no cuadra con el comprobante ${codigoComprobante}: ${partes.join(' · ')}. Corrige uno de los dos antes de cerrar.`;
}
