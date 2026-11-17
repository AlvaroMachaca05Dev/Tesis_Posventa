// PDF y ticket de la nota de venta (RF-088).
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import type { Empresa, NotaOrden, Orden } from '../comun/api';
import { totalesDe } from './FormNota';
import { generarPdfNota } from './pdfNota';

const empresa: Empresa = { nombre: 'Taller Demo', razonSocial: 'Taller Demo S.A.C.', ruc: '20123456789', direccion: 'Av. Principal 123', telefono: '999888777', correo: 'correo@taller.test', lema: 'BIENVENIDO', cuentasBancarias: 'BANCO DEMO 000', terminosRecepcion: null, pieTicket: 'Gracias por su compra', anchoTicketMm: 80 };
const orden = {
  id: 'o1', codigo: '2026111600001', km: 64000, cliente: { id: 'c', nombre: 'Juan Pérez Núñez', documento: '12345678', tipoDocumento: 'DNI', movil: '987654321', direccionFiscal: null },
  vehiculo: { id: 'v', placa: 'ABC-123', marca: 'SUZUKI', modelo: 'JIMNY' },
} as unknown as Orden;
const nota: NotaOrden = {
  id: 'n1', codigo: 'NV01-000007', condicion: 'CREDITO', fechaEmision: '2026-11-16T15:00:00.000Z', fechaVencimiento: '2026-12-01T15:00:00.000Z', local: 'Local Prohogar', observaciones: 'Entrega en taller', comentario: null,
  detalles: [
    { id: 'a', tipo: 'servicio', descripcion: 'Cambio de motor', referencia: null, cantidad: 1, precio: 800, descuentoPct: 0, tipoIgv: 'GRAVADO', total: 800 },
    { id: 'b', tipo: 'producto', descripcion: 'Aceite 5W-30', referencia: 'AMO-102', cantidad: 2, precio: 50, descuentoPct: 0, tipoIgv: 'EXONERADO', total: 100 },
  ],
  exonerada: 100, inafecta: 0, gravada: 677.97, igv: 122.03, total: 900, conDetraccion: true, detraccionPct: 12, detraccion: 108,
};
const texto = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

describe('logo de la empresa en el PDF', () => {
  it('con logo propio se incrusta el JPEG tal cual (DCTDecode) y con las medidas del logo; sin logo se usa el de respaldo', () => {
    const jpeg = btoa('\xFF\xD8\xFF\xE0jpeg-de-prueba');
    const propio = texto(generarPdfNota('PDF', orden, nota, { ...empresa, logo: { base64: jpeg, ancho: 600, alto: 100 } }));
    expect(propio).toContain('/Filter /DCTDecode');
    expect(propio).toContain('/Width 600 /Height 100');
    const respaldo = texto(generarPdfNota('PDF', orden, nota, empresa));
    expect(respaldo).toContain('/Filter /FlateDecode');
    expect(respaldo).not.toContain('DCTDecode');
  });
});

describe('totales de la nota en pantalla (mismas reglas que el servidor)', () => {
  it('gravado incluye el IGV; exonerado e inafecto aparte; detracción de 12 % redondeada si hay servicio y supera S/ 700', () => {
    const t = totalesDe([{ tipo: 'servicio', total: 800, tipoIgv: 'GRAVADO' }, { tipo: 'producto', total: 100, tipoIgv: 'EXONERADO' }]);
    expect(t).toMatchObject({ exonerada: 100, inafecta: 0, gravada: 677.97, igv: 122.03, total: 900, proponeDetraccion: true, detraccion: 108 });
    expect(totalesDe([{ tipo: 'producto', total: 900, tipoIgv: 'GRAVADO' }]).proponeDetraccion).toBe(false);
  });
});

describe('PDF de la nota de venta', () => {
  it('la hoja lleva el código, el cliente, los ítems con su tipo de IGV, los totales y la detracción', () => {
    const bytes = generarPdfNota('PDF', orden, nota, empresa);
    const s = texto(bytes);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    for (const t of ['NOTA DE VENTA', 'NV01-000007', 'JUAN PÉREZ NÚÑEZ', 'ABC-123', 'Cambio de motor', 'AMO-102', 'Exon.', 'OP. GRAVADA', '677.97', '122.03', '900.00', 'DETRACCION 12 %', '108.00', 'CRÉDITO', '2026111600001']) expect(s).toContain(t);
    if (process.env.PDF_SALIDA) writeFileSync(`${process.env.PDF_SALIDA}/nota.pdf`, bytes);
  });
  it('el ticket lleva el código, los ítems, los totales y el pie configurado', () => {
    const bytes = generarPdfNota('Ticket', orden, nota, empresa);
    const s = texto(bytes);
    for (const t of ['NOTA DE VENTA: NV01-000007', 'Cambio de', 'Op. gravada', 'IGV 18 %', 'Total S/', '900.00', 'Gracias por su compra']) expect(s).toContain(t);
    expect(s).toContain('/MediaBox [0 0 227 ');
    if (process.env.PDF_SALIDA) writeFileSync(`${process.env.PDF_SALIDA}/nota-ticket.pdf`, bytes);
  });
});
