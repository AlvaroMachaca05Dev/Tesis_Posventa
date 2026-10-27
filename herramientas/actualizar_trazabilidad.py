# -*- coding: utf-8 -*-
"""Mantiene al día la trazabilidad de la tesis con lo que ya está desarrollado.

Fuente de verdad del avance: docs/requisitos/ESTADO_IMPLEMENTACION.csv
  RF, Estado, BD, Backend, Front, Prueba      (solo los RF que ya tienen código real o cambiaron)

Qué hace (el investigador lo aprueba antes de ejecutarlo; ver la skill guardian-coherencia-tesis):
  1. Cambia el Estado de cada RF en la matriz de diseño de main.tex.
  2. Rellena BD / Archivos, Backend, Front y Prueba de esos RF en la matriz de código.
  3. Regenera docs/requisitos/MATRIZ_TRAZABILIDAD_R81.csv a partir de main.tex, para que el repositorio y la tesis coincidan.

Uso:  python herramientas/actualizar_trazabilidad.py [--simular]
La tesis se busca en la variable LATEX_MAIN o en la carpeta de Drive (ver analizar_impacto.py).
"""
import csv
import io
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRIVE_TESIS = 'J:/Mi unidad/Trabajo RSA/Tesis sistema posventa'
MAIN = os.environ.get('LATEX_MAIN') or next(
    (c for c in (os.path.join(os.path.dirname(RAIZ), '2_documento-tesis-overleaf', 'main.tex'), DRIVE_TESIS + '/2_documento-tesis-overleaf/main.tex') if os.path.exists(c)),
    DRIVE_TESIS + '/2_documento-tesis-overleaf/main.tex',
)
ESTADO = os.path.join(RAIZ, 'docs', 'requisitos', 'ESTADO_IMPLEMENTACION.csv')
SALIDA = os.path.join(RAIZ, 'docs', 'requisitos', 'MATRIZ_TRAZABILIDAD_R81.csv')
VALIDOS = {'Implementado', 'Prototipo verificado', 'Pendiente'}


def tex(t):
    t = str(t or '')
    for a, b in (('\\', r'\textbackslash{}'), ('&', r'\&'), ('%', r'\%'), ('$', r'\$'), ('#', r'\#'), ('_', r'\_'), ('{', r'\{'), ('}', r'\}')):
        t = t.replace(a, b)
    return t


def destex(t):
    return t.replace(r'\_', '_').replace(r'\&', '&').replace(r'\%', '%').replace(r'\#', '#').replace(r'\$', '$').replace(r'\{', '{').replace(r'\}', '}').strip()


def main():
    simular = '--simular' in sys.argv
    with io.open(ESTADO, encoding='utf-8-sig', newline='') as f:
        filas = {r['RF'].strip(): r for r in csv.DictReader(f)}
    for rf, r in filas.items():
        if r['Estado'] not in VALIDOS:
            raise SystemExit('Estado no válido para %s: %s (usa %s)' % (rf, r['Estado'], ', '.join(sorted(VALIDOS))))
    with io.open(MAIN, encoding='utf-8', newline='') as f:
        lineas = f.read().split('\n')
    cambios = 0
    ya_diseno = ya_codigo = set()
    ya_diseno, ya_codigo = set(), set()
    for i, l in enumerate(lineas):
        m = re.match(r'^(RF-\d+) & ', l)
        if not m or m.group(1) not in filas:
            continue
        rf, r = m.group(1), filas[m.group(1)]
        cols = l.rstrip('\\').split(' & ')
        if len(cols) == 10 and cols[1] in VALIDOS:  # matriz de diseño
            if cols[1] != r['Estado']:
                cols[1] = r['Estado']
                lineas[i] = ' & '.join(cols) + '\\\\'
                cambios += 1
            ya_diseno.add(rf)
        elif len(cols) == 5:  # matriz de código y prueba
            nuevo = [rf, tex(r['BD']) or '—', tex(r['Backend']) or '—', tex(r['Front']) or '—', tex(r['Prueba']) or '—']
            if cols != nuevo:
                lineas[i] = ' & '.join(nuevo) + '\\\\'
                cambios += 1
            ya_codigo.add(rf)
    faltan = [rf for rf in filas if rf not in ya_diseno or rf not in ya_codigo]
    if faltan:
        print('Aviso: no encontré estas filas en las dos matrices:', ', '.join(faltan))
    if not simular:
        with io.open(MAIN, 'w', encoding='utf-8', newline='') as f:
            f.write('\n'.join(lineas))
    # regenerar el CSV del repositorio a partir de la tesis
    diseno, codigo = {}, {}
    for l in lineas:
        m = re.match(r'^(RF-\d+) & ', l)
        if not m:
            continue
        cols = [destex(c) for c in l.rstrip('\\').split(' & ')]
        if len(cols) == 10 and cols[1] in VALIDOS:
            diseno[cols[0]] = cols
        elif len(cols) == 5:
            codigo[cols[0]] = cols
    if not simular:
        with io.open(SALIDA, 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.writer(f)
            w.writerow(['RF', 'Estado', 'DAS', 'DCM', 'CU', 'DCL', 'DMD', 'DSE', 'DES', 'DAC', 'BD / Archivos', 'Backend', 'Front', 'Prueba'])
            for rf in sorted(diseno):
                c = codigo.get(rf, [rf, '—', '—', '—', '—'])
                w.writerow(diseno[rf] + c[1:])
    print('%s: %d celdas cambiadas en la tesis, %d RF en la matriz%s.' % ('Simulación' if simular else 'Hecho', cambios, len(diseno), ' (nada se escribió)' if simular else ''))


if __name__ == '__main__':
    main()
