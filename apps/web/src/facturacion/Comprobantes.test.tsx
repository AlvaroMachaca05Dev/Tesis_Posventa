// Módulo «Emitir comprobante (nota de venta)»: lista de notas, acciones por fila y «+ Nuevo» desde una orden.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

const me = {
  usuario: { id: 'm', nombre: 'Cajera Demo', correo: 'cajera@demo.local', organizacionId: 'o1' }, roles: ['Cajera'],
  permisos: { notas: 'A' }, menu: [{ id: 'notas', label: 'Emitir comprobante (nota de venta)', grupo: 'Ingresos', nivel: 'A' }],
  actuandoComo: false, esPlataforma: false, real: { id: 'm', nombre: 'Cajera Demo' },
};
const nota = (id: string, codigo: string, estado: string) => ({
  id, codigo, serie: 'NV01', numero: 7, estado, condicion: 'CONTADO', fechaEmision: '2026-11-16T15:00:00.000Z', fechaVencimiento: null,
  local: { id: 'l1', nombre: 'Local Prohogar' }, observaciones: null, comentario: null, orden: { id: 'o1', codigo: '2026000001', km: 1 },
  cliente: { id: 'c1', nombre: 'JOAQUIN DEL CARPIO', documento: '73867734', tipoDocumento: 'DNI', direccionFiscal: null, movil: null }, vehiculo: { placa: 'B5W-165', marca: null, modelo: null },
  detalles: [], exonerada: 0, inafecta: 0, gravada: 0, igv: 0, total: 800, conDetraccion: false, detraccionPct: 12, detraccionExacta: 0, detraccion: 0,
  pagado: 0, saldo: 800, emitidaPor: 'Cajera Demo', anuladaPor: null, motivoAnulacion: null, anuladaEn: null,
});
const llamadas: string[] = [];
const posts: { ruta: string; cuerpo: any }[] = [];

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'false');
  sessionStorage.clear(); localStorage.clear(); sessionStorage.setItem('posventa-token', 't');
  llamadas.length = 0; posts.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url); const clave = `${(init?.method ?? 'GET').toUpperCase()} ${u.pathname}`;
    llamadas.push(clave);
    if (init?.method === 'POST') posts.push({ ruta: u.pathname, cuerpo: JSON.parse(String(init.body)) });
    const base: Record<string, unknown> = {
      'GET /me': me, 'GET /notas-venta': [nota('n1', 'NV01-000007', 'EMITIDA'), nota('n2', 'NV01-000006', 'ANULADA')],
      'GET /ordenes/catalogos': { tiposAtencion: [], decisiones: [], estados: [], metodosPago: ['Efectivo'], tecnicos: [], jefes: [], locales: [{ id: 'l1', nombre: 'Local Prohogar', serieNotaVenta: 'NV01' }], localId: 'l1' },
      'GET /ordenes': [], 'GET /cotizaciones': [], 'GET /clientes': [{ id: 'c1', documento: '73867734', nombre: 'JOAQUIN DEL CARPIO', esGenerico: false }], 'GET /vehiculos': [], 'GET /catalogo-ods': { servicios: [], productos: [] },
      'POST /notas-venta': { codigo: 'NV01-000008' },
    };
    return { ok: true, status: 200, json: async () => base[clave] ?? {} };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('Comprobantes: lista solo las notas vigentes, con usuario, y el menú ofrece Ver, Ticket, PDF, Duplicar y Eliminar (con motivo en un modal propio)', async () => {
  window.location.hash = '#/notas';
  render(<App />);
  const vigente = (await screen.findByText('NV01-000007')).closest('tr')!;
  expect(within(vigente).getByText('Cajera Demo')).toBeInTheDocument();
  expect(within(vigente).getByText('73867734')).toBeInTheDocument();
  await userEvent.click(within(vigente).getByRole('button', { name: 'Acciones' }));
  for (const n of ['Ver', 'Ticket', 'PDF', 'Duplicar', 'Eliminar']) expect(within(vigente).getByRole('button', { name: n })).toBeInTheDocument();
  expect(within(vigente).queryByRole('button', { name: 'Anular' })).toBeNull();
  expect(screen.queryByText('NV01-000006')).toBeNull();
  await userEvent.click(within(vigente).getByRole('button', { name: 'Eliminar' }));
  const d = await screen.findByRole('alertdialog', { name: '¿Eliminar la nota de venta NV01-000007?' });
  expect(within(d).getByRole('button', { name: 'Eliminar' })).toBeDisabled();
  await userEvent.type(within(d).getByLabelText('Motivo *'), 'Error de digitación');
  await userEvent.click(within(d).getByRole('button', { name: 'Eliminar' }));
  expect(await screen.findByText('Nota de venta NV01-000007 eliminada.')).toBeInTheDocument();
  expect(posts.find((p) => p.ruta === '/notas-venta/n1/anular')?.cuerpo).toEqual({ motivo: 'Error de digitación' });
});

it('Comprobantes: «+ Nuevo» abre la nota con la carga desde cotización u orden y emite una venta directa con sus pagos', async () => {
  window.location.hash = '#/notas';
  render(<App />);
  await screen.findByText('NV01-000007');
  await userEvent.click(screen.getByRole('button', { name: '+ Nuevo' }));
  const d = await screen.findByRole('dialog', { name: /Emitir nuevo comprobante/ });
  expect(within(d).getByLabelText('Cargar ítems desde una cotización')).toBeEnabled();
  expect(within(d).getByLabelText('Cargar ítems desde una orden de servicio')).toBeInTheDocument();
  expect(within(d).getByLabelText('Serie')).toHaveValue('NV01');
  await userEvent.selectOptions(within(d).getByLabelText('Cliente *'), 'c1');
  await userEvent.type(within(d).getByLabelText('Detalle del ítem 1'), 'Aceite');
  await userEvent.type(within(d).getByLabelText('Precio del ítem 1'), '100');
  expect(within(d).getByLabelText('Totales')).toHaveTextContent('Total S/ 100.00');
  await userEvent.type(within(d).getByLabelText('Monto recibido'), '40');
  await userEvent.click(within(d).getByRole('button', { name: 'Agregar pago' }));
  expect(within(d).getByLabelText('Totales')).toHaveTextContent('Saldo S/ 60.00');
  await userEvent.click(within(d).getByRole('button', { name: 'Emitir' }));
  await vi.waitFor(() => expect(posts.find((x) => x.ruta === '/notas-venta')?.cuerpo).toMatchObject({ clienteId: 'c1', condicion: 'CONTADO', pagos: [{ metodo: 'Efectivo', valor: 40 }], items: [{ descripcion: 'Aceite', precio: 100, cantidad: 1 }] }));
});
