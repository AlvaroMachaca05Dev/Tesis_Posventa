// Cabeceras de seguridad de todas las respuestas (RNF-01, ISO/IEC 25010: seguridad).
type Respuesta = { setHeader: (n: string, v: string) => void; removeHeader: (n: string) => void };

export function cabecerasSeguridad(_req: unknown, res: Respuesta, next: () => void) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

// Caracteres de control invisibles (byte nulo y similares; se permiten tabulación y saltos de línea). PostgreSQL rechaza
// el byte nulo en un texto, así que sin este filtro un «\u0000» en cualquier campo terminaba en error 500.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Recorre el cuerpo y la consulta sin recursión (aguanta objetos muy anidados) y avisa si algún texto o clave trae control. */
export function tieneControl(...raices: unknown[]) {
  const pila: unknown[] = [...raices];
  let vistos = 0;
  while (pila.length) {
    const x = pila.pop();
    if (++vistos > 200_000) return false; // el tamaño del cuerpo ya lo limita el servidor
    if (typeof x === 'string') { if (CONTROL.test(x)) return true; }
    else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (CONTROL.test(k)) return true; pila.push(v); }
  }
  return false;
}

type Peticion = { body?: unknown; query?: unknown; originalUrl?: string; url?: string };
type RespuestaJson = { status: (c: number) => { json: (b: unknown) => void } };
export function rechazarControl(req: Peticion, res: RespuestaJson, next: () => void) {
  let ruta = '';
  try { ruta = decodeURIComponent(req.originalUrl ?? req.url ?? ''); } catch { ruta = ''; }
  if (tieneControl(req.body, req.query) || CONTROL.test(ruta)) {
    res.status(400).json({ statusCode: 400, message: 'El texto trae caracteres no permitidos.', error: 'Bad Request' });
    return;
  }
  next();
}
