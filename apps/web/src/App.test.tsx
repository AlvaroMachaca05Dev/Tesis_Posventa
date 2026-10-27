// Pruebas del slice S1 en la pantalla: ingreso, menú por rol, «Sin acceso», «Ver como…» y módulos beta ocultables.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';

const resp = (cuerpo: unknown, status = 200) => ({ ok: status < 400, status, json: async () => cuerpo });
const me = (extra: Record<string, unknown> = {}) => ({
  usuario: { id: '1', nombre: 'Técnico Demo 1', correo: 'tecnico@demo.local', organizacionId: 'o1' },
  roles: ['Técnico'],
  permisos: { ods: 'E' },
  menu: [{ id: 'ods', label: 'Órdenes de servicio', grupo: 'General', nivel: 'E' }],
  actuandoComo: false,
  esPlataforma: false,
  real: { id: '1', nombre: 'Técnico Demo 1' },
  ...extra,
});
const simular = (m: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/auth/login')) return resp({ token: 't' }, 201);
      if (url.endsWith('/me')) return resp(m);
      if (url.endsWith('/usuarios')) return resp([{ id: '9', nombre: 'Cajera Demo', correo: 'cajera@demo.local', activo: true, roles: ['Cajera'] }]);
      return resp({});
    }),
  );

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'false'); // las pruebas no dependen del .env local
  sessionStorage.clear();
  localStorage.clear();
  window.location.hash = '';
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('modo demostración: avisa y deja escrita la cuenta del Desarrollador', () => {
  vi.stubEnv('VITE_DEMO_MODE', 'true');
  vi.stubEnv('VITE_DEMO_CORREO', 'superusuario@rmotriz.com');
  render(<App />);
  expect(screen.getByText(/Modo demostración/)).toBeInTheDocument();
  expect(screen.getByLabelText(/Usuario/)).toHaveValue('superusuario@rmotriz.com');
});

it('sin modo demostración no hay aviso ni datos escritos', () => {
  vi.stubEnv('VITE_DEMO_MODE', 'false');
  render(<App />);
  expect(screen.queryByText(/Modo demostración/)).toBeNull();
  expect(screen.getByLabelText(/Usuario/)).toHaveValue('');
});

it('al ingresar, el menú muestra solo los módulos del rol, el nombre y la etiqueta del rol', async () => {
  simular(me());
  render(<App />);
  await userEvent.type(screen.getByLabelText(/Usuario/), 'tecnico@demo.local');
  await userEvent.type(screen.getByLabelText(/Contraseña/), 'clave');
  await userEvent.click(screen.getByRole('button', { name: /Ingresar/ }));
  expect(await screen.findByRole('link', { name: 'Órdenes de servicio' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Bancos/ })).toBeNull();
  expect(screen.getByText('Técnico Demo 1')).toBeInTheDocument();
  expect(screen.getByTestId('roles')).toHaveTextContent('Técnico');
});

it('un módulo sin permiso muestra «Sin acceso», aunque se fuerce la dirección', async () => {
  sessionStorage.setItem('posventa-token', 't');
  window.location.hash = '#/bancos';
  simular(me());
  render(<App />);
  expect(await screen.findByText(/no tiene acceso/)).toBeInTheDocument();
});

it('«Ver como…» aparece solo para el Desarrollador', async () => {
  sessionStorage.setItem('posventa-token', 't');
  simular(me({ esPlataforma: true, roles: ['Desarrollador'], permisos: { ods: 'A', usuarios: 'A' } }));
  render(<App />);
  expect(await screen.findByLabelText(/Ver como/)).toBeInTheDocument();
  cleanup();
  simular(me());
  render(<App />);
  await screen.findByRole('link', { name: 'Órdenes de servicio' });
  expect(screen.queryByLabelText(/Ver como/)).toBeNull();
});

it('los módulos beta van al final y se pueden ocultar', async () => {
  sessionStorage.setItem('posventa-token', 't');
  simular(
    me({
      roles: ['Superadministrador'],
      permisos: { ods: 'A', ajustes: 'A', paquetes: 'A' },
      menu: [
        { id: 'ods', label: 'Órdenes de servicio', grupo: 'General', nivel: 'A' },
        { id: 'paquetes', label: 'Paquetes de servicios y productos', grupo: 'Beta', nivel: 'A' },
      ],
    }),
  );
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: /Beta/ })); // la lista Beta está plegada
  expect(screen.getByRole('link', { name: /Paquetes/ })).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText(/Mostrar módulos beta/));
  expect(screen.queryByRole('button', { name: /Beta/ })).toBeNull();
  expect(screen.queryByRole('link', { name: /Paquetes/ })).toBeNull();
});

// ---- Menú tipo acordeón, ocultar el menú, pantalla completa y celular (como el prototipo HTML) ----
const menuGrupos = () =>
  me({
    roles: ['Administrador'],
    permisos: { ods: 'A', clientes: 'A', catalogo: 'A' },
    menu: [
      { id: 'ods', label: 'Órdenes de servicio', grupo: 'General', nivel: 'A' },
      { id: 'clientes', label: 'Clientes', grupo: 'Maestros', nivel: 'A' },
      { id: 'vehiculos', label: 'Vehículos', grupo: 'Maestros', nivel: 'A' },
      { id: 'catalogo', label: 'Productos y servicios', grupo: 'Inventario', nivel: 'A' },
    ],
  });
const entrar = async (m: unknown) => {
  sessionStorage.setItem('posventa-token', 't');
  simular(m);
  const r = render(<App />);
  await screen.findByRole('link', { name: 'Órdenes de servicio' });
  return r;
};

it('acordeón: al abrir una lista se cierran las demás', async () => {
  await entrar(menuGrupos());
  expect(screen.queryByRole('link', { name: 'Clientes' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: /Maestros/ }));
  expect(screen.getByRole('link', { name: 'Clientes' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Inventario/ }));
  expect(screen.getByRole('link', { name: 'Productos y servicios' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Clientes' })).toBeNull();
  expect(screen.getByRole('button', { name: /Inventario/ })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: /Maestros/ })).toHaveAttribute('aria-expanded', 'false');
});

it('la lista del módulo en que estás empieza abierta', async () => {
  window.location.hash = '#/vehiculos';
  await entrar(menuGrupos());
  expect(screen.getByRole('link', { name: 'Vehículos' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Maestros/ })).toHaveAttribute('aria-expanded', 'true');
});

it('el botón ☰ oculta y vuelve a mostrar el menú, y lo recuerda', async () => {
  const { container } = await entrar(menuGrupos());
  const app = container.querySelector('.app')!;
  expect(app).not.toHaveClass('oculto');
  await userEvent.click(screen.getByLabelText(/Mostrar u ocultar el menú/));
  expect(app).toHaveClass('oculto');
  expect(localStorage.getItem('posventa-menu-oculto')).toBe('si');
  await userEvent.click(screen.getByLabelText(/Mostrar u ocultar el menú/));
  expect(app).not.toHaveClass('oculto');
});

it('el botón de pantalla completa la solicita', async () => {
  const pedir = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(document.documentElement, 'requestFullscreen', { value: pedir, configurable: true });
  await entrar(menuGrupos());
  await userEvent.click(screen.getByLabelText(/Pantalla completa/));
  expect(pedir).toHaveBeenCalled();
});

it('en celular el menú es un cajón: empieza cerrado, se abre con ☰ y se cierra al elegir un módulo', async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
  const { container } = await entrar(menuGrupos());
  const app = container.querySelector('.app')!;
  expect(app).toHaveClass('movil');
  expect(app).not.toHaveClass('cajon-abierto');
  await userEvent.click(screen.getByLabelText(/Mostrar u ocultar el menú/));
  expect(app).toHaveClass('cajon-abierto');
  await userEvent.click(screen.getByRole('link', { name: 'Órdenes de servicio' }));
  expect(app).not.toHaveClass('cajon-abierto');
});
