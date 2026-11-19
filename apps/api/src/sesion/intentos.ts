// Límite de intentos fallidos de ingreso por correo (RNF-01, ISO/IEC 25010: seguridad).
export const MAX_INTENTOS = 5;
export const VENTANA_MS = 15 * 60 * 1000;

// Tope de correos distintos que se recuerdan: si alguien manda miles de correos inventados, la memoria no crece sin fin.
export const MAX_CLAVES = 10_000;

export class ControlIntentos {
  private fallos = new Map<string, number[]>();

  constructor(private max = MAX_INTENTOS, private ventanaMs = VENTANA_MS, private ahora: () => number = Date.now, private maxClaves = MAX_CLAVES) {}

  get tamano() { return this.fallos.size; }

  /** Quita los correos cuyos fallos ya vencieron y, si aún sobran, los más antiguos (el Map guarda el orden de llegada). */
  private podar() {
    if (this.fallos.size < this.maxClaves) return;
    const desde = this.ahora() - this.ventanaMs;
    for (const [k, v] of this.fallos) if (!v.some((t) => t > desde)) this.fallos.delete(k);
    for (const k of this.fallos.keys()) { if (this.fallos.size < this.maxClaves) break; this.fallos.delete(k); }
  }

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
    const v = this.vigentes(clave);
    if (!this.fallos.has(clave)) this.podar();
    this.fallos.set(clave, [...v, this.ahora()].slice(-this.max));
  }

  limpiar(clave: string) {
    this.fallos.delete(clave);
  }
}
