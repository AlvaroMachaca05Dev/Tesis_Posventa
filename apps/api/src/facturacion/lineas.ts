import { BadRequestException } from '@nestjs/common';
import { texto } from '../comun/validacion';
import { TIPOS_IGV, TipoIgv } from './notaVenta.reglas';

const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

export interface LineaDoc { posicion: number; tipo: string; descripcion: string; referencia: string | null; cantidad: number; precio: number; descuentoPct: number; tipoIgv: TipoIgv; total: number; servicioId: string | null; productoId: string | null }

/** Valida los ítems escritos a mano (nota de venta directa y cotización) y calcula el total de cada uno; en un servicio la cantidad son horas y no multiplica. */
export function parsearItems(items: unknown): LineaDoc[] {
  const lista = Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  return lista.map((d, i) => {
    const tipo = d.tipo === 'producto' ? 'producto' : 'servicio';
    const descripcion = texto(d.descripcion, 300);
    const cantidad = Number(d.cantidad), precio = Number(d.precio), descuentoPct = Number(d.descuentoPct ?? 0);
    if (!descripcion) throw new BadRequestException(`El ítem ${i + 1} necesita un detalle.`);
    if (![cantidad, precio, descuentoPct].every(Number.isFinite) || cantidad <= 0 || cantidad > 100000 || precio < 0 || precio > 10_000_000 || descuentoPct < 0 || descuentoPct > 100) throw new BadRequestException(`El ítem ${i + 1} tiene cantidad, precio o descuento inválidos.`);
    const tipoIgv = String(d.tipoIgv ?? 'GRAVADO') as TipoIgv;
    if (!TIPOS_IGV.includes(tipoIgv)) throw new BadRequestException('El tipo de IGV es Gravado, Exonerado o Inafecto.');
    return {
      posicion: i, tipo, descripcion, referencia: texto(d.referencia, 80), cantidad, precio, descuentoPct, tipoIgv,
      total: r2((tipo === 'servicio' ? 1 : cantidad) * precio * (1 - descuentoPct / 100)), servicioId: d.servicioId ? String(d.servicioId) : null, productoId: d.productoId ? String(d.productoId) : null,
    };
  });
}
