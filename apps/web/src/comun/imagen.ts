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
