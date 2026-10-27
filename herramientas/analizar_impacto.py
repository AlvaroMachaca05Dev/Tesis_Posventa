# -*- coding: utf-8 -*-
"""Analiza el impacto de cambiar un requisito, un diagrama o un término.

Uso:
    python herramientas/analizar_impacto.py RF-017
    python herramientas/analizar_impacto.py DCL-R81-0004
    python herramientas/analizar_impacto.py "Cotizacion"

No modifica nada: solo lista dónde aparece el término y qué más se vería afectado.
El documento de la tesis se busca en la variable LATEX_MAIN o, por defecto, en
../2_documento-tesis-overleaf/main.tex (hermano de la carpeta del repositorio).
"""
import io
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.environ.get('LATEX_MAIN') or os.path.join(os.path.dirname(RAIZ), '2_documento-tesis-overleaf', 'main.tex')
CARPETAS = [('specs', ('.md',)), ('docs', ('.md', '.csv')), ('diagramas', ('.puml',)), ('prototipo/pruebas', ('.mjs',)), ('database', ('.prisma', '.sql')), ('apps', ('.ts', '.tsx')), ('packages', ('.ts',))]
CODIGO = re.compile(r'^(RF|RC|CU|DAS|DAF|DCM|DCU|DCL|DMD|DSE|DES|DAC|DAM)-[A-Z0-9-]+$')


def leer(ruta):
    try:
        return io.open(ruta, encoding='utf-8').read().split('\n')
    except Exception:
        return []


def ubicacion(lineas, i):
    cap = sec = ''
    for j in range(i, -1, -1):
        m = re.match(r'^(?:\\clearpage)?\\(chapter|section|subsection)\*?\{([^}]*)\}', lineas[j])
        if m:
            if m.group(1) == 'chapter' and not cap:
                cap = m.group(2)
                break
            if not sec:
                sec = m.group(2)
    return (cap + ' › ' if cap else '') + sec


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    t = sys.argv[1]
    print('# Impacto de cambiar «%s»\n' % t)
    L = leer(MAIN)
    if not L:
        print('No encuentro el documento de la tesis en %s (define LATEX_MAIN).' % MAIN)
    en_tex = [(i, l) for i, l in enumerate(L) if t in l]
    print('## En el documento de la tesis (%d apariciones)' % len(en_tex))
    por_sec = {}
    for i, l in en_tex:
        por_sec.setdefault(ubicacion(L, i), []).append(i + 1)
    for k, v in por_sec.items():
        print('- %s: líneas %s' % (k or '(inicio)', ', '.join(map(str, v[:12])) + (' …' if len(v) > 12 else '')))
    # filas de la matriz: qué otros artefactos comparten esa fila
    filas = [l for i, l in en_tex if re.match(r'^RF-\d+ &', l)]
    if CODIGO.match(t) and not t.startswith('RF-'):
        rfs = sorted(set(re.match(r'^(RF-\d+)', l).group(1) for l in filas))
        print('\n## Requisitos que citan este diagrama (%d)\n%s' % (len(rfs), ', '.join(rfs) or 'ninguno'))
    if t.startswith('RF-') and filas:
        print('\n## Fila de la matriz de %s' % t)
        for l in filas:
            cols = [c.strip(' \\') for c in l.split(' & ')]
            print('- ' + ' | '.join(cols)[:400])
            cods = sorted(set(c for c in re.findall(r'D[A-Z]{2}-R81-\d{4}', l) if c[:3] in ('DCL', 'DMD', 'DSE', 'DES', 'DAC')))
            otros = set()
            for ll in L:
                if re.match(r'^RF-\d+ &', ll) and any(c in ll for c in cods):
                    otros.add(re.match(r'^(RF-\d+)', ll).group(1))
            otros.discard(t)
            print('  Otros RF que comparten sus diagramas (%d): %s' % (len(otros), ', '.join(sorted(otros)[:30]) + (' …' if len(otros) > 30 else '')))
    print('\n## En el repositorio')
    hubo = False
    for carpeta, exts in CARPETAS:
        base = os.path.join(RAIZ, carpeta)
        for r, ds, fs in os.walk(base):
            ds[:] = [d for d in ds if d not in ('node_modules', '.git', 'png')]
            for f in fs:
                if f.lower().endswith(exts):
                    ln = leer(os.path.join(r, f))
                    n = [i + 1 for i, l in enumerate(ln) if t in l] or ([0] if t in f else [])
                    if n:
                        hubo = True
                        print('- %s: líneas %s' % (os.path.relpath(os.path.join(r, f), RAIZ).replace('\\', '/'), ', '.join(map(str, n[:8]))))
    if not hubo:
        print('- sin apariciones')
    print('\nSiguiente paso: presentar este informe al investigador con la clasificación «rompe lógica / no rompe lógica» y esperar su aprobación (ver la skill guardian-coherencia-tesis).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
