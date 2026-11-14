# -*- coding: utf-8 -*-
"""Dibuja DAM-001: metodología Scrum + IA-ASE con desarrollo vertical por módulo.
Uso: python diagramas/tesis/DAM-001_metodologia.py  (requiere Pillow). Genera png/DAM-001_metodologia_scrum_ia_ase.png
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 2600, 1620
AZUL, AZUL_CL, TINTA, GRIS = (37, 99, 235), (232, 240, 254), (15, 23, 42), (100, 116, 139)
VERDE, VERDE_CL, NARANJA, NARANJA_CL, MORADO, MORADO_CL = (21, 128, 61), (228, 246, 234), (234, 88, 12), (255, 241, 230), (109, 40, 217), (241, 234, 254)
F = 'C:/Windows/Fonts/'
def fu(n, b=False): return ImageFont.truetype(F + ('arialbd.ttf' if b else 'arial.ttf'), n)

img = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(img)

def texto(x, y, s, f, c=TINTA, ancla='mm'):
    for i, l in enumerate(s.split('\n')):
        d.text((x, y + i * f.size * 1.25), l, font=f, fill=c, anchor=ancla)

def caja(x, y, w, h, titulo, sub, borde=TINTA, fondo='white', ft=34, fs=27):
    d.rounded_rectangle((x, y, x + w, y + h), 26, fill=fondo, outline=borde, width=5)
    n = sub.count('\n') + 1 if sub else 0
    alto = ft * 1.25 + n * fs * 1.25
    y0 = y + (h - alto) / 2 + ft / 2
    texto(x + w / 2, y0, titulo, fu(ft, True), borde if borde != TINTA else TINTA)
    if sub: texto(x + w / 2, y0 + ft * 1.25 + 2, sub, fu(fs), GRIS)

def flecha(p, q, c=AZUL, g=7, punta=24):
    d.line((p, q), fill=c, width=g)
    a = math.atan2(q[1] - p[1], q[0] - p[0])
    d.polygon([q, (q[0] - punta * math.cos(a - .45), q[1] - punta * math.sin(a - .45)), (q[0] - punta * math.cos(a + .45), q[1] - punta * math.sin(a + .45))], fill=c)

def ruta(pts, c, g=7):
    for a, b in zip(pts[:-2], pts[1:-1]): d.line((a, b), fill=c, width=g)
    flecha(pts[-2], pts[-1], c, g)

texto(W / 2, 70, 'Metodología de desarrollo del software de la tesis', fu(62, True))
texto(W / 2, 150, 'Scrum + IA-ASE: cada Sprint entrega un módulo completo, de la base de datos a la pantalla', fu(36), AZUL)

Y, AL = 470, 230
caja(50, Y, 330, AL, 'Product Backlog', 'requisitos con sus\ncriterios de aceptación')
caja(430, Y, 300, AL, 'Sprint Planning', 'se elige el módulo\ny su objetivo')
caja(1900, Y, 300, AL, 'Review + Retro', 'demostración al taller\ny mejoras')
caja(2250, Y, 300, AL, 'Incremento', 'módulo integrado\ny probado', VERDE, VERDE_CL)
flecha((380, Y + AL / 2), (425, Y + AL / 2))
flecha((730, Y + AL / 2), (775, Y + AL / 2))
flecha((1850, Y + AL / 2), (1895, Y + AL / 2))
flecha((2200, Y + AL / 2), (2245, Y + AL / 2))

# Panel del Sprint
PX, PY, PW, PH = 780, 240, 1070, 800
d.rounded_rectangle((PX, PY, PX + PW, PY + PH), 46, fill=AZUL_CL, outline=AZUL, width=7)
texto(PX + PW / 2, PY + 50, 'Sprint: desarrollo vertical de un módulo', fu(40, True), AZUL)
texto(PX + PW / 2, PY + 100, 'registro diario del avance', fu(27), GRIS)
bw, bh, by = 225, 150, PY + 150
pasos = [('1. Criterios', 'Dado, Cuando\ny Entonces'), ('2. Construir', 'una capa\ncada vez'), ('3. Probar', 'automáticas y\nen localhost'), ('4. Corregir', 'hasta que\ntodo pasa')]
xs = [PX + 35 + i * (bw + 33) for i in range(4)]
for x, (a, b) in zip(xs, pasos):
    caja(x, by, bw, bh, a, b, MORADO, 'white', 31, 25)
for a, b in zip(xs[:-1], xs[1:]):
    flecha((a + bw, by + bh / 2), (b - 4, by + bh / 2), MORADO, 6, 20)
# retorno de Corregir a Construir
yr = by + bh + 42
ruta([(xs[3] + bw / 2, by + bh), (xs[3] + bw / 2, yr), (xs[1] + bw / 2, yr), (xs[1] + bw / 2, by + bh + 4)], MORADO, 6)
texto((xs[1] + xs[3] + bw) / 2, yr + 30, 'se repite si una prueba falla', fu(25), MORADO)

# capas del módulo
cy = yr + 78
texto(PX + PW / 2, cy, 'Capas del módulo (corte vertical)', fu(30, True), TINTA)
capas = ['Base de datos', 'API y reglas', 'Pantalla', 'Pruebas']
cw = 232
for i, c in enumerate(capas):
    x = PX + 35 + i * (cw + 24)
    d.rounded_rectangle((x, cy + 34, x + cw, cy + 34 + 78), 18, fill='white', outline=AZUL, width=4)
    texto(x + cw / 2, cy + 34 + 39, c, fu(28, True), AZUL)
    if i < 3: flecha((x + cw, cy + 73), (x + cw + 22, cy + 73), AZUL, 5, 16)

# IA-ASE
iy = cy + 150
d.rounded_rectangle((PX + 35, iy, PX + PW - 35, iy + 215), 24, fill=NARANJA_CL, outline=NARANJA, width=4)
texto(PX + PW / 2, iy + 36, 'IA-ASE', fu(34, True), NARANJA)
ia = [('Criterios de aceptación', 'dicen qué construir\ny qué probar'), ('Agentes de IA', 'proponen pruebas\ny código'), ('Harness', 'las pruebas deciden\nqué se acepta')]
for i, (a, b) in enumerate(ia):
    x = PX + 35 + (PW - 70) * (i + .5) / 3
    texto(x, iy + 92, a, fu(28, True), NARANJA)
    texto(x, iy + 132, b, fu(25), GRIS)

# Entrega incremental
gy = 1190
texto(W / 2, gy, 'Entrega incremental por módulos dentro del mismo ciclo Scrum', fu(34, True), VERDE)
mods = [('S1', 'Acceso y\nroles'), ('S2', 'Clientes y\nvehículos'), ('S3', 'Órdenes de servicio\n(en curso)'), ('S5', 'Maestros y\nprecios'), ('S4', 'Migración\ninicial'), ('S6-S7', 'Planes y\nreajuste'), ('S8-S14', 'Tareas, citas,\nposventa y más')]
mw, mh = 268, 150
x0 = (W - (len(mods) * mw + (len(mods) - 1) * 42)) / 2
for i, (a, b) in enumerate(mods):
    x = x0 + i * (mw + 42)
    hecho = i in (0, 1, 3)
    d.rounded_rectangle((x, gy + 50, x + mw, gy + 50 + mh), 22, fill=VERDE_CL if hecho else 'white', outline=VERDE, width=5 if hecho else 3)
    texto(x + mw / 2, gy + 50 + 36, a, fu(32, True), VERDE)
    texto(x + mw / 2, gy + 50 + 78, b, fu(25), GRIS)
    if i < len(mods) - 1: flecha((x + mw, gy + 50 + mh / 2), (x + mw + 38, gy + 50 + mh / 2), VERDE, 6, 20)
# incremento baja a la fila de módulos y la fila realimenta al backlog
xe = x0 + len(mods) * (mw + 42) - 42
ruta([(2400, Y + AL), (2400, gy + 50 + mh / 2), (xe + 6, gy + 50 + mh / 2)], VERDE, 7)
texto(2385, Y + AL + 150, 'cada incremento\nse acumula', fu(26, True), VERDE, 'rm')
ruta([(x0, gy + 50 + mh / 2), (215, gy + 50 + mh / 2), (215, Y + AL + 6)], VERDE, 7)
texto(40, Y + AL + 150, 'lo aprendido\nrealimenta\nel backlog', fu(26, True), VERDE, 'lm')

texto(W / 2 - 330, 1515, 'Fondo verde: módulos terminados y probados', fu(27), VERDE)
texto(W / 2 + 400, 1515, 'La persona valida · la IA apoya', fu(27, True), TINTA)
d.line((60, 1565, W - 60, 1565), fill=(203, 213, 225), width=3)
texto(W / 2, 1592, 'DAM-001', fu(22), GRIS)

sal = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'png', 'DAM-001_metodologia_scrum_ia_ase.png')
img.save(sal, optimize=True)
print(sal)
