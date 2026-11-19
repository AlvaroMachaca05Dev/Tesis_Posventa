// Línea temporal (S7): vehículo recordado, alternativas excluyentes, HTML inyectado como texto, datos vacíos o rotos y cotización por paquete.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

const me = {
  usuario: { id: 'm', nombre: 'Cajera Demo', correo: 'cajera@demo.local', organizacionId: 'o1' }, roles: ['Cajera'],
  permisos: { timeline: 'E' }, menu: [{ id: 'timeline', label: 'Línea temporal', grupo: 'General', nivel: 'E' }],
  actuandoComo: false, esPlataforma: false, real: { id: 'm', nombre: 'Cajera Demo' },
};
const L = (n: string, c: string, alt?: string) => ({ n, h: 0.25, c, ...(alt ? { alt } : {}) });
const exp = [L('Cambio de aceite y filtro de motor', 'Motor y lubricación'), L('Revisión de batería', 'Eléctrico, escáner y pruebas')];
const afin = [L('Revisión de bobinas y chicotes', 'Encendido y afinamiento'), L('Limpieza y mantenimiento de carburador', 'Encendido y afinamiento', 'afin'), L('Limpieza de inyectores y obturador / IAC', 'Encendido y afinamiento', 'afin')];
let datos: Record<string, unknown>;
const base = () => ({
  vehiculo: { id: 'v1', placa: 'ABC-123', marca: 'KIA', modelo: 'RIO', anio: 2020, uso: null, aceite: null, grupo: 'G1', cliente: { id: 'c1', nombre: '<img src=x onerror=alert(1)>', telefono: null } },
  plan: { id: 'p', codigo: 'GP-S', nombre: 'Gasolina · uso particular · sintético', combustible: 'Gasolina', uso: 'Particular', aceite: 'S', km: 7500, meses: 6, visitas: 4, horizonte: 1 },
  porConfirmar: true, asignado: false,
  resumen: { ultimaVisita: { km: 50000, fecha: '2026-08-20', codigo: 'X1' }, kmHoy: 52000, rate: 1000, hoy: '2026-11-19' },
  pasadas: [{ clave: 'p2026-08', mes: '2026-08', km: 50000, fecha: '2026-08-20', paquete: 'SV094', ordenes: [{ id: 'o1', codigo: '<script>x</script>', fecha: '2026-08-20', km: 50000, servicios: ['Cambio de aceite y filtro de motor'] }], esperadas: exp, hechos: ['Cambio de aceite y filtro de motor'] }],
  futuras: [
    { clave: 'f1', k: 1, paquete: 'SV094', nombre: 'Servicio express', afinamiento: false, km: 57500, fecha: '2027-02-20', vencido: false, porVencer: false, lineas: exp },
    { clave: 'f2', k: 2, paquete: 'SV095', nombre: 'Mantenimiento menor', afinamiento: true, km: 65000, fecha: '2027-08-20', vencido: false, porVencer: false, lineas: [...exp, ...afin] },
  ],
  tramos: [{ codigo: 'GP-S', desde: { fecha: '2026-08-20', km: 50000 }, corte: null, por: null, hasta: null }],
  precios: { SV094: { id: 's94', codigo: 'SV094', nombre: 'Servicio express', horas: 0.75, precio: 40 }, SV095: { id: 's95', codigo: 'SV095', nombre: 'Mantenimiento menor', horas: 1.75, precio: 90 }, SV096: null, SV071: { id: 's71', codigo: 'SV071', nombre: 'Afinamiento (carburado)', horas: 2.5, precio: 140 }, SV072: { id: 's72', codigo: 'SV072', nombre: 'Afinamiento (inyección)', horas: 3, precio: 140 } },
  categorias: ['Motor y lubricación', 'Eléctrico, escáner y pruebas', 'Encendido y afinamiento'],
});
const posts: { ruta: string; cuerpo: any }[] = [];

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'false');
  sessionStorage.clear(); localStorage.clear(); sessionStorage.setItem('posventa-token', 't');
  localStorage.setItem('lt-vehiculo', 'v1');
  posts.length = 0; datos = base();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url); const clave = `${(init?.method ?? 'GET').toUpperCase()} ${u.pathname}`;
    if (init?.method === 'POST' || init?.method === 'PATCH') posts.push({ ruta: u.pathname, cuerpo: JSON.parse(String(init.body)) });
    const r: Record<string, unknown> = { 'GET /me': me, 'GET /vehiculos/v1/linea-temporal': datos, 'POST /cotizaciones': { codigo: 'COT-000009' }, 'PATCH /vehiculos/v1': {} };
    return { ok: true, status: 200, json: async () => r[clave] ?? {} };
  }));
  window.location.hash = '#/timeline';
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('abre el último vehículo visto y muestra el HTML inyectado como texto', async () => {
  render(<App />);
  await screen.findAllByText('GP-S');
  expect(document.querySelector('.lt-chip')?.textContent).toContain('ript>');
  expect(document.querySelector('img[src="x"]')).toBeNull();
  expect(document.querySelector('script:not([src])')?.textContent ?? '').not.toContain('x');
});

it('en detalle, elegir carburador bloquea inyección', async () => {
  render(<App />);
  await screen.findAllByText('GP-S');
  await userEvent.click(screen.getByRole('button', { name: 'Detalle' }));
  await userEvent.click(screen.getByLabelText('Limpieza y mantenimiento de carburador en 65000 km'));
  expect(screen.getByLabelText('Limpieza de inyectores y obturador / IAC en 65000 km')).toBeDisabled();
});

it('marcar toda la visita no elige alternativas y agrupar por paquete crea menor y afinamiento de carburador', async () => {
  render(<App />);
  await screen.findAllByText('GP-S');
  await userEvent.click(screen.getByLabelText('Seleccionar la visita de 65000 km'));
  expect(document.querySelector('.lt-cnt')?.textContent).toMatch(/^3 /);
  await userEvent.click(screen.getByRole('button', { name: 'Detalle' }));
  await userEvent.click(screen.getByLabelText('Limpieza y mantenimiento de carburador en 65000 km'));
  await userEvent.click(screen.getByRole('button', { name: /Agregar a\s*cotización/ }));
  const d = await screen.findByRole('dialog', { name: 'Cómo generar la cotización' });
  await userEvent.click(within(d).getByRole('button', { name: 'Agrupar por paquete' }));
  const c = posts.find((p) => p.ruta === '/cotizaciones')!;
  expect(c.cuerpo.items.map((i: { descripcion: string }) => i.descripcion)).toEqual(['Mantenimiento menor', 'Afinamiento (carburado)']);
  expect(await screen.findByText(/COT-000009/)).toBeInTheDocument();
});

it('uso y aceite sin asignar: borrador y Guardar con alerta; con datos asignados quedan congelados', async () => {
  const { unmount } = render(<App />);
  await screen.findAllByText('GP-S');
  const guardar = screen.getByRole('button', { name: 'Guardar' });
  expect(guardar).toBeDisabled();
  await userEvent.selectOptions(screen.getByLabelText('Uso'), 'Particular');
  await userEvent.selectOptions(screen.getByLabelText('Aceite'), 'Sintético');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  const a = await screen.findByRole('alertdialog', { name: 'Guardar en el vehículo' });
  await userEvent.click(within(a).getByRole('button', { name: 'Guardar' }));
  expect(posts.find((p) => p.ruta === '/vehiculos/v1')?.cuerpo).toEqual({ uso: 'Particular', aceite: 'Sintético' });
  unmount();
  datos = { ...base(), asignado: true };
  render(<App />);
  await screen.findAllByText('GP-S');
  expect(screen.getByLabelText('Uso')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
});

it('sin plan, sin visitas o con datos vacíos no se rompe', async () => {
  datos = { ...base(), plan: null, futuras: [], pasadas: [], tramos: [], categorias: [] };
  render(<App />);
  expect(await screen.findByText(/no tiene plan/)).toBeInTheDocument();
});
