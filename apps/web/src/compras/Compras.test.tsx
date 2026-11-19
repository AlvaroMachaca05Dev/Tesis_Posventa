// Compras, cuentas por cobrar y cuentas por pagar: tabla con filtros, modal de compra con validación y cobro/pago de saldos.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { diasParaVencer } from './Cuentas';
import { errorDeCompra } from './FormCompra';

const me = {
  usuario: { id: 'm', nombre: 'Administrador Demo', correo: 'admin@demo.local', organizacionId: 'o1' }, roles: ['Administrador'],
  permisos: { compras: 'A', cobrar: 'A', pagar: 'A' },
  menu: [{ id: 'compras', label: 'Compras y comprobantes', grupo: 'Egresos', nivel: 'A' }, { id: 'cobrar', label: 'Cuentas por cobrar', grupo: 'Ingresos', nivel: 'A' }, { id: 'pagar', label: 'Cuentas por pagar', grupo: 'Egresos', nivel: 'A' }],
  actuandoComo: false, esPlataforma: false, real: { id: 'm', nombre: 'Administrador Demo' },
};
const ayer = new Date(Date.now() - 3 * 86_400_000).toISOString();
const compra = (id: string, numero: string, extra: object = {}) => ({
  id, tipoDocumento: 'FACTURA', serie: 'F001', numero, codigo: `F001-${numero}`, fecha: ayer, condicion: 'CREDITO', fechaVencimiento: ayer, observaciones: null, estado: 'REGISTRADA',
  total: 500, pagado: 200, saldo: 300, local: { id: 'l1', nombre: 'Local Prohogar' }, proveedor: { id: 'p1', nombre: 'FILTROS DEL SUR SAC', documento: '20123456789', tipoDocumento: 'RUC' },
  detalles: [{ id: 'd1', productoId: 'x1', descripcion: 'Filtro de aceite', cantidad: 10, costo: 50, descuento: 0, total: 500 }],
  pagos: [{ id: 'pg1', fecha: ayer, metodo: 'Transferencia', concepto: 'Adelanto', valor: 200, registradoPor: 'Administrador Demo' }], registradaPor: 'Logístico Demo', anuladaPor: null, motivoAnulacion: null, ...extra,
});
const nota = (id: string, codigo: string, cliente: string, saldo: number) => ({
  id, codigo, serie: 'NV01', numero: 1, estado: 'EMITIDA', condicion: 'CREDITO', fechaEmision: ayer, fechaVencimiento: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  local: { id: 'l1', nombre: 'Local Prohogar' }, observaciones: null, comentario: null, orden: null,
  cliente: { id: cliente, nombre: cliente === 'c1' ? 'JOAQUIN DEL CARPIO' : 'MARIA ROJAS', documento: cliente === 'c1' ? '73867734' : '40112233', tipoDocumento: 'DNI', direccionFiscal: null, movil: null }, vehiculo: null,
  detalles: [], exonerada: 0, inafecta: 0, gravada: 0, igv: 0, total: 400, conDetraccion: false, detraccionPct: 0, detraccionExacta: 0, detraccion: 0,
  pagado: 400 - saldo, saldo, pagos: [], emitidaPor: 'Cajera Demo', anuladaPor: null, motivoAnulacion: null,
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
      'GET /me': me,
      'GET /compras': [compra('k1', '000123'), compra('k2', '000124', { condicion: 'CONTADO', pagado: 500, saldo: 0, proveedor: { id: 'p2', nombre: 'LUBRICANTES LIMA', documento: '20999888777', tipoDocumento: 'RUC' } })],
      'GET /compras/catalogos': { proveedores: [{ id: 'p1', nombre: 'FILTROS DEL SUR SAC', documento: '20123456789' }], productos: [{ id: 'x1', codigo: 'P001', nombre: 'Filtro de aceite', costo: 48, unidad: 'UND' }], locales: [{ id: 'l1', nombre: 'Local Prohogar' }], localId: 'l1', metodos: ['Efectivo', 'Yape', 'Transferencia', 'Tarjeta', 'Otro'] },
      'POST /compras': compra('k3', '000999', { total: 96, saldo: 0, condicion: 'CONTADO' }),
      'GET /cuentas-cobrar': [nota('n1', 'NV01-000010', 'c1', 300), nota('n2', 'NV01-000011', 'c1', 100), nota('n3', 'NV01-000012', 'c2', 50)],
      'POST /notas-venta/n1/cobros': nota('n1', 'NV01-000010', 'c1', 200),
      'GET /cuentas-pagar': [compra('k1', '000123')],
      'POST /compras/k1/pagos': compra('k1', '000123', { pagado: 500, saldo: 0 }),
    };
    return { ok: true, status: 200, json: async () => base[clave] ?? {} };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('Compras: lista con filtros por columna; «Ver» muestra ítems y pagos; la acción es Eliminar', async () => {
  window.location.hash = '#/compras';
  render(<App />);
  expect(await screen.findByText('F001-000123')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Filtrar Proveedor'), 'LUBRI');
  expect(screen.queryByText('F001-000123')).toBeNull();
  expect(screen.getByText('F001-000124')).toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText('Filtrar Proveedor'));
  const fila = screen.getByText('F001-000123').closest('tr')!;
  await userEvent.click(within(fila).getByRole('button', { name: 'Acciones' }));
  expect(within(fila).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  expect(within(fila).queryByRole('button', { name: 'Anular' })).toBeNull();
  await userEvent.click(within(fila).getByRole('button', { name: 'Ver' }));
  const d = await screen.findByRole('dialog', { name: 'Compra F001-000123' });
  expect(within(d).getByText('Filtro de aceite')).toBeInTheDocument();
  expect(within(d).getByText('Adelanto')).toBeInTheDocument();
});

it('Compras: el modal no envía datos inválidos y avisa; con datos correctos envía la compra al contado', async () => {
  window.location.hash = '#/compras';
  render(<App />);
  await screen.findByText('F001-000123');
  await userEvent.click(screen.getByRole('button', { name: '+ Nuevo' }));
  const d = await screen.findByRole('dialog', { name: 'Ingresar compra' });
  await userEvent.click(within(d).getByRole('button', { name: 'Guardar compra' }));
  expect(within(d).getByRole('alert')).toHaveTextContent('Elige el proveedor.');
  await userEvent.selectOptions(within(d).getByLabelText('Proveedor *'), 'p1');
  await userEvent.type(within(d).getByLabelText('Serie *'), "F0'1; DROP");
  expect(within(d).getByLabelText('Serie *')).toHaveValue('F01D');
  await userEvent.type(within(d).getByLabelText('Número *'), '12ab34');
  expect(within(d).getByLabelText('Número *')).toHaveValue('1234');
  await userEvent.click(within(d).getByRole('button', { name: 'Guardar compra' }));
  expect(within(d).getByRole('alert')).toHaveTextContent('Agrega al menos un producto');
  await userEvent.selectOptions(within(d).getByLabelText('Producto del ítem 1'), 'x1');
  expect(within(d).getByLabelText('Costo del ítem 1')).toHaveValue('48');
  await userEvent.clear(within(d).getByLabelText('Cantidad del ítem 1'));
  await userEvent.type(within(d).getByLabelText('Cantidad del ítem 1'), '-0');
  await userEvent.click(within(d).getByRole('button', { name: 'Guardar compra' }));
  expect(within(d).getByRole('alert')).toHaveTextContent('la cantidad debe ser mayor a cero');
  await userEvent.clear(within(d).getByLabelText('Cantidad del ítem 1'));
  await userEvent.type(within(d).getByLabelText('Cantidad del ítem 1'), '2');
  expect(within(d).getByText('Total S/ 96.00')).toBeInTheDocument();
  expect(posts).toHaveLength(0);
  await userEvent.click(within(d).getByRole('button', { name: 'Guardar compra' }));
  expect(await screen.findByText(/Compra F001-000999 registrada/)).toBeInTheDocument();
  expect(posts[0]).toMatchObject({ ruta: '/compras', cuerpo: { proveedorId: 'p1', localId: 'l1', serie: 'F01D', numero: '1234', condicion: 'CONTADO', metodo: 'Efectivo', items: [{ productoId: 'x1', cantidad: 2, costo: 48 }] } });
});

it('Cuentas por cobrar: agrupa por cliente con saldo y vencido; la cuenta cobra el comprobante elegido y no deja pasar del saldo', async () => {
  window.location.hash = '#/cobrar';
  render(<App />);
  const fila = (await screen.findByText('JOAQUIN DEL CARPIO')).closest('tr')!;
  expect(within(fila).getByText('S/ 400.00')).toBeInTheDocument();
  expect(screen.getByLabelText('Resumen de la cuenta')).toHaveTextContent('Saldo S/ 450.00');
  await userEvent.click(screen.getByRole('button', { name: 'Por comprobante' }));
  expect(await screen.findByText('NV01-000012')).toBeInTheDocument();
  expect(screen.getAllByText('Vence en 5 d').length).toBeGreaterThan(0);
  await userEvent.click(screen.getByRole('button', { name: 'Por cliente' }));
  const f2 = (await screen.findByText('JOAQUIN DEL CARPIO')).closest('tr')!;
  await userEvent.click(within(f2).getByRole('button', { name: 'Acciones' }));
  await userEvent.click(within(f2).getByRole('button', { name: 'Ver cuenta y cobrar' }));
  const d = await screen.findByRole('dialog', { name: 'Cuenta de JOAQUIN DEL CARPIO' });
  expect(within(d).getByText('NV01-000011')).toBeInTheDocument();
  expect(within(d).getByLabelText('Importe')).toHaveValue('300');
  await userEvent.clear(within(d).getByLabelText('Importe'));
  await userEvent.type(within(d).getByLabelText('Importe'), '999');
  await userEvent.click(within(d).getByRole('button', { name: 'Grabar' }));
  expect(within(d).getByRole('alert')).toHaveTextContent('supera el saldo');
  await userEvent.clear(within(d).getByLabelText('Importe'));
  await userEvent.type(within(d).getByLabelText('Importe'), '100');
  await userEvent.selectOptions(within(d).getByLabelText('Método'), 'Yape');
  await userEvent.click(within(d).getByRole('button', { name: 'Grabar' }));
  expect(await screen.findByText('Cobro de S/ 100.00 registrado en NV01-000010.')).toBeInTheDocument();
  expect(posts[0]).toEqual({ ruta: '/notas-venta/n1/cobros', cuerpo: { metodo: 'Yape', valor: 100 } });
});

it('Cuentas por pagar: muestra la compra vencida y registra el pago al proveedor', async () => {
  window.location.hash = '#/pagar';
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Por comprobante' }));
  const fila = (await screen.findByText('F001-000123')).closest('tr')!;
  expect(within(fila).getByText('Vencido hace 3 d')).toBeInTheDocument();
  await userEvent.click(within(fila).getByRole('button', { name: 'Acciones' }));
  await userEvent.click(within(fila).getByRole('button', { name: 'Pagar' }));
  const d = await screen.findByRole('dialog', { name: 'Cuenta de FILTROS DEL SUR SAC' });
  await userEvent.click(within(d).getByRole('button', { name: 'Grabar' }));
  expect(await screen.findByText('Pago de S/ 300.00 registrado en F001-000123.')).toBeInTheDocument();
  expect(posts[0]).toEqual({ ruta: '/compras/k1/pagos', cuerpo: { metodo: 'Efectivo', valor: 300 } });
});

it('reglas: días para vencer en hora de Lima y validación de la compra', () => {
  expect(diasParaVencer('2026-11-20T15:00:00.000Z', '2026-11-17T15:00:00.000Z')).toBe(3);
  expect(diasParaVencer('2026-11-17T04:00:00.000Z', '2026-11-17T15:00:00.000Z')).toBe(-1); // 16/11 en Lima
  const base = { proveedorId: 'p', localId: 'l', serie: 'F001', numero: '1', fecha: '2026-01-01', condicion: 'CONTADO', vence: '' };
  const l = (x: object) => [{ clave: 1, productoId: 'x', descripcion: '', cantidad: '1', costo: '10', descuento: '', ...x }];
  expect(errorDeCompra(base, l({}))).toBe('');
  expect(errorDeCompra({ ...base, serie: 'F0001' }, l({}))).toMatch(/serie/);
  expect(errorDeCompra({ ...base, fecha: '2999-01-01' }, l({}))).toMatch(/futura/);
  expect(errorDeCompra({ ...base, condicion: 'CREDITO', vence: '2025-01-01' }, l({}))).toMatch(/vencimiento/);
  expect(errorDeCompra(base, l({ costo: 'abc' }))).toMatch(/costo/);
  expect(errorDeCompra(base, l({ descuento: '11' }))).toMatch(/descuento/);
  expect(errorDeCompra(base, l({ cantidad: '1e9' }))).toMatch(/cantidad/);
});
