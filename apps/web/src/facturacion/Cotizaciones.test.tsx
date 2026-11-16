// Módulo Cotizaciones y su carga desde «Emitir comprobante».
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

const me = {
  usuario: { id: 'm', nombre: 'Cajera Demo', correo: 'cajera@demo.local', organizacionId: 'o1' }, roles: ['Cajera'],
  permisos: { cotizaciones: 'A', notas: 'A' }, menu: [{ id: 'cotizaciones', label: 'Cotizaciones', grupo: 'Ingresos', nivel: 'A' }, { id: 'notas', label: 'Emitir comprobante (nota de venta)', grupo: 'Ingresos', nivel: 'A' }],
  actuandoComo: false, esPlataforma: false, real: { id: 'm', nombre: 'Cajera Demo' },
};
const cliente = { id: 'c1', nombre: 'JOAQUIN DEL CARPIO', documento: '73867734', tipoDocumento: 'DNI', direccionFiscal: null, movil: null };
const cot = (id: string, codigo: string, estado: string) => ({
  id, codigo, estado, fechaEmision: '2026-11-16T15:00:00.000Z', validaHasta: '2026-11-30T15:00:00.000Z', condicion: 'CONTADO', formaPago: 'Yape', conIgv: true, conDetraccion: false,
  observaciones: null, comentario: null, local: { id: 'l1', nombre: 'Local Prohogar' }, cliente, vehiculo: null,
  detalles: [{ id: 'd1', tipo: 'servicio', descripcion: 'Cambio de aceite', referencia: null, cantidad: 1, precio: 118, descuentoPct: 0, tipoIgv: 'GRAVADO', total: 118, servicioId: null, productoId: null }],
  exonerada: 0, inafecta: 0, gravada: 100, igv: 18, total: 118, creadaPor: 'Cajera Demo', anuladaPor: null, motivoAnulacion: null,
});
const posts: { ruta: string; cuerpo: any }[] = [];

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'false');
  sessionStorage.clear(); localStorage.clear(); sessionStorage.setItem('posventa-token', 't');
  posts.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url); const clave = `${(init?.method ?? 'GET').toUpperCase()} ${u.pathname}`;
    if (init?.method === 'POST') posts.push({ ruta: u.pathname, cuerpo: JSON.parse(String(init.body)) });
    const base: Record<string, unknown> = {
      'GET /me': me, 'GET /cotizaciones': [cot('k1', 'COT-000001', 'VIGENTE'), cot('k2', 'COT-000002', 'VENCIDA')],
      'GET /ordenes/catalogos': { tiposAtencion: [], decisiones: [], estados: [], metodosPago: ['Efectivo', 'Yape'], tecnicos: [], jefes: [], locales: [{ id: 'l1', nombre: 'Local Prohogar', serieNotaVenta: 'NV01' }], localId: 'l1' },
      'GET /ordenes': [], 'GET /clientes': [{ id: 'c1', documento: '73867734', nombre: 'JOAQUIN DEL CARPIO', esGenerico: false }], 'GET /vehiculos': [], 'GET /catalogo-ods': { servicios: [], productos: [] },
      'GET /notas-venta': [], 'POST /cotizaciones': { codigo: 'COT-000003' }, 'POST /notas-venta': { codigo: 'NV01-000001' },
    };
    return { ok: true, status: 200, json: async () => base[clave] ?? {} };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('Cotizaciones: lista con estado vigente/vencida y acciones PDF, Ticket y Anular solo si no está anulada', async () => {
  window.location.hash = '#/cotizaciones';
  render(<App />);
  const vigente = (await screen.findByText('COT-000001')).closest('tr')!;
  expect(within(vigente).getByText('Vigente')).toBeInTheDocument();
  expect(within(screen.getByText('COT-000002').closest('tr')!).getByText('Vencida')).toBeInTheDocument();
  await userEvent.click(within(vigente).getByRole('button', { name: 'Acciones' }));
  for (const n of ['Ticket', 'PDF', 'Anular']) expect(within(vigente).getByRole('button', { name: n })).toBeInTheDocument();
});

it('Cotizaciones: «+ Nuevo» abre el formato sin serie ni pagos, con vigencia hasta hoy, vehículo opcional e IGV incluido, y la emite', async () => {
  window.location.hash = '#/cotizaciones';
  render(<App />);
  await screen.findByText('COT-000001');
  await userEvent.click(screen.getByRole('button', { name: '+ Nuevo' }));
  const d = await screen.findByRole('dialog', { name: 'Emitir nueva cotización' });
  expect(within(d).queryByLabelText('Serie')).toBeNull();
  expect(within(d).queryByLabelText('Monto recibido')).toBeNull();
  expect(within(d).getByLabelText('Válida hasta')).toHaveValue(new Date().toLocaleDateString('en-CA'));
  expect(within(d).getByLabelText('Placa (opcional)')).toBeInTheDocument();
  expect(within(d).queryByLabelText('Responsable')).toBeNull();
  await userEvent.selectOptions(within(d).getByLabelText('Cliente *'), 'c1');
  await userEvent.type(within(d).getByLabelText('Detalle del ítem 1'), 'Revisión');
  await userEvent.type(within(d).getByLabelText('Precio del ítem 1'), '50');
  await userEvent.selectOptions(within(d).getByLabelText('Forma de pago'), 'Yape');
  await userEvent.click(within(d).getByRole('button', { name: 'Emitir' }));
  await vi.waitFor(() => expect(posts.find((x) => x.ruta === '/cotizaciones')?.cuerpo).toMatchObject({ clienteId: 'c1', formaPago: 'Yape', conIgv: true, items: [{ descripcion: 'Revisión', precio: 50 }] }));
});

it('Emitir comprobante: carga los ítems de una cotización vigente, con su cliente', async () => {
  window.location.hash = '#/notas';
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  const d = await screen.findByRole('dialog', { name: 'Emitir nuevo comprobante' });
  await userEvent.selectOptions(await within(d).findByLabelText('Cargar ítems desde una cotización'), 'k1');
  await userEvent.click(within(d).getAllByRole('button', { name: '+ Agregar' })[0]);
  expect(within(d).getByLabelText('Detalle del ítem 1')).toHaveValue('Cambio de aceite');
  expect(within(d).getByLabelText('Cliente *')).toHaveValue('c1');
  expect(within(d).getByLabelText('Totales')).toHaveTextContent('Total S/ 118.00');
  expect(within(d).queryByRole('option', { name: /COT-000002/ })).toBeNull(); // la vencida no se ofrece
});
