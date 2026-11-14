// Límite de intentos fallidos de ingreso por correo (RNF-01, ISO/IEC 25010: seguridad).
export const MAX_INTENTOS = 5;
export const VENTANA_MS = 15 * 60 * 1000;

export class ControlIntentos {
  private fallos = new Map<string, number[]>();

  constructor(private max = MAX_INTENTOS, private ventanaMs = VENTANA_MS, private ahora: () => number = Date.now) {}

  private vigentes(clave: string) {
    const desde = this.ahora() - this.ventanaMs;
    const v = (this.fallos.get(clave) ?? []).filter((t) => t > desde);
    if (v.length) this.fallos.set(clave, v);
    else this.fallos.delete(clave);
    return v;
  }

  bloqueado(clave: string) {
    return this.vigentes(clave).length >= this.max;
  }

  registrarFallo(clave: string) {
    this.fallos.set(clave, [...this.vigentes(clave), this.ahora()]);
  }

  limpiar(clave: string) {
    this.fallos.delete(clave);
  }
}
