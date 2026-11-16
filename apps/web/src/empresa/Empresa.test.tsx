// Configuración de la empresa: datos, impresión y series por local (DEC-101).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

type Peticion = { metodo: string; ruta: string; cuerpo: any };
const llamadas: Peticion[] = [];
const empresa = {
  nombre: 'Taller Demo', razonSocial: null, ruc: '20123456789', direccion: 'Av. Principal 123', telefono: '999888777', correo: 'correo@taller.test', lema: 'BIENVENIDO',
  cuentasBancarias: 'BANCO DEMO 000', terminosRecepcion: '1. Cláusula.', pieTicket: 'Gracias', anchoTicketMm: 80,
  locales: [
    { id: 'l1', nombre: 'Local Prohogar', direccion: null, telefono: null, serieNotaVenta: 'NV01', serieBoleta: 'B001', serieFactura: 'F001' },
    { id: 'l2', nombre: 'Local Unión', direccion: null, telefono: null, serieNotaVenta: 'NV02', serieBoleta: 'B002', serieFactura: 'F002' },
  ],
};
const me = (nivel: 'A' | 'V') => ({
  usuario: { id: 'u', nombre: 'Administrador Demo', correo: 'admin@demo.local', organizacionId: 'o1' }, roles: ['Administrador'], permisos: { ajustes: nivel },
  menu: [{ id: 'ajustes', label: 'Empresa y parámetros', grupo: 'Configuración', nivel }], actuandoComo: false, esPlataforma: false, real: { id: 'u', nombre: 'Administrador Demo' },
});
function simular(nivel: 'A' | 'V' = 'A') {
  llamadas.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const metodo = (init?.method ?? 'GET').toUpperCase();
    const ruta = new URL(url).pathname;
    llamadas.push({ metodo, ruta, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    return { ok: true, status: 200, json: async () => (ruta === '/me' ? me(nivel) : empresa) };
  }));
}
beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'false');
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem('posventa-token', 't');
  window.location.hash = '#/ajustes';
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('muestra tres pestañas y guarda los datos de la empresa', async () => {
  simular();
  render(<App />);
  expect(await screen.findByRole('tab', { name: 'Datos de la empresa' })).toHaveAttribute('aria-selected', 'true');
  for (const t of ['Impresión', 'Locales y series']) expect(screen.getByRole('tab', { name: t })).toBeInTheDocument();
  const razon = await screen.findByLabelText('Razón social');
  await userEvent.type(razon, 'Taller Demo S.A.C.');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH' && l.ruta === '/empresa')?.cuerpo).toMatchObject({ nombre: 'Taller Demo', razonSocial: 'Taller Demo S.A.C.', ruc: '20123456789' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Datos de la empresa guardados.');
});

it('Impresión guarda el ancho del ticket, el pie, las cuentas y los términos', async () => {
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Impresión' }));
  const ancho = await screen.findByLabelText('Ancho del ticket (mm) *');
  await userEvent.clear(ancho);
  await userEvent.type(ancho, '58');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({ anchoTicketMm: 58, pieTicket: 'Gracias', cuentasBancarias: 'BANCO DEMO 000', terminosRecepcion: '1. Cláusula.' }));
});

it('Locales y series: cada local guarda sus series en mayúsculas', async () => {
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Locales y series' }));
  const serie = await screen.findByLabelText('Serie de boleta de Local Unión');
  expect(serie).toHaveValue('B002');
  await userEvent.clear(serie);
  await userEvent.type(serie, 'b009');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar Local Unión' }));
  await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH' && l.ruta === '/empresa/locales/l2')?.cuerpo).toMatchObject({ serieBoleta: 'B009', serieNotaVenta: 'NV02' }));
});

it('con permiso solo de ver no hay botón Guardar y los campos están bloqueados', async () => {
  simular('V');
  render(<App />);
  expect(await screen.findByLabelText('Razón social')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
  expect(within(screen.getByRole('tablist')).getAllByRole('tab')).toHaveLength(3);
});
