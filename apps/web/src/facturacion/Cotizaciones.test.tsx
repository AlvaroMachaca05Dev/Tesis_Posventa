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
const servicioFicha = { id: 's1', codigo: 'SV094', nombre: 'Servicio express', categoria: 'Paquetes de mantenimiento', horas: 0.75, precio: 40, grupo: 'G1', repuestos: [], etiqueta: 'Preventivo', descripcion: null, subservicios: [{ nombre: 'Cambio de aceite y filtro de motor', horas: 0.5 }, { nombre: 'Revisión de batería', horas: 0.25 }], pasos: [] };
let catalogo: { servicios: unknown[]; productos: unknown[] } = { servicios: [], productos: [] };

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'false');
  sessionStorage.clear(); localStorage.clear(); sessionStorage.setItem('posventa-token', 't');
  posts.length = 0; catalogo = { servicios: [], productos: [] };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url); const clave = `${(init?.method ?? 'GET').toUpperCase()} ${u.pathname}`;
    if (init?.method === 'POST') posts.push({ ruta: u.pathname, cuerpo: JSON.parse(String(init.body)) });
    const base: Record<string, unknown> = {
      'GET /me': me, 'GET /cotizaciones': [cot('k1', 'COT-000001', 'VIGENTE'), cot('k2', 'COT-000002', 'VENCIDA')],
      'GET /ordenes/catalogos': { tiposAtencion: [], decisiones: [], estados: [], metodosPago: ['Efectivo', 'Yape'], tecnicos: [], jefes: [], locales: [{ id: 'l1', nombre: 'Local Prohogar', serieNotaVenta: 'NV01' }], localId: 'l1' },
      'GET /ordenes': [], 'GET /clientes': [{ id: 'c1', documento: '73867734', nombre: 'JOAQUIN DEL CARPIO', esGenerico: false }], 'GET /vehiculos': [], 'GET /catalogo-ods': catalogo,
      'GET /notas-venta': [], 'POST /cotizaciones': { codigo: 'COT-000003' }, 'POST /notas-venta': { codigo: 'NV01-000001' },
    };
    return { ok: true, status: 200, json: async () => base[clave] ?? {} };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('Cotizaciones: lista con estado vigente/vencida y acciones PDF, Ticket y Eliminar (sin Anular)', async () => {
  window.location.hash = '#/cotizaciones';
  render(<App />);
  const vigente = (await screen.findByText('COT-000001')).closest('tr')!;
  expect(within(vigente).getByText('Vigente')).toBeInTheDocument();
  expect(within(screen.getByText('COT-000002').closest('tr')!).getByText('Vencida')).toBeInTheDocument();
  await userEvent.click(within(vigente).getByRole('button', { name: 'Acciones' }));
  for (const n of ['Ticket', 'PDF', 'Eliminar']) expect(within(vigente).getByRole('button', { name: n })).toBeInTheDocument();
  expect(within(vigente).queryByRole('button', { name: 'Anular' })).toBeNull();
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
  await userEvent.click(within(d).getByRole('button', { name: 'Agregar los ítems de la cotización' }));
  expect(within(d).getByLabelText('Detalle del ítem 1')).toHaveValue('Cambio de aceite');
  expect(within(d).getByLabelText('Cliente *')).toHaveValue('c1');
  expect(within(d).getByLabelText('Totales')).toHaveTextContent('Total S/ 118.00');
  expect(within(d).queryByRole('option', { name: /COT-000002/ })).toBeNull(); // la vencida no se ofrece
});

it('Cotizaciones: el formato es simple (sin tipo de IGV ni desglose, solo total y si los precios incluyen IGV) y el menú ofrece emitir, duplicar, editar y eliminar', async () => {
  window.location.hash = '#/cotizaciones';
  render(<App />);
  const vigente = (await screen.findByText('COT-000001')).closest('tr')!;
  await userEvent.click(within(vigente).getByRole('button', { name: 'Acciones' }));
  for (const n of ['Emitir comprobante', 'Duplicar', 'Editar', 'Eliminar']) expect(within(vigente).getByRole('button', { name: n })).toBeInTheDocument();
  await userEvent.click(within(vigente).getByRole('button', { name: 'Duplicar' }));
  const d = await screen.findByRole('dialog', { name: 'Emitir nueva cotización' });
  expect(within(d).getByLabelText('Detalle del ítem 1')).toHaveValue('Cambio de aceite');
  expect(within(d).queryByLabelText('Tipo de IGV del ítem 1')).toBeNull();
  const totales = within(d).getByLabelText('Totales');
  expect(totales).toHaveTextContent('Total S/ 118.00');
  expect(totales).not.toHaveTextContent('Gravada');
  expect(totales).toHaveTextContent('Precios incluyen IGV');
  await userEvent.click(within(d).getByLabelText('Los precios incluyen el IGV'));
  expect(totales).toHaveTextContent('Precios no incluyen IGV');
});

it('Cotizaciones: «Emitir comprobante» abre «Emitir nuevo comprobante» (sin número de orden) con la cotización cargada', async () => {
  window.location.hash = '#/cotizaciones';
  render(<App />);
  const vigente = (await screen.findByText('COT-000001')).closest('tr')!;
  await userEvent.click(within(vigente).getByRole('button', { name: 'Acciones' }));
  await userEvent.click(within(vigente).getByRole('button', { name: 'Emitir comprobante' }));
  const d = await screen.findByRole('dialog', { name: 'Emitir nuevo comprobante' });
  expect(within(d).getByRole('heading', { level: 2 })).toHaveTextContent(/^Emitir nuevo comprobante$/);
  expect(within(d).getByLabelText('Cargar ítems desde una cotización')).toHaveValue('k1');
  expect(within(d).getByLabelText('Detalle del ítem 1')).toHaveValue('Cambio de aceite');
});

it('Cotizaciones: un servicio con ficha muestra un ojo que despliega, justo bajo la línea, lo que incluye con sus tiempos y sin precios', async () => {
  catalogo = { servicios: [servicioFicha], productos: [] };
  const original = cot('k1', 'COT-000001', 'VIGENTE');
  (original.detalles[0] as any).servicioId = 's1'; (original.detalles[0] as any).descripcion = 'Servicio express';
  const base = globalThis.fetch as unknown as (u: string, i?: RequestInit) => Promise<unknown>;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => (new URL(url).pathname === '/cotizaciones' && !init?.method ? { ok: true, status: 200, json: async () => [original] } : base(url, init))));
  window.location.hash = '#/cotizaciones';
  render(<App />);
  const fila = (await screen.findByText('COT-000001')).closest('tr')!;
  await userEvent.click(within(fila).getByRole('button', { name: 'Acciones' }));
  await userEvent.click(within(fila).getByRole('button', { name: 'Duplicar' }));
  const d = await screen.findByRole('dialog', { name: 'Emitir nueva cotización' });
  expect(within(d).queryByRole('group', { name: /Ficha de/ })).toBeNull();
  const ojo = await within(d).findByRole('button', { name: 'Ver ficha de Servicio express' });
  await userEvent.click(ojo);
  const ficha = within(d).getByRole('group', { name: 'Ficha de Servicio express' });
  expect(ficha).toHaveTextContent('Cambio de aceite y filtro de motor · 0.5 h');
  expect(ficha).not.toHaveTextContent(/S\/|precio/i);
  expect(ficha.closest('tr')!.previousElementSibling).toBe(within(d).getByLabelText('Detalle del ítem 1').closest('tr'));
  await userEvent.click(within(d).getByRole('button', { name: 'Ocultar ficha de Servicio express' }));
  expect(within(d).queryByRole('group', { name: /Ficha de/ })).toBeNull();
});
