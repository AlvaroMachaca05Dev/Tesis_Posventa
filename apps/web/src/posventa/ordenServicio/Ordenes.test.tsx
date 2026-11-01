// Pantalla Órdenes de servicio (slice S3; DEC-61, 71, 72, 73, 80). Se escribe primero.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../../App';

type Peticion = { metodo: string; ruta: string; consulta: string; cuerpo: any };
const llamadas: Peticion[] = [];
let respuestas: Record<string, { status?: number; cuerpo: unknown }> = {};

const orden = {
  id: 'o1', codigo: '2026102800001', externa: false, estado: 'Recepcion', decision: 'Pendiente de aprobación', tipoAtencion: 'Mantenimiento preventivo',
  fechaInicio: '2026-10-28T10:00:00.000Z', fechaCierre: null, km: 64000, observaciones: 'Ruido', recomendaciones: null,
  cliente: { id: 'c1', nombre: 'JOAQUIN DEL CARPIO', documento: '73867734', tipoDocumento: 'DNI' },
  vehiculo: { id: 'v1', placa: 'B5W-165', marca: 'SUZUKI', modelo: 'JIMMY', anio: 2012, color: 'PLOMO', nroSerie: null, nroVin: 'VIN1', nroMotor: null },
  tecnico: null, jefeTaller: null, creadoPor: { id: 'u', nombre: 'Cajera Demo' },
  detalles: [{ id: 'd1', tipo: 'producto', descripcion: 'Aceite 5W-30', referencia: 'AMO-102', cantidad: 1, costo: 10, rentabilidadPct: 20, precio: 12, descuentoPct: 0, impuesto: 'IGV', total: 12 }],
  total: 12, abonos: [], totalAbonos: 0, pendiente: 12, comprobantes: [], conComprobante: false, ultimaBitacora: { texto: 'ODS creada', fecha: '2026-10-28T10:00:00.000Z', actor: 'Cajera Demo' }, bitacora: [],
};
const catalogos = { tiposAtencion: ['Mantenimiento preventivo', 'Garantía'], decisiones: ['Pendiente de aprobación', 'Aprobada para cotizar', 'Aprobada para comprar', 'No aprobada'], estados: [{ id: 'Recepcion', nombre: 'Recepción' }, { id: 'EnProceso', nombre: 'En proceso' }, { id: 'Entrega', nombre: 'Entrega' }, { id: 'Cerrada', nombre: 'Cerrado' }], metodosPago: ['Efectivo', 'Yape'], tecnicos: [{ id: 't1', nombre: 'Técnico Demo 1' }], jefes: [{ id: 'j1', nombre: 'Jefe de Taller Demo' }] };

const me = (nivel: 'A' | 'E' | 'V') => ({
  usuario: { id: 'u', nombre: 'Cajera Demo', correo: 'cajera@demo.local', organizacionId: 'o' },
  roles: ['Cajera'], permisos: { ods: nivel }, menu: [{ id: 'ods', label: 'Órdenes de servicio', grupo: 'General', nivel }],
  actuandoComo: false, esPlataforma: false, real: { id: 'u', nombre: 'Cajera Demo' },
});
function simular(nivel: 'A' | 'E' | 'V' = 'E') {
  llamadas.length = 0;
  respuestas = {};
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const metodo = (init?.method ?? 'GET').toUpperCase();
    const u = new URL(url);
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    llamadas.push({ metodo, ruta: u.pathname, consulta: u.search, cuerpo });
    const r = respuestas[`${metodo} ${u.pathname}`];
    if (r) return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.cuerpo };
    const base: Record<string, unknown> = { 'GET /me': me(nivel), 'GET /ordenes/catalogos': catalogos, 'GET /ordenes': [orden], 'GET /ordenes/o1': orden, 'GET /clientes': [{ ...orden.cliente, activo: true }], 'GET /vehiculos': [{ ...orden.vehiculo, cliente: orden.cliente, kmActual: 64000 }] };
    const clave = `${metodo} ${u.pathname}`;
    if (clave in base) return { ok: true, status: 200, json: async () => base[clave] };
    return { ok: true, status: 200, json: async () => orden };
  }));
}
beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'false');
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem('posventa-token', 't');
  window.location.hash = '#/ods';
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('Lista: tarjeta con consecutivo, «Sin comprobante», fechas, cliente, vehículo y botones de acción', async () => {
  simular();
  render(<App />);
  const t = (await screen.findByText('#2026102800001')).closest('article')!;
  expect(within(t).getByText('Sin comprobante')).toBeInTheDocument();
  expect(within(t).getByText(/Placa: B5W-165/)).toBeInTheDocument();
  expect(within(t).getByText(/JOAQUIN DEL CARPIO/)).toBeInTheDocument();
  for (const b of ['Facturar', 'Editar', 'Fechas de inicio y cierre', 'Estado de la orden', 'Bitácora', 'Registrar abono o pago', 'Imprimir', 'Eliminar']) expect(within(t).getByRole('button', { name: b })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Cerrado/ })).toBeInTheDocument();
});

it('Lista: la búsqueda rápida y el estado se envían al servidor', async () => {
  simular();
  render(<App />);
  await screen.findByText('#2026102800001');
  await userEvent.click(screen.getByRole('tab', { name: /En proceso/ }));
  await userEvent.type(screen.getByLabelText('Búsqueda rápida'), 'B5W');
  await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
  await waitFor(() => expect(llamadas.some((l) => l.ruta === '/ordenes' && l.consulta.includes('estado=EnProceso') && l.consulta.includes('q=B5W'))).toBe(true));
});

it('Editar: una sola pantalla con «Datos del comprobante», ítems, solo el TOTAL y los abonos; sin «Nuevos ítems» ni subtotales', async () => {
  simular();
  render(<App />);
  await userEvent.click(within((await screen.findByText('#2026102800001')).closest('article')!).getByRole('button', { name: 'Editar' }));
  const d = await screen.findByRole('dialog');
  expect(within(d).getByText('Datos del comprobante')).toBeInTheDocument();
  expect(within(d).getByLabelText('Técnico')).toBeInTheDocument();
  expect(within(d).getByLabelText('Jefe de taller (opcional)')).toBeInTheDocument();
  expect(within(d).getByDisplayValue('AMO-102')).toBeInTheDocument();
  expect(within(d).getByText('TOTAL')).toBeInTheDocument();
  expect(within(d).getByText('Abonos / pagos')).toBeInTheDocument();
  expect(within(d).queryByText(/Nuevos ítems/i)).toBeNull();
  expect(within(d).queryByText(/Base imponible|Subtotal/i)).toBeNull();
  expect(within(d).queryByRole('tab')).toBeNull();
  expect(within(d).queryByLabelText(/SOAT|Forma de pago|Requerimientos/i)).toBeNull();
  // 28/10: sin columna Impuesto ni Color; con Responsable, evidencias y estado del vehículo; estado y decisión en la cabecera
  expect(within(d).queryByRole('columnheader', { name: 'Impuesto' })).toBeNull();
  expect(within(d).getByRole('columnheader', { name: 'Responsable' })).toBeInTheDocument();
  expect(within(d).queryByText('Color')).toBeNull();
  expect(within(d).getByText('Evidencias de ingreso')).toBeInTheDocument();
  expect(within(d).getByRole('button', { name: /Estado del vehículo/ })).toBeInTheDocument();
});

it('Editar: «Datos del comprobante» se pliega y el estado del vehículo se guarda', async () => {
  simular();
  render(<App />);
  await userEvent.click(within((await screen.findByText('#2026102800001')).closest('article')!).getByRole('button', { name: 'Editar' }));
  const d = await screen.findByRole('dialog');
  await userEvent.click(within(d).getByRole('button', { name: /Datos del comprobante/ }));
  expect(within(d).queryByLabelText('Técnico')).toBeNull();
  await userEvent.click(within(d).getByRole('button', { name: /Estado del vehículo/ }));
  const e = await screen.findByRole('dialog', { name: 'Estado del vehículo' });
  await userEvent.selectOptions(within(e).getByLabelText('Nivel de combustible'), '1/2');
  await userEvent.click(within(e).getByLabelText('Rayado'));
  await userEvent.click(within(e).getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PATCH' && l.cuerpo?.estadoVehiculo?.combustible === '1/2' && l.cuerpo.estadoVehiculo.danos[0] === 'Rayado')).toBe(true));
});

it('Fechas: el botón está deshabilitado si no eres Superadministrador', async () => {
  simular();
  render(<App />);
  const t = (await screen.findByText('#2026102800001')).closest('article')!;
  expect(within(t).getByRole('button', { name: 'Fechas de inicio y cierre' })).toBeDisabled();
});

it('Editar: «+ Agregar ítem» y «Guardar cambios» envían los ítems con su referencia', async () => {
  simular();
  render(<App />);
  await userEvent.click(within((await screen.findByText('#2026102800001')).closest('article')!).getByRole('button', { name: 'Editar' }));
  const d = await screen.findByRole('dialog');
  await userEvent.click(within(d).getByRole('button', { name: '+ Agregar ítem' }));
  const detalles = within(d).getAllByLabelText('Detalle');
  await userEvent.type(detalles[1], 'Cambio de motor');
  await userEvent.click(within(d).getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT' && l.ruta === '/ordenes/o1/detalles')).toBe(true));
  const put = llamadas.find((l) => l.metodo === 'PUT')!.cuerpo.detalles;
  expect(put).toHaveLength(2);
  expect(put[0]).toMatchObject({ id: 'd1', referencia: 'AMO-102' });
  expect(put[1]).toMatchObject({ descripcion: 'Cambio de motor' });
});

it('Editar: el ojo oculta costo, rentabilidad y referencia (vista del cliente)', async () => {
  simular();
  render(<App />);
  await userEvent.click(within((await screen.findByText('#2026102800001')).closest('article')!).getByRole('button', { name: 'Editar' }));
  const d = await screen.findByRole('dialog');
  expect(within(d).getByRole('columnheader', { name: 'Costo' })).toBeInTheDocument();
  await userEvent.click(within(d).getByRole('button', { name: /Vista del cliente/ }));
  expect(within(d).queryByRole('columnheader', { name: 'Costo' })).toBeNull();
  expect(within(d).queryByDisplayValue('AMO-102')).toBeNull();
});

it('Estado: cerrar sin nota de venta muestra el aviso del servidor', async () => {
  simular();
  respuestas['PATCH /ordenes/o1'] = { status: 409, cuerpo: { message: 'Para cerrar sin nota de venta, la decisión del cliente debe ser «No aprobada».' } };
  render(<App />);
  await userEvent.click(within((await screen.findByText('#2026102800001')).closest('article')!).getByRole('button', { name: 'Estado de la orden' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Cerrado' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No aprobada');
});

it('Nueva orden: pide cliente, vehículo y tipo de atención y la crea', async () => {
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nueva orden' }));
  const d = await screen.findByRole('dialog');
  await userEvent.selectOptions(within(d).getByLabelText('Cliente'), 'c1');
  await userEvent.selectOptions(within(d).getByLabelText('Vehículo'), 'v1');
  await userEvent.selectOptions(within(d).getByLabelText('Tipo de atención'), 'Garantía');
  expect(within(d).getAllByLabelText('Detalle')).toHaveLength(1);
  expect(within(d).getByText('Evidencias de ingreso')).toBeInTheDocument();
  expect(within(d).getByText('Abonos / pagos')).toBeInTheDocument();
  await userEvent.click(within(d).getByRole('button', { name: 'Crear orden' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.ruta === '/ordenes')).toBe(true));
  expect(llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/ordenes')!.cuerpo).toMatchObject({ vehiculoId: 'v1', tipoAtencion: 'Garantía' });
});

it('Editar: el precio con coma decimal («12,50») se entiende y lo que no es número se ignora', async () => {
  simular();
  render(<App />);
  await userEvent.click(within((await screen.findByText('#2026102800001')).closest('article')!).getByRole('button', { name: 'Editar' }));
  const d = await screen.findByRole('dialog');
  const precio = within(d).getByLabelText('Precio unitario');
  await userEvent.clear(precio);
  await userEvent.type(precio, '12,5');
  await userEvent.tab();
  expect(within(d).getByText('TOTAL').parentElement).toHaveTextContent('S/ 12.50');
  await userEvent.type(within(d).getByLabelText('Precio unitario'), 'x');
  await userEvent.tab();
  expect(within(d).getByText('TOTAL').parentElement).toHaveTextContent('S/ 12.50');
});
