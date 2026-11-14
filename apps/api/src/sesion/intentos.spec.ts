// CP-61 (RNF-01): pruebas unitarias de caja blanca del límite de intentos, con análisis de valor límite.
import { ControlIntentos, MAX_INTENTOS, VENTANA_MS } from './intentos';

describe('CP-61 límite de intentos de ingreso (RNF-01)', () => {
  let reloj = 0;
  const nuevo = () => new ControlIntentos(MAX_INTENTOS, VENTANA_MS, () => reloj);
  beforeEach(() => {
    reloj = 1_000_000;
  });

  it('valor límite: con 4 fallos no bloquea y con 5 sí', () => {
    const c = nuevo();
    for (let i = 0; i < MAX_INTENTOS - 1; i++) c.registrarFallo('a@demo.local');
    expect(c.bloqueado('a@demo.local')).toBe(false);
    c.registrarFallo('a@demo.local');
    expect(c.bloqueado('a@demo.local')).toBe(true);
  });

  it('valor límite: sigue bloqueado justo antes de vencer la ventana y se libera al vencer', () => {
    const c = nuevo();
    for (let i = 0; i < MAX_INTENTOS; i++) c.registrarFallo('a@demo.local');
    reloj += VENTANA_MS - 1;
    expect(c.bloqueado('a@demo.local')).toBe(true);
    reloj += 1;
    expect(c.bloqueado('a@demo.local')).toBe(false);
  });

  it('partición de equivalencia: cada correo se cuenta aparte', () => {
    const c = nuevo();
    for (let i = 0; i < MAX_INTENTOS; i++) c.registrarFallo('a@demo.local');
    expect(c.bloqueado('b@demo.local')).toBe(false);
  });

  it('un ingreso correcto borra los fallos', () => {
    const c = nuevo();
    for (let i = 0; i < MAX_INTENTOS - 1; i++) c.registrarFallo('a@demo.local');
    c.limpiar('a@demo.local');
    c.registrarFallo('a@demo.local');
    expect(c.bloqueado('a@demo.local')).toBe(false);
  });
});
