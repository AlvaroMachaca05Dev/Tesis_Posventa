// Pantallas Clientes y Vehículos (slice S2; DEC-69 y DEC-70). Se escriben primero.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

type Peticion = { metodo: string; ruta: string; consulta: string; cuerpo: any };
const llamadas: Peticion[] = [];
let respuestas: Record<string, { status?: number; cuerpo: unknown }> = {};

const cliente1 = { id: 'c1', tipoDocumento: 'DNI', documento: '73867734', nombre: 'JOAQUIN IGNACIO DEL CARPIO', nombreComercial: null, pais: 'PE', movil: '987654321', direccionFiscal: null, email: 'joaquin@demo.test', ubigeo: null, comentario: null, esGenerico: false, activo: true, creadoEn: '2026-10-14T16:26:54.000Z', vehiculos: 1 };
const varios = { ...cliente1, id: 'c2', tipoDocumento: 'DNI', documento: '0000', nombre: 'Clientes varios', movil: null, email: null, esGenerico: true, vehiculos: 0 };
const vehiculo1 = { id: 'v1', placa: 'B5W-165', marca: 'SUZUKI', modelo: 'JIMMY', anio: 2012, color: 'PLOMO NEGRO', nroSerie: null, nroVin: null, nroMotor: null, comentario: null, grupo: null, creadoEn: '2026-10-14T16:26:54.000Z', kmActual: 64000, cliente: { id: 'c1', nombre: 'JOAQUIN IGNACIO DEL CARPIO', documento: '73867734', tipoDocumento: 'DNI' } };
const config = { paisPredeterminado: 'PE', paises: [{ codigo: 'PE', nombre: 'Perú', prefijo: '+51' }, { codigo: 'CO', nombre: 'Colombia', prefijo: '+57' }] };
const marcas = [{ id: 'm1', nombre: 'KIA', modelos: ['PICANTO', 'RIO'] }, { id: 'm2', nombre: 'SUZUKI', modelos: ['JIMMY'] }];

const me = (nivel: 'A' | 'E' | 'V') => ({
  usuario: { id: 'm', nombre: 'Cajera Demo', correo: 'cajera@demo.local', organizacionId: 'o1' },
  roles: ['Cajera'],
  permisos: { clientes: nivel, vehiculos: nivel },
  menu: [
    { id: 'clientes', label: 'Clientes', grupo: 'Maestros', nivel },
    { id: 'vehiculos', label: 'Vehículos', grupo: 'Maestros', nivel },
  ],
  actuandoComo: false,
  esPlataforma: false,
  real: { id: 'm', nombre: 'Cajera Demo' },
});

function simular(nivel: 'A' | 'E' | 'V' = 'E') {
  llamadas.length = 0;
  respuestas = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = (init?.method ?? 'GET').toUpperCase();
      const u = new URL(url);
      const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
      llamadas.push({ metodo, ruta: u.pathname, consulta: u.search, cuerpo });
      const r = respuestas[`${metodo} ${u.pathname}`];
      if (r) return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.cuerpo };
      const base: Record<string, unknown> = {
        'GET /me': me(nivel),
        'GET /maestros/config': config,
        'GET /clientes': u.searchParams.get('q') === '738' ? [cliente1] : [cliente1, varios],
        'GET /vehiculos': [vehiculo1],
        'GET /marcas-vehiculo': marcas,
      };
      const clave = `${metodo} ${u.pathname}`;
      if (clave in base) return { ok: true, status: 200, json: async () => base[clave] };
      return { ok: true, status: 201, json: async () => ({ ok: true, id: 'nuevo' }) };
    }),
  );
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

// ───────── Clientes ─────────
it('Clientes: lista el documento, el nombre, el móvil con su prefijo y el estado', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  const fila = (await screen.findByText('JOAQUIN IGNACIO DEL CARPIO')).closest('tr')!;
  expect(within(fila).getByText('DNI 73867734')).toBeInTheDocument();
  expect(within(fila).getByText('+51 987654321')).toBeInTheDocument();
  expect(within(fila).getByText('Activo')).toBeInTheDocument();
  expect(screen.getByText('Clientes varios')).toBeInTheDocument();
});

it('Clientes: sin buscador general; cada columna tiene su filtro y el embudo admite más condiciones', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  await screen.findByText('Clientes varios');
  expect(screen.queryByLabelText('Buscar cliente')).toBeNull();
  await userEvent.type(screen.getByLabelText('Filtrar Documento'), '738');
  expect(screen.queryByText('Clientes varios')).toBeNull();
  await userEvent.clear(screen.getByLabelText('Filtrar Documento'));
  expect(screen.getByText('Clientes varios')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Más condiciones para Cliente' }));
  await userEvent.selectOptions(screen.getByLabelText('Primera condición'), 'nocontiene');
  await userEvent.type(screen.getByLabelText('Primer valor'), 'varios');
  await userEvent.click(screen.getByRole('button', { name: '🔍 Filtrar' }));
  expect(screen.queryByText('Clientes varios')).toBeNull();
});

it('Clientes: «+ Cliente» y «Editar» abren un modal centrado, sin bajar la tabla', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  await screen.findByText('Clientes varios');
  await userEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
  expect(screen.getByRole('dialog', { name: 'Editar cliente' })).toBeInTheDocument();
});

it('Clientes: «+ Cliente» propone Perú (+51), pide el móvil sin prefijo y envía los datos', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Cliente' }));
  expect(await screen.findByDisplayValue('Perú (+51)')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Número de documento'), '45678912');
  await userEvent.type(screen.getByLabelText('Razón social o nombre'), 'Ana Prueba');
  await userEvent.type(screen.getByLabelText('Móvil'), '987654321');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.ruta === '/clientes')).toBe(true));
  expect(llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/clientes')!.cuerpo).toMatchObject({ tipoDocumento: 'DNI', documento: '45678912', nombre: 'Ana Prueba', pais: 'PE', movil: '987654321' });
});

it('Clientes: al elegir otro país cambia el prefijo del móvil', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Cliente' }));
  expect(await screen.findByText('+51', { selector: '.prefijo' })).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('País'), 'CO');
  expect(screen.getByText('+57', { selector: '.prefijo' })).toBeInTheDocument();
});

it('Clientes: el tipo de documento ofrece solo DNI, Carné de extranjería y RUC', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Cliente' }));
  const opciones = within(screen.getByLabelText('Tipo de documento')).getAllByRole('option').map((o) => o.textContent);
  expect(opciones).toEqual(['DNI', 'Carné de extranjería', 'RUC']);
});

it('Clientes: con permiso solo de ver no aparecen «+ Cliente» ni Editar', async () => {
  window.location.hash = '#/clientes';
  simular('V');
  render(<App />);
  await screen.findByText('JOAQUIN IGNACIO DEL CARPIO');
  expect(screen.queryByRole('button', { name: '+ Cliente' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
});

it('Clientes: eliminar pide confirmación y envía activo=false; «Clientes varios» no se puede eliminar', async () => {
  window.location.hash = '#/clientes';
  simular();
  vi.stubGlobal('confirm', () => true);
  render(<App />);
  const fila = (await screen.findByText('JOAQUIN IGNACIO DEL CARPIO')).closest('tr')!;
  await userEvent.click(within(fila).getByRole('button', { name: 'Eliminar' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PATCH' && l.ruta === '/clientes/c1')).toBe(true));
  expect(llamadas.find((l) => l.metodo === 'PATCH')!.cuerpo).toEqual({ activo: false });
  const filaVarios = screen.getByText('Clientes varios').closest('tr')!;
  expect(within(filaVarios).queryByRole('button', { name: 'Eliminar' })).toBeNull();
});

// ───────── Vehículos ─────────
it('Vehículos: lista la placa, el vehículo, el titular con su documento y el kilometraje', async () => {
  window.location.hash = '#/vehiculos';
  simular();
  render(<App />);
  const fila = (await screen.findByText('B5W-165')).closest('tr')!;
  expect(within(fila).getByText('SUZUKI')).toBeInTheDocument();
  expect(within(fila).getByText('JIMMY')).toBeInTheDocument();
  expect(within(fila).getByText('2012')).toBeInTheDocument();
  expect(within(fila).getByText('JOAQUIN IGNACIO DEL CARPIO')).toBeInTheDocument();
  expect(within(fila).getByText('DNI 73867734')).toBeInTheDocument();
  expect(within(fila).getByText('64 000 km')).toBeInTheDocument();
});

it('Vehículos: al buscar el cliente por documento se ve su nombre y se envía su ID', async () => {
  window.location.hash = '#/vehiculos';
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Vehículo' }));
  await userEvent.type(screen.getByLabelText('Cliente (documento o nombre)'), '738');
  const opcion = await screen.findByRole('button', { name: /73867734.*JOAQUIN IGNACIO DEL CARPIO/ });
  await userEvent.click(opcion);
  expect(screen.getByLabelText('Cliente (documento o nombre)')).toHaveValue('73867734 · JOAQUIN IGNACIO DEL CARPIO');
  expect(screen.queryByText(/Cliente elegido/)).toBeNull();
  await userEvent.type(screen.getByLabelText('Placa'), 'ABC-123');
  await userEvent.selectOptions(screen.getByLabelText('Marca'), 'KIA');
  await userEvent.type(screen.getByLabelText('Nro. de VIN'), 'VIN123');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar vehículo' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.ruta === '/vehiculos')).toBe(true));
  expect(llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/vehiculos')!.cuerpo).toMatchObject({ clienteId: 'c1', placa: 'ABC-123', marca: 'KIA', nroVin: 'VIN123' });
});

it('Vehículos: si la placa ya existe muestra el aviso del servidor con el titular', async () => {
  window.location.hash = '#/vehiculos';
  simular();
  respuestas['POST /vehiculos'] = { status: 409, cuerpo: { message: 'La placa B5W-165 ya existe y pertenece a JOAQUIN IGNACIO DEL CARPIO (documento 73867734).' } };
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Vehículo' }));
  await userEvent.type(screen.getByLabelText('Cliente (documento o nombre)'), '738');
  await userEvent.click(await screen.findByRole('button', { name: /73867734/ }));
  await userEvent.type(screen.getByLabelText('Placa'), 'b5w165');
  await userEvent.selectOptions(screen.getByLabelText('Marca'), 'SUZUKI');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar vehículo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('ya existe y pertenece a JOAQUIN IGNACIO DEL CARPIO');
});

it('Vehículos: sin cliente elegido no se envía el formulario', async () => {
  window.location.hash = '#/vehiculos';
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Vehículo' }));
  await userEvent.type(screen.getByLabelText('Placa'), 'ABC-123');
  await userEvent.selectOptions(screen.getByLabelText('Marca'), 'KIA');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar vehículo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Elige el cliente');
  expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
});

it('Vehículos: «Registrar km» guarda la lectura del kilometraje', async () => {
  window.location.hash = '#/vehiculos';
  simular();
  render(<App />);
  const fila = (await screen.findByText('B5W-165')).closest('tr')!;
  await userEvent.click(within(fila).getByRole('button', { name: 'Registrar km' }));
  await userEvent.type(screen.getByLabelText('Kilometraje'), '70000');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar lectura' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.ruta === '/vehiculos/v1/lecturas')).toBe(true));
  expect(llamadas.find((l) => l.ruta === '/vehiculos/v1/lecturas')!.cuerpo).toMatchObject({ km: 70000, fuente: 'Llamada' });
});
