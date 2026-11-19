// Pantalla «Usuarios y responsabilidades» (como el prototipo) con gestión de roles propios. Se escribe primero.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

type Peticion = { metodo: string; ruta: string; cuerpo: any };
const llamadas: Peticion[] = [];
let respuestas: Record<string, { status?: number; cuerpo: unknown }> = {};

const roles = [
  { id: 'r-caj', nombre: 'Cajera', ambito: 'empresa', nivel: 1, esBase: true, asignable: true, permisos: [{ modulo: 'clientes', nivel: 'E' }] },
  { id: 'r-tec', nombre: 'Técnico', ambito: 'empresa', nivel: 1, esBase: true, asignable: true, permisos: [] },
  { id: 'r-adm', nombre: 'Administrador', ambito: 'empresa', nivel: 3, esBase: true, asignable: false, permisos: [] },
];
const usuarios = [
  { id: 'u1', nombre: 'Cajera Demo', correo: 'cajera@demo.local', activo: true, localId: 'l1', roles: ['Cajera'] },
  { id: 'u2', nombre: 'Técnico Demo 1', correo: 'tecnico@demo.local', activo: false, localId: 'l1', roles: ['Técnico'] },
];
const locales = [{ id: 'l1', nombre: 'Local Unión', organizacionId: 'o1' }];

const me = (nivel: 'A' | 'E' | 'V') => ({
  usuario: { id: 'm', nombre: 'Superadministrador Demo', correo: 'ti@demo.local', organizacionId: 'o1' },
  roles: ['Superadministrador'],
  permisos: { usuarios: nivel, clientes: 'A', citas: 'A' },
  menu: [
    { id: 'usuarios', label: 'Usuarios', grupo: 'Configuración', nivel },
    { id: 'clientes', label: 'Clientes', grupo: 'Maestros', nivel: 'A' },
    { id: 'citas', label: 'Citas', grupo: 'Seguimiento', nivel: 'A' },
  ],
  actuandoComo: false,
  esPlataforma: false,
  real: { id: 'm', nombre: 'Superadministrador Demo' },
});

function simular(nivel: 'A' | 'E' | 'V') {
  llamadas.length = 0;
  respuestas = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = (init?.method ?? 'GET').toUpperCase();
      const ruta = new URL(url).pathname;
      const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
      llamadas.push({ metodo, ruta, cuerpo });
      const clave = `${metodo} ${ruta}`;
      const r = respuestas[clave];
      if (r) return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.cuerpo };
      const base: Record<string, unknown> = { 'GET /me': me(nivel), 'GET /usuarios': usuarios, 'GET /roles': roles, 'GET /locales': locales };
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
  window.location.hash = '#/usuarios';
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('lista los usuarios con su correo, sus roles y su estado', async () => {
  simular('A');
  render(<App />);
  const fila = (await screen.findByText('cajera@demo.local')).closest('tr')!;
  expect(within(fila).getByText('Cajera Demo')).toBeInTheDocument();
  expect(within(fila).getByText('Cajera')).toBeInTheDocument();
  expect(within(fila).getByText('Activo')).toBeInTheDocument();
  const baja = screen.getByText('tecnico@demo.local').closest('tr')!;
  expect(within(baja).getByText('Inactivo')).toBeInTheDocument();
});

it('«+ Nuevo» crea un usuario con nombre, correo, contraseña, local y roles', async () => {
  simular('A');
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  await userEvent.type(screen.getByLabelText('Nombre'), 'Reemplazo Nuevo');
  await userEvent.type(screen.getByLabelText('Correo'), 'nuevo@demo.local');
  await userEvent.type(screen.getByLabelText('Contraseña'), 'ClaveSegura-1');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Cajera' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Técnico' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar usuario' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.ruta === '/usuarios')).toBe(true));
  const p = llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/usuarios')!;
  expect(p.cuerpo).toMatchObject({ nombre: 'Reemplazo Nuevo', correo: 'nuevo@demo.local', password: 'ClaveSegura-1', rolIds: ['r-caj', 'r-tec'], localId: 'l1' });
});

it('solo ofrece los roles que puedes asignar (nivel inferior al tuyo)', async () => {
  simular('A');
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  expect(screen.getByRole('checkbox', { name: 'Cajera' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Administrador' })).toBeNull();
});

it('muestra el mensaje del servidor cuando algo falla (correo repetido)', async () => {
  simular('A');
  respuestas['POST /usuarios'] = { status: 409, cuerpo: { message: 'Ese correo ya existe.' } };
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  await userEvent.type(screen.getByLabelText('Nombre'), 'X');
  await userEvent.type(screen.getByLabelText('Correo'), 'cajera@demo.local');
  await userEvent.type(screen.getByLabelText('Contraseña'), 'ClaveSegura-1');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Cajera' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar usuario' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Ese correo ya existe.');
});

it('elimina un usuario después de confirmar en el modal propio (con movimientos queda desactivado en el servidor)', async () => {
  simular('A');
  render(<App />);
  const fila = (await screen.findByText('cajera@demo.local')).closest('tr')!;
  await userEvent.click(within(fila).getByRole('button', { name: 'Acciones' }));
  await userEvent.click(within(fila).getByRole('button', { name: 'Eliminar' }));
  const d = await screen.findByRole('alertdialog');
  await userEvent.click(within(d).getByRole('button', { name: 'Eliminar' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'DELETE' && l.ruta === '/usuarios/u1')).toBe(true));
});

it('con nivel «solo ver» no hay botones para crear ni modificar', async () => {
  simular('V');
  render(<App />);
  await screen.findByText('cajera@demo.local');
  expect(screen.queryByRole('button', { name: '+ Nuevo' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Acciones' })).toBeNull();
});

it('las acciones de la fila van en un solo botón con lista: Editar, Cambiar contraseña y Eliminar', async () => {
  simular('A');
  render(<App />);
  const fila = (await screen.findByText('cajera@demo.local')).closest('tr')!;
  expect(within(fila).queryByRole('button', { name: 'Editar' })).toBeNull();
  await userEvent.click(within(fila).getByRole('button', { name: 'Acciones' }));
  for (const a of ['Editar', 'Cambiar contraseña', 'Eliminar']) expect(within(fila).getByRole('button', { name: a })).toBeInTheDocument();
});

it('«Cambiar contraseña» pide la nueva contraseña dos veces y la envía', async () => {
  simular('A');
  render(<App />);
  const fila = (await screen.findByText('cajera@demo.local')).closest('tr')!;
  await userEvent.click(within(fila).getByRole('button', { name: 'Acciones' }));
  await userEvent.click(within(fila).getByRole('button', { name: 'Cambiar contraseña' }));
  const d = screen.getByRole('dialog', { name: /Cambiar contraseña de/ });
  await userEvent.type(within(d).getByLabelText('Nueva contraseña *'), 'clave-nueva-1');
  await userEvent.type(within(d).getByLabelText('Repetir contraseña *'), 'clave-distinta');
  await userEvent.click(within(d).getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByText('Las dos contraseñas no son iguales.')).toBeInTheDocument();
  expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
  await userEvent.clear(within(d).getByLabelText('Repetir contraseña *'));
  await userEvent.type(within(d).getByLabelText('Repetir contraseña *'), 'clave-nueva-1');
  await userEvent.click(within(d).getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH' && l.ruta === '/usuarios/u1')?.cuerpo).toEqual({ password: 'clave-nueva-1' }));
});

it('Roles: el Superadministrador crea un rol propio eligiendo módulos y niveles', async () => {
  simular('A');
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Roles' }));
  await userEvent.click(await screen.findByRole('button', { name: '+ Nuevo' }));
  expect(screen.getByRole('dialog', { name: 'Nuevo rol propio' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Nombre del rol'), 'Recepcionista');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Clientes' }));
  await userEvent.selectOptions(screen.getByLabelText('Nivel de Clientes'), 'E');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Citas' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar rol' }));
  await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.ruta === '/roles')).toBe(true));
  expect(llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/roles')!.cuerpo).toMatchObject({
    nombre: 'Recepcionista',
    permisos: [{ modulo: 'clientes', nivel: 'E' }, { modulo: 'citas', nivel: 'V' }],
  });
});

it('Roles: sin nivel «todo» sobre Usuarios no se puede crear roles', async () => {
  simular('E');
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Roles' }));
  expect(screen.queryByRole('button', { name: '+ Nuevo' })).toBeNull();
  expect(await screen.findByText('Cajera')).toBeInTheDocument();
});
