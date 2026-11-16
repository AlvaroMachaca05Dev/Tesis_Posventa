// Ancho de columnas arrastrando el borde: no debe fallar al soltar el mouse y debe recordar el ancho.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useColumnasRedimensionables } from './useColumnasRedimensionables';

function Tabla() {
  const { anchos, iniciarArrastre } = useColumnasRedimensionables('prueba');
  return (
    <table>
      <thead><tr>
        <th style={anchos.A ? { width: anchos.A } : undefined}>A<span data-testid="borde" className="resizer" onMouseDown={iniciarArrastre('A', 100)} /></th>
        <th>B</th>
      </tr></thead>
      <tbody><tr><td data-testid="celda">1</td><td>2</td></tr></tbody>
    </table>
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('arrastrar el borde cambia el ancho de toda la columna, no falla al soltar y el ancho se recuerda', async () => {
  render(<Tabla />);
  fireEvent.mouseDown(screen.getByTestId('borde'), { clientX: 100 });
  expect(document.body.classList.contains('arrastrando-columna')).toBe(true);
  fireEvent.mouseMove(document, { clientX: 180 });
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  expect(screen.getByTestId('celda').style.width).toBe('180px');
  fireEvent.mouseUp(document);
  expect(document.body.classList.contains('arrastrando-columna')).toBe(false);
  expect(JSON.parse(localStorage.getItem('posventa-col-prueba')!)).toEqual({ A: 180 });
  // Un segundo arrastre tampoco falla.
  fireEvent.mouseDown(screen.getByTestId('borde'), { clientX: 100 });
  fireEvent.mouseUp(document);
});
