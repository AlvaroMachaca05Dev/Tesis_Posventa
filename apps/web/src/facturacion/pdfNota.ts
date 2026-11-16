import type { Empresa, NotaOrden, Orden } from '../comun/api';
import { anchoTexto, construirPdf, dividir, ImagenRgb, Pagina } from '../comun/pdf';
import { LOGO_PDF } from '../ordenServicio/logoPdf';

/** PDF y ticket de la nota de venta (RF-088), con el mismo escritor y los mismos datos de empresa que la ODS (DEC-98, DEC-101). */
const LOGO: ImagenRgb = { ...LOGO_PDF, predictor: true };
const L = 28, R = 584, W = R - L;
const GRIS = 0.93, BORDE = 0.6;
const dinero = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const dia = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const TIPO_DOC: Record<string, string> = { DNI: 'DNI', RUC: 'RUC', CARNET_EXTRANJERIA: 'CE' };
const IGV_CORTO: Record<string, string> = { GRAVADO: 'Grav.', EXONERADO: 'Exon.', INAFECTO: 'Inaf.' };
const mayus = (t: string | null | undefined) => (t ?? '').toUpperCase();
const cuadro = (p: Pagina, x: number, y: number, w: number, h: number, relleno?: number) => p.rect(x, y, w, h, { radio: 5, borde: BORDE, ...(relleno !== undefined ? { relleno } : {}) });

function hoja(o: Orden, n: NotaOrden, e: Empresa, titulo = 'NOTA DE VENTA') {
  const p = new Pagina(612, 792);
  // Cabecera: logo, datos de la empresa y cuadro del comprobante
  p.imagen(L, 19, 207, 67);
  p.texto(336, 50, mayus(e.nombre), { f: 'B', tam: 7.5, alinear: 'centro' });
  ([e.razonSocial, e.lema, e.direccion, e.telefono ? `TLF : ${e.telefono}` : '', e.correo ? `Email: ${e.correo}` : ''].filter(Boolean) as string[]).forEach((t, i) => p.texto(336, 59 + i * 6.6, t, { tam: 5.2, alinear: 'centro' }));
  cuadro(p, 420, 36, R - 420, 51, GRIS);
  p.texto(502, 47, `R.U.C. ${e.ruc ?? ''}`, { f: 'B', tam: 6.6, alinear: 'centro' });
  p.texto(502, 62, titulo, { f: 'B', tam: 11.5, alinear: 'centro' });
  p.texto(502, 77, n.codigo, { f: 'B', tam: 11.5, alinear: 'centro' });

  // Cliente y datos del comprobante
  const paso = 10.6;
  let y = 98;
  cuadro(p, L, y, 385, 5 * paso + 8);
  p.texto(L + 8, y + 11, 'DATOS DEL CLIENTE', { f: 'B', tam: 8.5 });
  p.campo(L + 8, y + 11 + paso, `${TIPO_DOC[o.cliente.tipoDocumento] ?? 'DOC'}:`, o.cliente.documento, 8.5, 365, paso);
  p.campo(L + 8, y + 11 + paso * 2, 'RAZÓN SOCIAL:', mayus(o.cliente.nombre), 8.5, 365, paso);
  p.campo(L + 8, y + 11 + paso * 3, 'DIRECCIÓN:', o.cliente.direccionFiscal ?? '', 8.5, 365, paso);
  p.campo(L + 8, y + 11 + paso * 4, 'CELULAR:', o.cliente.movil ?? '', 8.5, 365, paso);
  cuadro(p, 419, y, R - 419, 5 * paso + 8);
  const der: [string, string][] = [['FECHA EMISION:', dia(n.fechaEmision)], ['MONEDA:', 'SOLES'], ['CONDICION:', n.condicion === 'CREDITO' ? 'CRÉDITO' : 'CONTADO'], ['VENCE:', n.fechaVencimiento ? dia(n.fechaVencimiento) : ''], ['ODS:', o.codigo]];
  der.forEach(([a, b], i) => p.campo(425, y + 11 + i * paso, a, b, 8.5, 150, paso));
  y += 5 * paso + 8 + 6;
  cuadro(p, L, y, W, 19);
  p.campo(L + 8, y + 12, 'VEHICULO:', [o.vehiculo.placa, mayus(o.vehiculo.marca), mayus(o.vehiculo.modelo), o.km != null ? `${o.km} km` : ''].filter(Boolean).join(' · '), 8.5, W - 16, paso);
  y += 25;

  // Ítems
  cuadro(p, L, y, W, 23, GRIS);
  const col = { num: L + 8, cod: L + 22, desc: L + 112, cant: 395, uni: 445, igv: 458, tot: R - 4 };
  const th = (x: number, t: string, a: 'izq' | 'centro' | 'der' = 'izq') => p.texto(x, y + 15, t, { f: 'B', tam: 8.5, alinear: a });
  th(col.num, '#'); th(col.cod, 'CODIGO'); th(col.desc + 90, 'DETALLE', 'centro'); th(col.cant, 'CANT.', 'der'); th(col.uni, 'PRECIO', 'der'); th(col.igv, 'IGV'); th(col.tot, 'TOTAL', 'der');
  y += 25;
  n.detalles.forEach((d, i) => {
    const desc = dividir(d.descripcion, 'N', 8.5, 220);
    const h = Math.max(22, desc.length * paso + 9);
    if (i % 2 === 0) p.rect(L, y, W, h, { relleno: GRIS });
    const b = y + 14;
    p.texto(col.num, b, String(i + 1), { tam: 8.5 });
    p.texto(col.cod, b, dividir(d.referencia ?? '', 'N', 8.5, 86)[0] ?? '', { tam: 8.5 });
    desc.forEach((t, k) => p.texto(col.desc, b + k * paso, t, { tam: 8.5 }));
    p.texto(col.cant, b, dinero(d.cantidad), { tam: 8.5, alinear: 'der' });
    p.texto(col.uni, b, dinero(d.cantidad ? d.total / d.cantidad : d.precio), { tam: 8.5, alinear: 'der' });
    p.texto(col.igv, b, IGV_CORTO[d.tipoIgv] ?? '', { tam: 8.5 });
    p.texto(col.tot, b, dinero(d.total), { tam: 8.5, alinear: 'der' });
    y += h + 2;
  });
  y += 8;

  // Pie: observaciones y cuentas a la izquierda; totales a la derecha
  const yPie = y;
  for (const [etq, val] of [['OBSERVACIONES:', n.observaciones ?? ''], ['COMENTARIO:', n.comentario ?? '']] as const) {
    const lineas = dividir(val, 'N', 8.5, 385 - 16 - anchoTexto(`${etq} `, 'B', 8.5)).length;
    const h = Math.max(19, lineas * paso + 9);
    cuadro(p, L, y, 385, h);
    p.campo(L + 8, y + 12, etq, val, 8.5, 369, paso);
    y += h + 3;
  }
  if (e.cuentasBancarias) {
    const cuentas = dividir(e.cuentasBancarias, 'N', 6.6, 365);
    const h = 22 + cuentas.length * 8;
    cuadro(p, L, y + 2, 385, h);
    p.texto(L + 8, y + 13, `CUENTAS BANCARIAS (${mayus(e.nombre)})`, { f: 'B', tam: 6.6 });
    p.linea(L + 8, y + 16, L + 377, y + 16, { gris: 0.55, grosor: 0.5 });
    cuentas.forEach((t, i) => p.texto(L + 8, y + 25 + i * 8, t, { tam: 6.6 }));
  }
  const filas: [string, string, boolean][] = [['OP. EXONERADA', dinero(n.exonerada), false], ['OP. INAFECTA', dinero(n.inafecta), false], ['OP. GRAVADA', dinero(n.gravada), false], ['IGV 18 %', dinero(n.igv), false], ['TOTAL S/', dinero(n.total), true]];
  if (n.conDetraccion) filas.push([`DETRACCION ${n.detraccionPct} %`, dinero(n.detraccion), false]);
  cuadro(p, 419, yPie, R - 419, filas.length * 12 + 10);
  filas.forEach(([a, b, negrita], i) => {
    p.texto(427, yPie + 14 + i * 12, a, { f: 'B', tam: 8 });
    p.texto(R - 10, yPie + 14 + i * 12, b, { f: negrita ? 'B' : 'N', tam: 8.5, alinear: 'der' });
  });
  return [p];
}

function ticket(o: Orden, n: NotaOrden, e: Empresa, titulo = 'NOTA DE VENTA') {
  const ancho = Math.round((e.anchoTicketMm ?? 80) * 2.8346), m = 12, tam = 9.5, paso = 11.5, util = ancho - m * 2;
  type Fila = { t: string; f?: 'N' | 'B'; a?: 'izq' | 'centro'; par?: string };
  const filas: Fila[] = [];
  const centro = (t: string, f: 'N' | 'B' = 'N') => dividir(t, f, tam, util).forEach((l) => filas.push({ t: l, f, a: 'centro' }));
  const izq = (t: string) => dividir(t, 'N', tam, util).forEach((l) => filas.push({ t: l }));
  const par = (a: string, b: string, f: 'N' | 'B' = 'N') => filas.push({ t: a, par: b, f });
  const separador = () => { let s = ''; while (anchoTexto(s + '=', 'N', tam) <= util) s += '='; filas.push({ t: s, a: 'centro' }); };
  centro(mayus(e.nombre));
  if (e.ruc) centro(e.ruc);
  if (e.direccion) centro(e.direccion);
  if (e.telefono) centro(`TLF : ${e.telefono}`);
  centro(dia(n.fechaEmision));
  filas.push({ t: '' });
  izq(`CLIENTE: ${mayus(o.cliente.nombre)}`);
  izq(`${TIPO_DOC[o.cliente.tipoDocumento] ?? 'DOC'}: ${o.cliente.documento}`);
  izq(`${titulo}: ${n.codigo}`);
  filas.push({ t: '' });
  separador();
  par('CANT.  DESC.', 'PRECIO', 'B');
  const descMax = util - 34 - 44;
  for (const d of n.detalles) {
    const nombre = d.referencia ? `${d.referencia} - ${d.descripcion}` : d.descripcion;
    dividir(nombre, 'N', tam, descMax).forEach((l, i) => filas.push({ t: `${i === 0 ? dinero(d.cantidad) : ''}\t${l}`, par: i === 0 ? dinero(d.total) : '' }));
  }
  separador();
  if (n.exonerada) par('Op. exonerada', dinero(n.exonerada));
  if (n.inafecta) par('Op. inafecta', dinero(n.inafecta));
  par('Op. gravada', dinero(n.gravada));
  par('IGV 18 %', dinero(n.igv));
  par('Total S/', dinero(n.total), 'B');
  if (n.conDetraccion) par(`Detracción ${n.detraccionPct} %`, dinero(n.detraccion));
  separador();
  if (e.pieTicket) { filas.push({ t: '' }); centro(e.pieTicket); }

  const p = new Pagina(ancho, Math.ceil(filas.length * paso + m * 2 + 8));
  let y = m + 8;
  for (const f of filas) {
    if (f.t.includes('\t')) {
      const [cant, desc] = f.t.split('\t');
      p.texto(m, y, cant, { tam });
      p.texto(m + 34, y, desc, { tam });
    } else {
      p.texto(f.a === 'centro' ? ancho / 2 : m, y, f.t, { f: f.f, tam, alinear: f.a });
    }
    if (f.par) p.texto(ancho - m, y, f.par, { f: f.f, tam, alinear: 'der' });
    y += paso;
  }
  return [p];
}

/** PDF (hoja carta) o ticket de la nota de venta vigente de la orden. */
export function generarPdfNota(formato: 'PDF' | 'Ticket', o: Orden, n: NotaOrden, e: Empresa, titulo = 'NOTA DE VENTA'): Uint8Array {
  return construirPdf(formato === 'Ticket' ? ticket(o, n, e, titulo) : hoja(o, n, e, titulo), LOGO);
}
