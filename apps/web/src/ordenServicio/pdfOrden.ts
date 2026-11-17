import type { Empresa, Orden } from '../comun/api';
import { anchoTexto, construirPdf, dividir, ImagenRgb, logoEmpresa, medidasLogo, Pagina } from '../comun/pdf';
import { LOGO_PDF } from './logoPdf';

/** Formatos de impresión de una orden: la hoja de la ODS, la hoja de recepción con términos y el ticket angosto. */
export type FormatoPdf = 'PDF' | 'Recepción' | 'Ticket';

const LOGO: ImagenRgb = { ...LOGO_PDF, predictor: true };
const L = 28, R = 584, W = R - L; // márgenes de la hoja carta (612 x 792 puntos)
const GRIS = 0.93, BORDE = 0.6;
const dinero = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const dia = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const TIPO_DOC: Record<string, string> = { DNI: 'DNI', RUC: 'RUC', CARNET_EXTRANJERIA: 'CE' };
const mayus = (t: string | null | undefined) => (t ?? '').toUpperCase();

/** Cuadro con el relleno que se le pide; el alto se ajusta al contenido. */
function cuadro(p: Pagina, x: number, y: number, w: number, h: number, relleno?: number) {
  p.rect(x, y, w, h, { radio: 5, borde: BORDE, ...(relleno !== undefined ? { relleno } : {}) });
}

/** Cabecera común: logo, datos de la empresa y el cuadro con el número del documento. */
function cabecera(p: Pagina, e: Empresa, titulo: string, subtitulo: string, subtituloGrande: boolean) {
  { const m = medidasLogo(logoEmpresa(e, LOGO)); p.imagen(L, 19 + (67 - m.h) / 2, m.w, m.h); }
  const cx = 336;
  p.texto(cx, 50, mayus(e.nombre), { f: 'B', tam: 7.5, alinear: 'centro' });
  const lineas = [e.razonSocial, e.lema, e.direccion, e.telefono ? `TLF : ${e.telefono}` : '', e.correo ? `Email: ${e.correo}` : ''].filter(Boolean) as string[];
  lineas.forEach((t, i) => p.texto(cx, 59 + i * 6.6, t, { tam: 5.2, alinear: 'centro' }));
  cuadro(p, 420, 36, R - 420, 51, GRIS);
  p.texto(502, 47, `R.U.C. ${e.ruc ?? ''}`, { f: 'B', tam: 6.6, alinear: 'centro' });
  p.texto(502, 62, titulo, { f: 'B', tam: 11.5, alinear: 'centro' });
  p.texto(502, 77, subtitulo, { f: 'B', tam: subtituloGrande ? 11.5 : 8.5, alinear: 'centro' });
}

function datosCliente(p: Pagina, o: Orden, y: number) {
  const c = o.cliente;
  const lineas = 5, paso = 10.6, h = lineas * paso + 8;
  cuadro(p, L, y, 385, h);
  p.texto(L + 8, y + 11, 'DATOS DEL CLIENTE', { f: 'B', tam: 8.5 });
  p.campo(L + 8, y + 11 + paso, `${TIPO_DOC[c.tipoDocumento] ?? 'DOC'}:`, c.documento, 8.5, 365, paso);
  p.campo(L + 8, y + 11 + paso * 2, 'RAZÓN SOCIAL:', mayus(c.nombre), 8.5, 365, paso);
  p.campo(L + 8, y + 11 + paso * 3, 'DIRECCIÓN:', c.direccionFiscal ?? '', 8.5, 365, paso);
  p.campo(L + 8, y + 11 + paso * 4, 'CELULAR:', c.movil ?? '', 8.5, 365, paso);
  return h;
}

function datosOrden(p: Pagina, o: Orden, y: number, conPersonal: boolean) {
  const paso = 10.6, max = 150;
  const filas: [string, string][] = [['FECHA EMISION:', dia(o.fechaInicio)], ['MONEDA:', 'SOLES'], ['TIPO ATEN:', mayus(o.tipoAtencion)]];
  if (conPersonal) {
    filas.push(['JEFE TALLER:', o.jefeTaller?.nombre ?? '']);
    filas.push(['MECANICO:', o.tecnico?.nombre ?? '']);
  }
  let lineas = 0;
  for (const [, v] of filas) lineas += dividir(v, 'N', 8.5, Math.max(20, max - anchoTexto('MECANICO: ', 'B', 8.5))).length;
  const h = Math.max(lineas, filas.length) * paso + 8;
  cuadro(p, 419, y - 5, R - 419, h);
  let yy = y + 6;
  for (const [e, v] of filas) yy += p.campo(425, yy, e, v, 8.5, max, paso) * paso;
  return h;
}

function datosVehiculo(p: Pagina, o: Orden, y: number) {
  const v = o.vehiculo, paso = 10.6, h = 4 * paso + 14;
  cuadro(p, L, y, 271, h);
  cuadro(p, 305, y, R - 305, h);
  p.texto(L + 8, y + 11, 'DATOS VEHICULO', { f: 'B', tam: 8.5 });
  p.campo(L + 8, y + 11 + paso, 'PLACA:', v.placa, 8.5, 255, paso);
  p.campo(L + 8, y + 11 + paso * 2, 'MARCA:', mayus(v.marca), 8.5, 255, paso);
  p.campo(L + 8, y + 11 + paso * 3, 'MODELO:', mayus(v.modelo), 8.5, 255, paso);
  p.campo(L + 8, y + 11 + paso * 4, 'COLOR:', mayus(v.color), 8.5, 255, paso);
  p.campo(313, y + 11, 'AÑO:', v.anio ? String(v.anio) : '', 8.5, 265, paso);
  p.campo(313, y + 11 + paso, 'KILOMETRAJE:', o.km != null ? String(o.km) : '', 8.5, 265, paso);
  p.campo(313, y + 11 + paso * 2, 'SOAT:', '', 8.5, 265, paso);
  p.campo(313, y + 11 + paso * 3, 'REVISION TECNICA:', '', 8.5, 265, paso);
  return h;
}

/** Cuadro de una etiqueta y su texto; crece si el texto necesita más líneas. */
function cuadroTexto(p: Pagina, x: number, y: number, w: number, etiqueta: string, valor: string) {
  const paso = 10.6, tam = 8.5;
  const n = dividir(valor, 'N', tam, Math.max(20, w - 16 - anchoTexto(`${etiqueta} `, 'B', tam))).length;
  const h = Math.max(19, n * paso + 9);
  cuadro(p, x, y, w, h);
  p.campo(x + 8, y + 12, etiqueta, valor, tam, w - 16, paso);
  return h;
}

function hojaOds(o: Orden, e: Empresa) {
  const p = new Pagina(612, 792);
  cabecera(p, e, 'ORDEN DE SERVICIO', o.codigo, true);
  let y = 98;
  const hc = datosCliente(p, o, y);
  datosOrden(p, o, y + 5, true);
  y += Math.max(hc, 5 * 10.6 + 8 + 12) + 9;
  y += datosVehiculo(p, o, y) + 6;

  // Tabla de ítems
  cuadro(p, L, y, W, 23, GRIS);
  const col = { num: L + 8, cod: L + 22, desc: L + 112, cant: 410, uni: 458, reg: 505, dcto: 545, tot: R - 4 };
  const th = (x: number, t: string, a: 'izq' | 'centro' | 'der' = 'izq') => p.texto(x, y + 15, t, { f: 'B', tam: 8.5, alinear: a });
  th(col.num, '#'); th(col.cod, 'CODIGO'); th(col.desc + 100, 'DETALLE', 'centro');
  th(col.cant, 'CANT.', 'der'); th(col.uni, 'PRE UNI.', 'der'); th(col.reg, 'PRE REG', 'der'); th(col.dcto, 'DCTO', 'der'); th(col.tot, 'TOTAL', 'der');
  y += 25;
  o.detalles.forEach((d, i) => {
    const desc = dividir(d.descripcion, 'N', 8.5, 235);
    const h = Math.max(22, desc.length * 10.6 + 9);
    if (i % 2 === 0) p.rect(L, y, W, h, { relleno: GRIS });
    const b = y + 14;
    const regular = d.precio, descuento = d.descuentoMonto ?? Math.round(d.precio * d.cantidad * d.descuentoPct) / 100;
    const codigo = d.referencia ?? '';
    p.texto(col.num, b, String(i + 1), { tam: 8.5 });
    p.texto(col.cod, b, dividir(codigo, 'N', 8.5, 86)[0] ?? '', { tam: 8.5 });
    desc.forEach((t, k) => p.texto(col.desc, b + k * 10.6, t, { tam: 8.5 }));
    p.texto(col.cant, b, dinero(d.cantidad), { tam: 8.5, alinear: 'der' });
    p.texto(col.uni, b, dinero(d.cantidad ? d.total / d.cantidad : regular), { tam: 8.5, alinear: 'der' });
    p.texto(col.reg, b, dinero(regular), { tam: 8.5, alinear: 'der' });
    p.texto(col.dcto, b, dinero(descuento), { tam: 8.5, alinear: 'der' });
    p.texto(col.tot, b, dinero(d.total), { tam: 8.5, alinear: 'der' });
    y += h + 2;
  });
  y += 8;

  // Pie: observaciones, recomendaciones, asesor, cuentas y total
  const yPie = y;
  y += cuadroTexto(p, L, y, 385, 'OBSERVACIONES:', o.observaciones ?? '') + 3;
  y += cuadroTexto(p, L, y, 385, 'RECOMENDACIONES:', o.recomendaciones ?? '') + 3;
  y += cuadroTexto(p, L, y, 385, 'ASESOR DE SERVICIO:', mayus(o.creadoPor?.nombre)) + 5;
  if (e.cuentasBancarias) {
    const cuentas = dividir(e.cuentasBancarias, 'N', 6.6, 365);
    const h = 22 + cuentas.length * 8;
    cuadro(p, L, y, 385, h);
    p.texto(L + 8, y + 11, `CUENTAS BANCARIAS (${mayus(e.nombre)})`, { f: 'B', tam: 6.6 });
    p.linea(L + 8, y + 14, L + 377, y + 14, { gris: 0.55, grosor: 0.5 });
    cuentas.forEach((t, i) => p.texto(L + 8, y + 23 + i * 8, t, { tam: 6.6 }));
    y += h + 8;
  }
  cuadro(p, 419, yPie, R - 419, 36);
  p.texto(432, yPie + 15, 'TOTAL', { f: 'B', tam: 8.5 });
  p.texto(484, yPie + 15, 'S/', { f: 'B', tam: 8.5 });
  p.texto(R - 10, yPie + 15, dinero(o.total), { f: 'B', tam: 8.5, alinear: 'der' });
  p.texto(R - 10, yPie + 28, 'PRECIOS INCLUYEN IGV', { f: 'B', tam: 8.5, alinear: 'der' });
  cuadro(p, L, y, W, 30);
  return [p];
}

function hojaRecepcion(o: Orden, e: Empresa) {
  const p = new Pagina(612, 792);
  cabecera(p, e, 'RECEPCION', `NRO ORDEN: ${o.codigo}`, false);
  let y = 98;
  const hc = datosCliente(p, o, y);
  datosOrden(p, o, y + 5, false);
  y += hc + 9;
  y += datosVehiculo(p, o, y) + 8;

  // Requerimientos: los trabajos pedidos para la orden
  const trabajos = o.detalles.filter((d) => d.tipo === 'servicio').map((d) => d.descripcion);
  const req = (trabajos.length ? trabajos : [o.tipoAtencionDetalle ?? '']).join('\n');
  const lineasReq = dividir(req, 'N', 8.5, W - 16);
  const hReq = Math.max(44, 22 + lineasReq.length * 10.6);
  cuadro(p, L, y, W, hReq);
  p.texto(L + 8, y + 13, 'REQUERIMIENTOS:', { f: 'B', tam: 8.5 });
  lineasReq.forEach((t, i) => p.texto(L + 8, y + 33 + i * 10.6 - (hReq === 44 ? 6 : 0), t, { tam: 8.5 }));
  y += hReq + 8;

  const hObs = cuadroTexto(p, L, y, 370, 'OBSERVACIONES:', o.observaciones ?? '');
  cuadroTexto(p, L + 377, y, W - 377, 'ASESOR DE SERVICIO:', mayus(o.creadoPor?.nombre));
  y += hObs + 8;

  // Términos y condiciones del servicio
  const terminos = (e.terminosRecepcion ?? '').trim();
  if (terminos) {
    const tam = 6.4, paso = 7.9;
    const lineas = dividir(terminos, 'N', tam, W - 16);
    const h = 18 + lineas.length * paso;
    cuadro(p, L, y, W, h);
    p.texto(L + 8, y + 11, 'TERMINOS Y CONDICIONES DEL SERVICIO:', { f: 'B', tam: 7.5 });
    lineas.forEach((t, i) => p.texto(L + 8, y + 20 + i * paso, t, { tam }));
    y += h + 10;
  }

  // Firmas
  const hf = Math.max(70, Math.min(108, 784 - y)); // las firmas no se salen de la hoja si los términos son largos
  for (const [x, t] of [[144, 'LA EMPRESA'], [314, 'EL CLIENTE']] as const) {
    cuadro(p, x, y, 166, hf);
    p.linea(x + 25, y + hf - 20, x + 141, y + hf - 20, { gris: 0.3, grosor: 0.5 });
    p.texto(x + 83, y + hf - 9, t, { tam: 7, alinear: 'centro' });
  }
  return [p];
}

function hojaTicket(o: Orden, e: Empresa) {
  // El ancho del papel y el pie del ticket vienen de la configuración de la empresa (80 mm si no se indicó).
  const ancho = Math.round((e.anchoTicketMm ?? 80) * 2.8346), m = 12, tam = 9.5, paso = 11.5, util = ancho - m * 2;
  const pie = e.pieTicket ?? '';
  // Primero se arman las filas para saber el alto de la hoja.
  type Fila = { t: string; f?: 'N' | 'B'; a?: 'izq' | 'centro' | 'der'; tam?: number };
  const filas: Fila[] = [];
  const centro = (t: string, f: 'N' | 'B' = 'N') => dividir(t, f, tam, util).forEach((l) => filas.push({ t: l, f, a: 'centro' }));
  const izq = (t: string) => dividir(t, 'N', tam, util).forEach((l) => filas.push({ t: l }));
  const vacia = () => filas.push({ t: '' });
  const separador = () => {
    let s = '';
    while (anchoTexto(s + '=', 'N', tam) <= util) s += '=';
    filas.push({ t: s, a: 'centro' });
  };
  centro(mayus(e.nombre));
  if (e.ruc) centro(e.ruc);
  if (e.direccion) centro(e.direccion);
  if (e.telefono) centro(`TLF : ${e.telefono}`);
  centro(dia(o.fechaInicio));
  vacia();
  izq(`CLIENTE: ${mayus(o.cliente.nombre)}`);
  izq(`${TIPO_DOC[o.cliente.tipoDocumento] ?? 'DOC'}: ${o.cliente.documento}`);
  izq(`NRO ORDEN DE SERVICIO: ${o.codigo}`);
  vacia();
  separador();
  const cantX = m, descX = m + 34, precioX = ancho - m, descMax = precioX - descX - 44;
  const items: { cant: string; lineas: string[]; precio: string }[] = o.detalles.map((d) => {
    const nombre = d.referencia ? `${d.referencia} - ${d.descripcion}` : d.descripcion;
    return { cant: dinero(d.cantidad), lineas: dividir(nombre, 'N', tam, descMax), precio: dinero(d.total) };
  });
  const gracias = pie ? dividir(pie, 'N', tam, util) : [];
  let n = filas.length + 1; // más la fila de encabezados de columnas
  for (const it of items) n += it.lineas.length;
  n += 1 + 1.5 + gracias.length; // total, línea de cierre y despedida
  const p = new Pagina(ancho, Math.ceil(n * paso + m * 2 + 8));
  let y = m + 8;
  for (const f of filas) {
    p.texto(f.a === 'centro' ? ancho / 2 : m, y, f.t, { f: f.f, tam, alinear: f.a });
    y += paso;
  }
  p.texto(cantX, y, 'CANT.', { f: 'B', tam });
  p.texto(descX + descMax / 2 + 6, y, 'DESC.', { f: 'B', tam, alinear: 'centro' });
  p.texto(precioX, y, 'PRECIO', { f: 'B', tam, alinear: 'der' });
  y += paso;
  for (const it of items) {
    p.texto(cantX, y, it.cant, { tam });
    it.lineas.forEach((l, i) => p.texto(descX, y + i * paso, l, { tam }));
    p.texto(precioX, y, it.precio, { tam, alinear: 'der' });
    y += it.lineas.length * paso;
  }
  p.texto(precioX - 52, y, 'Total', { f: 'B', tam, alinear: 'der' });
  p.texto(precioX, y, dinero(o.total), { f: 'B', tam, alinear: 'der' });
  y += paso;
  let s = '';
  while (anchoTexto(s + '=', 'N', tam) <= util) s += '=';
  p.texto(ancho / 2, y, s, { tam, alinear: 'centro' });
  y += paso * 1.5;
  for (const l of gracias) {
    p.texto(ancho / 2, y, l, { tam, alinear: 'centro' });
    y += paso;
  }
  return [p];
}

/** PDF de la orden en el formato pedido; devuelve los bytes del archivo. */
export function generarPdf(formato: FormatoPdf, o: Orden, e: Empresa): Uint8Array {
  const paginas = formato === 'Recepción' ? hojaRecepcion(o, e) : formato === 'Ticket' ? hojaTicket(o, e) : hojaOds(o, e);
  return construirPdf(paginas, logoEmpresa(e, LOGO));
}

export const TITULO_VISTA: Record<FormatoPdf, string> = { PDF: 'Orden de servicio', Recepción: 'Recepción', Ticket: 'Ticket' };
