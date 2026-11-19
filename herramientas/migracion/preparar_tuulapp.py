"""Migración inicial Tuulapp → RMOTRIZ (S4, RN-11). Paso 1: preparar.

Lee las exportaciones de Tuulapp y el archivo maestro del trabajo previo de migración (JSON consolidado), aplica las
decisiones ya tomadas en él (unificaciones, exclusiones, cantidades) sin volver a decidirlas, y deja:
  - staging.json  : lo que se va a cargar, con la clave de origen de cada fila
  - rechazos.csv  : filas que no se cargan y por qué
  - resumen.json  : conteos
Nada de esto va al repositorio: entrada y salida viven en .local/ (ignorado por git).
El paso 2 (cargar) es apps/api/src/migracion/cargar-tuulapp.ts.

Uso (desde la raíz):  python herramientas/migracion/preparar_tuulapp.py [carpeta_datos] [carpeta_salida]
"""
import csv, collections, json, os, re, sys, unicodedata
from datetime import datetime

import openpyxl

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATOS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, '.local/datos_reales/actualizado_2026-11-17')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else os.path.join(RAIZ, '.local/migracion')
REGLAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reglas_servicios.json')
CATALOGO = os.path.join(RAIZ, 'database/seeds/precarga/s6/catalogo_rmotriz.json')
PERSONAL = os.path.join(SALIDA, 'personal.json')
KM_MAX = 999_999

rechazos = []
def rechazar(tabla, clave, motivo):
    rechazos.append((tabla, clave, motivo))


# ───────────── utilidades ─────────────
def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def placa_norm(p):
    return re.sub(r'[^A-Z0-9]', '', str(p or '').upper())

def texto(v):
    s = '' if v is None else str(v).strip()
    return s if s and s != '-' else None

def num(v):
    try:
        return float(str(v).replace(',', '')) if v not in (None, '', '-') else None
    except ValueError:
        return None

def km_de(v):
    s = str(v or '').strip()
    if not s or s == '-':
        return None
    d = re.sub(r'[^\d]', '', s.split('.')[0] if re.fullmatch(r'\d+\.\d+', s) else s)
    return int(d) if d else None

def fecha(v):
    """ISO 8601 (hora de Lima sin zona: se guarda tal cual como texto ISO)."""
    if v is None or v == '':
        return None
    if isinstance(v, datetime):
        return v.strftime('%Y-%m-%dT%H:%M:%S')
    s = str(v).strip()
    for f in ('%Y-%m-%d %I:%M %p', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
        try:
            return datetime.strptime(s, f).strftime('%Y-%m-%dT%H:%M:%S')
        except ValueError:
            pass
    return None

def tipo_documento(doc):
    d = re.sub(r'\D', '', doc or '')
    if d != (doc or '').strip():
        return None
    if len(d) == 8:
        return 'DNI'
    if len(d) == 11 and d[:2] in ('10', '15', '17', '20'):
        return 'RUC'
    if len(d) in (9, 12):
        return 'CARNET_EXTRANJERIA'
    return None

def leer_xlsx(nombre):
    wb = openpyxl.load_workbook(os.path.join(DATOS, nombre), read_only=True)
    it = wb.worksheets[0].iter_rows(values_only=True)
    hdr = [str(h).strip() if h else '' for h in next(it)]
    return [dict(zip(hdr, r)) for r in it if any(v is not None for v in r)]


# ───────────── servicios: enlace solo con equivalencia clara ─────────────
catalogo = {s['codigo']: s for s in json.load(open(CATALOGO, encoding='utf-8'))['servicios']}
por_nombre = {norm(s['nombre']): k for k, s in catalogo.items()}
reglas = [(re.compile(p), c) for p, c in json.load(open(REGLAS, encoding='utf-8'))]
for _, c in reglas:
    assert c in catalogo, f'La regla apunta a un servicio que no existe: {c}'

def base_servicio(t):
    return norm(re.sub(r'(\s*-\s*\d*([.,]\d+)?)+\s*-?\s*$', '', str(t or '')))

def servicio_de(tipo, item):
    if tipo != 'mano de obra':
        return None, None
    b = base_servicio(item)
    if b in por_nombre:
        return por_nombre[b], 'NOMBRE_EXACTO'
    for p, c in reglas:
        if p.match(b):
            return c, 'REGLA'
    return None, None


# ───────────── personal ─────────────
pers = json.load(open(PERSONAL, encoding='utf-8'))
personas = {}      # clave -> persona
alias = {}         # nombre normalizado -> clave
def alta(nombre, sede, activo, aliases=()):
    clave = norm(nombre).replace(' ', '-')
    personas[clave] = {'clave': clave, 'nombre': nombre, 'sede': sede, 'activo': activo, 'roles': set()}
    for a in (nombre, *aliases):
        alias.setdefault(norm(a), clave)
    return clave
for sede, nombre, al in pers['activos']:
    alta(nombre, sede, True, [a.strip() for a in al.split(',')])
for sede, nombre in pers['antiguos']:
    alta(nombre, sede, False)
EXTERNOS = alta(pers['servicios_externos'], 'Ambos', True)
personas[EXTERNOS]['roles'].add('Técnico')
JEFES = {s: alias[norm(n)] for s, n in pers['jefes'].items()}
for c in JEFES.values():
    personas[c]['roles'].add('Jefe de taller')
OTROS = {'Union': alias[norm('Otro(s) Union')], 'Prohogar': alias[norm('Otro(s) Prohogar')]}
LIDER = norm(pers['lider_de_taller'])
GENERICOS = {norm(g) for g in pers.get('genericos', [])}
for corto, largo in pers.get('alias_extra', {}).items():
    alias[norm(corto)] = alias.get(norm(largo)) or alta(largo, None, False)

def persona(nombre, crear=True):
    """Clave de la persona; si no está en la lista, se crea inactiva (antiguo sin sede conocida)."""
    n = norm(nombre)
    if not n or n.startswith(LIDER) or n in GENERICOS or 'no encontrado' in n:
        return None
    if n in alias:
        return alias[n]
    for k, c in alias.items():          # nombre completo que empieza igual (p. ej. sin segundo apellido)
        if len(k.split()) >= 2 and (n.startswith(k + ' ') or k.startswith(n + ' ')):
            return c
    return alta(str(nombre).strip(), None, False) if crear else None


# ───────────── fuentes ─────────────
print('Leyendo JSON consolidado…')
J = json.load(open(os.path.join(DATOS, 'codex_migracion/consolidated_data_migracion_v2.json'), encoding='utf-8'))
print('Leyendo ods.xlsx…')
ods_x = collections.defaultdict(list)
for r in leer_xlsx('ods.xlsx'):
    ods_x[str(r['# ODS']).lstrip('#').strip()].append(r)
print('Leyendo facturas…')
facturas = leer_xlsx('FacturasVentaTuulapp20261117.xlsx')

# Clientes (JSON, ya unificados)
clientes, cli_doc, cli_nombre = {}, {}, collections.defaultdict(list)
for c in J['clients']:
    doc = (c['DOCUMENTO'] or '').strip()
    td = tipo_documento(doc)
    nombre = (c['RAZON_SOCIAL'] or '').strip() or ' '.join(x for x in [c['NOMBRES'], c['APELLIDOS']] if x).strip() or '(sin nombre en Tuulapp)'
    coment = [f"Migrado de Tuulapp ({c['ID_CLIENTE']})."]
    if not td:
        coment.append(f"Documento original: «{doc}»." if doc else 'Sin documento en Tuulapp.')
    clientes[c['ID_CLIENTE']] = {
        'clave': c['ID_CLIENTE'], 'tipoDocumento': td or 'DNI', 'documento': doc if td else f"SD-{c['ID_CLIENTE']}",
        'nombre': nombre[:200], 'movil': texto(c['CELULAR']), 'email': texto(c['EMAIL']), 'direccionFiscal': texto(c['DIRECCIONES']),
        'comentario': ' '.join(coment), 'esGenerico': c['ID_CLIENTE'] == 'CLI-MIG-VARIOS', 'creadoEn': fecha(c['FECHA_REGISTRO']),
    }
    if td:
        cli_doc[doc] = c['ID_CLIENTE']
    cli_nombre[norm(nombre)].append(c['ID_CLIENTE'])
# Documento repetido entre clientes válidos: el segundo pasa a SD- (no se decide aquí unirlos)
vistos = {}
for k, c in clientes.items():
    if c['documento'] in vistos:
        c['comentario'] += f" Documento repetido con {vistos[c['documento']]}: original «{c['documento']}»."
        c['documento'] = f'SD-{k}'
    vistos[c['documento']] = k
GENERICO = 'CLI-MIG-VARIOS' if 'CLI-MIG-VARIOS' in clientes else None

# Vehículos (JSON, ya unificados y con su titular)
vehiculos, veh_placa = {}, {}
for v in J['vehicles']:
    pn = placa_norm(v['PLACA']) or f"SINPLACA{v['ID_VEHICULO']}"
    coment = [f"Migrado de Tuulapp ({v['ID_VEHICULO']})."]
    if pn in veh_placa:
        n = 2
        while f'{pn}-{n}' in veh_placa:
            n += 1
        coment.append(f"Placa repetida con otro vehículo distinto ({veh_placa[pn]}); se marca como {pn}-{n}.")
        pn = f'{pn}-{n}'
    if v['OBSERVACIONES_ORIGEN']:
        coment.append(v['OBSERVACIONES_ORIGEN'])
    if v['ID_CLIENTE'] not in clientes:
        rechazar('Vehiculo', v['ID_VEHICULO'], f"Titular {v['ID_CLIENTE']} no existe")
        continue
    anio = re.sub(r'\D', '', str(v['ANIO'] or ''))
    vehiculos[v['ID_VEHICULO']] = {
        'clave': v['ID_VEHICULO'], 'cliente': v['ID_CLIENTE'], 'placa': (v['PLACA'] or pn).strip(), 'placaNorm': pn,
        'marca': texto(v['MARCA']), 'modelo': texto(v['MODELO']), 'anio': int(anio) if anio and 1900 < int(anio) < 2100 else None,
        'color': texto(v['COLOR']), 'nroVin': texto(v['N_VIN']), 'nroSerie': texto(v['N_SERIE']), 'nroMotor': texto(v['N_MOTOR']),
        'comentario': ' '.join(coment),
    }
    veh_placa[pn] = v['ID_VEHICULO']

def parse_vehiculo(t):
    """«Marca, Modelo: X, Año: 2016, Placa: ABC-123, Vin: …» del reporte de operación."""
    t = str(t or '')
    g = lambda k: (re.search(k + r':\s*([^,]*)', t) or [None, None])[1]
    return {'marca': texto(t.split(',')[0]), 'modelo': texto(g('Modelo')), 'anio': texto(g('Año')), 'placa': texto(g('Placa')), 'vin': texto(g('Vin'))}

# ───────────── órdenes ─────────────
jo = {o['ID_ODS']: o for o in J['orders']}
det_json = collections.defaultdict(list)
for d in J['details']:
    det_json[d['ID_ODS']].append(d)
nuevas = sorted(set(ods_x) - set(jo))
excluidas = collections.Counter()

def local_de(asesor_txt, tecnico_txt, ase, tec):
    for txt in (asesor_txt, tecnico_txt):
        n = norm(txt)
        if 'union' in n:
            return 'Union', 'NOMBRE_SEDE'
        if 'prohogar' in n:
            return 'Prohogar', 'NOMBRE_SEDE'
    for p in (ase, tec):
        if p and personas[p]['sede'] in ('Union', 'Prohogar'):
            return personas[p]['sede'], 'SEDE_PERSONA'
    return None, None

ordenes, sin_sede = [], []
for oid in sorted(set(jo) | set(nuevas)):
    o = jo.get(oid)
    xs = ods_x.get(oid, [])
    x0 = xs[0] if xs else {}
    if o and not o['DECISION_MIGRACION'].startswith('MIGRAR'):
        excluidas[o['DECISION_MIGRACION']] += 1
        rechazar('OrdenServicio', oid, f"Excluida por decisión del JSON: {o['DECISION_MIGRACION']}")
        continue
    if o:
        cli, veh = o['ID_CLIENTE'], o['ID_VEHICULO']
        tec_txt, ase_txt = o['TECNICO'] or x0.get('Técnico'), o['ASESOR_SERVICIOS'] or x0.get('Asesor de servicios')
        f_ini, f_fin = fecha(o['FECHA_INGRESO']) or fecha(x0.get('Fecha/Ingreso')), fecha(o['FECHA_SALIDA']) or fecha(x0.get('Fecha/Salida'))
        km_txt, motivo, coment, factura = o['KILOMETRAJE'], o['MOTIVO_INGRESO'], o['COMENTARIOS'], o['FACTURA'] or x0.get('# Factura')
        anulada = (x0.get('Anulada') == 'Sí') or o['ANULADA'] == 'Sí'
        est_x = x0.get('Estado')
        estado = 'EnProceso' if est_x == 'En proceso' else ('Cerrada' if est_x or o['ESTADO'] in ('Finalizada', '10') else 'EnProceso')
    else:   # ODS nueva del reporte de operación (después del corte del JSON)
        doc = str(x0.get('Identificación') or '').strip()
        cli = cli_doc.get(doc)
        if not cli:
            cli = f'X-{doc or oid}'
            if cli not in clientes:
                td = tipo_documento(doc)
                clientes[cli] = {'clave': cli, 'tipoDocumento': td or 'DNI', 'documento': doc if td else f'SD-{cli}',
                                 'nombre': (texto(x0.get('Cliente')) or '(sin nombre)').replace('\t', ' ')[:200], 'movil': None, 'email': None,
                                 'direccionFiscal': None, 'comentario': 'Migrado de Tuulapp (reporte de operación).', 'esGenerico': False, 'creadoEn': None}
                if td:
                    cli_doc[doc] = cli
        pv = parse_vehiculo(x0.get('Vehiculo'))
        pn = placa_norm(pv['placa'])
        veh = veh_placa.get(pn)
        if not veh:
            if not pn:
                rechazar('OrdenServicio', oid, 'ODS nueva sin placa reconocible')
                continue
            veh = f'X-{pn}'
            anio = re.sub(r'\D', '', pv['anio'] or '')
            vehiculos[veh] = {'clave': veh, 'cliente': cli, 'placa': pv['placa'], 'placaNorm': pn, 'marca': pv['marca'], 'modelo': pv['modelo'],
                              'anio': int(anio) if anio else None, 'color': None, 'nroVin': pv['vin'], 'nroSerie': None, 'nroMotor': None,
                              'comentario': 'Migrado de Tuulapp (reporte de operación).'}
            veh_placa[pn] = veh
        tec_txt, ase_txt = x0.get('Técnico'), x0.get('Asesor de servicios')
        f_ini, f_fin = fecha(x0.get('Fecha/Ingreso')), fecha(x0.get('Fecha/Salida'))
        km_txt, motivo, coment, factura = x0.get('Kilometraje/Millas'), x0.get('Motivo/Ingreso'), x0.get('Comentarios'), x0.get('# Factura')
        anulada = x0.get('Anulada') == 'Sí'
        estado = 'EnProceso' if x0.get('Estado') == 'En proceso' else 'Cerrada'
    if cli not in clientes or veh not in vehiculos:
        rechazar('OrdenServicio', oid, f'Cliente {cli} o vehículo {veh} no existe')
        continue
    if not f_ini:
        rechazar('OrdenServicio', oid, 'Sin fecha de ingreso')
        continue
    externo = norm(tec_txt) == norm(pers['servicios_externos'])
    tec = EXTERNOS if externo else persona(tec_txt)
    ase = persona(ase_txt)
    sede, fuente_sede = local_de(ase_txt, tec_txt, ase, tec)
    ordenes.append({'oid': oid, 'o': o, 'xs': xs, 'cli': cli, 'veh': veh, 'tec': tec, 'ase': ase, 'tec_txt': tec_txt, 'ase_txt': ase_txt,
                    'sede': sede, 'fuente_sede': fuente_sede, 'f_ini': f_ini, 'f_fin': f_fin, 'km': km_de(km_txt), 'motivo': motivo,
                    'coment': coment, 'busqueda': ' '.join(str(v) for v in [coment, (o or {}).get('COMENTARIOS_REPORTE_OPERATIVO'), x0.get('Comentarios')] if v),
                    'factura': factura, 'anulada': anulada, 'estado': estado})

# Sede de quien no está en la lista: donde más trabajó (según las ODS con sede conocida)
votos = collections.defaultdict(collections.Counter)
for x in ordenes:
    if x['sede']:
        for p in (x['tec'], x['ase']):
            if p:
                votos[p][x['sede']] += 1
for p in personas.values():
    if p['sede'] is None and votos[p['clave']]:
        p['sede'] = votos[p['clave']].most_common(1)[0][0]
tecnicos_txt = {persona(x['tec_txt'], crear=False) for x in ordenes} - {None, EXTERNOS}
def sede_por_comentario(t):
    """Busca nombres o alias (palabra completa, 4+ letras) de técnicos con sede conocida; vale solo si todos apuntan a una sede."""
    n = ' ' + norm(t) + ' '
    hallados = [c for a, c in alias.items() if len(a) >= 4 and c in tecnicos_txt and personas[c]['sede'] in ('Union', 'Prohogar') and f' {a} ' in n]
    sedes = {personas[c]['sede'] for c in hallados}
    return (sedes.pop(), 'COMENTARIO', hallados[0]) if len(sedes) == 1 else (None, None, None)
emisor_factura = {}
for f in facturas:
    k = re.sub(r'\D', '', str(f.get('CONSECUTIVO') or '')).lstrip('0')
    if k and k not in emisor_factura:
        emisor_factura[k] = persona(f.get('CREADA POR'))
for x in ordenes:
    if not x['sede']:
        x['sede'], x['fuente_sede'] = local_de(None, None, x['ase'], x['tec'])
    if not x['sede']:   # 1) nombre de un técnico con sede en los comentarios («Sr. Gabriel», «Apoyo: Roy»)
        x['sede'], x['fuente_sede'], encontrado = sede_por_comentario(x['busqueda'])
        if encontrado and not x['tec']:
            x['tec'] = encontrado
    if not x['sede']:   # 2) sede de quien emitió la factura enganchada a la ODS
        emisor = emisor_factura.get(re.sub(r'\D', '', str(x['factura'] or '')).lstrip('0'))
        if emisor and personas[emisor]['sede'] in ('Union', 'Prohogar'):
            x['sede'], x['fuente_sede'] = personas[emisor]['sede'], 'EMISOR_FACTURA'
    if not x['sede']:
        x['sede'], x['fuente_sede'] = 'Union', 'POR_DEFECTO'
        sin_sede.append(x['oid'])

# Roles: quien aparece como técnico es Técnico; quien crea (asesor) es Cajera
for x in ordenes:
    if x['tec'] and x['tec'] != EXTERNOS:
        personas[x['tec']]['roles'].add('Técnico')
    if x['ase']:
        personas[x['ase']]['roles'].add('Cajera')

# ───────────── detalles, lecturas y salida de ODS ─────────────
out_ordenes, lecturas = [], []
enlace = collections.Counter()
recuperados = collections.Counter()
for x in ordenes:
    oid, o = x['oid'], x['o']
    detalles = []
    fuente_det = 'JSON' if o and det_json.get(oid) else 'REPORTE'
    if fuente_det == 'JSON':
        filas_x = [r for r in x['xs'] if (r.get('Tipo') or '-') != '-']
        js = sorted(det_json[oid], key=lambda d: d['LINEA'])
        for d in js:
            item, ref = d['ITEM'], None
            # Mismo ítem en el reporte de operación (misma posición, tipo y total): de ahí salen el nombre que falta y el código de Tuulapp.
            r = filas_x[d['LINEA'] - 1] if len(filas_x) == len(js) and 0 < d['LINEA'] <= len(filas_x) else None
            if r is not None and r.get('Tipo') == d['TIPO'] and abs((num(r.get('Total')) or 0) - (num(d['TOTAL']) or 0)) < 0.01:
                ref = texto(r.get('Referencia'))
                if not texto(item) and texto(r.get('Item')):
                    item = r['Item']
                    recuperados['nombre'] += 1
            detalles.append((d['LINEA'], d['TIPO'], item, ref, d['CANTIDAD'], d['TOTAL']))
    else:
        for i, r in enumerate(x['xs'], 1):
            if (r.get('Tipo') or '-') == '-':
                continue
            detalles.append((i, r['Tipo'], r['Item'], r.get('Referencia'), r.get('Cantidad'), r.get('Total')))
    dets = []
    for linea, tipo, item, ref, cant, total in detalles:
        q = num(cant)
        marca = []
        if not q or q <= 0:
            q = 1
            marca.append('cantidad vacía en Tuulapp: 1')
        t = num(total) or 0.0
        desc = texto(item) or '(sin descripción en Tuulapp)'
        sv, como = servicio_de(tipo, item)
        enlace[como or ('SIN_ENLACE' if tipo == 'mano de obra' else 'NO_ES_MANO_DE_OBRA')] += 1
        tipo_ods = {'mano de obra': 'servicio', 'mano de obra externa': 'servicio externo', 'insumo': 'insumo', 'repuesto': 'repuesto', 'adicional': 'adicional'}.get(tipo, str(tipo or 'servicio'))
        dets.append({'clave': f'{oid}:{linea}', 'posicion': linea, 'tipo': tipo_ods, 'descripcion': desc[:500], 'referencia': texto(ref),
                     'cantidad': round(q, 3), 'precio': round(t / q, 3), 'total': round(t, 2), 'servicioCodigo': sv,
                     'tecnico': x['tec'] if tipo in ('mano de obra', 'mano de obra externa') else None, 'nota': '; '.join(marca) or None})
    km = x['km']
    km_fuera = km is not None and (km <= 0 or km > KM_MAX)
    obs = []
    if x['tec_txt'] and not x['tec']:
        obs.append(f"Técnico en Tuulapp: {x['tec_txt']}.")
    if x['ase_txt']:
        obs.append(f"Asesor en Tuulapp: {str(x['ase_txt']).strip()}.")
    if x['factura']:
        obs.append(f"Comprobante en Tuulapp: {str(x['factura']).strip()}.")
    if texto(x['coment']):
        obs.append(f"Comentarios: {str(x['coment']).strip()}")
    if km_fuera:
        obs.append(f'Km fuera de rango en Tuulapp: {km}.')
    if fuente_det == 'REPORTE' and not dets:
        obs.append('Sin ítems en Tuulapp.')
    creador = x['ase'] or (JEFES[x['sede']] if norm(x['ase_txt']).startswith(LIDER) else OTROS[x['sede']])
    out_ordenes.append({
        'clave': oid, 'codigo': oid, 'cliente': x['cli'], 'vehiculo': x['veh'], 'local': x['sede'], 'fuenteLocal': x['fuente_sede'],
        'estado': x['estado'], 'decision': 'Aprobada', 'tipoAtencion': 'Otro',
        'tipoAtencionDetalle': (texto(x['motivo']) or 'Migración Tuulapp')[:300], 'fechaInicio': x['f_ini'],
        'fechaCierre': x['f_fin'] if x['estado'] == 'Cerrada' else None, 'km': km, 'tecnico': x['tec'], 'jefeTaller': JEFES[x['sede']],
        'creadoPor': creador, 'observaciones': ' '.join(obs)[:4000] or None, 'eliminada': x['anulada'],
        'motivoEliminacion': 'Anulada en Tuulapp' if x['anulada'] else None, 'detalles': dets,
        'decisionJson': o['DECISION_MIGRACION'] if o else 'NUEVA_REPORTE',
    })
    if km and not km_fuera and not x['anulada']:
        lecturas.append({'clave': oid, 'vehiculo': x['veh'], 'km': km, 'fecha': x['f_ini']})

# Lecturas incoherentes: menor que la anterior del mismo vehículo (en orden de fecha)
por_veh = collections.defaultdict(list)
for l in lecturas:
    por_veh[l['vehiculo']].append(l)
incoherentes = 0
for ls in por_veh.values():
    ls.sort(key=lambda l: (l['fecha'], l['clave']))
    mayor = None
    for l in ls:
        if mayor is not None and l['km'] < mayor:
            l['observacion'] = f'Incoherente: menor que una lectura anterior ({mayor} km).'
            incoherentes += 1
        else:
            l['observacion'] = None
            mayor = l['km']

# ───────────── comprobantes (facturas de Tuulapp → notas de venta) ─────────────
ods_por_factura = {}
fact_de = {x['oid']: re.sub(r'\D', '', str(x['factura'] or '')) for x in ordenes}
for oo in out_ordenes:
    n = fact_de.get(oo['clave'])
    if n:
        ods_por_factura.setdefault(int(n), oo)

METODO = {'efectivo': 'Efectivo', 'transferencia bancaria': 'Transferencia', 'tarjeta debito': 'Tarjeta', 'tarjeta credito': 'Tarjeta'}
notas, vistos_num = [], set()
for f in facturas:
    n = re.sub(r'\D', '', str(f.get('CONSECUTIVO') or ''))
    if not n:
        rechazar('NotaVenta', str(f.get('CONSECUTIVO')), 'Sin número')
        continue
    numero = int(n)
    if numero in vistos_num:
        rechazar('NotaVenta', n, 'Número repetido en Tuulapp: se carga solo la primera')
        continue
    vistos_num.add(numero)
    total = round(num(f.get('VALOR_FACTURA')) or 0.0, 2)
    abono = round(num(f.get('ABONO')) or 0.0, 2)
    saldo = round(num(f.get('SALDO')) or 0.0, 2)
    oo = ods_por_factura.get(numero)
    emisor = persona(f.get('CREADA POR'))
    if oo:
        sede, cli, veh = oo['local'], oo['cliente'], oo['vehiculo']
    else:
        sede = (personas[emisor]['sede'] if emisor and personas[emisor]['sede'] in ('Union', 'Prohogar') else 'Union')
        cands = cli_nombre.get(norm(str(f.get('CLIENTE') or '').replace('\t', ' ')), [])
        cli = cands[0] if len(cands) == 1 else GENERICO
        pv = re.search(r'Placa:\s*([A-Za-z0-9-]+)', str(f.get('OBSERVACIONES') or ''))
        veh = veh_placa.get(placa_norm(pv.group(1))) if pv else None
        if veh and vehiculos[veh]['cliente'] != cli:
            veh = veh if cli == GENERICO else None
    if not cli:
        rechazar('NotaVenta', n, 'Cliente no identificado y sin cliente genérico')
        continue
    if emisor:
        personas[emisor]['roles'].add('Cajera')
    # Ítems: los de la ODS si cuadran con el total facturado; si no, una línea con el texto de la factura
    dets = []
    if oo and oo['detalles'] and abs(sum(d['total'] for d in oo['detalles']) - total) <= 0.5:
        dets = [{'clave': f"{n}:{d['posicion']}", 'posicion': d['posicion'], 'tipo': d['tipo'], 'descripcion': d['descripcion'],
                 'referencia': d['referencia'], 'cantidad': d['cantidad'], 'precio': d['precio'], 'total': d['total'], 'servicioCodigo': d['servicioCodigo']} for d in oo['detalles']]
    else:
        dets = [{'clave': f'{n}:1', 'posicion': 1, 'tipo': 'servicio', 'descripcion': (texto(str(f.get('ITEMS') or '').rstrip(', ')) or 'Comprobante de Tuulapp')[:500],
                 'referencia': None, 'cantidad': 1, 'precio': total, 'total': total, 'servicioCodigo': None}]
    metodo_txt = str(f.get('METODO_PAGO') or '').strip()
    credito = norm(metodo_txt) == 'credito' or saldo > 0.005
    abonos = []
    if abono > 0:
        m = METODO.get(norm(metodo_txt))
        abonos.append({'clave': n, 'fecha': fecha(f.get('FECHA_HORA')), 'metodo': m or 'Otro', 'valor': abono,
                       'concepto': None if m else f'Tuulapp: {metodo_txt}'})
    notas.append({'clave': n, 'numero': numero, 'local': sede, 'orden': oo['clave'] if oo else None, 'cliente': cli, 'vehiculo': veh,
                  'fechaEmision': fecha(f.get('FECHA_HORA')), 'condicion': 'CREDITO' if credito else 'CONTADO', 'total': total,
                  'emitidaPor': emisor or OTROS[sede], 'observaciones': f"Comprobante {n} de Tuulapp." + (f" Saldo en Tuulapp: S/ {saldo:.2f}." if saldo > 0.005 else ''),
                  'detalles': dets, 'abonos': abonos})

# ───────────── correos de usuario ─────────────
usados = set()
for p in sorted(personas.values(), key=lambda p: (not p['activo'], p['nombre'])):
    partes = norm(p['nombre'].replace('(s)', 's')).split()
    for cand in (('.'.join(partes[:2]),) if partes[0] == 'otros' else ()) + (partes[0], '.'.join(partes[:2]), '.'.join(partes[:3]), '.'.join(partes)):
        if cand not in usados:
            usados.add(cand)
            p['correo'] = f'{cand}@rmotriz.com'
            break
    p['roles'] = sorted(p['roles']) or ['Técnico']
    p['local'] = p['sede'] if p['sede'] in ('Union', 'Prohogar') else None
    del p['sede']

usados_cli = {o['cliente'] for o in out_ordenes} | {n['cliente'] for n in notas}
staging = {
    'sistema': 'tuulapp', 'generado': datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
    'personas': sorted(personas.values(), key=lambda p: p['clave']),
    'clientes': list(clientes.values()), 'vehiculos': list(vehiculos.values()),
    'ordenes': out_ordenes, 'lecturas': lecturas, 'notas': notas,
}
os.makedirs(SALIDA, exist_ok=True)
json.dump(staging, open(os.path.join(SALIDA, 'staging.json'), 'w', encoding='utf-8'), ensure_ascii=False)
with open(os.path.join(SALIDA, 'rechazos.csv'), 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh)
    w.writerow(['tabla', 'clave_origen', 'motivo'])
    w.writerows(rechazos)
resumen = {
    'personas': len(personas), 'personas_activas': sum(1 for p in personas.values() if p['activo']),
    'clientes': len(clientes), 'clientes_sin_documento_valido': sum(1 for c in clientes.values() if c['documento'].startswith('SD-')),
    'vehiculos': len(vehiculos), 'ordenes': len(out_ordenes), 'ordenes_nuevas_reporte': sum(1 for o in out_ordenes if o['decisionJson'] == 'NUEVA_REPORTE'),
    'ordenes_excluidas': dict(excluidas), 'ordenes_eliminadas_anuladas': sum(1 for o in out_ordenes if o['eliminada']),
    'ordenes_por_estado': dict(collections.Counter(o['estado'] for o in out_ordenes)),
    'ordenes_por_local': dict(collections.Counter(o['local'] for o in out_ordenes)),
    'ordenes_fuente_local': dict(collections.Counter(o['fuenteLocal'] for o in out_ordenes)),
    'ordenes_sin_km': sum(1 for o in out_ordenes if not o['km']), 'detalles': sum(len(o['detalles']) for o in out_ordenes),
    'enlace_servicios': dict(enlace), 'nombres_recuperados_del_reporte': recuperados['nombre'], 'lecturas': len(lecturas), 'lecturas_incoherentes': incoherentes,
    'notas': len(notas), 'notas_con_orden': sum(1 for n in notas if n['orden']), 'abonos': sum(len(n['abonos']) for n in notas),
    'notas_detalle_texto_factura': sum(1 for n in notas if len(n['detalles']) == 1 and n['detalles'][0]['servicioCodigo'] is None and n['detalles'][0]['referencia'] is None),
}
resumen['rechazos'] = {f'{t} · {m}': c for (t, m), c in collections.Counter((t, m.split(':')[0]) for t, _, m in rechazos).items()}
json.dump(resumen, open(os.path.join(SALIDA, 'resumen.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(resumen, ensure_ascii=False, indent=1))
