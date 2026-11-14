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
