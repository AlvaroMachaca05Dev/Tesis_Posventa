// Reglas puras del slice S5: tiempos, precios por grupo (RN-08, RN-09), grupo del vehículo (RF-100) y solapamiento (RF-102).
// Portadas de integracion/reglas_rsa.py (referencia Autodata en combinación con datos del taller RSA). No leen la base.

// ─────────────── tiempos ───────────────
export const PASO_RAPIDO = 0.25; // hasta 1,5 h: de 15 en 15 minutos
export const LIMITE_RAPIDO = 1.5;
export const PASO_NORMAL = 0.5; // más de 1,5 h: de media en media hora
export const PASO_MAYOR = 1; // reparación de motor, culata, caja, anillos: por horas enteras
/** RN-08: sin tiempo de AutoData, el servicio toma 1 h. */
export const HORAS_PREDETERMINADAS = 1;

const subir = (x: number, paso: number) => Math.ceil(Math.round((x / paso) * 1e6) / 1e6) * paso;

/** Sube el tiempo al siguiente bloque de la rejilla (siempre hacia arriba, a favor del técnico). */
export function redondearTiempo(horas: number, trabajoMayor = false) {
  if (!(horas > 0)) return PASO_RAPIDO;
  const paso = trabajoMayor ? PASO_MAYOR : horas <= LIMITE_RAPIDO ? PASO_RAPIDO : PASO_NORMAL;
  return subir(horas, paso);
}

/** Tiempo real + margen del técnico (15 min; 30 min si pasa de 1,5 h), subido a la rejilla. */
export function tiempoEstandar(horasReales: number, trabajoMayor = false) {
  return redondearTiempo(horasReales + (horasReales <= LIMITE_RAPIDO ? 0.25 : 0.5), trabajoMayor);
}

// ─────────────── precios ───────────────
/** Precio de servicio: entero terminado en 0 o 5, hacia arriba. */
export const redondearPrecio = (p: number) => subir(p, 5);
/** Tras un porcentaje: a 10 céntimos (no hay monedas de 1 ni 5 céntimos), a favor de la empresa. 118,75 → 118,80. */
export const redondearCentimos = (p: number) => Math.round(subir(p, 0.1) * 100) / 100;

export type Nivel = 'SERVICIO' | 'GRUPO' | 'GLOBAL';
export type TipoRegla = 'FIJAR' | 'SUMAR' | 'PORCENTAJE';
export const NIVELES: Nivel[] = ['SERVICIO', 'GRUPO', 'GLOBAL'];

export interface ServicioBase { codigo: string; horas: number; precio: number; trabajoMayor?: boolean; preciosGrupo?: Record<string, number | null> | null; horasGrupo?: Record<string, number> | null }
export interface Regla {
  codigo: string;
  nivel: Nivel;
  tipo: TipoRegla;
  grupo?: string | null; // código del grupo; vacío solo en GLOBAL
  servicios?: string[]; // códigos; vacío = todos
  precio?: number | null;
  horas?: number | null;
  porcentaje?: number | null;
  precioDesde?: number | null;
  precioHasta?: number | null;
  activa?: boolean;
  orden?: number;
}

function aplica(r: Regla, servicio: string, grupo: string, precio: number) {
  if (r.activa === false || (r.servicios?.length && !r.servicios.includes(servicio))) return false;
  if (r.nivel !== 'GLOBAL' && r.grupo !== grupo) return false;
  if (r.precioDesde != null && precio < r.precioDesde) return false;
  return r.precioHasta == null || precio <= r.precioHasta;
}

/** Errores de una regla antes de guardarla. */
export function validarRegla(r: Partial<Regla>) {
  const e: string[] = [];
  if (!NIVELES.includes(r.nivel as Nivel) || !['FIJAR', 'SUMAR', 'PORCENTAJE'].includes(String(r.tipo))) e.push('nivel o tipo desconocido');
  if (r.nivel !== 'GLOBAL' && !r.grupo) e.push('falta el grupo');
  if (r.precio != null && Math.round(r.precio * 100) % 500 !== 0) e.push('el monto debe terminar en 0 o 5');
  if (r.horas != null && Math.round(r.horas * 100) % 25 !== 0) e.push('el tiempo va de 0,25 h en 0,25 h');
  if (r.tipo === 'PORCENTAJE' && r.porcentaje == null) e.push('falta el porcentaje');
  if (r.tipo !== 'PORCENTAJE' && r.precio == null && r.horas == null) e.push('indica el precio o las horas');
  return e;
}

/**
 * Tiempo y precio de un servicio para un vehículo del grupo `grupo` ('' = sin grupo). RN-09, acumulativo:
 * 1) estándar del servicio; 2) reglas del grupo para ese servicio; 3) reglas generales del grupo; 4) reglas de todos los grupos.
 * Dentro de un nivel, los rangos se evalúan con el precio con que se llega a ese nivel (el orden de las reglas no cambia el resultado).
 */
export function calcularServicio(s: ServicioBase, grupo: string, reglas: Regla[]) {
  // La tabla del servicio por grupo manda sobre el estándar; un precio null es «No aplica» para ese grupo.
  const tienePrecio = !!grupo && !!s.preciosGrupo && Object.prototype.hasOwnProperty.call(s.preciosGrupo, grupo);
  if (tienePrecio && s.preciosGrupo![grupo] == null) {
    return { horas: s.horas, precio: 0, traza: [`${s.codigo}: no aplica para ${grupo}`], disponible: false };
  }
  let precio = tienePrecio ? Number(s.preciosGrupo![grupo]) : s.precio;
  let horas = grupo && s.horasGrupo?.[grupo] != null ? Number(s.horasGrupo[grupo]) : s.horas;
  const traza = [tienePrecio ? `Precio de ${grupo} ${s.codigo}: ${horas} h, S/ ${precio}` : `Estándar ${s.codigo}: ${horas} h, S/ ${precio}`];
  let huboPorcentaje = false;
  for (const nivel of NIVELES) {
    const base = precio;
    const del = reglas.filter((r) => r.nivel === nivel && aplica(r, s.codigo, grupo, base)).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.codigo.localeCompare(b.codigo));
    for (const r of del) {
      if (r.tipo === 'FIJAR') {
        if (r.precio != null) precio = r.precio;
        if (r.horas != null) horas = r.horas;
      } else if (r.tipo === 'SUMAR') {
        precio += r.precio ?? 0;
        horas += r.horas ?? 0;
      } else {
        precio += (base * (r.porcentaje ?? 0)) / 100;
        huboPorcentaje = true;
      }
      traza.push(`${nivel} ${r.codigo} (${r.tipo}): ${Math.round(horas * 100) / 100} h, S/ ${Math.round(precio * 100) / 100}`);
    }
  }
  precio = Math.max(0, huboPorcentaje ? redondearCentimos(precio) : redondearPrecio(precio));
  horas = Math.max(PASO_RAPIDO, redondearTiempo(horas, s.trabajoMayor));
  return { horas, precio, traza, disponible: true };
}

// ─────────────── grupo del vehículo (RF-100) ───────────────
export interface Familia { codigo: string; codigos: string[]; grupo: string | null }
export interface ReglaModelo { marca: string; modelo: string; anioDesde: number; anioHasta: number; grupo: string; automatica: boolean }
const clave = (t: unknown) => String(t ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Orden: 1) familia del código de motor; 2) marca + modelo + año, solo si no se conoce el motor (automática o sugerida);
 * 3) sin grupo: tiempo y precio estándar del servicio.
 */
export function asignarGrupo(v: { codigoMotor?: string | null; marca?: string | null; modelo?: string | null; anio?: number | null }, familias: Familia[], porModelo: ReglaModelo[]) {
  const motor = clave(v.codigoMotor);
  if (motor) {
    const f = familias.find((x) => x.codigos.some((c) => clave(c) === motor));
    if (f?.grupo) return { grupo: f.grupo, fuente: 'FAMILIA_MOTOR' as const, familia: f.codigo, sugerido: false };
  }
  const m = porModelo.find((r) => clave(r.marca) === clave(v.marca) && clave(r.modelo) === clave(v.modelo) && v.anio != null && v.anio >= r.anioDesde && v.anio <= r.anioHasta);
  if (m) return { grupo: m.grupo, fuente: 'MODELO' as const, familia: null, sugerido: !m.automatica };
  return { grupo: null, fuente: null, familia: null, sugerido: false };
}

// ─────────────── solapamiento de servicios (RF-102) ───────────────
export interface ReglaSolape {
  id: string;
  codigo: string;
  tipo: 'PAR' | 'CONJUNTO';
  base: string[]; // PAR: ids de los servicios que ya se hacen (basta uno)
  reducidos: string[]; // PAR: servicios que llevan el descuento; CONJUNTO: miembros del conjunto
  minimo?: number; // CONJUNTO: cuántos servicios del conjunto deben estar
  modo: 'AUTOMATICO' | 'OPCIONAL' | 'AVISO';
  descuentoEstandar: number;
  descuentos?: Record<string, number | null> | null;
  alerta?: string | null;
  activo?: boolean;
}
export interface LineaSolape { indice: number; servicioId?: string | null; total: number }
export interface Hallazgo { regla: ReglaSolape; indiceBase: number; indiceReducido: number; monto: number; alerta: string; clave: string }

/** Monto del descuento para el grupo del vehículo: el del grupo si existe; si no, el estándar. Múltiplo de 5. */
export function montoSolape(r: ReglaSolape, grupo: string | null) {
  const g = grupo ? r.descuentos?.[grupo] : undefined;
  return g != null ? g : r.descuentoEstandar;
}
/** Clave de una decisión: la regla y el servicio que lleva el descuento. Si el servicio se quita, la decisión se pierde. */
export const claveSolape = (reglaId: string, servicioId: string) => `${reglaId}:${servicioId}`;

/**
 * Detecta los servicios de la ODS que comparten trabajo.
 * - PAR: con un servicio base presente, cada servicio reducido presente (en otra línea) lleva el descuento.
 * - CONJUNTO: con «minimo» servicios del conjunto, todos menos el de mayor total llevan el descuento.
 * - AVISO: solo informa (sin monto).
 * Cada línea recibe a lo más un descuento (el mayor) y nunca más que su total (antes del solapamiento).
 */
export function evaluarSolapamientos(lineas: LineaSolape[], reglas: ReglaSolape[], grupo: string | null): Hallazgo[] {
  const hallados: Hallazgo[] = [];
  const texto = (r: ReglaSolape, monto: number) => (r.alerta ?? `${r.codigo}: descuento de S/ {d} en el segundo servicio.`).replace(/\{d\}/g, String(monto));
  for (const r of reglas) {
    if (r.activo === false) continue;
    if (r.tipo === 'CONJUNTO') {
      const miembros = lineas.filter((l) => l.servicioId && r.reducidos.includes(l.servicioId));
      if (miembros.length < (r.minimo ?? 2)) continue;
      const orden = [...miembros].sort((a, b) => b.total - a.total || a.indice - b.indice);
      if (r.modo === 'AVISO') {
        hallados.push({ regla: r, indiceBase: orden[0].indice, indiceReducido: -1, monto: 0, alerta: texto(r, 0), clave: `${r.id}:aviso` });
        continue;
      }
      for (const l of orden.slice(1)) {
        const monto = Math.max(0, Math.min(montoSolape(r, grupo), l.total));
        if (monto > 0) hallados.push({ regla: r, indiceBase: orden[0].indice, indiceReducido: l.indice, monto, alerta: texto(r, monto), clave: claveSolape(r.id, l.servicioId!) });
      }
      continue;
    }
    const a = lineas.find((l) => l.servicioId && r.base.includes(l.servicioId));
    if (!a) continue;
    for (const b of lineas.filter((l) => l.servicioId && r.reducidos.includes(l.servicioId) && l.indice !== a.indice)) {
      const monto = r.modo === 'AVISO' ? 0 : Math.max(0, Math.min(montoSolape(r, grupo), b.total));
      if (monto <= 0 && r.modo !== 'AVISO') continue;
      hallados.push({ regla: r, indiceBase: a.indice, indiceReducido: b.indice, monto, alerta: texto(r, monto), clave: claveSolape(r.id, b.servicioId!) });
    }
  }
  // una línea, un descuento: se queda el mayor; los avisos van aparte
  const avisos = hallados.filter((h) => h.indiceReducido < 0);
  const porLinea = new Map<number, Hallazgo>();
  for (const h of hallados) {
    if (h.indiceReducido < 0) continue;
    const x = porLinea.get(h.indiceReducido);
    if (!x || h.monto > x.monto) porLinea.set(h.indiceReducido, h);
  }
  return [...[...porLinea.values()].sort((x, y) => x.indiceReducido - y.indiceReducido), ...avisos];
}

// ─────────────── documentos y teléfonos ───────────────
/** DNI: 8 dígitos. RUC: 11 dígitos. Carné de extranjería: de 9 a 12 caracteres (letras y números), como lo acepta SUNAT. */
export const REGLA_DOCUMENTO: Record<string, { re: RegExp; texto: string }> = {
  DNI: { re: /^\d{8}$/, texto: 'El DNI tiene 8 dígitos.' },
  RUC: { re: /^\d{11}$/, texto: 'El RUC tiene 11 dígitos.' },
  CARNET_EXTRANJERIA: { re: /^[A-Z0-9]{9,12}$/, texto: 'El carné de extranjería tiene de 9 a 12 caracteres (letras y números).' },
};
export function errorDocumento(tipo: string, documento: string) {
  const r = REGLA_DOCUMENTO[tipo];
  return r && !r.re.test(documento) ? r.texto : null;
}
/** Teléfono o móvil del Perú: 9 dígitos. */
export const errorTelefono = (t: string | null | undefined) => (t && !/^\d{9}$/.test(t) ? 'El teléfono tiene 9 dígitos, sin el prefijo del país.' : null);
