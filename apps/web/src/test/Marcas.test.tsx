// Módulo Marcas de vehículo: lista con sus modelos, alta con modelos y edición.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

const me = {
  usuario: { id: 'm', nombre: 'Administrador Demo', correo: 'admin@demo.local', organizacionId: 'o1' }, roles: ['Administrador'],
  permisos: { marcasv: 'A' }, menu: [{ id: 'marcasv', label: 'Marcas de vehículo', grupo: 'Maestros', nivel: 'A' }],
  actuandoComo: false, esPlataforma: false, real: { id: 'm', nombre: 'Administrador Demo' },
};
const llamadas: { metodo: string; ruta: string; cuerpo: any }[] = [];

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'false');
  sessionStorage.clear(); localStorage.clear(); sessionStorage.setItem('posventa-token', 't');
  llamadas.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url); const metodo = (init?.method ?? 'GET').toUpperCase(); const clave = `${metodo} ${u.pathname}`;
    if (metodo !== 'GET') llamadas.push({ metodo, ruta: u.pathname, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const base: Record<string, unknown> = {
      'GET /me': me, 'GET /marcas-vehiculo': [{ id: 'm1', nombre: 'KIA', modelos: ['PICANTO', 'RIO'] }, { id: 'm2', nombre: 'SUZUKI', modelos: [] }],
      'POST /marcas-vehiculo': { id: 'm3', nombre: 'TOYOTA', modelos: [] },
    };
    return { ok: true, status: 200, json: async () => base[clave] ?? { id: 'm1', nombre: 'KIA', modelos: [] } };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('Marcas: lista cada marca con sus modelos y la cantidad', async () => {
  window.location.hash = '#/marcasv';
  render(<App />);
  const kia = (await screen.findByText('KIA')).closest('tr')!;
  expect(within(kia).getByText('PICANTO, RIO')).toBeInTheDocument();
  expect(within(kia).getByText('2')).toBeInTheDocument();
});

it('Marcas: «+ Nuevo» crea la marca y le guarda sus modelos; «Editar» cambia el nombre y los modelos', async () => {
  window.location.hash = '#/marcasv';
  render(<App />);
  await screen.findByText('KIA');
  await userEvent.click(screen.getByRole('button', { name: '+ Nuevo' }));
  let d = await screen.findByRole('dialog', { name: 'Nuevo marca' });
  await userEvent.type(within(d).getByLabelText('Marca *'), 'TOYOTA');
  await userEvent.type(within(d).getByLabelText('Modelos (uno por línea)'), 'YARIS{enter}HILUX');
  await userEvent.click(within(d).getByRole('button', { name: 'Guardar' }));
  await vi.waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH' && l.ruta === '/marcas-vehiculo/m3')?.cuerpo).toEqual({ modelos: ['YARIS', 'HILUX'] }));
  const suzuki = (await screen.findByText('SUZUKI')).closest('tr')!;
  await userEvent.click(within(suzuki).getByRole('button', { name: 'Acciones' }));
  await userEvent.click(within(suzuki).getByRole('button', { name: 'Editar' }));
  d = await screen.findByRole('dialog', { name: 'Editar marca' });
  await userEvent.type(within(d).getByLabelText('Modelos (uno por línea)'), 'JIMMY');
  await userEvent.click(within(d).getByRole('button', { name: 'Guardar' }));
  await vi.waitFor(() => expect(llamadas.find((l) => l.ruta === '/marcas-vehiculo/m2')?.cuerpo).toEqual({ nombre: 'SUZUKI', modelos: ['JIMMY'] }));
});
