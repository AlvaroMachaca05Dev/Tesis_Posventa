// Pantallas Clientes y Vehículos (slice S2; DEC-69 y DEC-70). Se escriben primero.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

type Peticion = { metodo: string; ruta: string; consulta: string; cuerpo: any };
const llamadas: Peticion[] = [];
let respuestas: Record<string, { status?: number; cuerpo: unknown }> = {};

const cliente1 = { id: 'c1', tipoDocumento: 'DNI', documento: '73867734', nombre: 'JOAQUIN IGNACIO DEL CARPIO', nombreComercial: null, pais: 'PE', movil: '987654321', direccionFiscal: null, email: 'joaquin@demo.test', contacto: null, ubigeo: null, comentario: null, esGenerico: false, activo: true, creadoEn: '2026-10-14T16:26:54.000Z', vehiculos: 1 };
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
  expect(within(fila).getByText('73867734')).toBeInTheDocument();
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
  await userEvent.type(screen.getByLabelText('Filtrar Número de documento'), '738');
  expect(screen.queryByText('Clientes varios')).toBeNull();
  await userEvent.clear(screen.getByLabelText('Filtrar Número de documento'));
  expect(screen.getByText('Clientes varios')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Más condiciones para Cliente' }));
  await userEvent.selectOptions(screen.getByLabelText('Primera condición'), 'nocontiene');
  await userEvent.type(screen.getByLabelText('Primer valor'), 'varios');
  await userEvent.click(screen.getByRole('button', { name: '🔍 Filtrar' }));
  expect(screen.queryByText('Clientes varios')).toBeNull();
});

it('Clientes: «+ Nuevo» y «Editar» abren un modal centrado, sin bajar la tabla', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  await screen.findByText('Clientes varios');
  await userEvent.click(screen.getAllByRole('button', { name: 'Acciones' })[0]);
  await userEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
  expect(screen.getByRole('dialog', { name: 'Editar cliente' })).toBeInTheDocument();
});

it('Clientes: «+ Nuevo» propone Perú (+51), pide el móvil sin prefijo y envía los datos', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  expect(await screen.findByDisplayValue('Perú (+51)')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Número de documento *'), '45678912');
  await userEvent.type(screen.getByLabelText('Razón social o nombre'), 'Ana Prueba');
  await userEvent.type(screen.getByLabelText('Móvil'), '987654321');
  await userEvent.type(screen.getByLabelText('Nombre de contacto (solo si es una empresa)'), 'Ana Contacto');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.ruta === '/clientes')).toBe(true));
  expect(llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/clientes')!.cuerpo).toMatchObject({ tipoDocumento: 'DNI', documento: '45678912', nombre: 'Ana Prueba', pais: 'PE', movil: '987654321', contacto: 'Ana Contacto' });
});

// El modal de cliente y el de proveedor son el mismo formulario: mismos campos y en el mismo orden.
const CAMPOS_TERCERO = ['Tipo de documento *', 'Número de documento *', 'Razón social o nombre', 'Nombre comercial', 'País', 'Móvil', 'Dirección fiscal', 'Correo', 'Nombre de contacto (solo si es una empresa)', 'Comentario'];
it('Clientes: el modal trae los mismos campos que el de proveedores', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  const modal = await screen.findByRole('dialog', { name: 'Nuevo cliente' });
  expect([...modal.querySelectorAll('.campo > label')].map((l) => l.textContent)).toEqual(CAMPOS_TERCERO);
});

it('Clientes: al elegir otro país cambia el prefijo del móvil', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  expect(await screen.findByText('+51', { selector: '.prefijo' })).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('País'), 'CO');
  expect(screen.getByText('+57', { selector: '.prefijo' })).toBeInTheDocument();
});

it('Clientes: el tipo de documento ofrece solo DNI, Carné de extranjería y RUC', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  const opciones = within(screen.getByLabelText('Tipo de documento *')).getAllByRole('option').map((o) => o.textContent);
  expect(opciones).toEqual(['DNI', 'Carné de extranjería', 'RUC']);
});

it('Clientes: con permiso solo de ver no aparecen «+ Nuevo» ni Editar', async () => {
  window.location.hash = '#/clientes';
  simular('V');
  render(<App />);
  await screen.findByText('JOAQUIN IGNACIO DEL CARPIO');
  expect(screen.queryByRole('button', { name: '+ Nuevo' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
});

it('Clientes: eliminar pide confirmación y envía activo=false; «Clientes varios» no se puede eliminar', async () => {
  window.location.hash = '#/clientes';
  simular();
  vi.stubGlobal('confirm', () => true);
  render(<App />);
  const fila = (await screen.findByText('JOAQUIN IGNACIO DEL CARPIO')).closest('tr')!;
  await userEvent.click(within(fila).getByRole('button', { name: 'Acciones' }));
  await userEvent.click(within(fila).getByRole('button', { name: 'Eliminar' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PATCH' && l.ruta === '/clientes/c1')).toBe(true));
  expect(llamadas.find((l) => l.metodo === 'PATCH')!.cuerpo).toEqual({ activo: false });
  const filaVarios = screen.getByText('Clientes varios').closest('tr')!;
  await userEvent.click(within(filaVarios).getByRole('button', { name: 'Acciones' }));
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
  expect(within(fila).getByText('73867734')).toBeInTheDocument();
  expect(within(fila).getByText('64 000 km')).toBeInTheDocument();
});

it('Vehículos: al buscar el cliente por documento se ve su nombre y se envía su ID', async () => {
  window.location.hash = '#/vehiculos';
  simular();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
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
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
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
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
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
  await userEvent.click(within(fila).getByRole('button', { name: 'Acciones' }));
  await userEvent.click(within(fila).getByRole('button', { name: 'Registrar km' }));
  await userEvent.type(screen.getByLabelText('Kilometraje'), '70000');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar lectura' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.ruta === '/vehiculos/v1/lecturas')).toBe(true));
  expect(llamadas.find((l) => l.ruta === '/vehiculos/v1/lecturas')!.cuerpo).toMatchObject({ km: 70000, fuente: 'Llamada' });
});

// ───────── Alta rápida desde el modal de vehículo y paso de Clientes a Vehículos ─────────
it('Vehículos: el «+» junto a la marca crea la marca y la deja elegida', async () => {
  window.location.hash = '#/vehiculos';
  simular();
  render(<App />);
  respuestas['POST /marcas-vehiculo'] = { status: 201, cuerpo: { id: 'm9', nombre: 'HYUNDAI', modelos: [] } };
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  await userEvent.click(screen.getByRole('button', { name: 'Crear marca nueva' }));
  const dialogo = screen.getByRole('dialog', { name: 'Nueva marca' });
  await userEvent.type(within(dialogo).getByLabelText('Nombre de la marca'), 'HYUNDAI');
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nueva marca' })).toBeNull());
  expect(llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/marcas-vehiculo')!.cuerpo).toEqual({ nombre: 'HYUNDAI' });
  expect(screen.getByLabelText('Marca')).toHaveValue('HYUNDAI');
});

it('Vehículos: si la marca ya existe se muestra el aviso y el modal sigue abierto', async () => {
  window.location.hash = '#/vehiculos';
  simular();
  render(<App />);
  respuestas['POST /marcas-vehiculo'] = { status: 409, cuerpo: { message: 'La marca «KIA» ya existe.' } };
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  await userEvent.click(screen.getByRole('button', { name: 'Crear marca nueva' }));
  const dialogo = screen.getByRole('dialog', { name: 'Nueva marca' });
  await userEvent.type(within(dialogo).getByLabelText('Nombre de la marca'), 'kia');
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
  expect(await within(dialogo).findByText('La marca «KIA» ya existe.')).toBeInTheDocument();
});

it('Vehículos: el «+» junto al cliente abre el formulario de cliente y deja al nuevo cliente elegido', async () => {
  window.location.hash = '#/vehiculos';
  simular();
  render(<App />);
  respuestas['POST /clientes'] = { status: 201, cuerpo: { ...cliente1, id: 'c9', documento: '45678912', nombre: 'MARIA PEREZ SOTO' } };
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  await userEvent.click(screen.getByRole('button', { name: 'Crear cliente nuevo' }));
  const dialogo = await screen.findByRole('dialog', { name: 'Nuevo cliente' });
  await userEvent.type(within(dialogo).getByLabelText('Número de documento *'), '45678912');
  await userEvent.type(within(dialogo).getByLabelText('Razón social o nombre'), 'MARIA PEREZ SOTO');
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(screen.getByLabelText('Cliente (documento o nombre)')).toHaveValue('45678912 · MARIA PEREZ SOTO'));
  expect(llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/clientes')!.cuerpo).toMatchObject({ documento: '45678912', nombre: 'MARIA PEREZ SOTO' });
  expect(screen.queryByRole('dialog', { name: 'Nuevo cliente' })).toBeNull();
  expect(screen.getByRole('dialog', { name: 'Nuevo vehículo' })).toBeInTheDocument();
});

it('Clientes: la acción «Vehículos» abre Vehículos con el documento del cliente en el filtro', async () => {
  window.location.hash = '#/clientes';
  simular();
  render(<App />);
  const fila = (await screen.findByText('JOAQUIN IGNACIO DEL CARPIO')).closest('tr')!;
  await userEvent.click(within(fila).getByRole('button', { name: 'Acciones' }));
  await userEvent.click(within(fila).getByRole('button', { name: 'Vehículos' }));
  expect(await screen.findByRole('heading', { name: 'Vehículos' })).toBeInTheDocument();
  expect(window.location.hash).toBe('#/vehiculos');
  expect(screen.getByLabelText('Filtrar Número de documento')).toHaveValue('73867734');
  expect(await screen.findByText('B5W-165')).toBeInTheDocument();
});

// ───────── Consulta de DNI y RUC, asteriscos y botón «Nuevo» ─────────
it('Cliente: «Consultar» trae el nombre del DNI; solo se habilita con DNI o RUC completos, y el carné no se consulta', async () => {
  window.location.hash = '#/clientes';
  simular();
  respuestas['GET /consulta-documento'] = { cuerpo: { tipoDocumento: 'DNI', documento: '45678912', nombre: 'MARIA PEREZ SOTO', direccion: null, estado: null, condicion: null } };
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  const dialogo = await screen.findByRole('dialog', { name: 'Nuevo cliente' });
  const consultar = within(dialogo).getByRole('button', { name: 'Consultar' });
  expect(consultar).toBeDisabled();
  await userEvent.type(within(dialogo).getByLabelText('Número de documento *'), '45678912');
  expect(consultar).toBeEnabled();
  await userEvent.click(consultar);
  await waitFor(() => expect(within(dialogo).getByLabelText('Razón social o nombre')).toHaveValue('MARIA PEREZ SOTO'));
  const pedido = llamadas.find((l) => l.ruta === '/consulta-documento')!;
  expect(pedido.consulta).toContain('tipo=DNI');
  expect(pedido.consulta).toContain('numero=45678912');
  await userEvent.selectOptions(within(dialogo).getByLabelText('Tipo de documento *'), 'CARNET_EXTRANJERIA');
  expect(consultar).toBeDisabled();
});

it('Cliente: si la consulta falla se muestra el aviso y se puede seguir escribiendo a mano; solo el documento es obligatorio', async () => {
  window.location.hash = '#/clientes';
  simular();
  respuestas['GET /consulta-documento'] = { status: 503, cuerpo: { message: 'La consulta no está configurada: falta CONSULTA_DOC_TOKEN en el .env del servidor.' } };
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  const dialogo = await screen.findByRole('dialog', { name: 'Nuevo cliente' });
  await userEvent.type(within(dialogo).getByLabelText('Número de documento *'), '45678912');
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Consultar' }));
  expect(await within(dialogo).findByRole('alert')).toHaveTextContent('La consulta no está configurada');
  expect(within(dialogo).getByLabelText('Razón social o nombre')).not.toBeRequired();
  expect(within(dialogo).getByText('* Los campos con asterisco son obligatorios.')).toBeInTheDocument();
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.ruta === '/clientes')).toBe(true));
});

it('Vehículo: «Consultar» junto a la placa trae la marca, el modelo, el año, el color y los números de la consulta vehicular', async () => {
  window.location.hash = '#/vehiculos';
  simular();
  respuestas['GET /consulta-vehicular'] = { cuerpo: { placa: 'B5W165', marca: 'SUZUKI', modelo: 'JIMNY', anio: 2012, color: 'PLOMO NEGRO', nroSerie: 'SER123', nroVin: 'VIN456', nroMotor: 'M789', codigoMotor: 'G3LA' } };
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  const dialogo = await screen.findByRole('dialog', { name: 'Nuevo vehículo' });
  const consultar = within(dialogo).getByRole('button', { name: 'Consultar' });
  expect(consultar).toBeDisabled();
  await userEvent.type(within(dialogo).getByLabelText('Placa'), 'B5W-165');
  expect(consultar).toBeEnabled();
  await userEvent.click(consultar);
  await waitFor(() => expect(within(dialogo).getByLabelText('Modelo')).toHaveValue('JIMNY'));
  expect(llamadas.find((l) => l.ruta === '/consulta-vehicular')!.consulta).toContain('placa=B5W-165');
  expect(within(dialogo).getByLabelText('Marca')).toHaveValue('SUZUKI');
  expect(within(dialogo).getByLabelText('Año')).toHaveValue('2012');
  expect(within(dialogo).getByLabelText('Color')).toHaveValue('PLOMO NEGRO');
  expect(within(dialogo).getByLabelText('Nro. de serie')).toHaveValue('SER123');
  expect(within(dialogo).getByLabelText('Nro. de VIN')).toHaveValue('VIN456');
  expect(within(dialogo).getByLabelText('Nro. de motor')).toHaveValue('M789');
  expect(within(dialogo).getByLabelText('Código de motor')).toHaveValue('G3LA');
});

it('Vehículo: si la consulta vehicular falla se muestra el aviso y se puede escribir a mano', async () => {
  window.location.hash = '#/vehiculos';
  simular();
  respuestas['GET /consulta-vehicular'] = { status: 404, cuerpo: { message: 'No se encontró la placa B5W165.' } };
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  const dialogo = await screen.findByRole('dialog', { name: 'Nuevo vehículo' });
  await userEvent.type(within(dialogo).getByLabelText('Placa'), 'B5W165');
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Consultar' }));
  expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No se encontró la placa B5W165.');
  await userEvent.type(within(dialogo).getByLabelText('Modelo'), 'JIMNY');
  expect(within(dialogo).getByLabelText('Modelo')).toHaveValue('JIMNY');
});
