/**
 * Convierte la imagen que sube la usuaria a JPEG sobre fondo blanco (los PDF incrustan el JPEG tal cual) y la achica
 * si hace falta para que pese poco. Devuelve el base64 sin el prefijo «data:».
 */
export async function aJpeg(archivo: File, anchoMax = 900): Promise<{ base64: string; ancho: number; alto: number }> {
  if (!/^image\//.test(archivo.type)) throw new Error('Elige una imagen (PNG, JPG o similar).');
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const k = Math.min(1, anchoMax / img.naturalWidth);
    const ancho = Math.max(1, Math.round(img.naturalWidth * k)), alto = Math.max(1, Math.round(img.naturalHeight * k));
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho; lienzo.height = alto;
    const g = lienzo.getContext('2d');
    if (!g) throw new Error('Tu navegador no puede procesar la imagen.');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, ancho, alto);
    g.drawImage(img, 0, 0, ancho, alto);
    for (const calidad of [0.92, 0.8, 0.65, 0.5]) {
      const base64 = lienzo.toDataURL('image/jpeg', calidad).split(',')[1] ?? '';
      if (base64.length <= 500_000) return { base64, ancho, alto };
    }
    throw new Error('La imagen es muy pesada: usa una más pequeña.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface LogoListo { jpeg: { base64: string; ancho: number; alto: number }; png: string; vista: string; fondoQuitado: boolean }

/**
 * Prepara el logo: lo achica, le quita el fondo liso (si lo tiene) y devuelve un PNG transparente para la pantalla y un JPEG sobre blanco
 * para los PDF. El fondo se detecta por el color de las esquinas y se borra solo si toca el borde de la imagen (así no se vacía el interior del dibujo).
 */
export async function prepararLogo(archivo: File, quitarFondo = true, anchoMax = 600): Promise<LogoListo> {
  if (!/^image\//.test(archivo.type)) throw new Error('Elige una imagen (PNG, JPG o similar).');
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const k = Math.min(1, anchoMax / img.naturalWidth);
    const ancho = Math.max(1, Math.round(img.naturalWidth * k)), alto = Math.max(1, Math.round(img.naturalHeight * k));
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho; lienzo.height = alto;
    const g = lienzo.getContext('2d', { willReadFrequently: true });
    if (!g) throw new Error('Tu navegador no puede procesar la imagen.');
    g.drawImage(img, 0, 0, ancho, alto);
    let fondoQuitado = false;
    if (quitarFondo) {
      const dato = g.getImageData(0, 0, ancho, alto);
      fondoQuitado = quitarFondoLiso(dato.data, ancho, alto);
      g.putImageData(dato, 0, 0);
    }
    const png = lienzo.toDataURL('image/png');
    // JPEG sobre blanco para los PDF.
    const l2 = document.createElement('canvas');
    l2.width = ancho; l2.height = alto;
    const g2 = l2.getContext('2d')!;
    g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, ancho, alto); g2.drawImage(lienzo, 0, 0);
    for (const calidad of [0.92, 0.8, 0.65, 0.5]) {
      const base64 = l2.toDataURL('image/jpeg', calidad).split(',')[1] ?? '';
      if (base64.length <= 500_000) return { jpeg: { base64, ancho, alto }, png: png.split(',')[1] ?? '', vista: png, fondoQuitado };
    }
    throw new Error('La imagen es muy pesada: usa una más pequeña.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Borra (alfa 0) el fondo de un solo color que toca el borde. Devuelve false si no había fondo liso o ya era transparente. */
export function quitarFondoLiso(px: Uint8ClampedArray, ancho: number, alto: number, tolerancia = 42): boolean {
  const en = (x: number, y: number) => (y * ancho + x) * 4;
  const esquinas = [en(0, 0), en(ancho - 1, 0), en(0, alto - 1), en(ancho - 1, alto - 1)];
  if (esquinas.some((i) => px[i + 3] < 10)) return false; // ya trae transparencia
  const bg = [0, 1, 2].map((c) => esquinas.reduce((a, i) => a + px[i + c], 0) / 4);
  const dist = (i: number) => Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]);
  // Si las esquinas no se parecen entre sí, el fondo no es liso.
  if (esquinas.some((i) => dist(i) > tolerancia)) return false;
  const visto = new Uint8Array(ancho * alto);
  const pila: number[] = [];
  const meter = (x: number, y: number) => { const p = y * ancho + x; if (!visto[p] && dist(p * 4) <= tolerancia) { visto[p] = 1; pila.push(p); } };
  for (let x = 0; x < ancho; x++) { meter(x, 0); meter(x, alto - 1); }
  for (let y = 0; y < alto; y++) { meter(0, y); meter(ancho - 1, y); }
  while (pila.length) {
    const p = pila.pop()!; const x = p % ancho, y = (p - x) / ancho;
    if (x > 0) meter(x - 1, y); if (x < ancho - 1) meter(x + 1, y); if (y > 0) meter(x, y - 1); if (y < alto - 1) meter(x, y + 1);
  }
  let borrados = 0;
  for (let p = 0; p < visto.length; p++) if (visto[p]) { px[p * 4 + 3] = 0; borrados++; }
  // Borde suave: los píxeles vecinos del fondo, de color parecido, quedan semitransparentes.
  for (let p = 0; p < visto.length; p++) {
    if (visto[p]) continue;
    const x = p % ancho, y = (p - x) / ancho;
    const toca = (x > 0 && visto[p - 1]) || (x < ancho - 1 && visto[p + 1]) || (y > 0 && visto[p - ancho]) || (y < alto - 1 && visto[p + ancho]);
    if (toca) { const d = dist(p * 4); if (d < tolerancia * 2) px[p * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, (d - tolerancia) / tolerancia))); }
  }
  return borrados > ancho * alto * 0.02;
}
