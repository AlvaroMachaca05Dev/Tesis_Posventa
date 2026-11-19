import json
p = 'F:/Tesis/Tesis_Posventa/database/seeds/precarga/s6/catalogo_rmotriz.json'
d = json.loads(open(p, encoding='utf-8').read())
por = {s['codigo']: s for s in d['servicios']}
PAQ = ('SV094', 'SV095', 'SV096', 'SV097', 'SV098', 'SV099', 'SV071', 'SV072')

PARES = [
    ('Revisión de pastillas', 'Revisión de discos', 'Revisión de pastillas y discos'),
    ('Revisión de zapatas', 'Revisión de tambores', 'Revisión de zapatas y tambores'),
    ('Revisión de filtro de aire', 'Revisión de filtro de cabina', 'Revisión de filtros de aire y cabina'),
    ('Escaneo de fallas', 'Prueba de ruta', 'Escaneo de fallas y prueba de ruta'),
    ('Revisión de bobinas', 'Revisión de chicotes', 'Revisión de bobinas y chicotes'),
    ('Limpieza de inyectores', 'Limpieza de obturador / IAC', 'Limpieza de inyectores y obturador / IAC'),
]

def miembros(n):
    return tuple(c for c in PAQ if any(x['nombre'] == n for x in por[c]['subservicios']))

# regla: solo se unen servicios que van en los mismos paquetes; el tiempo unificado es la suma
for a, b, nuevo in PARES:
    assert miembros(a) == miembros(b) and miembros(a), (a, b, miembros(a), miembros(b))
    for c in PAQ:
        L = por[c]['subservicios']
        ia = next((i for i, x in enumerate(L) if x['nombre'] == a), None)
        ib = next((i for i, x in enumerate(L) if x['nombre'] == b), None)
        if ia is None:
            assert ib is None
            continue
        L[ia] = {'nombre': nuevo, 'horas': round(L[ia]['horas'] + L[ib]['horas'], 2)}
        del L[ib]

# uniones anteriores: ahora también suman sus tiempos (antes se dejó el de una sola línea)
HORAS = {
    'Revisión de mangueras y fugas (motor / refrigerante / caja)': {'SV095': 0.25, 'SV096': 0.5, 'SV097': 0.25, 'SV098': 0.5, 'SV099': 0.5},
    'Revisión de embrague y su líquido': {'SV095': 0.25, 'SV096': 0.5, 'SV097': 0.25, 'SV098': 0.5, 'SV099': 0.5},
}
for nombre, por_paq in HORAS.items():
    for c, h in por_paq.items():
        for x in por[c]['subservicios']:
            if x['nombre'] == nombre:
                x['horas'] = h

open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))
todos = set()
for c in PAQ:
    todos |= {x['nombre'] for x in por[c]['subservicios']}
print({c: len(por[c]['subservicios']) for c in PAQ}, len(todos))
for c in ('SV095', 'SV096', 'SV099'):
    print(c, round(sum(x['horas'] for x in por[c]['subservicios']), 2), por[c]['horas'])
