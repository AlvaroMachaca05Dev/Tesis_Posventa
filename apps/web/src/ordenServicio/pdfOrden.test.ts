// PDF de la orden de servicio: hoja de la ODS, hoja de recepción y ticket (formatos del taller).
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import type { Empresa, Orden } from '../comun/api';
import { anchoTexto, dividir } from '../comun/pdf';
import { generarPdf } from './pdfOrden';

const empresa: Empresa = {
  nombre: 'Taller Demo', ruc: '20123456789', direccion: 'Av. Principal 123 - Miraflores', telefono: '999888777', correo: 'correo@taller.test', lema: 'BIENVENIDO AL TALLER',
  cuentasBancarias: 'BANCO DEMO CUENTA CORRIENTE SOLES: 0000000000000 CCI.: 00000000000000000000',
  pieTicket: '¡GRACIAS POR SU COMPRA. NO SE ACEPTAN DEVOLUCIONES DESPUES DE LAS 24 HORAS !!', anchoTicketMm: 80,
  terminosRecepcion: '1. Primera cláusula de prueba con ñ, tildes y «comillas».\n2. Segunda cláusula (con paréntesis).',
};
const orden = {
  id: 'o1', codigo: '2026000009', externa: false, estado: 'Recepcion', decision: 'Aprobada', tipoAtencion: 'Preventivo y correctivo', tipoAtencionDetalle: null,
  fechaInicio: '2026-10-18T15:00:00.000Z', fechaCierre: null, km: 64564, observaciones: 'observaciones', recomendaciones: 'recomendaciones',
  cliente: { id: 'c1', nombre: 'Juan Pérez Núñez', documento: '12345678', tipoDocumento: 'DNI', movil: '987654321', direccionFiscal: null, pais: 'PE' },
  vehiculo: { id: 'v1', placa: 'ABC-123', marca: 'SUZUKI', modelo: 'JIMMY', anio: 2012, color: 'PLOMO NEGRO', nroSerie: null, nroVin: null, nroMotor: null },
  tecnico: { id: 't', nombre: 'Mecánico Demo' }, jefeTaller: { id: 'j', nombre: 'Jefe Demo' }, creadoPor: { id: 'u', nombre: 'Asesor Demo' },
  detalles: [
    { tipo: 'producto', descripcion: '8100 ECO LITE Motul 5w30 1 LT', referencia: 'AMO102', cantidad: 1, costo: null, rentabilidadPct: null, precio: 12, descuentoPct: 0, impuesto: 'IGV', total: 12 },
    { tipo: 'servicio', descripcion: 'CAMBIO DE MOTOR', referencia: null, cantidad: 1, costo: null, rentabilidadPct: null, precio: 60, descuentoPct: 0, impuesto: 'IGV', total: 60 },
  ],
  total: 72, abonos: [], totalAbonos: 0, pendiente: 72, comprobantes: [], conComprobante: false, ultimaBitacora: null, bitacora: [],
} as unknown as Orden;

const texto = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

describe('escritor de PDF', () => {
  it('mide con Helvetica y parte las líneas sin pasar del ancho', () => {
    expect(anchoTexto('ABC', 'N', 10)).toBeCloseTo((667 + 667 + 722) / 100, 5);
    expect(anchoTexto('ñ', 'N', 10)).toBe(anchoTexto('n', 'N', 10));
    const lineas = dividir('uno dos tres cuatro cinco seis siete ocho nueve diez', 'N', 10, 80);
    expect(lineas.length).toBeGreaterThan(2);
    for (const l of lineas) expect(anchoTexto(l, 'N', 10)).toBeLessThanOrEqual(80);
    expect(dividir('a\nb', 'N', 10, 80)).toEqual(['a', 'b']);
  });
});

describe('PDF de la orden', () => {
  for (const formato of ['PDF', 'Recepción', 'Ticket'] as const) {
    it(`${formato}: es un PDF válido con los datos de la orden`, () => {
      const bytes = generarPdf(formato, orden, empresa);
      const s = texto(bytes);
      expect(s.startsWith('%PDF-1.4')).toBe(true);
      expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
      expect(s).toContain('2026000009');
      // La tabla de referencias apunta a cada objeto en su posición real.
      const inicio = Number(/startxref\n(\d+)/.exec(s)![1]);
      expect(s.slice(inicio, inicio + 4)).toBe('xref');
      const posiciones = [...s.slice(inicio).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
      posiciones.forEach((pos, i) => expect(s.slice(pos, pos + String(i + 1).length + 6)).toBe(`${i + 1} 0 obj`));
      if (formato !== 'Ticket') expect(s).toContain('/Subtype /Image'); // el ticket no lleva logo
      if (process.env.PDF_SALIDA) writeFileSync(`${process.env.PDF_SALIDA}/${formato === 'PDF' ? 'ods' : formato === 'Recepción' ? 'recepcion' : 'ticket'}.pdf`, bytes);
    });
  }
  it('la ODS lleva cliente, vehículo, ítems con su total y el total general; el ticket, el cliente y los ítems', () => {
    const ods = texto(generarPdf('PDF', orden, empresa));
    for (const t of ['ORDEN DE SERVICIO', 'RAZÓN SOCIAL:','ABC-123', 'SUZUKI', '72.00', 'PRECIOS INCLUYEN IGV', 'AMO102', 'CAMBIO DE MOTOR', '20123456789']) expect(ods).toContain(t);
    const ticket = texto(generarPdf('Ticket', orden, empresa));
    for (const t of ['NRO ORDEN DE SERVICIO: 2026000009', 'AMO102 - 8100', 'SERVICIOS - CAMBIO', 'Total']) expect(ticket).toContain(t);
  });
  it('la recepción lleva los términos de la empresa y las dos firmas', () => {
    const rec = texto(generarPdf('Recepción', orden, empresa));
    for (const t of ['RECEPCION', 'TERMINOS Y CONDICIONES DEL SERVICIO:', 'LA EMPRESA', 'EL CLIENTE', 'Primera cl\xE1usula']) expect(rec).toContain(t);
  });
});
