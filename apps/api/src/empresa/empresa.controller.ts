import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Patch } from '@nestjs/common';
import { auditar, Requiere, Sesion, SesionActual, SesionReal } from '../comun/acceso';
import { PrismaService } from '../comun/prisma.service';
import { empresaDe, texto } from '../comun/validacion';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Serie de un comprobante: una letra y tres letras o números (NV01, B001, F001).
const SERIE = /^[A-Z][A-Z0-9]{3}$/;
const SERIES = ['serieNotaVenta', 'serieBoleta', 'serieFactura'] as const;
const NOMBRE_SERIE: Record<(typeof SERIES)[number], string> = { serieNotaVenta: 'nota de venta', serieBoleta: 'boleta', serieFactura: 'factura' };

/** Configuración de la empresa: sus datos, los parámetros de impresión y las series de comprobantes de cada local. */
@Controller()
export class EmpresaController {
  constructor(private prisma: PrismaService) {}

  private async leer(organizacionId: string) {
    const e = await this.prisma.organizacion.findUniqueOrThrow({ where: { id: organizacionId }, include: { locales: { orderBy: { nombre: 'asc' } } } });
    return {
      nombre: e.nombre, razonSocial: e.razonSocial, ruc: e.ruc, direccion: e.direccion, telefono: e.telefono, correo: e.correo, lema: e.lema,
      cuentasBancarias: e.cuentasBancarias, terminosRecepcion: e.terminosRecepcion, pieTicket: e.pieTicket, anchoTicketMm: e.anchoTicketMm,
      logo: e.logoJpeg ? { base64: e.logoJpeg, ancho: e.logoAncho, alto: e.logoAlto } : null,
      locales: e.locales.map((l) => ({ id: l.id, nombre: l.nombre, direccion: l.direccion, telefono: l.telefono, serieNotaVenta: l.serieNotaVenta, serieBoleta: l.serieBoleta, serieFactura: l.serieFactura })),
    };
  }

  @Get('empresa')
  @Requiere('ajustes', 'V')
  async empresa(@SesionActual() s: Sesion) {
    return this.leer(empresaDe(s));
  }

  @Patch('empresa')
  @Requiere('ajustes', 'A')
  async editar(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const c = b ?? {};
    const d: Record<string, unknown> = {};
    if (c.nombre !== undefined) {
      const n = texto(c.nombre, 120);
      if (!n) throw new BadRequestException('Escribe el nombre de la empresa.');
      d.nombre = n;
    }
    if (c.ruc !== undefined) {
      const r = texto(c.ruc, 11);
      if (r && !/^\d{11}$/.test(r)) throw new BadRequestException('El RUC tiene 11 dígitos.');
      d.ruc = r;
    }
    if (c.correo !== undefined) {
      const m = texto(c.correo, 120);
      if (m && !CORREO.test(m)) throw new BadRequestException('El correo no es válido.');
      d.correo = m;
    }
    for (const k of ['razonSocial', 'direccion', 'telefono', 'lema']) if (c[k] !== undefined) d[k] = texto(c[k], 200);
    for (const k of ['cuentasBancarias', 'pieTicket']) if (c[k] !== undefined) d[k] = texto(c[k], 1000);
    if (c.terminosRecepcion !== undefined) d.terminosRecepcion = texto(c.terminosRecepcion, 12000);
    if (c.anchoTicketMm !== undefined) {
      const a = Number(c.anchoTicketMm);
      if (!Number.isInteger(a) || a < 48 || a > 110) throw new BadRequestException('El ancho del ticket va de 48 a 110 mm.');
      d.anchoTicketMm = a;
    }
    if (c.logo !== undefined) {
      if (c.logo === null) Object.assign(d, { logoJpeg: null, logoAncho: null, logoAlto: null });
      else {
        const l = c.logo as { base64?: unknown; ancho?: unknown; alto?: unknown };
        const base64 = typeof l.base64 === 'string' ? l.base64 : '';
        const ancho = Number(l.ancho), alto = Number(l.alto);
        // El logo va como JPEG (el PDF lo incrusta tal cual): empieza con «/9j/» en base64 y no pasa de unos 400 KB.
        if (!base64.startsWith('/9j/') || !/^[A-Za-z0-9+/=]+$/.test(base64)) throw new BadRequestException('El logo debe ser una imagen JPEG.');
        if (base64.length > 550_000) throw new BadRequestException('El logo es muy pesado: usa una imagen de hasta 400 KB.');
        if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho < 1 || alto < 1 || ancho > 4000 || alto > 4000) throw new BadRequestException('Las medidas del logo no son válidas.');
        Object.assign(d, { logoJpeg: base64, logoAncho: ancho, logoAlto: alto });
      }
    }
    const antes = await this.leer(organizacionId);
    await this.prisma.organizacion.update({ where: { id: organizacionId }, data: d });
    const despues = await this.leer(organizacionId);
    await auditar(this.prisma, real, s, 'organizacion', organizacionId, antes, despues, 'Configuración de la empresa modificada');
    return despues;
  }

  /** Dirección, teléfono y series de comprobantes de un local. Una serie no se repite entre los locales de la empresa. */
  @Patch('empresa/locales/:id')
  @Requiere('ajustes', 'A')
  async editarLocal(@SesionActual() s: Sesion, @SesionReal() real: Sesion, @Param('id') id: string, @Body() b: Record<string, unknown>) {
    const organizacionId = empresaDe(s);
    const local = await this.prisma.local.findFirst({ where: { id, organizacionId } });
    if (!local) throw new NotFoundException('Local no encontrado.');
    const c = b ?? {};
    const d: Record<string, unknown> = {};
    for (const k of ['direccion', 'telefono']) if (c[k] !== undefined) d[k] = texto(c[k], 200);
    for (const k of SERIES) {
      if (c[k] === undefined) continue;
      const serie = texto(c[k], 4)?.toUpperCase() ?? null;
      if (serie && !SERIE.test(serie)) throw new BadRequestException(`La serie de ${NOMBRE_SERIE[k]} lleva una letra y tres letras o números (por ejemplo, ${k === 'serieBoleta' ? 'B001' : k === 'serieFactura' ? 'F001' : 'NV01'}).`);
      if (serie) {
        const otro = await this.prisma.local.findFirst({ where: { organizacionId, id: { not: id }, [k]: serie } });
        if (otro) throw new ConflictException(`La serie ${serie} ya es del local «${otro.nombre}».`);
      }
      d[k] = serie;
    }
    await this.prisma.local.update({ where: { id }, data: d });
    const despues = await this.leer(organizacionId);
    await auditar(this.prisma, real, s, 'local', id, { direccion: local.direccion, telefono: local.telefono, serieNotaVenta: local.serieNotaVenta, serieBoleta: local.serieBoleta, serieFactura: local.serieFactura }, despues.locales.find((l) => l.id === id), 'Local modificado');
    return despues;
  }
}
