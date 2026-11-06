// Pruebas unitarias del slice S5 (CP-59): rejilla de tiempos (RN-08), precio por grupo acumulativo (RN-09),
// grupo del vehículo (RF-100) y solapamiento (RF-102). Casos portados de integracion/test_reglas_rsa.py.
import { asignarGrupo, calcularServicio, errorDocumento, errorTelefono, evaluarSolapamientos, redondearTiempo, Regla, ReglaSolape, tiempoEstandar, validarRegla } from './maestros.reglas';

describe('Reglas S5', () => {
  it('la rejilla de tiempos sube de 0,25 h hasta 1,5 h y luego de 0,5 h', () => {
    const casos: [number, number][] = [[0.1, 0.25], [0.5, 0.5], [1.1, 1.25], [1.5, 1.5], [1.6, 2], [2.2, 2.5], [3.5, 3.5]];
    for (const [h, e] of casos) expect(redondearTiempo(h)).toBe(e);
    expect(redondearTiempo(25.2, true)).toBe(26);
  });

  it('el tiempo estándar suma el margen del técnico', () => {
    expect(tiempoEstandar(0.25)).toBe(0.5);
    expect(tiempoEstandar(2.5)).toBe(3);
    expect(tiempoEstandar(25, true)).toBe(26);
  });

  const ACE = { codigo: 'ACE', horas: 0.5, precio: 20 };
  const REGLAS: Regla[] = [
    { codigo: 'G3-ACE', nivel: 'SERVICIO', tipo: 'SUMAR', grupo: 'N3', servicios: ['ACE'], precio: 10, horas: 0.25 },
    { codigo: 'G3-R1', nivel: 'GRUPO', tipo: 'SUMAR', grupo: 'N3', precio: 10, precioDesde: 50, precioHasta: 100 },
    { codigo: 'G3-R2', nivel: 'GRUPO', tipo: 'SUMAR', grupo: 'N3', precio: 20, precioDesde: 150, precioHasta: 200 },
    { codigo: 'G3-R3', nivel: 'GRUPO', tipo: 'SUMAR', grupo: 'N3', precio: 50, precioDesde: 300, precioHasta: 1000 },
    { codigo: 'DESC5', nivel: 'GLOBAL', tipo: 'PORCENTAJE', porcentaje: -5, precioDesde: 101 },
  ];

  it('sin grupo o con un grupo sin reglas se usa el estándar del servicio', () => {
    expect(calcularServicio(ACE, '', REGLAS)).toMatchObject({ horas: 0.5, precio: 20 });
    expect(calcularServicio(ACE, 'N1', REGLAS)).toMatchObject({ horas: 0.5, precio: 20 });
  });

  it('las reglas del grupo se acumulan en orden: servicio, grupo y todos los grupos (RN-09)', () => {
    expect(calcularServicio(ACE, 'N3', REGLAS)).toMatchObject({ horas: 0.75, precio: 30 });
    expect(calcularServicio({ codigo: 'AFI', horas: 3.5, precio: 130 }, 'N3', REGLAS).precio).toBe(123.5);
    expect(calcularServicio({ codigo: 'AFI', horas: 3.5, precio: 150 }, 'N3', REGLAS).precio).toBe(161.5);
    expect(calcularServicio({ codigo: 'X', horas: 3, precio: 125 }, '', REGLAS).precio).toBe(118.8);
  });

  it('una regla FIJAR del servicio funciona como excepción de precio', () => {
    const r = calcularServicio(ACE, 'N2', [{ codigo: 'EXC', nivel: 'SERVICIO', tipo: 'FIJAR', grupo: 'N2', servicios: ['ACE'], precio: 45 }]);
    expect(r.precio).toBe(45);
    expect(r.traza).toHaveLength(2);
  });

  it('valida montos múltiplos de 5 y tiempos de 0,25 h', () => {
    expect(validarRegla({ codigo: 'X', nivel: 'GRUPO', tipo: 'SUMAR', grupo: 'N1', precio: 18 })).toEqual(['el monto debe terminar en 0 o 5']);
    expect(validarRegla({ codigo: 'X', nivel: 'GRUPO', tipo: 'SUMAR', grupo: 'N1', horas: 0.3 })).toEqual(['el tiempo va de 0,25 h en 0,25 h']);
  });

  it('el grupo sale de la familia del motor; si no, de marca, modelo y año; si no, queda sin grupo', () => {
    const fam = [{ codigo: 'FM0001', codigos: ['G3LA', 'G4LA'], grupo: 'G1' }];
    const mod = [{ marca: 'KIA', modelo: 'RIO', anioDesde: 2015, anioHasta: 2020, grupo: 'N1', automatica: true }];
    expect(asignarGrupo({ codigoMotor: 'g3la' }, fam, mod)).toMatchObject({ grupo: 'G1', fuente: 'FAMILIA_MOTOR' });
    expect(asignarGrupo({ marca: 'Kia', modelo: 'Rio', anio: 2017 }, fam, mod)).toMatchObject({ grupo: 'N1', fuente: 'MODELO', sugerido: false });
    expect(asignarGrupo({ marca: 'Kia', modelo: 'Rio', anio: 2010 }, fam, mod).grupo).toBeNull();
  });

  it('el solapamiento da un solo descuento por línea, el del grupo o el estándar, sin pasar el total', () => {
    const reglas: ReglaSolape[] = [
      { id: 'a', codigo: 'SOL-A', tipo: 'PAR', base: ['COR'], reducidos: ['BOM'], modo: 'OPCIONAL', descuentoEstandar: 35, descuentos: { G3: 60 } },
      { id: 'b', codigo: 'SOL-B', tipo: 'PAR', base: ['CAD'], reducidos: ['BOM'], modo: 'AUTOMATICO', descuentoEstandar: 10 },
    ];
    const lineas = [{ indice: 0, servicioId: 'COR', total: 80 }, { indice: 1, servicioId: 'BOM', total: 40 }, { indice: 2, servicioId: 'CAD', total: 180 }];
    expect(evaluarSolapamientos(lineas, reglas, null)).toMatchObject([{ indiceReducido: 1, monto: 35, regla: { codigo: 'SOL-A' }, clave: 'a:BOM' }]);
    expect(evaluarSolapamientos(lineas, reglas, 'G3')[0].monto).toBe(40); // 60 del grupo, tope el total de la línea
    expect(evaluarSolapamientos(lineas.slice(1), reglas, null)).toMatchObject([{ regla: { codigo: 'SOL-B' }, monto: 10 }]);
  });

  it('en un conjunto (misma rueda) todos menos el más caro llevan el descuento; el aviso no descuenta', () => {
    const rueda: ReglaSolape = { id: 'r', codigo: 'SOL-37', tipo: 'CONJUNTO', base: [], reducidos: ['AMO', 'TRA', 'ROT'], minimo: 2, modo: 'OPCIONAL', descuentoEstandar: 5, descuentos: { G3: 10 } };
    const aviso: ReglaSolape = { id: 'v', codigo: 'SOL-41', tipo: 'CONJUNTO', base: [], reducidos: ['BUJ', 'FIL', 'IAC'], minimo: 3, modo: 'AVISO', descuentoEstandar: 0 };
    const l = [{ indice: 0, servicioId: 'AMO', total: 50 }, { indice: 1, servicioId: 'TRA', total: 40 }, { indice: 2, servicioId: 'ROT', total: 30 }];
    expect(evaluarSolapamientos(l, [rueda], 'G3').map((h) => [h.indiceReducido, h.monto])).toEqual([[1, 10], [2, 10]]);
    expect(evaluarSolapamientos(l.slice(0, 1), [rueda], 'G3')).toEqual([]);
    const a = evaluarSolapamientos([{ indice: 0, servicioId: 'BUJ', total: 15 }, { indice: 1, servicioId: 'FIL', total: 10 }, { indice: 2, servicioId: 'IAC', total: 25 }], [aviso], 'G1');
    expect(a).toMatchObject([{ indiceReducido: -1, monto: 0 }]);
  });

  it('el precio de la tabla del grupo manda; «No aplica» deja el servicio fuera para ese grupo', () => {
    const afi = { codigo: 'B01', horas: 3.5, precio: 140, preciosGrupo: { G1: 130, G2: 140, G3: 150, G4: null }, horasGrupo: { G1: 3 } };
    expect(calcularServicio(afi, 'G1', [])).toMatchObject({ precio: 130, horas: 3, disponible: true });
    expect(calcularServicio(afi, 'G3', [])).toMatchObject({ precio: 150, horas: 3.5 });
    expect(calcularServicio(afi, 'G4', []).disponible).toBe(false);
    expect(calcularServicio(afi, '', []).precio).toBe(140);
  });

  it('DNI de 8 dígitos, RUC de 11, carné de extranjería de 9 a 12 y teléfono de 9', () => {
    expect(errorDocumento('DNI', '12345678')).toBeNull();
    expect(errorDocumento('DNI', '20000000000')).toBe('El DNI tiene 8 dígitos.');
    expect(errorDocumento('RUC', '20123456789')).toBeNull();
    expect(errorDocumento('RUC', '2012345678')).toBe('El RUC tiene 11 dígitos.');
    expect(errorDocumento('CARNET_EXTRANJERIA', '001234567')).toBeNull();
    expect(errorDocumento('CARNET_EXTRANJERIA', '12345')).not.toBeNull();
    expect(errorTelefono('987654321')).toBeNull();
    expect(errorTelefono('99999999')).not.toBeNull();
  });
});
