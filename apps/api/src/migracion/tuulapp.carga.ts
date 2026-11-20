// Migración inicial (S4, RN-11): carga en la base el archivo intermedio que arma herramientas/migracion/preparar_tuulapp.py.
// Es un procedimiento interno, no una pantalla. Reglas:
//  - Cada fila lleva su clave de origen (tabla ClaveOrigen: sistema + tabla + identificador de origen).
//  - Idempotente: si la clave ya existe, la fila se actualiza; correrlo otra vez no duplica nada.
//  - Atómico por lote: cada lote va en una transacción; si falla, ese lote no deja nada a medias.
//  - Las filas inválidas no se cargan: se devuelven en `rechazos` con su motivo.
// Orden: personas (usuarios) → clientes → vehículos → ODS y detalles → lecturas de km → notas de venta y abonos.
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { codigoNota } from '../facturacion/notaVenta.reglas';

type Tx = Prisma.TransactionClient;
type Fila = Record<string, any>;
export interface Staging {
  sistema: string;
  personas: Fila[];
  clientes: Fila[];
  vehiculos: Fila[];
  ordenes: Fila[];
  lecturas: Fila[];
  notas: Fila[];
}
export interface Opciones {
  claveUsuarios: string; // contraseña inicial de los usuarios creados (llega por variable de entorno, nunca escrita en el código)
  lote?: number;
  log?: (m: string) => void;
}
export interface Conteo { creadas: number; actualizadas: number; rechazadas: number }
export interface Reporte { tablas: Record<string, Conteo>; rechazos: { tabla: string; clave: string; motivo: string }[]; avisos: string[] }

const TIPOS_DOC = ['DNI', 'CARNET_EXTRANJERIA', 'RUC'];
const ESTADOS = ['Recepcion', 'EnProceso', 'Entrega', 'Cerrada', 'Archivada'];
const METODOS = ['Efectivo', 'Yape', 'Transferencia', 'Tarjeta', 'Otro'];
const KM_MAX = 999_999;

/** Fecha local de Lima («2026-11-17T10:30:00») a Date. Sin fecha válida → null. */
export function fechaLima(s: unknown): Date | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(s)) return null;
  const d = new Date((s.length === 10 ? s + 'T00:00:00' : s) + '-05:00');
  return isNaN(d.getTime()) ? null : d;
}
const texto = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());
const numero = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);
const sinTildes = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function cargarStaging(prisma: PrismaClient, s: Staging, op: Opciones): Promise<Reporte> {
  const sistema = texto(s?.sistema);
  if (!sistema) throw new Error('El archivo intermedio no dice de qué sistema viene («sistema»).');
  const lote = op.lote ?? 500;
  const log = op.log ?? (() => undefined);
  const rep: Reporte = { tablas: {}, rechazos: [], avisos: [] };
  const conteo = (t: string) => (rep.tablas[t] ??= { creadas: 0, actualizadas: 0, rechazadas: 0 });
  const rechazar = (t: string, clave: unknown, motivo: string) => {
    conteo(t).rechazadas++;
    rep.rechazos.push({ tabla: t, clave: String(clave ?? '(sin clave)'), motivo });
  };

  // ── contexto: empresa, locales, roles, servicios y claves ya cargadas ──
  const org = await prisma.organizacion.findFirst({ where: { activa: true }, orderBy: { nombre: 'asc' } });
  if (!org) throw new Error('No hay una empresa activa en la base.');
  const organizacionId = org.id;
  const locales = await prisma.local.findMany({ where: { organizacionId } });
  const local: Record<string, (typeof locales)[number]> = Object.create(null); // sin prototipo: una sede «constructor» no resuelve a Object
  for (const sede of ['Union', 'Prohogar']) {
    const l = locales.find((x) => sinTildes(x.nombre).includes(sede.toLowerCase()));
    if (!l) throw new Error(`No hay un local cuyo nombre diga «${sede}».`);
    local[sede] = l;
  }
  const roles = new Map((await prisma.rol.findMany({ where: { organizacionId } })).map((r) => [r.nombre, r.id]));
  const servicios = new Map((await prisma.servicio.findMany({ where: { organizacionId }, select: { id: true, codigo: true } })).map((x) => [x.codigo, x.id]));
  const claves = new Map<string, Map<string, string>>(); // tabla → idOrigen → registroId
  for (const c of await prisma.claveOrigen.findMany({ where: { sistema } })) {
    if (!claves.has(c.tabla)) claves.set(c.tabla, new Map());
    claves.get(c.tabla)!.set(c.idOrigen, c.registroId);
  }
  const idDe = (tabla: string, clave: unknown) => (clave === null || clave === undefined ? undefined : claves.get(tabla)?.get(String(clave)));

  /** Procesa una tabla por lotes. `armar` valida y devuelve los datos o un motivo de rechazo; nuevas → createMany, existentes → update. */
  async function cargar<T extends Fila>(
    tabla: string,
    filas: T[],
    armar: (f: T) => { datos: Fila } | string,
    escribir: (tx: Tx, nuevas: Fila[], existentes: { id: string; datos: Fila }[], originales: T[]) => Promise<void>,
  ) {
    const c = conteo(tabla);
    if (!claves.has(tabla)) claves.set(tabla, new Map());
    const mapa = claves.get(tabla)!;
    const vistas = new Set<string>();
    for (let i = 0; i < filas.length; i += lote) {
      const nuevas: Fila[] = [];
      const existentes: { id: string; datos: Fila }[] = [];
      const originales: T[] = [];
      const clavesNuevas: Fila[] = [];
      for (const f of filas.slice(i, i + lote)) {
        const clave = texto(f?.clave);
        if (!clave) { rechazar(tabla, null, 'Fila sin clave de origen'); continue; }
        if (vistas.has(clave)) { rechazar(tabla, clave, 'Clave de origen repetida en el archivo'); continue; }
        vistas.add(clave);
        const r = armar(f);
        if (typeof r === 'string') { rechazar(tabla, clave, r); continue; }
        const id = mapa.get(clave);
        if (id) existentes.push({ id, datos: r.datos });
        else {
          const nuevo = randomUUID();
          nuevas.push({ id: nuevo, ...r.datos });
          clavesNuevas.push({ sistema, tabla, idOrigen: clave, registroId: nuevo });
        }
        originales.push(f);
      }
      await prisma.$transaction(async (tx) => {
        await escribir(tx, nuevas, existentes, originales);
        if (clavesNuevas.length) await tx.claveOrigen.createMany({ data: clavesNuevas as any });
      }, { timeout: 600_000, maxWait: 60_000 });
      for (const k of clavesNuevas) mapa.set(k.idOrigen, k.registroId);
      c.creadas += nuevas.length;
      c.actualizadas += existentes.length;
      log(`${tabla}: ${Math.min(i + lote, filas.length)}/${filas.length}`);
    }
  }
  const actualizarCada = (modelo: string) => async (tx: Tx, existentes: { id: string; datos: Fila }[]) => {
    for (const e of existentes) await (tx as any)[modelo].update({ where: { id: e.id }, data: e.datos });
  };

  // ── 1. personas → usuarios con sus roles ──
  const hash = await bcrypt.hash(op.claveUsuarios, 10);
  const correosAjenos = new Map((await prisma.usuario.findMany({ select: { id: true, correo: true } })).map((u) => [u.correo, u.id]));
  for (const id of claves.get('Usuario')?.values() ?? []) for (const [c, i] of correosAjenos) if (i === id) correosAjenos.delete(c);
  const rolesDe = new Map<string, string[]>();
  const correosVistos = new Map<string, string>();
  await cargar('Usuario', s.personas ?? [], (p) => {
    const nombre = texto(p.nombre), correo = texto(p.correo)?.toLowerCase();
    if (!nombre || !correo || !/^[^@\s]+@[^@\s]+$/.test(correo)) return 'Sin nombre o con correo inválido';
    if (correosAjenos.has(correo)) return `El correo ${correo} ya lo usa otro usuario que no viene de ${sistema}`;
    if (correosVistos.has(correo) && correosVistos.get(correo) !== String(p.clave)) return `El correo ${correo} está repetido en el archivo (${correosVistos.get(correo)})`;
    const rs: string[] = Array.isArray(p.roles) ? p.roles : [];
    const faltan = rs.filter((r) => !roles.has(r));
    if (!rs.length || faltan.length) return `Rol inexistente: ${faltan.join(', ') || '(ninguno)'}`;
    if (p.local && !local[p.local]) return `Sede desconocida: ${p.local}`;
    correosVistos.set(correo, String(p.clave));
    rolesDe.set(String(p.clave), rs);
    return { datos: { organizacionId, nombre, correo, activo: p.activo !== false, localId: p.local ? local[p.local].id : null } };
  }, async (tx, nuevas, existentes, originales) => {
    if (nuevas.length) await tx.usuario.createMany({ data: nuevas.map((n) => ({ ...n, passwordHash: hash })) as any });
    await actualizarCada('usuario')(tx, existentes); // la contraseña no se toca al volver a correr
    let k = 0; // las nuevas siguen el orden de las originales que aún no tenían clave
    const roleRows = originales.flatMap((p) => {
      const uid = idDe('Usuario', p.clave) ?? nuevas[k++]?.id;
      return (rolesDe.get(String(p.clave)) ?? []).map((r) => ({ usuarioId: uid, rolId: roles.get(r)! }));
    });
    if (roleRows.length) await tx.usuarioRol.createMany({ data: roleRows, skipDuplicates: true });
  });

  // ── 2. clientes ──
  const docsAjenos = new Set((await prisma.cliente.findMany({ where: { organizacionId }, select: { id: true, documento: true } }))
    .filter((c) => ![...(claves.get('Cliente')?.values() ?? [])].includes(c.id)).map((c) => c.documento));
  const docsArchivo = new Set<string>();
  await cargar('Cliente', s.clientes ?? [], (c) => {
    const documento = texto(c.documento), nombre = texto(c.nombre);
    if (!documento || !nombre) return 'Sin documento o sin nombre';
    if (!TIPOS_DOC.includes(c.tipoDocumento)) return `Tipo de documento inválido: ${c.tipoDocumento}`;
    if (docsAjenos.has(documento)) return `El documento ya existe en la base y no viene de ${sistema}`;
    if (docsArchivo.has(documento)) return 'Documento repetido en el archivo';
    docsArchivo.add(documento);
    const creadoEn = fechaLima(c.creadoEn);
    return { datos: { organizacionId, tipoDocumento: c.tipoDocumento, documento, nombre, movil: texto(c.movil), email: texto(c.email),
      direccionFiscal: texto(c.direccionFiscal), comentario: texto(c.comentario), esGenerico: !!c.esGenerico, ...(creadoEn ? { creadoEn } : {}) } };
  }, async (tx, nuevas, existentes) => {
    if (nuevas.length) await tx.cliente.createMany({ data: nuevas as any });
    await actualizarCada('cliente')(tx, existentes);
  });

  // ── 3. vehículos con su titular ──
  const ids = (t: string) => new Set(claves.get(t)?.values() ?? []);
  const propios = ids('Vehiculo');
  const placasAjenas = new Set((await prisma.vehiculo.findMany({ where: { organizacionId }, select: { id: true, placaNorm: true } }))
    .filter((v) => !propios.has(v.id)).map((v) => v.placaNorm));
  const placasArchivo = new Set<string>();
  await cargar('Vehiculo', s.vehiculos ?? [], (v) => {
    const clienteId = idDe('Cliente', v.cliente);
    const placaNorm = texto(v.placaNorm)?.toUpperCase();
    if (!clienteId) return `Titular sin cargar: ${v.cliente}`;
    if (!placaNorm) return 'Sin placa';
    if (placasAjenas.has(placaNorm)) return `La placa ${placaNorm} ya existe en la base y no viene de ${sistema}`;
    if (placasArchivo.has(placaNorm)) return 'Placa repetida en el archivo';
    placasArchivo.add(placaNorm);
    const anio = numero(v.anio);
    return { datos: { organizacionId, clienteId, placa: texto(v.placa) ?? placaNorm, placaNorm, marca: texto(v.marca), modelo: texto(v.modelo),
      anio: anio && anio > 1900 && anio < 2100 ? Math.trunc(anio) : null, color: texto(v.color), nroVin: texto(v.nroVin), nroSerie: texto(v.nroSerie),
      nroMotor: texto(v.nroMotor), comentario: texto(v.comentario) } };
  }, async (tx, nuevas, existentes) => {
    if (nuevas.length) await tx.vehiculo.createMany({ data: nuevas as any });
    await actualizarCada('vehiculo')(tx, existentes);
  });

  // ── 4. ODS y sus detalles ──
  const propiasOds = ids('OrdenServicio');
  const codigosAjenos = new Set((await prisma.ordenServicio.findMany({ where: { organizacionId }, select: { id: true, codigo: true } }))
    .filter((o) => !propiasOds.has(o.id)).map((o) => o.codigo));
  const detallesDe = new Map<string, Fila[]>();
  const codigosVistos = new Map<string, string>();
  let sinServicio = 0;
  await cargar('OrdenServicio', s.ordenes ?? [], (o) => {
    const vehiculoId = idDe('Vehiculo', o.vehiculo), clienteId = idDe('Cliente', o.cliente), creadoPorId = idDe('Usuario', o.creadoPor);
    const fechaInicio = fechaLima(o.fechaInicio);
    const codigo = texto(o.codigo);
    if (!codigo) return 'Sin código';
    if (codigosAjenos.has(codigo)) return `El código ${codigo} ya existe en la base y no viene de ${sistema}`;
    if (codigosVistos.has(codigo) && codigosVistos.get(codigo) !== String(o.clave)) return `El código ${codigo} está repetido en el archivo (${codigosVistos.get(codigo)})`;
    if (!vehiculoId || !clienteId) return `Cliente o vehículo sin cargar (${o.cliente} / ${o.vehiculo})`;
    if (!creadoPorId) return `Creador sin cargar: ${o.creadoPor}`;
    if (!local[o.local]) return `Sede desconocida: ${o.local}`;
    if (!fechaInicio) return 'Fecha de ingreso inválida';
    if (!ESTADOS.includes(o.estado)) return `Estado inválido: ${o.estado}`;
    codigosVistos.set(codigo, String(o.clave));
    const km = numero(o.km);
    const dets: Fila[] = [];
    for (const d of Array.isArray(o.detalles) ? o.detalles : []) {
      const q = numero(d.cantidad), t = numero(d.total);
      if (!texto(d.clave) || !texto(d.descripcion) || !q || q <= 0 || t === null || Math.abs(t) > 9_999_999_999 || q > 9_999_999) { rechazar('DetalleODS', d?.clave, 'Detalle sin clave, descripción, cantidad positiva o total'); continue; }
      const servicioId = d.servicioCodigo ? servicios.get(d.servicioCodigo) : undefined;
      if (d.servicioCodigo && !servicioId) sinServicio++;
      dets.push({ clave: String(d.clave), datos: { posicion: Math.trunc(numero(d.posicion) ?? 0), tipo: texto(d.tipo) ?? 'servicio', descripcion: String(d.descripcion).slice(0, 500),
        referencia: texto(d.referencia), cantidad: q, precio: numero(d.precio) ?? t / q, total: t, servicioId: servicioId ?? null,
        tecnicoId: d.tecnico ? idDe('Usuario', d.tecnico) ?? null : null } });
    }
    detallesDe.set(String(o.clave), dets);
    return { datos: { organizacionId, vehiculoId, clienteId, localId: local[o.local].id, codigo, correlativo: null, externa: false, estado: o.estado,
      decision: texto(o.decision) ?? 'Aprobada', tipoAtencion: texto(o.tipoAtencion) ?? 'Otro', tipoAtencionDetalle: texto(o.tipoAtencionDetalle),
      fechaInicio, fechaCierre: fechaLima(o.fechaCierre), km: km !== null && km > 0 && km <= 2_000_000_000 ? Math.trunc(km) : null,
      tecnicoId: o.tecnico ? idDe('Usuario', o.tecnico) ?? null : null, jefeTallerId: o.jefeTaller ? idDe('Usuario', o.jefeTaller) ?? null : null, creadoPorId,
      observaciones: texto(o.observaciones), eliminada: !!o.eliminada, motivoEliminacion: texto(o.motivoEliminacion), creadoEn: fechaInicio } };
  }, async (tx, nuevas, existentes, originales) => {
    if (nuevas.length) await tx.ordenServicio.createMany({ data: nuevas as any });
    await actualizarCada('ordenServicio')(tx, existentes);
    // Detalles de las ODS de este lote, en la misma transacción
    const mapaDet = claves.get('DetalleODS') ?? new Map<string, string>();
    claves.set('DetalleODS', mapaDet);
    const nuevosDet: Fila[] = [], clavesDet: Fila[] = [];
    let k = 0;
    for (const o of originales) {
      const ordenId = idDe('OrdenServicio', o.clave) ?? nuevas[k++]?.id;
      for (const d of detallesDe.get(String(o.clave)) ?? []) {
        const id = mapaDet.get(d.clave);
        if (id) { await tx.detalleODS.update({ where: { id }, data: d.datos as any }); conteo('DetalleODS').actualizadas++; continue; }
        const nuevo = randomUUID();
        nuevosDet.push({ id: nuevo, ordenId, ...d.datos });
        clavesDet.push({ sistema, tabla: 'DetalleODS', idOrigen: d.clave, registroId: nuevo });
      }
    }
    if (nuevosDet.length) await tx.detalleODS.createMany({ data: nuevosDet as any });
    if (clavesDet.length) await tx.claveOrigen.createMany({ data: clavesDet as any });
    for (const c of clavesDet) mapaDet.set(c.idOrigen, c.registroId);
    conteo('DetalleODS').creadas += nuevosDet.length;
  });
  if (sinServicio) rep.avisos.push(`${sinServicio} detalles apuntaban a un servicio que no está en el catálogo de la base: quedaron sin enlazar.`);

  // ── 5. lecturas de km ──
  await cargar('LecturaKm', s.lecturas ?? [], (l) => {
    const vehiculoId = idDe('Vehiculo', l.vehiculo), fecha = fechaLima(l.fecha), km = numero(l.km);
    if (!vehiculoId) return `Vehículo sin cargar: ${l.vehiculo}`;
    if (!fecha) return 'Fecha inválida';
    if (km === null || !Number.isInteger(km) || km <= 0 || km > KM_MAX) return `Km fuera de rango: ${l.km}`;
    return { datos: { vehiculoId, km, fecha, fuente: sistema, observacion: texto(l.observacion) } };
  }, async (tx, nuevas, existentes) => {
    if (nuevas.length) await tx.lecturaKm.createMany({ data: nuevas as any });
    await actualizarCada('lecturaKm')(tx, existentes);
  });

  // ── 6. comprobantes → notas de venta con sus ítems y abonos ──
  const propiasNotas = ids('NotaVenta');
  const numerosAjenos = new Set((await prisma.notaVenta.findMany({ where: { organizacionId }, select: { id: true, serie: true, numero: true } }))
    .filter((n) => !propiasNotas.has(n.id)).map((n) => `${n.serie}:${n.numero}`));
  const hijos = new Map<string, { dets: Fila[]; abonos: Fila[] }>();
  const maxSerie = new Map<string, number>();
  const notasVistas = new Map<string, string>();
  await cargar('NotaVenta', s.notas ?? [], (n) => {
    const l = local[n.local];
    const num = numero(n.numero), total = numero(n.total), fecha = fechaLima(n.fechaEmision);
    const clienteId = idDe('Cliente', n.cliente), emitidaPorId = idDe('Usuario', n.emitidaPor);
    if (!l?.serieNotaVenta) return `Sede desconocida o sin serie de nota de venta: ${n.local}`;
    if (!num || !Number.isInteger(num) || num <= 0 || num > 2_000_000_000) return 'Número inválido';
    if (total === null || total < 0 || total > 9_999_999_999) return 'Total inválido';
    if (!fecha) return 'Fecha inválida';
    if (!clienteId) return `Cliente sin cargar: ${n.cliente}`;
    if (!emitidaPorId) return `Emisor sin cargar: ${n.emitidaPor}`;
    const serie = l.serieNotaVenta;
    if (numerosAjenos.has(`${serie}:${num}`)) return `El número ${codigoNota(serie, num)} ya existe en la base y no viene de ${sistema}`;
    const ordenId = n.orden ? idDe('OrdenServicio', n.orden) : null;
    if (n.orden && !ordenId) return `ODS sin cargar: ${n.orden}`;
    const claveNota = `${serie}:${num}`;
    if (notasVistas.has(claveNota) && notasVistas.get(claveNota) !== String(n.clave)) return `El número ${codigoNota(serie, num)} está repetido en el archivo (${notasVistas.get(claveNota)})`;
    notasVistas.set(claveNota, String(n.clave));
    maxSerie.set(serie, Math.max(maxSerie.get(serie) ?? 0, num));
    const dets = (Array.isArray(n.detalles) ? n.detalles : []).filter((d: Fila) => texto(d.clave) && texto(d.descripcion) && numero(d.cantidad)! > 0)
      .map((d: Fila) => ({ clave: String(d.clave), datos: { posicion: Math.trunc(numero(d.posicion) ?? 0), tipo: texto(d.tipo) ?? 'servicio',
        descripcion: String(d.descripcion).slice(0, 500), referencia: texto(d.referencia), cantidad: numero(d.cantidad)!, precio: numero(d.precio) ?? 0,
        tipoIgv: 'EXONERADO', total: numero(d.total) ?? 0, servicioId: d.servicioCodigo ? servicios.get(d.servicioCodigo) ?? null : null } }));
    const abonos = (Array.isArray(n.abonos) ? n.abonos : []).flatMap((a: Fila) => {
      const valor = numero(a.valor);
      if (!texto(a.clave) || !valor || valor <= 0 || !METODOS.includes(a.metodo)) { rechazar('Abono', a?.clave, 'Abono sin clave, con valor no positivo o método inválido'); return []; }
      return [{ clave: String(a.clave), datos: { ordenId, fecha: fechaLima(a.fecha) ?? fecha, metodo: a.metodo, concepto: texto(a.concepto), valor, registradoPorId: emitidaPorId } }];
    });
    hijos.set(String(n.clave), { dets, abonos });
    const vehiculoId = n.vehiculo ? idDe('Vehiculo', n.vehiculo) ?? null : null;
    // Las notas internas de Tuulapp no llevaban IGV aparte: el total se registra como exonerado (no se inventa un desglose).
    return { datos: { organizacionId, localId: l.id, ordenId, clienteId, vehiculoId, serie, numero: num, codigo: codigoNota(serie, num), fechaEmision: fecha,
      fechaVencimiento: fecha, condicion: n.condicion === 'CREDITO' ? 'CREDITO' : 'CONTADO', observaciones: texto(n.observaciones), estado: 'EMITIDA',
      exonerada: total, inafecta: 0, gravada: 0, igv: 0, total, emitidaPorId, creadoEn: fecha } };
  }, async (tx, nuevas, existentes, originales) => {
    if (nuevas.length) await tx.notaVenta.createMany({ data: nuevas as any });
    await actualizarCada('notaVenta')(tx, existentes);
    for (const [tabla, modelo, campo] of [['DetalleNota', 'detalleNota', 'dets'], ['Abono', 'abono', 'abonos']] as const) {
      const mapa = claves.get(tabla) ?? new Map<string, string>();
      claves.set(tabla, mapa);
      const nuevos: Fila[] = [], ks: Fila[] = [];
      let k = 0;
      for (const n of originales) {
        const notaId = idDe('NotaVenta', n.clave) ?? nuevas[k++]?.id;
        for (const h of hijos.get(String(n.clave))?.[campo] ?? []) {
          const id = mapa.get(h.clave);
          if (id) { await (tx as any)[modelo].update({ where: { id }, data: h.datos }); conteo(tabla).actualizadas++; continue; }
          const nuevo = randomUUID();
          // Igual que en el sistema: el pago de una nota con ODS va a la ODS (RF-089); el de una venta directa, a la nota.
          nuevos.push(tabla === 'Abono' && h.datos.ordenId ? { id: nuevo, ...h.datos } : { id: nuevo, notaId, ...h.datos, ...(tabla === 'Abono' ? { ordenId: null } : {}) });
          ks.push({ sistema, tabla, idOrigen: h.clave, registroId: nuevo });
        }
      }
      if (nuevos.length) await (tx as any)[modelo].createMany({ data: nuevos });
      if (ks.length) await tx.claveOrigen.createMany({ data: ks as any });
      for (const c of ks) mapa.set(c.idOrigen, c.registroId);
      conteo(tabla).creadas += nuevos.length;
    }
  });
  // El correlativo de cada serie sigue después del mayor número cargado (las notas nuevas no chocan con las migradas).
  for (const [serie, max] of maxSerie) {
    const c = await prisma.correlativoSerie.findUnique({ where: { organizacionId_serie: { organizacionId, serie } } });
    if (!c) await prisma.correlativoSerie.create({ data: { organizacionId, serie, ultimo: max } });
    else if (c.ultimo < max) await prisma.correlativoSerie.update({ where: { organizacionId_serie: { organizacionId, serie } }, data: { ultimo: max } });
  }
  return rep;
}
