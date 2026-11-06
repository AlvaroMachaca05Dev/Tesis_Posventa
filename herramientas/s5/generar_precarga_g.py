# -*- coding: utf-8 -*-
"""Genera database/seeds/precarga/s5/catalogo_g.json para el slice S5 con los grupos G1 a G4.

Fuentes (referencia Autodata en combinación con datos del taller RSA; sin datos personales):
- Excel de la reunión «precios_por_grupo_reunion.xlsx» (hojas «Precios por grupo» y «Filtros»).
- Paquete de integración del chat «Solapamiento de servicios»: reglas_solapamiento.json y familias_motor.json.
Uso: python generar_precarga_g.py <excel> <carpeta_precarga_integracion> <salida.json>
"""
import json, re, sys, unicodedata
import openpyxl

excel, integ, salida = sys.argv[1], sys.argv[2], sys.argv[3]

def norm(t):
    t = unicodedata.normalize('NFD', str(t or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', t).strip()

GRUPOS = [
    {'codigo': 'G1', 'nombre': 'Gasolinero motor chico', 'descripcion': 'Gasolina, motor de hasta 1.25 L (Tico, Spark, Picanto, i10, Alto)'},
    {'codigo': 'G2', 'nombre': 'Gasolinero motor mediano', 'descripcion': 'Gasolina, motor de 1.3 a 1.6 L (Yaris, Gol 1.6, Sail, Rio, Accent)'},
    {'codigo': 'G3', 'nombre': 'Gasolinero motor grande', 'descripcion': 'Gasolina, motor de más de 1.6 L (Corolla 1.8, Sportage, Tucson, Santa Fe)'},
    {'codigo': 'G4', 'nombre': 'Petrolero (diésel)', 'descripcion': 'Todo motor diésel, de cualquier tamaño (Hilux, H-1, Frontier, L200)'},
]
G = [g['codigo'] for g in GRUPOS]
LETRA = {'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'F': 'F', 'G': 'G', 'H': 'H', 'J': 'J', 'K': 'K', 'L': 'L', 'M': 'M', 'N': 'N', 'P': 'P', 'SERVICIOS EXTERNOS': 'X', 'REVISIÓN ADICIONAL': 'R'}

wb = openpyxl.load_workbook(excel, read_only=True, data_only=True)
filas = list(wb['Precios por grupo'].iter_rows(values_only=True))
servicios, seccion, cuenta = [], None, {}
for r in filas[3:]:
    if r[0] and not r[1]:
        s = str(r[0]).strip()
        seccion = LETRA.get(s.split(' · ')[0], LETRA.get(s, 'Z'))
        continue
    if not r[1] or not any(isinstance(x, (int, float)) for x in r[2:6]):
        continue
    cuenta[seccion] = cuenta.get(seccion, 0) + 1
    precios = {g: (float(v) if isinstance(v, (int, float)) else None) for g, v in zip(G, r[2:6])}
    estandar = precios['G2'] if precios['G2'] is not None else next(v for v in precios.values() if v is not None)
    nombre = str(r[1]).strip()
    servicios.append({'codigo': f'{seccion}{cuenta[seccion]:02d}', 'nombre': nombre, 'categoria': str(r[0]).strip().upper(),
                      'externo': seccion == 'X', 'trabajoMayor': bool(re.search(r'reparaci[oó]n de motor|cambio de anillos|bajada de motor|reparacion de caja', norm(nombre))),
                      'precios': precios, 'precioEstandar': estandar, 'horas': None, 'horasGrupo': None, 'repuestos': []})

# Horas: hoja «Filtros» (horas Autodata por grupo) y los 15 servicios del paquete de integración (estándar). Si no hay dato: 1 h (RN-08).
filtros = list(wb['Filtros'].iter_rows(values_only=True))
for r in filtros[3:]:
    if not r[0] or not isinstance(r[2], (int, float)):
        continue
    for s in servicios:
        if norm(s['nombre']) == norm(r[0]):
            s['horasGrupo'] = {g: float(h) for g, h in zip(G, r[2:6]) if isinstance(h, (int, float))}
            s['horas'] = s['horasGrupo'].get('G2')
integ_sv = {x['codigo']: x for x in json.load(open(f'{integ}/servicios.json', encoding='utf-8'))}
HORAS = {'ACE': ['cambio de aceite de motor'], 'AFI': ['afinamiento completo de motor (obturador'], 'BOM': ['cambio de bomba de agua'], 'BUJ': ['cambio de bujias'],
         'CAB': ['cambio de cable de embrague'], 'CAD': ['cambio de cadena de distribucion'], 'CMP': ['prueba de compresion'], 'COR': ['cambio de correa de distribucion'],
         'EMB': ['bajada de caja (kit de embrague)'], 'ETB': ['cambio de empaque de tapa de balancines'], 'IAC': ['limpieza de obturador'], 'MOT': ['reparacion de motor (sin torneria)'],
         'RAD': ['cambio de radiador'], 'REF': ['cambio de refrigerante'], 'SCN': ['escaner computarizado']}
for cod, prefijos in HORAS.items():
    for s in servicios:
        if s['horas'] is None and any(norm(s['nombre']).startswith(p) for p in prefijos):
            s['horas'] = integ_sv[cod]['horas_estandar']
            s['repuestos'] = integ_sv[cod].get('repuestos_sugeridos') or []

nombres = [s['nombre'] for s in servicios]
def N(*prefijos):
    out = [s['codigo'] for s in servicios if any(norm(s['nombre']).startswith(norm(p)) for p in prefijos)]
    assert out, prefijos
    return out

CULATA, CORREA, CADENA = N('Bajada de culata'), N('Cambio de correa de distribución'), N('Cambio de cadena de distribución')
BOMBA, BOMBA_CORREA, BOMBA_CADENA = N('Cambio de bomba de agua'), N('Cambio de bomba de agua (refrigeracion) (motor con correa'), N('Cambio de bomba de agua (refrigeracion) (motor con cadena')
PASTILLAS, KIT, PALIER = N('Cambio de pastillas de freno'), N('Bajada de caja (kit de embrague)'), N('Cambio de palier + engrasado')
TAPA, CREMALLERA, AXIAL, TERMINAL = N('Cambio de empaque de tapa de balancines'), N('Cambio de cremallera'), N('Cambio de axial'), N('Cambio de terminal de direccion')
AFIN_PARTES = N('Cambio de bujias', 'Limpieza de bujias', 'Cambio de filtro de aire', 'Limpieza de obturador', 'Limpieza de inyectores', 'Cambio de filtro de combustible tipo gasolina', 'Regulacion de minimo')
PAR = {
 'SOL-01': (CORREA, BOMBA_CORREA), 'SOL-02': (PASTILLAS, N('Cambio de fajas de freno')), 'SOL-03': (CULATA, TAPA), 'SOL-04': (PALIER, N('Cambio de poncho de palier')),
 'SOL-05': (KIT, N('Bajada de caja (collarín')), 'SOL-06': (N('Bajada de culata · motor con correa'), CORREA), 'SOL-07': (N('Cambio de amortiguador'), N('Cambio de trapecio')),
 'SOL-08': (AXIAL, TERMINAL), 'SOL-09': (CREMALLERA, TERMINAL), 'SOL-10': (CREMALLERA, AXIAL), 'SOL-11': (PASTILLAS, N('Limpieza y cambio de seguros de pastillas')),
 'SOL-12': (PASTILLAS, N('Mantenimiento de pastillas de freno')), 'SOL-13': (N('Cambio de discos de freno'), PASTILLAS), 'SOL-14': (CORREA, N('Cambio de reten delantero de ciguenal')),
 'SOL-15': (CORREA, N('Cambio de reten de arbol de levas')), 'SOL-16': (KIT, N('Cambio de reten posterior de ciguenal')), 'SOL-17': (N('Calibracion de valvulas'), TAPA),
 'SOL-18': (PALIER, N('Cambio de reten de palier')), 'SOL-19': (N('Mantenimiento de palier'), N('Cambio de poncho de palier')), 'SOL-20': (PALIER, N('Mantenimiento de palier')),
 'SOL-21': (N('Bajada de tanque de combustible'), N('Cambio de bomba de combustible tipo gasolina (electrica', 'Cambio de filtro de combustible tipo gasolina (dentro del tanque', 'Cambio de sensor de nivel de combustible')),
 'SOL-22': (N('Cambio de trapecio'), N('Cambio de rotula')), 'SOL-23': (N('Cambio de bombin o caliper'), N('Purgado y cambio de liquido de frenos')),
 'SOL-24': (N('Cambio de radiador'), N('Cambio de refrigerante')), 'SOL-25': (CULATA, N('Cambio de refrigerante')), 'SOL-26': (BOMBA, N('Cambio de refrigerante')),
 'SOL-27': (CADENA, N('Cambio de correa de accesorios')), 'SOL-28': (CORREA, N('Cambio de correa de accesorios')), 'SOL-29': (BOMBA, N('Cambio de correa de accesorios')),
 'SOL-30': (CADENA, TAPA), 'SOL-31': (N('Bajada de culata · motor con cadena'), CADENA), 'SOL-32': (CULATA, BOMBA), 'SOL-33': (BOMBA, N('Cambio de radiador')),
 'SOL-34': (CULATA, N('Cambio de radiador')), 'SOL-35': (CADENA, BOMBA_CADENA), 'SOL-36': (N('Cambio de amortiguador'), N('Cambio de rotula')),
 'SOL-40': (N('Afinamiento completo'), AFIN_PARTES), 'SOL-42': (N('Torneria completo'), N('Torneria culata', 'Torneria monoblock')),
 'SOL-43': (KIT, N('Cambio de bomba auxiliar de embrague - concentrica')),
}
CONJ = {
 'SOL-37': (2, N('Cambio de amortiguador', 'Cambio de trapecio', 'Cambio de rotula', 'Cambio de bieletas', 'Cambio de terminal de direccion', 'Cambio de axial', 'Cambio de cremallera',
                  'Cambio de rodaje de rueda', 'Cambio de palier + engrasado', 'Cambio de poncho de palier', 'Cambio de bombin o caliper', 'Cambio de pastillas de freno', 'Cambio de discos de freno')),
 'SOL-38': (2, N('Cambio de terminal de direccion', 'Cambio de axial', 'Cambio de cremallera', 'Cambio de trapecio', 'Cambio de rotula', 'Cambio de amortiguador', 'Cambio de rodaje de rueda · delantera')),
 'SOL-39': (2, N('Cambio de radiador', 'Cambio de bomba de agua', 'Cambio de termostato', 'Cambio de brida de agua', 'Cambio de manguera de radiador', 'Bajada de culata')),
 'SOL-41': (3, AFIN_PARTES),
}
sol = json.load(open(f'{integ}/reglas_solapamiento.json', encoding='utf-8'))['solapamientos']
reglas = []
for r in sol:
    desc = {g: v for g, v in (r.get('descuento_sugerido') or {}).items() if v is not None}
    modo = 'AUTOMATICO' if 'autom' in norm(r['modo']) else 'OPCIONAL'
    base = {'codigo': r['id'], 'modo': modo, 'descuentos': desc, 'estandar': desc.get('G2', next(iter(desc.values()), 0)),
            'alerta': r.get('alerta'), 'estado': 'Decidido' if norm(r.get('estado')).startswith('decidido') else 'Propuesto', 'nota': r.get('regla')}
    if r['id'] in PAR:
        a, b = PAR[r['id']]
        reglas.append({**base, 'tipo': 'PAR', 'base': a, 'reducidos': b, 'minimo': 2})
    elif r['id'] in CONJ:
        m, miembros = CONJ[r['id']]
        if r['id'] == 'SOL-41':  # sugiere el paquete: aviso sin descuento
            reglas.append({**base, 'tipo': 'CONJUNTO', 'modo': 'AVISO', 'base': [], 'reducidos': miembros, 'minimo': m, 'estandar': 0, 'descuentos': {},
                           'alerta': 'Hay 3 o más servicios sueltos del afinamiento: conviene ofrecer el paquete Afinamiento completo (G1 S/ 130, G2 S/ 140, G3 S/ 150).'})
        else:
            reglas.append({**base, 'tipo': 'CONJUNTO', 'base': [], 'reducidos': miembros, 'minimo': m})
    else:
        raise SystemExit('Regla sin enlace: ' + r['id'])

# Familias de motor: el grupo se recalcula con el combustible y la cilindrada (G1 ≤ 1.25 L, G2 1.3–1.6 L, G3 > 1.6 L, G4 diésel).
familias = []
for f in json.load(open(f'{integ}/familias_motor.json', encoding='utf-8')):
    litros = [float(x) for x in re.findall(r'\d+(?:\.\d+)?', str(f.get('litros') or ''))]
    comb = str(f.get('combustible') or '').upper()
    if comb.startswith('D'):
        g = 'G4'
    elif litros and comb.startswith('P'):
        mx = max(litros); g = 'G1' if mx <= 1.25 else 'G2' if mx <= 1.6 else 'G3'
    else:
        g = None
    familias.append({'codigo': f['familia'], 'codigos': f['codigos'], 'combustible': f.get('combustible'), 'litros': f.get('litros'), 'turbo': bool(f.get('turbo')), 'grupo': g})

json.dump({'fuente': 'Referencia Autodata en combinación con datos del taller RSA (reunión de precios, 05/11/2026)', 'grupos': GRUPOS, 'servicios': servicios,
           'solapamientos': reglas, 'familias': familias}, open(salida, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('servicios', len(servicios), 'con horas', sum(1 for s in servicios if s['horas'] is not None), 'reglas', len(reglas), 'familias', len(familias),
      {g: sum(1 for f in familias if f['grupo'] == g) for g in G + [None]})
