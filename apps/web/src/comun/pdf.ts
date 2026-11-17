/**
 * Escritor mínimo de PDF, sin dependencias: texto con Helvetica (normal y negrita), cuadros con esquinas redondeadas,
 * líneas e imágenes RGB comprimidas. Las coordenadas van en puntos, con el origen arriba a la izquierda.
 * Lo usan los PDF de la orden de servicio (ODS, recepción y ticket).
 */
export type Fuente = 'N' | 'B';

// Anchos de Helvetica y Helvetica-Bold (milésimas de em) de los caracteres 32 a 126.
const ANCHO_N = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  334, 260, 334, 584,
];
const ANCHO_B = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  333, 333, 584, 584, 584, 611, 975,
  722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  333, 278, 333, 584, 556, 333,
  556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500,
  389, 280, 389, 584,
];

function anchoCaracter(c: string, f: Fuente) {
  const tabla = f === 'B' ? ANCHO_B : ANCHO_N;
  const cod = c.charCodeAt(0);
  if (cod >= 32 && cod <= 126) return tabla[cod - 32];
  if (c === '¿') return tabla['?'.charCodeAt(0) - 32];
  if (c === '¡') return tabla['!'.charCodeAt(0) - 32];
  const base = c.normalize('NFD')[0];
  const b = base.charCodeAt(0);
  if (b >= 32 && b <= 126) return tabla[b - 32];
  return 556;
}

/** Ancho en puntos de un texto de una sola línea. */
export function anchoTexto(t: string, f: Fuente, tam: number) {
  let s = 0;
  for (const c of t) s += anchoCaracter(c, f);
  return (s * tam) / 1000;
}

/** Parte un texto en líneas que caben en `max` puntos; respeta los saltos de línea (\n). */
export function dividir(t: string, f: Fuente, tam: number, max: number): string[] {
  const salida: string[] = [];
  for (const parrafo of String(t ?? '').split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      let p = palabra;
      // Una palabra más ancha que la línea se corta por letras.
      while (anchoTexto(p, f, tam) > max && p.length > 1) {
        let n = p.length - 1;
        while (n > 1 && anchoTexto(p.slice(0, n), f, tam) > max) n--;
        if (linea) { salida.push(linea); linea = ''; }
        salida.push(p.slice(0, n));
        p = p.slice(n);
      }
      const prueba = linea ? `${linea} ${p}` : p;
      if (anchoTexto(prueba, f, tam) <= max || !linea) linea = prueba;
      else { salida.push(linea); linea = p; }
    }
    salida.push(linea);
  }
  return salida;
}

const ESPECIALES: Record<string, number> = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };
/** Texto del PDF en WinAnsi (un byte por letra), con los paréntesis y la barra escapados. */
function codificar(t: string) {
  let s = '';
  for (const c of t) {
    const cod = c.charCodeAt(0);
    const b = ESPECIALES[c] ?? (cod <= 255 ? cod : 63);
    s += b === 40 || b === 41 || b === 92 ? '\\' + String.fromCharCode(b) : String.fromCharCode(b);
  }
  return s;
}
const n2 = (x: number) => (Math.round(x * 100) / 100).toString();
const gris = (g: number) => n2(g);

export interface ImagenRgb { ancho: number; alto: number; base64: string; predictor: boolean; jpeg?: boolean }

export class Pagina {
  ops: string[] = [];
  usaImagen = false;
  constructor(public ancho: number, public alto: number) {}
  private y(y: number) { return this.alto - y; }

  /** `y` es la línea base del texto, medida desde arriba. */
  texto(x: number, y: number, t: string, o: { f?: Fuente; tam?: number; alinear?: 'izq' | 'centro' | 'der'; gris?: number } = {}) {
    const f = o.f ?? 'N', tam = o.tam ?? 9;
    const w = anchoTexto(t, f, tam);
    const px = o.alinear === 'centro' ? x - w / 2 : o.alinear === 'der' ? x - w : x;
    this.ops.push(`BT ${gris(o.gris ?? 0)} g /${f === 'B' ? 'F2' : 'F1'} ${n2(tam)} Tf ${n2(px)} ${n2(this.y(y))} Td (${codificar(t)}) Tj ET`);
    return w;
  }
  /** Una etiqueta en negrita seguida de su valor en texto normal; devuelve las líneas usadas. */
  campo(x: number, y: number, etiqueta: string, valor: string, tam: number, max: number, paso: number) {
    const e = `${etiqueta} `;
    const we = anchoTexto(e, 'B', tam);
    const lineas = dividir(valor, 'N', tam, Math.max(20, max - we));
    this.texto(x, y, e, { f: 'B', tam });
    this.texto(x + we, y, lineas[0] ?? '', { tam });
    for (let i = 1; i < lineas.length; i++) this.texto(x, y + i * paso, lineas[i], { tam });
    return lineas.length;
  }
  rect(x: number, y: number, w: number, h: number, o: { radio?: number; relleno?: number; borde?: number; grosor?: number } = {}) {
    const r = Math.min(o.radio ?? 0, w / 2, h / 2);
    const X = x, Y = this.y(y + h);
    const k = r * 0.5523;
    const p: string[] = [];
    if (r > 0) {
      p.push(`${n2(X + r)} ${n2(Y)} m ${n2(X + w - r)} ${n2(Y)} l`);
      p.push(`${n2(X + w - r + k)} ${n2(Y)} ${n2(X + w)} ${n2(Y + r - k)} ${n2(X + w)} ${n2(Y + r)} c`);
      p.push(`${n2(X + w)} ${n2(Y + h - r)} l`);
      p.push(`${n2(X + w)} ${n2(Y + h - r + k)} ${n2(X + w - r + k)} ${n2(Y + h)} ${n2(X + w - r)} ${n2(Y + h)} c`);
      p.push(`${n2(X + r)} ${n2(Y + h)} l`);
      p.push(`${n2(X + r - k)} ${n2(Y + h)} ${n2(X)} ${n2(Y + h - r + k)} ${n2(X)} ${n2(Y + h - r)} c`);
      p.push(`${n2(X)} ${n2(Y + r)} l`);
      p.push(`${n2(X)} ${n2(Y + r - k)} ${n2(X + r - k)} ${n2(Y)} ${n2(X + r)} ${n2(Y)} c h`);
    } else {
      p.push(`${n2(X)} ${n2(Y)} ${n2(w)} ${n2(h)} re`);
    }
    const conRelleno = o.relleno !== undefined, conBorde = o.borde !== undefined;
    const pintar = conRelleno && conBorde ? 'B' : conRelleno ? 'f' : conBorde ? 'S' : 'n';
    this.ops.push(`q ${conRelleno ? `${gris(o.relleno!)} g ` : ''}${conBorde ? `${gris(o.borde!)} G ${n2(o.grosor ?? 0.6)} w ` : ''}${p.join(' ')} ${pintar} Q`);
  }
  linea(x1: number, y1: number, x2: number, y2: number, o: { grosor?: number; gris?: number } = {}) {
    this.ops.push(`q ${gris(o.gris ?? 0.5)} G ${n2(o.grosor ?? 0.6)} w ${n2(x1)} ${n2(this.y(y1))} m ${n2(x2)} ${n2(this.y(y2))} l S Q`);
  }
  imagen(x: number, y: number, w: number, h: number) {
    this.usaImagen = true;
    this.ops.push(`q ${n2(w)} 0 0 ${n2(h)} ${n2(x)} ${n2(this.y(y + h))} cm /Im1 Do Q`);
  }
}

/** Arma el archivo PDF. Cada letra de la cadena intermedia vale un byte. */
export function construirPdf(paginas: Pagina[], imagen?: ImagenRgb): Uint8Array {
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const pos: number[] = [];
  const obj = (n: number, cuerpo: string) => { pos[n] = out.length; out += `${n} 0 obj\n${cuerpo}\nendobj\n`; };
  const usaImagen = !!imagen && paginas.some((p) => p.usaImagen);
  const primera = usaImagen ? 6 : 5; // 1 catálogo, 2 páginas, 3 y 4 fuentes, 5 imagen (si hay)
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${paginas.length} /Kids [${paginas.map((_, i) => `${primera + i * 2 + 1} 0 R`).join(' ')}] >>`);
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  if (usaImagen && imagen) {
    const datos = atob(imagen.base64);
    const filtro = imagen.jpeg ? 'DCTDecode' : 'FlateDecode';
    const parms = imagen.predictor && !imagen.jpeg ? `/DecodeParms << /Predictor 15 /Colors 3 /Columns ${imagen.ancho} /BitsPerComponent 8 >> ` : '';
    obj(5, `<< /Type /XObject /Subtype /Image /Width ${imagen.ancho} /Height ${imagen.alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${filtro} ${parms}/Length ${datos.length} >>\nstream\n${datos}\nendstream`);
  }
  paginas.forEach((p, i) => {
    const contenido = p.ops.join('\n');
    const nc = primera + i * 2, np = nc + 1;
    obj(nc, `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`);
    obj(np, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(p.ancho)} ${n2(p.alto)}] /Contents ${nc} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${usaImagen ? ' /XObject << /Im1 5 0 R >>' : ''} >> >>`);
  });
  const total = primera + paginas.length * 2;
  const xref = out.length;
  out += `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) out += `${String(pos[n] ?? 0).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

/** Logo de la empresa si subió uno (JPEG, se incrusta tal cual); si no, el de respaldo. */
export function logoEmpresa(e: { logo?: { base64: string; ancho: number; alto: number } | null }, respaldo: ImagenRgb): ImagenRgb {
  return e.logo ? { ancho: e.logo.ancho, alto: e.logo.alto, base64: e.logo.base64, predictor: false, jpeg: true } : respaldo;
}
/** Medidas del logo dentro de la caja de la cabecera (207 x 67), sin deformarlo. */
export function medidasLogo(img: ImagenRgb, maxW = 207, maxH = 67) {
  const k = Math.min(maxW / img.ancho, maxH / img.alto);
  return { w: img.ancho * k, h: img.alto * k };
}
