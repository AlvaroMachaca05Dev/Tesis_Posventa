// Pantallas del slice S5: proveedores, grupos con precios por grupo y la ODS con catálogo y solapamiento (CP-60).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

type Peticion = { metodo: string; ruta: string; consulta: string; cuerpo: any };
const llamadas: Peticion[] = [];

const menu = [
  { id: 'ods', label: 'Órdenes de servicio', grupo: 'General', nivel: 'A' },
  { id: 'proveedores', label: 'Proveedores', grupo: 'Maestros', nivel: 'A' },
  { id: 'grupos', label: 'Grupos de vehículos', grupo: 'Maestros', nivel: 'A' },
  { id: 'solapes', label: 'Solapamientos de servicios', grupo: 'Maestros', nivel: 'A' },
  { id: 'catalogo', label: 'Productos y servicios', grupo: 'Inventario', nivel: 'A' },
];
const me = { usuario: { id: 'u', nombre: 'Administrador Demo', correo: 'admin@demo.local', organizacionId: 'o' }, roles: ['Administrador'], permisos: Object.fromEntries(menu.map((m) => [m.id, 'A'])), menu, actuandoComo: false, esPlataforma: false, real: { id: 'u', nombre: 'Administrador Demo' } };
const proveedor = { id: 'p1', tipoDocumento: 'RUC', documento: '20000000001', nombre: 'Lubricantes Demo S.A.C.', contacto: null, telefono: null, correo: null, direccion: null, rubro: 'Lubricantes', activo: true, creadoEn: '2026-11-05T10:00:00.000Z' };
const grupos = [{ id: 'g2', codigo: 'N2', nombre: 'Nivel de tiempo 2', descripcion: null, activo: true, vehiculos: 3, reglas: 4, familias: 2 }];
const tabla = { grupos: ['N2'], filas: [{ servicioId: 's1', codigo: 'COR', nombre: 'CAMBIO DE CORREA DE DISTRIBUCION', estandar: { horas: 3.5, precio: 80 }, porGrupo: { N2: { horas: 4, precio: 100 } } }] };
const vehiculo = { id: 'v1', grupo: 'N2', placa: 'DEM-679', marca: 'KIA', modelo: 'PICANTO', anio: 2017, color: null, nroSerie: null, nroVin: null, nroMotor: 'G3LA', cliente: { id: 'c1', nombre: 'Clientes varios', documento: '0000', tipoDocumento: 'DNI' }, kmActual: 290200 };
const orden = {
  id: 'o1', codigo: '2026110500001', externa: false, estado: 'Recepcion', decision: 'Pendiente de aprobación', tipoAtencion: 'Mantenimiento correctivo', fechaInicio: '2026-11-05T10:00:00.000Z', fechaCierre: null, km: null,
  observaciones: null, recomendaciones: null, cliente: vehiculo.cliente, vehiculo, tecnico: null, jefeTaller: null, creadoPor: { id: 'u', nombre: 'Administrador Demo' },
  detalles: [{ id: 'd1', tipo: 'servicio', descripcion: 'CAMBIO DE CORREA DE DISTRIBUCION', referencia: null, cantidad: 4, costo: null, rentabilidadPct: null, precio: 100, descuentoPct: 0, impuesto: 'IGV', total: 100, servicioId: 's1', precioGrupo: 100, horas: 4, descuentoMonto: 0, solapamientoId: null }],
  total: 100, abonos: [], totalAbonos: 0, pendiente: 100, solapamientosMantenidos: [], comprobantes: [], conComprobante: false, ultimaBitacora: null, bitacora: [],
};
const catalogos = { tiposAtencion: ['Mantenimiento correctivo'], decisiones: ['Pendiente de aprobación'], estados: [{ id: 'Recepcion', nombre: 'Recepción' }, { id: 'Cerrada', nombre: 'Cerrado' }], metodosPago: ['Efectivo'], tecnicos: [], jefes: [], logisticos: [], cajeras: [] };
const catalogoOds = { servicios: [{ id: 's1', codigo: 'COR', nombre: 'CAMBIO DE CORREA DE DISTRIBUCION', categoria: null, horas: 4, precio: 100, grupo: 'N2', repuestos: [] }, { id: 's2', codigo: 'BOM', nombre: 'CAMBIO DE BOMBA DE AGUA', categoria: null, horas: 1.5, precio: 30, grupo: 'N2', repuestos: [] }], productos: [] };

function simular(extra: Record<string, unknown> = {}) {
  llamadas.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const metodo = (init?.method ?? 'GET').toUpperCase();
    const u = new URL(url);
    const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    llamadas.push({ metodo, ruta: u.pathname, consulta: u.search, cuerpo });
    const base: Record<string, unknown> = {
      'GET /me': me, 'GET /proveedores': [proveedor], 'POST /proveedores': { ...proveedor, id: 'p2' }, 'GET /grupos': grupos, 'GET /reglas-precio': [], 'GET /precios-por-grupo': tabla, 'GET /familias-motor': [],
      'GET /ordenes/catalogos': catalogos, 'GET /ordenes': [orden], 'GET /ordenes/o1': orden, 'GET /clientes': [{ ...vehiculo.cliente, activo: true }], 'GET /vehiculos': [vehiculo], 'GET /catalogo-ods': catalogoOds,
      'GET /precio-servicio': { servicioId: 's2', codigo: 'BOM', nombre: 'CAMBIO DE BOMBA DE AGUA', grupo: 'N2', horas: 1.5, precio: 30, traza: ['Estándar BOM: 2 h, S/ 40', 'SERVICIO N2-BOM (SUMAR): 1.5 h, S/ 30'] },
      'POST /solapamientos/evaluar': [{ clave: 'sol1:s2', solapamientoId: 'sol1', codigo: 'SOL-01', modo: 'OPCIONAL', indiceBase: 0, indiceReducido: 1, monto: 30, alerta: 'Correa de distribución y bomba de agua se hacen juntas. Puedes descontar hasta S/ 30 en la bomba, si deseas.' }],
      ...extra,
    };
    const clave = `${metodo} ${u.pathname}`;
    return { ok: true, status: 200, json: async () => (clave in base ? base[clave] : orden) };
  }));
}
beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'false');
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem('posventa-token', 't');
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('Proveedores: tabla con filtros por columna y modal centrado de dos columnas para crear', async () => {
  window.location.hash = '#/proveedores';
  simular();
  render(<App />);
  expect(await screen.findByText('Lubricantes Demo S.A.C.')).toBeInTheDocument();
  expect(screen.getByLabelText('Filtrar Proveedor')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '+ Proveedor' }));
  const modal = screen.getByRole('dialog', { name: 'Nuevo proveedor' });
  expect(modal.querySelector('.dos-col')).not.toBeNull();
  await userEvent.type(within(modal).getByLabelText('Número de documento'), '20123456789');
  await userEvent.type(within(modal).getByLabelText('Razón social o nombre'), 'Repuestos Demo');
  await userEvent.click(within(modal).getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.ruta === '/proveedores' && l.cuerpo.documento === '20123456789' && l.cuerpo.tipoDocumento === 'RUC')).toBe(true));
});

it('Grupos: pestañas de grupos, reglas, precios por grupo y familias; la tabla muestra el precio de cada grupo', async () => {
  window.location.hash = '#/grupos';
  simular();
  render(<App />);
  expect(await screen.findByText('Nivel de tiempo 2')).toBeInTheDocument();
  for (const t of ['Grupos', 'Reglas de precio', 'Precios por grupo', 'Familias de motor']) expect(screen.getByRole('tab', { name: t })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Precios por grupo' }));
  expect(await screen.findByText('S/ 100.00 · 4 h')).toBeInTheDocument();
  expect(screen.getByText('S/ 80.00 · 3.5 h')).toBeInTheDocument();
});

it('ODS: el servicio del catálogo toma el precio del grupo y el solapamiento opcional se aplica desde la alerta', async () => {
  window.location.hash = '#/ods';
  simular();
  render(<App />);
  await userEvent.click(within((await screen.findByText('#2026110500001')).closest('article')!).getByRole('button', { name: 'Editar' }));
  await userEvent.click(screen.getByRole('button', { name: '+ Agregar ítem' }));
  const detalles = screen.getAllByLabelText('Detalle');
  fireEvent.change(detalles[1], { target: { value: 'BOM · CAMBIO DE BOMBA DE AGUA' } });
  await waitFor(() => expect((screen.getAllByLabelText('Precio unitario')[1] as HTMLInputElement).value).toBe('30'));
  const alerta = await screen.findByRole('status', { name: 'Solapamiento de servicios' });
  expect(within(alerta).getByText(/Puedes descontar hasta S\/ 30/)).toBeInTheDocument();
  await userEvent.click(within(alerta).getByRole('button', { name: 'Aplicar S/ 30.00' }));
  expect(screen.getByText('S/ 100.00', { selector: '.total-ods b' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => {
    const put = llamadas.find((l) => l.metodo === 'PUT' && l.ruta === '/ordenes/o1/detalles');
    expect(put?.cuerpo.detalles[1]).toMatchObject({ servicioId: 's2', solapamientoId: 'sol1', descuentoMonto: 30 });
  });
});
