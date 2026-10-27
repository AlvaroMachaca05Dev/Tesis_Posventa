# -*- coding: utf-8 -*-
"""Genera el resumen de la sesión de desarrollo en docs/plan/sesiones/AAAA-MM-DD.md.

Compara el estado actual con la última marca guardada en .estado_sesion (un hash de commit).
No modifica nada del código. Uso: python herramientas/resumen_sesion.py [--marcar]
  --marcar  guarda el commit actual como nueva marca (hazlo al cerrar el resumen).
"""
import datetime
import io
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARCA = os.path.join(RAIZ, '.estado_sesion')
SENSIBLES = ('database/', 'specs/', 'docs/requisitos/', 'docs/decisiones/', 'docs/api/', 'diagramas/', 'AGENTS.md')


def git(*a):
    try:
        return subprocess.run(['git'] + list(a), cwd=RAIZ, capture_output=True, text=True, encoding='utf-8').stdout.strip()
    except Exception:
        return ''


def main():
    hoy = datetime.date.today().isoformat()
    head = git('rev-parse', 'HEAD')
    base = io.open(MARCA, encoding='utf-8').read().strip() if os.path.exists(MARCA) else ''
    rango = (base + '..HEAD') if base else 'HEAD'
    commits = git('log', '--pretty=format:- %h %s (%an)', rango) if head else ''
    sin_commit = git('status', '--short')
    cambiados = [l for l in git('diff', '--name-only', base or 'HEAD').split('\n') if l] + [l[3:] for l in sin_commit.split('\n') if l.strip()]
    cambiados = sorted(set(cambiados))
    borrados = [l for l in git('diff', '--name-status', base or 'HEAD').split('\n') if l.startswith('D')]
    alertas = []
    if len(cambiados) > 15:
        alertas.append('Más de 15 archivos cambiados (%d).' % len(cambiados))
    if borrados:
        alertas.append('Hay %d archivo(s) borrado(s).' % len(borrados))
    for s in SENSIBLES:
        t = [c for c in cambiados if c.replace('\\', '/').startswith(s)]
        if t:
            alertas.append('Tocó %s (%d archivo(s)): pasar por la skill guardian-coherencia-tesis.' % (s, len(t)))
    out = ['## Sesión del %s (%s)' % (hoy, datetime.datetime.now().strftime('%H:%M')), '',
           '### Commits desde la última marca', commits or '- (ninguno)', '',
           '### Archivos cambiados (%d)' % len(cambiados)] + ['- ' + c for c in cambiados[:60]] + (['- …'] if len(cambiados) > 60 else []) + ['',
           '### Alertas de cambios drásticos'] + (['- ' + a for a in alertas] or ['- ninguna']) + ['',
           '### Qué quedó funcionando (pasos para probarlo)', '- COMPLETAR', '',
           '### Qué aprendimos (cómo funciona)', '- COMPLETAR', '',
           '### Pendiente o sin verificar', '- COMPLETAR', '',
           '### Decisiones y dudas abiertas', '- COMPLETAR', '']
    carpeta = os.path.join(RAIZ, 'docs', 'plan', 'sesiones')
    os.makedirs(carpeta, exist_ok=True)
    ruta = os.path.join(carpeta, hoy + '.md')
    previo = io.open(ruta, encoding='utf-8').read() + '\n---\n\n' if os.path.exists(ruta) else '# Resumen de sesiones del %s\n\n' % hoy
    io.open(ruta, 'w', encoding='utf-8', newline='\n').write(previo + '\n'.join(out))
    if '--marcar' in sys.argv and head:
        io.open(MARCA, 'w', encoding='utf-8').write(head)
    print('Resumen escrito en', os.path.relpath(ruta, RAIZ))
    for a in alertas:
        print('ALERTA:', a)


if __name__ == '__main__':
    main()
