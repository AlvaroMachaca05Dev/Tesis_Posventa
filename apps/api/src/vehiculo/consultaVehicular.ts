import { BadGatewayException, BadRequestException, Controller, Get, NotFoundException, Query, ServiceUnavailableException } from '@nestjs/common';
import { normalizarPlaca } from './vehiculo.reglas';

export interface ResultadoVehicular {
  placa: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  color: string | null;
  nroSerie: string | null;
  nroVin: string | null;
  nroMotor: string | null;
  codigoMotor: string | null;
}

const texto = (v: unknown) => {
  const t = typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
  return t === '' ? null : t;
};
const primero = (j: Record<string, unknown>, ...claves: string[]) => {
  for (const k of claves) {
    const t = texto(j[k]);
    if (t) return t;
  }
  return null;
};

/** Lleva la respuesta de cualquier proveedor de consulta vehicular al formato del sistema; null si no trae marca ni modelo. */
export function normalizarVehicular(placa: string, respuesta: unknown): ResultadoVehicular | null {
  const bruto = (respuesta ?? {}) as Record<string, unknown>;
  const j = ((typeof bruto.data === 'object' && bruto.data) || (typeof bruto.result === 'object' && bruto.result) || bruto) as Record<string, unknown>;
  const marca = primero(j, 'marca', 'brand', 'make');
  const modelo = primero(j, 'modelo', 'model');
  if (!marca && !modelo) return null;
  const anio = Number(primero(j, 'anio', 'año', 'ano', 'year', 'anioFabricacion', 'anio_fabricacion'));
  return {
    placa,
    marca: marca?.toUpperCase() ?? null,
    modelo: modelo?.toUpperCase() ?? null,
    anio: Number.isInteger(anio) && anio > 1900 && anio < 2100 ? anio : null,
    color: primero(j, 'color')?.toUpperCase() ?? null,
    nroSerie: primero(j, 'serie', 'nroSerie', 'nro_serie', 'numeroSerie', 'chasis', 'serial'),
    nroVin: primero(j, 'vin', 'nroVin', 'nro_vin', 'numeroVin'),
    nroMotor: primero(j, 'motor', 'nroMotor', 'nro_motor', 'numeroMotor', 'engineNumber'),
    codigoMotor: primero(j, 'codigoMotor', 'codigo_motor', 'engineCode'),
  };
}

@Controller()
export class ConsultaVehicularController {
  /**
   * Consulta los datos de un vehículo por su placa. El proveedor se configura en el servidor
   * (CONSULTA_PLACA_URL con {placa}, y la clave en CONSULTA_PLACA_TOKEN o, si falta, CONSULTA_DOC_TOKEN); la clave nunca llega a la pantalla.
   */
  @Get('consulta-vehicular')
  async consultar(@Query('placa') placa?: string): Promise<ResultadoVehicular> {
    const p = normalizarPlaca(String(placa ?? ''));
    if (!/^[A-Z0-9]{6}$/.test(p)) throw new BadRequestException('Escribe la placa completa (6 letras o números) para consultarla.');
    const plantilla = process.env.CONSULTA_PLACA_URL;
    const token = process.env.CONSULTA_PLACA_TOKEN || process.env.CONSULTA_DOC_TOKEN;
    if (!plantilla) throw new ServiceUnavailableException('La consulta vehicular no está configurada: falta CONSULTA_PLACA_URL en el .env del servidor.');
    const url = plantilla.replace('{placa}', encodeURIComponent(p)).replace('{token}', encodeURIComponent(token ?? ''));

    let r: Response;
    try {
      r = await fetch(url, { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(10000) });
    } catch {
      throw new BadGatewayException('La consulta no respondió. Intenta de nuevo o escribe los datos a mano.');
    }
    if (r.status === 404 || r.status === 422) throw new NotFoundException(`No se encontró la placa ${p}.`);
    if (!r.ok) throw new BadGatewayException('La consulta no respondió. Intenta de nuevo o escribe los datos a mano.');
    const res = normalizarVehicular(p, await r.json().catch(() => null));
    if (!res) throw new NotFoundException(`No se encontró la placa ${p}.`);
    return res;
  }
}
