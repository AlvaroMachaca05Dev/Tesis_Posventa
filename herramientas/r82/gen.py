# -*- coding: utf-8 -*-
"""Genera el Excel del anexo, los CSV R8.2 del repositorio, las tablas LaTeX y las páginas de evidencia."""
import csv, json, os, re, sys, html
sys.path.insert(0, os.path.dirname(__file__))
from datos import *  # noqa

REPO = 'F:/Tesis/Tesis_Posventa'
TESIS = 'J:/Mi unidad/Trabajo RSA/Tesis sistema posventa/2_documento-tesis-overleaf'
EV = 'C:/Users/alvaa/AppData/Local/Temp/claude/d485c19c858907d4/d6489753-d76b-4094-902b-732950b18a42/scratchpad/ev'
R81 = leer_r81(f'{REPO}/docs/requisitos/REQUISITOS_FUNCIONALES_FINALES_R81.csv', EXTRA_R81)

RFD = {r[0]: r for r in RF}
assert len(RF) == 49, len(RF)
todos = sorted(set(R81) | set(RFD))
assert len(todos) == 103, len(todos)

def destino(c):
    if c in RFD: return 'Queda'
    if c in ABSORBIDOS: return 'Absorbido'
    if c in BETA: return 'Beta'
    if c in A_RN: return 'Regla de negocio'
    if c in MIGRACION: return 'Migración interna'
    raise KeyError(c)

def destino_det(c):
    d = destino(c)
    if d == 'Absorbido': return f'Criterio de aceptación de {ABSORBIDOS[c]}'
    if d == 'Regla de negocio': return f'Pasa a {A_RN[c]}'
    if d == 'Migración interna': return 'Pasa al procedimiento de migración RN-11'
    if d == 'Beta': return NOTA_ABS.get(c, 'Segunda versión')
    return '—'

cuenta = {}
for c in R81:
    cuenta[destino(c)] = cuenta.get(destino(c), 0) + 1
print('R81 (99):', cuenta)
assert cuenta == {'Queda': 45, 'Absorbido': 17, 'Beta': 26, 'Regla de negocio': 5, 'Migración interna': 6}, cuenta

# CA numerados por requisito
def cas(r):
    return [(f'{r[0]}.CA-{i}', t, o) for i, (t, o) in enumerate(r[7], 1)]

HU_DE = {}
for h in HU:
    for x in h[4]: HU_DE.setdefault(x, h[0])
CU_DE = {}
for c in CU:
    for x in c[3]: CU_DE.setdefault(x, c[0])
CP_DE = {}
for c in CP_TODOS:
    CP_DE.setdefault(c[1], []).append(c[0])
SLICE_DE = {x: s[0] for s in SLICES for x in s[2]}
RN_DE = {}
for rn in RN:
    for x in re.findall(r'RF-\d{3}', rn[4]):
        RN_DE.setdefault(x, []).append(rn[0])

# ---------------------------------------------------------------------------
# Resultados reales de las pruebas
# ---------------------------------------------------------------------------
api = json.load(open(f'{EV}/api.json', encoding='utf-8'))
web = json.load(open(f'{EV}/web.json', encoding='utf-8'))
RES = {}
for suite in api['testResults'] + web['testResults']:
    for t in suite['assertionResults']:
        RES[t['title']] = (t['status'], t.get('duration') or 0, '/'.join(suite['name'].replace('\\', '/').split('/')[-2:]), t.get('ancestorTitles') or [])
RES_TOT = dict(api=(api['numPassedTests'], api['numTotalTests']), web=(web['numPassedTests'], web['numTotalTests']))
# Sprint (slice) al que pertenece cada archivo de prueba: así las pruebas se presentan por sprint.
SPRINT_ARCHIVO = {
 'sesion.spec.ts': 'S1', 'App.test.tsx': 'S1', 'usuario.spec.ts': 'S1', 'Usuarios.test.tsx': 'S1',
 'maestros.spec.ts': 'S2', 'Maestros.test.tsx': 'S2', 'precarga.spec.ts': 'S2',
 'ordenServicio.spec.ts': 'S3', 'Ordenes.test.tsx': 'S3', 'base.spec.ts': 'S3',
 's5.spec.ts': 'S5', 'maestros.reglas.spec.ts': 'S5', 'S5.test.tsx': 'S5',
}
def sprint_de(archivo):
    return SPRINT_ARCHIVO.get(archivo.replace('\\', '/').split('/')[-1], '—')
POR_SPRINT = {}
for conj, datos_ in (('api', api), ('web', web)):
    for suite in datos_['testResults']:
        sp = sprint_de(suite['name'])
        for t in suite['assertionResults']:
            a = POR_SPRINT.setdefault(sp, {'api': [0, 0], 'web': [0, 0], 'archivos': set()})
            a[conj][1] += 1
            a[conj][0] += t['status'] == 'passed'
            a['archivos'].add(suite['name'].replace('\\', '/').split('/')[-1])
assert '—' not in POR_SPRINT, 'Hay un archivo de prueba sin sprint: ' + str(POR_SPRINT.get('—'))
print('Pruebas por sprint:', {k: (v['api'], v['web']) for k, v in sorted(POR_SPRINT.items())})
print('Pruebas reales:', RES_TOT)

def resultado_cp(cp):
    if not cp[9]: return 'No ejecutado', ''
    est = []
    for nombre in cp[9]:
        if nombre not in RES: raise KeyError(f'{cp[0]}: no encuentro la prueba «{nombre}»')
        est.append(RES[nombre][0])
    return ('Pasó' if all(e == 'passed' for e in est) else 'Falló'), FECHA

# ---------------------------------------------------------------------------
# Excel
# ---------------------------------------------------------------------------
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

wb = Workbook()
AZUL = PatternFill('solid', fgColor='005679')
fino = Side(style='thin', color='BBBBBB')

def hoja(nombre, cab, filas, anchos):
    ws = wb.create_sheet(nombre)
    ws.append(cab)
    for f in filas: ws.append(list(f))
    for i, w in enumerate(anchos, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF'); c.fill = AZUL
        c.alignment = Alignment(wrap_text=True, vertical='center')
    for fila in ws.iter_rows(min_row=2):
        for c in fila:
            c.alignment = Alignment(wrap_text=True, vertical='top')
            c.border = Border(top=fino, bottom=fino, left=fino, right=fino)
    ws.freeze_panes = 'B2'
    ws.auto_filter.ref = ws.dimensions
    return ws

ws0 = wb.active; ws0.title = 'Léeme'
for linea in [
    f'Anexo de requisitos, historias de usuario, pruebas y trazabilidad — {VERSION}, {FECHA}',
    'Sistema web de posventa para Robert Service Automotriz. Autor: ' + AUTOR,
    '',
    'Hojas: RF (los 103 códigos y su destino) · CA (criterios de aceptación) · RN · RNF · HU · CU · CP · Trazabilidad diseño · Trazabilidad desarrollo · Slices · Beta · Equivalencias.',
    'Los códigos no cambian durante el desarrollo. La columna «Número final» se llena al renumerar, al cierre de la tesis; la hoja Equivalencias guardará la tabla de códigos viejos y nuevos.',
    'Destinos: Queda (requisito de la tesis) · Absorbido (pasa a criterio de aceptación de otro requisito) · Beta (segunda versión) · Regla de negocio · Migración interna.',
    f'Conteo de los 99 códigos R8.1: Queda 45 · Absorbido 17 · Beta 26 · Regla de negocio 5 · Migración interna 6. Nuevos R8.2: RF-100 a RF-103. Total en la tesis: 49.',
    f'Pruebas automáticas ejecutadas el {FECHA}: API {RES_TOT["api"][0]}/{RES_TOT["api"][1]}, interfaz {RES_TOT["web"][0]}/{RES_TOT["web"][1]}.',
    'Editable: se pueden cambiar nombres y textos; los códigos se mantienen. La tesis se regenera desde estos datos.',
]:
    ws0.append([linea])
ws0.column_dimensions['A'].width = 150
ws0['A1'].font = Font(bold=True, size=14)

filas = []
for c in todos:
    r = RFD.get(c)
    if r:
        filas.append((c, '', r[2], r[3], r[1], VERSION, FECHA, AUTOR, r[4], 'Investigador y personal del taller',
                      HU_DE.get(c, '—'), CU_DE.get(c, '—'), r[5], r[6], 'Queda', ', '.join(RN_DE.get(c, [])) or '—',
                      SLICE_DE.get(c, '—'), 'Nuevo en R8.2' if c in ('RF-100', 'RF-101', 'RF-102', 'RF-103') else 'Texto R8.2'))
    else:
        filas.append((c, '', '', R81[c], '', 'R8.1', '', AUTOR, '', '', '', '', '', '—', destino(c), '—', '—', destino_det(c)))
hoja('RF', ['Código', 'Número final', 'Nombre', 'Descripción', 'Módulo', 'Versión', 'Fecha', 'Autor', 'Actor', 'Fuente',
            'HU', 'CU', 'Importancia', 'Estado', 'Destino', 'Reglas que aplica', 'Slice', 'Comentario'], filas,
     [9, 9, 26, 70, 22, 8, 11, 14, 22, 20, 8, 8, 10, 12, 16, 16, 7, 34])

hoja('CA', ['Requisito', 'Criterio', 'Descripción', 'Origen'],
     [(r[0], k, t, o) for r in RF for (k, t, o) in cas(r)], [10, 16, 80, 12])
hoja('RN', ['Código', 'Nombre', 'Regla', 'Viene de', 'Se aplica en'], RN, [8, 24, 90, 14, 30])
hoja('RNF', ['Código', 'Categoría', 'Requisito', 'Criterio de medición', 'Estado', 'Evidencia'], RNF, [8, 14, 70, 36, 11, 24])
hoja('HU', ['Código', 'Nombre', 'Actor', 'Historia', 'Requisitos relacionados', 'Caso de uso', 'Criterios de aceptación',
            'Pruebas previstas', 'Estado'],
     [(h[0], h[1], h[2], h[3], ', '.join(h[4]), h[5], h[6], ', '.join(h[7]), h[8]) for h in HU],
     [8, 24, 18, 60, 30, 8, 60, 30, 11])
hoja('CU', ['Código', 'Caso de uso', 'Actores', 'Requisitos', 'HU', 'Propósito', 'Diagrama'],
     [(c[0], c[1], c[2], ', '.join(c[3]), c[4], c[5], c[6]) for c in CU], [8, 36, 24, 40, 8, 60, 14])
cpf = []
for c in CP_TODOS:
    res, fe = resultado_cp(c)
    cpf.append((c[0], c[1], c[2], c[3], c[4], c[5], c[6], res if res != 'No ejecutado' else 'Pendiente de ejecución',
                c[7], c[8], '; '.join(c[9]) or '—', fe, CP_A_ACTUALIZAR.get(c[0], '')))
hoja('CP', ['Código', 'Requisito', 'HU', 'Nombre', 'Precondiciones', 'Pasos', 'Resultado esperado', 'Resultado obtenido',
            'Tipo', 'Archivo de prueba', 'Prueba automática', 'Fecha de ejecución', 'Observación'], cpf,
     [8, 9, 8, 30, 26, 46, 46, 16, 20, 34, 50, 12, 40])
hoja('Trazabilidad diseño', ['Requisito', 'Nombre', 'Estado', 'Módulo', 'Caso de uso', 'DCU', 'DCL', 'DMD', 'DSE', 'DES', 'DAC'],
     [(r[0], r[2], r[6], r[1], CU_DE.get(r[0], '—')) + DIS[r[1]] for r in RF], [9, 30, 12, 24, 8, 14, 14, 14, 14, 14, 18])
hoja('Trazabilidad desarrollo', ['Requisito', 'Nombre', 'Estado', 'Slice', 'BD (tablas)', 'Back (API)', 'Front (pantalla)', 'Prueba', 'Casos de prueba'],
     [(r[0], r[2], r[6], SLICE_DE.get(r[0], '—')) + DEV.get(r[0], ('—', '—', '—', '—')) + (', '.join(CP_DE.get(r[0], [])),) for r in RF],
     [9, 30, 12, 7, 34, 40, 34, 34, 18])
hoja('Slices', ['Slice', 'Funcionalidad', 'Requisitos funcionales', 'Requisitos no funcionales', 'Estado'],
     [(s[0], s[1], ', '.join(s[2]) or '—', s[3], s[4]) for s in SLICES], [7, 44, 50, 18, 50])
hoja('Beta', ['Código', 'Requisito R8.1', 'Comentario'], [(c, R81[c], destino_det(c)) for c in BETA], [9, 90, 40])
ws = hoja('Beta resumen', ['Solución futura', 'Qué incluye'], BETA_RESUMEN, [30, 110])
hoja('Equivalencias', ['Código R8.2', 'Número final', 'Fecha'], [(r[0], '', '') for r in RF], [12, 14, 12])

os.makedirs(f'{TESIS}/anexos', exist_ok=True)
XLSX = f'{TESIS}/anexos/Anexo_requisitos_y_pruebas_R82.xlsx'
wb.save(XLSX)
print('Excel:', XLSX, os.path.getsize(XLSX))

# ---------------------------------------------------------------------------
# CSV del repositorio
# ---------------------------------------------------------------------------
dcsv = f'{REPO}/docs/requisitos/R82'
os.makedirs(dcsv, exist_ok=True)
def wcsv(nombre, cab, filas):
    with open(f'{dcsv}/{nombre}', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(cab); w.writerows(filas)
wcsv('REQUISITOS_R82.csv', ['Codigo', 'NumeroFinal', 'Nombre', 'Descripcion', 'Modulo', 'Actor', 'Importancia', 'Estado', 'Destino', 'Comentario'],
     [(f[0], '', f[2], f[3], f[4], f[8], f[12], f[13], f[14], f[17]) for f in filas])
wcsv('CRITERIOS_ACEPTACION_R82.csv', ['RF', 'Criterio', 'Descripcion', 'Origen'], [(r[0], k, t, o) for r in RF for (k, t, o) in cas(r)])
wcsv('REGLAS_NEGOCIO_R82.csv', ['Codigo', 'Nombre', 'Regla', 'VieneDe', 'SeAplicaEn'], RN)
wcsv('REQUISITOS_NO_FUNCIONALES_R82.csv', ['Codigo', 'Categoria', 'Requisito', 'Medicion', 'Estado', 'Evidencia'], RNF)
wcsv('HISTORIAS_USUARIO_R82.csv', ['Codigo', 'Nombre', 'Actor', 'Historia', 'RF', 'CU', 'Criterios', 'CP', 'Estado'],
     [(h[0], h[1], h[2], h[3], ', '.join(h[4]), h[5], h[6], ', '.join(h[7]), h[8]) for h in HU])
wcsv('CASOS_PRUEBA_R82.csv', ['Codigo', 'RF', 'HU', 'Nombre', 'Precondiciones', 'Pasos', 'Esperado', 'Obtenido', 'Tipo', 'Archivo', 'Prueba', 'Fecha', 'Observacion'], cpf)
wcsv('MATRIZ_TRAZABILIDAD_R82.csv', ['RF', 'Nombre', 'Estado', 'Modulo', 'CU', 'DCU', 'DCL', 'DMD', 'DSE', 'DES', 'DAC', 'Slice', 'BD', 'Backend', 'Front', 'Prueba', 'CP'],
     [(r[0], r[2], r[6], r[1], CU_DE.get(r[0], '—')) + DIS[r[1]] + (SLICE_DE.get(r[0], '—'),) + DEV.get(r[0], ('—', '—', '—', '—')) + (', '.join(CP_DE.get(r[0], [])),) for r in RF])
print('CSV en', dcsv)

# ---------------------------------------------------------------------------
# LaTeX
# ---------------------------------------------------------------------------
def tx(s):
    s = str(s)
    for a, b in [('\\', r'\textbackslash{}'), ('&', r'\&'), ('%', r'\%'), ('#', r'\#'), ('_', r'\_'), ('$', r'\$'),
                 ('{', r'\{'), ('}', r'\}'), ('~', r'\textasciitilde{}'), ('^', r'\textasciicircum{}'), ('→', 'a'), ('–', '--')]:
        s = s.replace(a, b)
    return s

out = {}
L = []
L.append(r'% Generado por gen.py (R8.2, ' + FECHA + r'). No editar a mano: editar el Excel o datos.py y regenerar.')
L.append(r'\section{Requisitos del sistema}\label{sec:requisitos-r82}')
L.append(r'Al revisar los 99 requisitos de la versión R8.1 dejé en la tesis los que el taller usa en esta versión. Los que eran un detalle de otro pasaron a ser sus criterios de aceptación, las automatizaciones pasaron a reglas de negocio del servidor y la carga masiva se reemplazó por una migración inicial que hago yo con los datos del sistema anterior del taller. Agregué cuatro requisitos nuevos para los grupos de vehículos, los precios por grupo, el solapamiento de servicios y la sugerencia de planes. Durante el desarrollo los códigos no cambian; al cerrar la tesis los renumeraré una sola vez con una tabla de equivalencias. El detalle completo de cada ficha está en el anexo editable (Anexo~\ref{anx:enlaces}).')
L.append(r'\begin{table}[H]\centering\small\caption{Destino de los 99 requisitos de la versión R8.1}\begin{tabular}{L{4.6cm}R{1.6cm}L{8cm}}\toprule Destino & Cantidad & Qué significa\\\midrule')
for k, v, d in [('Quedan en la tesis', 45, 'Conservan su código; varios absorben a otros.'), ('Absorbidos', 17, 'Pasan a criterio de aceptación de otro requisito.'),
                ('Segunda versión (beta)', 26, 'Se resumen como soluciones futuras.'), ('Reglas de negocio', 5, 'El servidor las aplica solo, sin pantalla.'),
                ('Migración interna', 6, 'La carga de datos la hago por dentro, una sola vez.'), ('Nuevos en R8.2', 4, 'RF-100 a RF-103.'),
                ('\\textbf{Requisitos funcionales de la tesis}', 49, '45 que quedan más 4 nuevos.')]:
    L.append(f'{k} & {v} & {tx(d)}\\\\')
L.append(r'\bottomrule\end{tabular}\end{table}')

L.append(r'\subsection{Requisitos funcionales}')
L.append(r'El cuadro resume los 49 requisitos por módulo. El estado Implementado indica que el requisito tiene código real con pruebas que pasan; Parcial, que una parte ya está hecha y falta el ajuste de la versión R8.2; Pendiente, que todavía no tiene código.')
L.append(r'\scriptsize\setlength{\tabcolsep}{3pt}\begin{longtable}{L{1.15cm}L{3.1cm}L{9.1cm}L{1.6cm}}')
L.append(r'\caption{Requisitos funcionales de la primera versión}\label{tab:rf-r82}\\\toprule Código & Nombre & Requisito & Estado\\\midrule\endfirsthead\toprule Código & Nombre & Requisito & Estado\\\midrule\endhead')
mod_ant = None
for r in RF:
    if r[1] != mod_ant:
        L.append(r'\multicolumn{4}{l}{\textbf{' + tx(r[1]) + r'}}\\'); mod_ant = r[1]
    L.append(f'{r[0]} & {tx(r[2])} & {tx(r[3])} & {r[6]}\\\\')
L.append(r'\bottomrule\end{longtable}\normalsize')

L.append(r'\subsection{Fichas de requisitos}')
L.append(r'Cada requisito tiene su ficha con los mismos campos. Muestro tres como ejemplo: uno implementado, uno de citas y uno nuevo; las 49 fichas completas están en la hoja RF del anexo editable.')
for cod in ['RF-011', 'RF-053', 'RF-101']:
    r = RFD[cod]
    L.append(r'\begin{table}[H]\centering\small\caption{Ficha del requisito ' + cod + r'}\begin{tabular}{L{3.6cm}L{10.6cm}}\toprule')
    campos = [('Código', cod), ('Historia de usuario', HU_DE.get(cod, '—')), ('Caso de uso', CU_DE.get(cod, '—')), ('Nombre', r[2]),
              ('Versión', VERSION), ('Fecha', FECHA), ('Autor', AUTOR), ('Actor', r[4]), ('Fuente', 'Investigador y personal del taller'),
              ('Reglas relacionadas', ', '.join(RN_DE.get(cod, [])) or '—'), ('Descripción', r[3]),
              ('Criterios de aceptación', ' '.join(f'{k}: {t}' for k, t, o in cas(r))), ('Importancia', r[5]), ('Estado', r[6]),
              ('Comentario', 'Absorbe a ' + ', '.join(sorted({o for _, _, o in cas(r) if o not in (cod, 'Nuevo')})) if any(o not in (cod, 'Nuevo') for _, _, o in cas(r)) else '—')]
    for k, v in campos:
        L.append(f'\\textbf{{{tx(k)}}} & {tx(v)}\\\\')
    L.append(r'\bottomrule\end{tabular}\end{table}')

L.append(r'\subsection{Reglas de negocio}\label{sec:rn-r82}')
L.append(r'Las reglas de negocio no son requisitos funcionales: son condiciones o cálculos que el servidor aplica solo cuando el usuario hace otra cosa. Cada una indica de dónde viene y en qué requisito se aplica. Las automatizaciones dejan de configurarse en pantalla y quedan como reglas fijas del servidor.')
L.append(r'\scriptsize\setlength{\tabcolsep}{3pt}\begin{longtable}{L{1.1cm}L{2.6cm}L{8.2cm}L{1.6cm}L{1.9cm}}')
L.append(r'\caption{Reglas de negocio}\label{tab:rn-r82}\\\toprule Código & Nombre & Regla & Viene de & Se aplica en\\\midrule\endfirsthead\toprule Código & Nombre & Regla & Viene de & Se aplica en\\\midrule\endhead')
for rn in RN:
    L.append(' & '.join(tx(x) for x in rn) + r'\\')
L.append(r'\bottomrule\end{longtable}\normalsize')

L.append(r'\subsection{Requisitos no funcionales}\label{sec:rnf-r82}')
L.append(r'Los requisitos no funcionales fijan cómo debe comportarse el sistema. Indico cómo se mide cada uno y si ya se cumple con evidencia.')
L.append(r'\scriptsize\setlength{\tabcolsep}{3pt}\begin{longtable}{L{1.2cm}L{1.9cm}L{6.4cm}L{3.2cm}L{1.4cm}}')
L.append(r'\caption{Requisitos no funcionales}\label{tab:rnf-r82}\\\toprule Código & Categoría & Requisito & Medición & Estado\\\midrule\endfirsthead\toprule Código & Categoría & Requisito & Medición & Estado\\\midrule\endhead')
for x in RNF:
    L.append(' & '.join(tx(v) for v in x[:5]) + r'\\')
L.append(r'\bottomrule\end{longtable}\normalsize')

L.append(r'\subsection{Soluciones para las siguientes etapas}')
L.append(r'Lo que pasó a segunda versión no se detalla requisito por requisito. Lo agrupo en soluciones futuras; los códigos de origen están en la hoja Beta del anexo editable.')
L.append(r'\begin{table}[H]\centering\small\caption{Soluciones previstas para las siguientes etapas}\begin{tabular}{L{4cm}L{10.2cm}}\toprule Solución & Qué incluye\\\midrule')
for a, b in BETA_RESUMEN:
    L.append(f'{tx(a)} & {tx(b)}\\\\')
L.append(r'\bottomrule\end{tabular}\end{table}')
out['r82_requisitos.tex'] = L

# --- HU y CU ---------------------------------------------------------------
L = [r'% Generado por gen.py (R8.2).']
L.append(r'\section{Historias de usuario}\label{sec:hu-r82}')
L.append(r'Escribí una historia de usuario por cada proceso del taller, con el formato «como, quiero, para». Cada una se relaciona con sus requisitos, su caso de uso, sus criterios de aceptación y las pruebas previstas. El cuadro resume las quince y luego muestro en ficha las ocho de los procesos principales; las demás fichas están en la hoja HU del anexo editable.')
L.append(r'\scriptsize\setlength{\tabcolsep}{3pt}\begin{longtable}{L{1.1cm}L{3.2cm}L{5.4cm}L{3.2cm}L{1.6cm}}')
L.append(r'\caption{Historias de usuario}\label{tab:hu-r82}\\\toprule Código & Nombre & Historia & Requisitos & Estado\\\midrule\endfirsthead\toprule Código & Nombre & Historia & Requisitos & Estado\\\midrule\endhead')
for h in HU:
    L.append(f'{h[0]} & {tx(h[1])} & {tx(h[3])} & {tx(", ".join(h[4]))} & {h[8]}\\\\')
L.append(r'\bottomrule\end{longtable}\normalsize')
for hc in ['HU-01', 'HU-03', 'HU-05', 'HU-06', 'HU-07', 'HU-09', 'HU-11', 'HU-13']:
    h = next(x for x in HU if x[0] == hc)
    L.append(r'\begin{table}[H]\centering\small\caption{Ficha de la historia ' + hc + r'}\begin{tabular}{L{3.6cm}L{10.6cm}}\toprule')
    for k, v in [('Código', h[0]), ('Nombre', h[1]), ('Actor', h[2]), ('Historia', h[3]), ('Requisitos relacionados', ', '.join(h[4])),
                 ('Caso de uso', h[5]), ('Criterios de aceptación', h[6]), ('Pruebas previstas', ', '.join(h[7])), ('Estado', h[8])]:
        L.append(f'\\textbf{{{tx(k)}}} & {tx(v)}\\\\')
    L.append(r'\bottomrule\end{tabular}\end{table}')

L.append(r'\section{Casos de uso}\label{sec:cu-r82}')
L.append(r'Los actores son las personas o sistemas que usan cada caso. El cuadro siguiente los define y luego resumo los quince casos de uso con sus requisitos; describo en detalle los cinco del recorrido principal.')
L.append(r'\begin{table}[H]\centering\small\caption{Actores del sistema}\begin{tabular}{L{4.4cm}L{9.8cm}}\toprule Actor & Responsabilidad\\\midrule')
for a, b in ACTORES:
    L.append(f'{tx(a)} & {tx(b)}\\\\')
L.append(r'\bottomrule\end{tabular}\end{table}')
L.append(r'\scriptsize\setlength{\tabcolsep}{3pt}\begin{longtable}{L{1.1cm}L{3.6cm}L{2.6cm}L{3.6cm}L{1cm}L{2.2cm}}')
L.append(r'\caption{Casos de uso}\label{tab:cu-r82}\\\toprule Código & Caso de uso & Actores & Requisitos & HU & Diagrama\\\midrule\endfirsthead\toprule Código & Caso de uso & Actores & Requisitos & HU & Diagrama\\\midrule\endhead')
for c in CU:
    L.append(f'{c[0]} & {tx(c[1])} & {tx(c[2])} & {tx(", ".join(c[3]))} & {c[4]} & {c[6]}\\\\')
L.append(r'\bottomrule\end{longtable}\normalsize')
for cc, (ctx, flujo, alt) in CU_CONTEXTO.items():
    c = next(x for x in CU if x[0] == cc)
    L.append(r'\begin{table}[H]\centering\small\caption{Descripción del caso de uso ' + cc + r'}\begin{tabular}{L{3.6cm}L{10.6cm}}\toprule')
    for k, v in [('Definición', f'{cc} {c[1]}'), ('Contexto', ctx), ('Actores', c[2]), ('Flujo principal', ' '.join(f'{i}. {p}' for i, p in enumerate(flujo, 1))),
                 ('Flujo alternativo', alt), ('HU relacionada', c[4]), ('Requisitos relacionados', ', '.join(c[3])), ('Propósito', c[5])]:
        L.append(f'\\textbf{{{tx(k)}}} & {tx(v)}\\\\')
    L.append(r'\bottomrule\end{tabular}\end{table}')
out['r82_hu_cu.tex'] = L

# --- Slices ------------------------------------------------------------------
L = [r'% Generado por gen.py (R8.2).']
L.append(r'\section{Slices de desarrollo}\label{sec:slices-r82}')
L.append(r'Construyo el sistema por slices: cada uno entrega una funcionalidad de punta a punta (base de datos, API, pantalla y pruebas). Con el recorte de la versión R8.2 los ordené según los requisitos aprobados. S1 y S2 están terminados; S3 está en curso porque falta la corrección de la ODS cerrada y los ajustes de esta versión. S4 ya no es una carga masiva diaria: es el procedimiento interno de migración, sin requisitos funcionales.')
L.append(r'\scriptsize\setlength{\tabcolsep}{3pt}\begin{longtable}{L{0.9cm}L{4cm}L{4.6cm}L{1.8cm}L{3.2cm}}')
L.append(r'\caption{Slices de desarrollo de la versión R8.2}\label{tab:slices-r82}\\\toprule Slice & Funcionalidad & Requisitos funcionales & RNF & Estado\\\midrule\endfirsthead\toprule Slice & Funcionalidad & Requisitos funcionales & RNF & Estado\\\midrule\endhead')
for s in SLICES:
    L.append(f'{s[0]} & {tx(s[1])} & {tx(", ".join(s[2]) or "—")} & {tx(s[3])} & {tx(s[4])}\\\\')
L.append(r'\bottomrule\end{longtable}\normalsize')
out['r82_slices.tex'] = L

# --- Trazabilidad ------------------------------------------------------------
L = [r'% Generado por gen.py (R8.2).']
L.append(r'\clearpage\section{Matriz de trazabilidad}\label{sec:trazabilidad-r82}')
L.append(r'La trazabilidad une cada requisito con su diseño y con su desarrollo. La primera matriz lo relaciona con su caso de uso y sus diagramas; la segunda, con las tablas de la base de datos, la API, la pantalla, las pruebas automáticas y los casos de prueba. Un guion indica que todavía no hay código. Las dos matrices completas y editables están en el anexo.')
L.append(r'\begin{landscape}\scriptsize\setlength{\tabcolsep}{2.5pt}\begin{longtable}{L{1.1cm}L{3.6cm}L{1.6cm}L{0.9cm}L{1.8cm}L{1.9cm}L{1.9cm}L{1.9cm}L{1.9cm}L{2.6cm}}')
L.append(r'\caption{Trazabilidad de diseño}\label{tab:traz-diseno-r82}\\\toprule RF & Nombre & Estado & CU & DCU & DCL & DMD & DSE & DES & DAC\\\midrule\endfirsthead\toprule RF & Nombre & Estado & CU & DCU & DCL & DMD & DSE & DES & DAC\\\midrule\endhead')
for r in RF:
    L.append(' & '.join([r[0], tx(r[2]), r[6], CU_DE.get(r[0], '—')] + [tx(x) for x in DIS[r[1]]]) + r'\\')
L.append(r'\bottomrule\end{longtable}')
L.append(r'\begin{longtable}{L{1.1cm}L{3.2cm}L{0.8cm}L{4cm}L{4.4cm}L{3.6cm}L{3cm}L{1.6cm}}')
L.append(r'\caption{Trazabilidad de desarrollo}\label{tab:traz-desarrollo-r82}\\\toprule RF & Nombre & Slice & BD (tablas) & API & Pantalla & Prueba & CP\\\midrule\endfirsthead\toprule RF & Nombre & Slice & BD (tablas) & API & Pantalla & Prueba & CP\\\midrule\endhead')
for r in RF:
    d = DEV.get(r[0], ('—', '—', '—', '—'))
    L.append(' & '.join([r[0], tx(r[2]), SLICE_DE.get(r[0], '—')] + [tx(x) for x in d] + [tx(', '.join(CP_DE.get(r[0], [])))]) + r'\\')
L.append(r'\bottomrule\end{longtable}\normalsize\end{landscape}')
out['r82_trazabilidad.tex'] = L

# --- Pruebas ------------------------------------------------------------------
EJEC = sorted(CP_EJEC + CP_EXTRA_WEB, key=lambda c: c[0])
L = [r'% Generado por gen.py (R8.2).']
L.append(r'\clearpage\section{Plan y diseño de pruebas}\label{sec:plan-pruebas-r82}')
L.append(r'\subsection{Propósito y alcance}')
L.append(r'El plan comprueba que cada requisito funcional cumpla sus criterios de aceptación y que los requisitos no funcionales de seguridad, integridad y exactitud se sostengan. Alcanza a los 49 requisitos de la primera versión: diseñé al menos un caso de prueba por requisito y ejecuto los que corresponden a lo ya implementado. Lo que está en segunda versión no se prueba.')
L.append(r'\subsection{Tipos de prueba y entorno}')
L.append(r'\begin{table}[H]\centering\small\caption{Tipos de prueba}\begin{tabular}{L{3.4cm}L{4.6cm}L{6.2cm}}\toprule Tipo & Herramienta & Qué comprueba\\\midrule')
for a, b, c in [('Integración de la API', 'Jest y Supertest', 'Cada endpoint con su base de datos real: permisos, reglas, errores y concurrencia.'),
                ('Base de datos', 'Jest sobre PostgreSQL', 'Unicidad, integridad referencial, decimales exactos, transacciones y texto UTF-8.'),
                ('Interfaz', 'Vitest y Testing Library', 'Pantallas, modales, filtros y mensajes del servidor.'),
                ('Extremo a extremo del prototipo', 'Playwright', 'Recorrido del prototipo HTML que guía el desarrollo.'),
                ('Funcional manual', 'Lista de verificación', 'Revisión en localhost y, más adelante, con el personal del taller.')]:
    L.append(f'{a} & {b} & {c}\\\\')
L.append(r'\bottomrule\end{tabular}\end{table}')
L.append(r'Las pruebas de la API corren contra una base de PostgreSQL aparte (\texttt{posventa\_test}), que se crea desde cero con sus migraciones y sus semillas, de modo que nunca tocan los datos de desarrollo. Se ejecutan con \texttt{pnpm test} en el equipo de desarrollo con Windows 10, Node 22 y PostgreSQL 18.')
L.append(r'\subsection{Criterios de aceptación de las pruebas}')
L.append(r'Un caso pasa si el resultado obtenido coincide con el esperado. Un incremento se acepta solo si todas las pruebas automáticas pasan; si una falla, el cambio no se integra. Un requisito figura como Implementado cuando todos sus casos ejecutados pasan.')
L.append(r'\subsection{Formato del caso de prueba}')
L.append(r'Cada caso de prueba tiene estos campos: código, requisito, historia de usuario, nombre, precondiciones, pasos, resultado esperado, resultado obtenido, tipo, archivo de prueba, prueba automática y fecha de ejecución. La Sección~\ref{tab:cp-ejec-r82} muestra los casos ejecutados por sprint y el Anexo~\ref{anx:cp} lista los ' + str(len(CP_TODOS)) + ' casos diseñados.')

L.append(r'\subsection{Casos de prueba ejecutados por sprint}\label{tab:cp-ejec-r82}')
L.append(r'Cada sprint corresponde a un slice del plan (Cuadro~\ref{tab:slices-r82}) y se cierra solo cuando todas sus pruebas pasan. Para cada sprint presento su objetivo, sus casos de prueba con el resultado y el resumen de sus pruebas automáticas. El sprint S4 es la migración inicial de datos: es un procedimiento interno sin requisitos funcionales y se hará después del S5, porque también carga los maestros.')
for sp in SLICES:
    if sp[0] not in POR_SPRINT: continue
    casos = [c for c in EJEC if sprint_de(c[8]) == sp[0]]
    x = POR_SPRINT[sp[0]]
    L.append(r'\subsubsection*{Sprint ' + sp[0] + ' · ' + tx(sp[1]) + '}')
    L.append(f'\\noindent\\textbf{{Requisitos:}} {tx(", ".join(sp[2]))}. \\textbf{{Estado:}} {tx(sp[4])}. ' +
             f'\\textbf{{Archivos de prueba:}} \\texttt{{{tx(", ".join(sorted(x["archivos"])))}}}.')
    L.append(r'\scriptsize\setlength{\tabcolsep}{3pt}\begin{longtable}{L{1cm}L{1.1cm}L{3.2cm}L{4.8cm}L{2.2cm}L{1.2cm}}')
    L.append(r'\caption{Casos de prueba del sprint ' + sp[0] + r'}\\\toprule CP & RF & Nombre & Resultado esperado & Tipo & Resultado\\\midrule\endfirsthead\toprule CP & RF & Nombre & Resultado esperado & Tipo & Resultado\\\midrule\endhead')
    for c in casos:
        L.append(f'{c[0]} & {c[1]} & {tx(c[3])} & {tx(c[6])} & {tx(c[7])} & {resultado_cp(c)[0]}\\\\')
    L.append(r'\bottomrule\end{longtable}\normalsize')
    tot_s = x['api'][1] + x['web'][1]; pas_s = x['api'][0] + x['web'][0]
    L.append(f'\\noindent Ejecución del {FECHA}: {pas_s} de {tot_s} pruebas automáticas del sprint pasan ({x["api"][0]} de {x["api"][1]} de la API y la base de datos, {x["web"][0]} de {x["web"][1]} de la interfaz).')

L.append(r'\subsection{Registro de ejecución}')
L.append(f'El {FECHA} ejecuté todas las pruebas automáticas del sistema real. Pasaron {RES_TOT["api"][0]} de {RES_TOT["api"][1]} pruebas de la API y {RES_TOT["web"][0]} de {RES_TOT["web"][1]} de la interfaz, sin fallos. ' +
         r'Cada caso ejecutado corresponde a una o dos pruebas automáticas; su evidencia se muestra en la sección siguiente. El caso CP-16 todavía prueba la regla anterior de cierre («No aprobada»); con la regla RN-06 lo actualizaré junto con el slice S3.')
L.append(r'\begin{table}[H]\centering\small\caption{Pruebas automáticas por sprint, ejecución del ' + FECHA + r'}\begin{tabular}{L{5.6cm}R{1.6cm}R{1.6cm}R{1.6cm}R{1.6cm}}\toprule Sprint & API & Interfaz & Pasaron & Fallaron\\\midrule')
for sp in SLICES:
    if sp[0] not in POR_SPRINT: continue
    x = POR_SPRINT[sp[0]]; t_ = x['api'][1] + x['web'][1]; p_ = x['api'][0] + x['web'][0]
    L.append(f'{sp[0]} · {tx(sp[1])} & {x["api"][1]} & {x["web"][1]} & {p_} & {t_-p_}\\\\')
L.append(r'\bottomrule\end{tabular}\end{table}')
L.append(r'\begin{table}[H]\centering\small\caption{Resumen de la ejecución del ' + FECHA + r'}\begin{tabular}{L{4.2cm}R{1.8cm}R{1.8cm}R{1.8cm}}\toprule Conjunto & Pruebas & Pasaron & Fallaron\\\midrule')
L.append(f'API y base de datos (Jest) & {RES_TOT["api"][1]} & {RES_TOT["api"][0]} & {RES_TOT["api"][1]-RES_TOT["api"][0]}\\\\')
L.append(f'Interfaz (Vitest) & {RES_TOT["web"][1]} & {RES_TOT["web"][0]} & {RES_TOT["web"][1]-RES_TOT["web"][0]}\\\\\\midrule')
tot = RES_TOT['api'][1] + RES_TOT['web'][1]; pas = RES_TOT['api'][0] + RES_TOT['web'][0]
L.append(f'Total & {tot} & {pas} & {tot-pas}\\\\')
L.append(r'\bottomrule\end{tabular}\end{table}')

L.append(r'\subsection{Matriz de historias, requisitos y pruebas}')
L.append(r'\scriptsize\setlength{\tabcolsep}{3pt}\begin{longtable}{L{1.1cm}L{3.4cm}L{4.4cm}L{4.4cm}L{1.6cm}}')
L.append(r'\caption{Matriz HU, RF y CP}\label{tab:hu-rf-cp-r82}\\\toprule HU & Nombre & Requisitos & Casos de prueba & Estado\\\midrule\endfirsthead\toprule HU & Nombre & Requisitos & Casos de prueba & Estado\\\midrule\endhead')
for h in HU:
    L.append(f'{h[0]} & {tx(h[1])} & {tx(", ".join(h[4]))} & {tx(", ".join(h[7]))} & {h[8]}\\\\')
L.append(r'\bottomrule\end{longtable}\normalsize')

L.append(r'\subsection{Estado del plan}')
n_imp = sum(1 for r in RF if r[6] == 'Implementado'); n_par = sum(1 for r in RF if r[6] == 'Parcial')
L.append(f'De los 49 requisitos, {n_imp} están implementados, {n_par} están parciales y {49-n_imp-n_par} están pendientes. De los {len(CP_TODOS)} casos de prueba diseñados, {len(EJEC)} están ejecutados y pasan; los demás se ejecutarán en el slice de su requisito. ' +
         r'Las pruebas de rendimiento, compatibilidad y respaldo (RNF-07, RNF-10 y RNF-11) quedan para el entorno de pruebas en internet.')

out['r82_pruebas.tex'] = L
L = [r'% Generado por gen.py (R8.2).']
L.append(r'\clearpage\section{Evidencia de ejecución de las pruebas}\label{sec:evidencia-r82}')
L.append(r'Para cada caso ejecutado muestro una evidencia: la salida real de su prueba automática, tomada del reporte de la ejecución del ' + FECHA + r', con el archivo, el nombre de la prueba, su resultado y su duración. En cinco casos muestro además el código de la prueba, para explicar qué comprueba.')
SNIP = {
 'CP-02': ('apps/api/src/sesion/sesion.spec.ts', 'un Técnico recibe 403 en bancos'),
 'CP-12': ('apps/api/src/ordenServicio/ordenServicio.spec.ts', 'dos ODS que se crean a la vez'),
 'CP-15': ('apps/api/src/ordenServicio/ordenServicio.spec.ts', 'evidencias: son opcionales y como máximo 5'),
 'CP-18': ('apps/api/src/ordenServicio/ordenServicio.spec.ts', 'tres abonos a la vez'),
 'CP-24': ('apps/api/test/s5.spec.ts', 'el opcional se aplica solo si la cajera lo acepta'),
}
def fragmento(ruta, clave, maxl=22):
    lineas = open(f'{REPO}/{ruta}', encoding='utf-8').read().split('\n')
    i = next(k for k, l in enumerate(lineas) if clave in l)
    prof = 0; res = []
    for l in lineas[i:]:
        res.append(l)
        prof += l.count('{') - l.count('}')
        if prof <= 0 and len(res) > 1: break
        if len(res) >= maxl: res.append('    // …'); break
    ind = min(len(l) - len(l.lstrip()) for l in res if l.strip())
    return [l[ind:] for l in res], i + 1
EJEC_SPRINT = sorted(EJEC, key=lambda c: (sprint_de(c[8]), c[0]))
sp_actual = None
for c in EJEC_SPRINT:
    if sprint_de(c[8]) != sp_actual:
        sp_actual = sprint_de(c[8])
        nombre_sp = next(x[1] for x in SLICES if x[0] == sp_actual)
        L.append(r'\subsection{Sprint ' + sp_actual + ' · ' + tx(nombre_sp) + '}')
    L.append(r'\subsubsection*{' + c[0] + ' · ' + tx(c[3]) + ' (' + c[1] + ')}')
    L.append(f'\\noindent\\textbf{{Prueba:}} \\texttt{{{tx(c[8])}}}. \\textbf{{Esperado:}} {tx(c[6])}')
    if c[0] in SNIP:
        ruta, clave = SNIP[c[0]]
        frag, ln = fragmento(ruta, clave)
        L.append(r'\begin{lstlisting}[language=TypeScript,firstnumber=' + str(ln) + r',caption={Código de la prueba de ' + c[0] + r'}]')
        L.extend(frag)
        L.append(r'\end{lstlisting}')
    L.append(r'\begin{figure}[H]\centering\includegraphics[width=.92\textwidth]{imagenes/capitulo_05_validacion/evidencias/' + c[0] + r'.png}\caption{Evidencia de ejecución de ' + c[0] + r'}\end{figure}')
out['r82_evidencia.tex'] = L

# --- Anexos -----------------------------------------------------------------
L = [r'% Generado por gen.py (R8.2).']
L.append(r'\chapter*{Anexos}\addcontentsline{toc}{chapter}{Anexos}')
L.append(r'\section*{Anexo A. Enlaces}\label{anx:enlaces}\addcontentsline{toc}{section}{Anexo A. Enlaces}')
L.append(r'\begin{table}[H]\centering\small\caption{Enlaces del proyecto}\begin{tabular}{L{4.6cm}L{9.6cm}}\toprule Recurso & Enlace\\\midrule')
L.append(r'Repositorio del sistema (GitHub) & \url{https://github.com/AlvaroMachaca05Dev/Tesis_Posventa}\\')
L.append(r'Anexo editable: requisitos, HU, CU, casos de prueba y trazabilidad (Excel en Google Drive) & \textit{[Enlace de Google Drive pendiente: Anexo\_requisitos\_y\_pruebas\_R82.xlsx]}\\')
L.append(r'Evidencias de las pruebas & Carpeta \texttt{imagenes/capitulo\_05\_validacion/evidencias} del documento y reporte de ejecución en el repositorio (\texttt{docs/requisitos/R82})\\')
L.append(r'Prototipo HTML de guía & \texttt{prototipo/R\_Motriz\_R7.8.html} en el repositorio\\')
L.append(r'\bottomrule\end{tabular}\end{table}')
L.append(r'\section*{Anexo B. Casos de prueba diseñados}\label{anx:cp}\addcontentsline{toc}{section}{Anexo B. Casos de prueba diseñados}')
L.append(r'\scriptsize\setlength{\tabcolsep}{3pt}\begin{longtable}{L{1cm}L{1.1cm}L{1cm}L{3.2cm}L{5.6cm}L{2cm}}')
L.append(r'\caption{Casos de prueba diseñados}\\\toprule CP & RF & HU & Nombre & Resultado esperado & Resultado\\\midrule\endfirsthead\toprule CP & RF & HU & Nombre & Resultado esperado & Resultado\\\midrule\endhead')
for c in CP_TODOS:
    res = resultado_cp(c)[0]
    L.append(f'{c[0]} & {c[1]} & {c[2]} & {tx(c[3])} & {tx(c[6])} & {res if res != "No ejecutado" else "Pendiente"}\\\\')
L.append(r'\bottomrule\end{longtable}\normalsize')
L.append(r'\section*{Anexo C. Destino de los requisitos de la versión R8.1}\addcontentsline{toc}{section}{Anexo C. Destino de los requisitos R8.1}')
L.append(r'El cuadro indica qué pasó con cada código de la versión R8.1 que no quedó como requisito propio.')
L.append(r'\scriptsize\setlength{\tabcolsep}{3pt}\begin{longtable}{L{1.2cm}L{9.4cm}L{3.6cm}}')
L.append(r'\caption{Requisitos R8.1 absorbidos, en beta, en reglas o en la migración}\\\toprule Código & Requisito R8.1 & Destino\\\midrule\endfirsthead\toprule Código & Requisito R8.1 & Destino\\\midrule\endhead')
for c in sorted(R81):
    if c in RFD: continue
    L.append(f'{c} & {tx(R81[c])} & {tx(destino(c) if destino(c) not in ("Absorbido","Regla de negocio","Migración interna") else destino_det(c))}\\\\')
L.append(r'\bottomrule\end{longtable}\normalsize')
L.append(r'\section*{Anexo D. Tabla de equivalencias}\addcontentsline{toc}{section}{Anexo D. Tabla de equivalencias}')
L.append(r'Durante el desarrollo los códigos se mantienen y no se reutilizan. Al cerrar la tesis los renumeraré una sola vez, del RF-001 al último, siguiendo el recorrido del sistema, y aquí quedará la tabla de equivalencias con su fecha.')
out['r82_anexos.tex'] = L

os.makedirs(f'{TESIS}/secciones', exist_ok=True)
for nombre, lineas in out.items():
    ruta = f'{TESIS}/secciones/{nombre}'
    with open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lineas) + '\n')
    print('tex:', ruta, os.path.getsize(ruta))

# ---------------------------------------------------------------------------
# Páginas HTML de evidencia (se convierten a PNG con capturar.mjs)
# ---------------------------------------------------------------------------
dh = f'{EV}/html'; os.makedirs(dh, exist_ok=True)
for c in EJEC:
    filas = []
    for nombre in c[9]:
        st, dur, arch, anc = RES[nombre]
        filas.append(f'<div class="t"><span class="ok">✓</span> {html.escape(" › ".join(anc + [nombre]))} <span class="d">({dur} ms)</span></div>')
    conj = 'web' if c[7] == WEB else 'api'
    herramienta = 'npx dotenv -e ../../.env -- jest --runInBand --verbose' if conj == 'api' else 'npx vitest run --reporter=verbose'
    p, t = RES_TOT[conj]
    doc = f'''<!doctype html><html><head><meta charset="utf-8"><style>
body{{margin:0;background:#fff;font-family:Segoe UI,Arial,sans-serif}}
.win{{margin:12px;border:1px solid #c9ced6;border-radius:8px;overflow:hidden;width:1180px}}
.bar{{background:#e9ecef;padding:8px 12px;font-size:15px;color:#333;display:flex;justify-content:space-between}}
.term{{background:#1e1e1e;color:#d4d4d4;font-family:Consolas,monospace;font-size:16px;padding:14px 16px;line-height:1.55}}
.cmd{{color:#9cdcfe}} .pass{{background:#16a34a;color:#fff;padding:0 6px;border-radius:3px;font-weight:bold}}
.ok{{color:#4ade80;font-weight:bold}} .d{{color:#8b949e}} .t{{padding-left:22px}} .sum{{margin-top:10px;color:#4ade80}}
</style></head><body><div class="win"><div class="bar"><b>{c[0]} · {html.escape(c[3])} ({c[1]})</b><span>Ejecución del {FECHA}</span></div>
<div class="term"><div class="cmd">F:\\Tesis\\Tesis_Posventa\\apps\\{'api' if conj=='api' else 'web'}&gt; {herramienta}</div>
<div><span class="pass">PASS</span> {html.escape(c[8])}</div>{''.join(filas)}
<div class="sum">Tests: {p} passed, {t} total (conjunto {'API y base de datos' if conj=='api' else 'interfaz'})</div></div></div></body></html>'''
    open(f'{dh}/{c[0]}.html', 'w', encoding='utf-8').write(doc)
print('HTML de evidencia:', len(EJEC))
json.dump([c[0] for c in EJEC], open(f'{EV}/ejec.json', 'w'))
