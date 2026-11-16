import { BadGatewayException, BadRequestException, Controller, Get, NotFoundException, Query, ServiceUnavailableException } from '@nestjs/common';
import { errorDocumento } from '../maestros/maestros.reglas';

export interface ResultadoConsulta {
  tipoDocumento: 'DNI' | 'RUC';
  documento: string;
  nombre: string;
  direccion: string | null;
  estado: string | null;
  condicion: string | null;
}

// Por defecto se consulta RENIEC (DNI) y SUNAT (RUC) por medio de apis.net.pe; cualquier otra API con respuesta JSON
// parecida se configura con CONSULTA_DOC_URL_DNI y CONSULTA_DOC_URL_RUC (con {numero} en la dirección).
const URL_POR_DEFECTO = {
  DNI: 'https://api.apis.net.pe/v2/reniec/dni?numero={numero}',
  RUC: 'https://api.apis.net.pe/v2/sunat/ruc?numero={numero}',
};

const texto = (v: unknown) => {
  const t = typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
  return t === '' ? null : t;
};

/** Lleva la respuesta de cualquier proveedor al formato del sistema; devuelve null si no trae un nombre. */
export function normalizarConsulta(tipo: 'DNI' | 'RUC', numero: string, respuesta: unknown): ResultadoConsulta | null {
  const bruto = (respuesta ?? {}) as Record<string, unknown>;
  const j = ((typeof bruto.data === 'object' && bruto.data) || bruto) as Record<string, unknown>;
  const nombre = tipo === 'DNI'
    ? texto(j.nombreCompleto ?? j.nombre_completo ?? j.nombre) ?? ([j.nombres, j.apellidoPaterno ?? j.apellido_paterno, j.apellidoMaterno ?? j.apellido_materno].map(texto).filter(Boolean).join(' ') || null)
    : texto(j.razonSocial ?? j.razon_social ?? j.nombreORazonSocial ?? j.nombre);
  if (!nombre) return null;
  return { tipoDocumento: tipo, documento: numero, nombre: nombre.toUpperCase(), direccion: tipo === 'RUC' ? texto(j.direccion) : null, estado: tipo === 'RUC' ? texto(j.estado) : null, condicion: tipo === 'RUC' ? texto(j.condicion) : null };
}

@Controller()
export class ConsultaDocumentoController {
  /** Consulta el nombre o la razón social de un DNI o RUC. La clave de la API queda en el servidor y nunca llega a la pantalla. */
  @Get('consulta-documento')
  async consultar(@Query('tipo') tipo?: string, @Query('numero') numero?: string): Promise<ResultadoConsulta> {
    const t = String(tipo ?? '').toUpperCase();
    const n = String(numero ?? '').replace(/\s+/g, '');
    if (t === 'CARNET_EXTRANJERIA' || t === 'CE') throw new BadRequestException('El carné de extranjería no tiene consulta: escribe los datos a mano.');
    if (t !== 'DNI' && t !== 'RUC') throw new BadRequestException('Elige primero el tipo de documento: DNI o RUC.');
    const invalido = errorDocumento(t, n);
    if (invalido) throw new BadRequestException(invalido);

    const token = process.env.CONSULTA_DOC_TOKEN;
    const propia = process.env[`CONSULTA_DOC_URL_${t}`];
    if (!token && !propia) throw new ServiceUnavailableException('La consulta no está configurada: falta CONSULTA_DOC_TOKEN en el .env del servidor.');
    const url = (propia || URL_POR_DEFECTO[t]).replace('{numero}', encodeURIComponent(n));

    let r: Response;
    try {
      r = await fetch(url, { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(8000) });
    } catch {
      throw new BadGatewayException('La consulta no respondió. Intenta de nuevo o escribe los datos a mano.');
    }
    if (r.status === 404 || r.status === 422) throw new NotFoundException(`No se encontró el ${t} ${n}.`);
    if (!r.ok) throw new BadGatewayException('La consulta no respondió. Intenta de nuevo o escribe los datos a mano.');
    const res = normalizarConsulta(t, n, await r.json().catch(() => null));
    if (!res) throw new NotFoundException(`No se encontró el ${t} ${n}.`);
    return res;
  }
}
