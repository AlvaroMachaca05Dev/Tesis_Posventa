import json
p = 'F:/Tesis/Tesis_Posventa/database/seeds/precarga/s6/catalogo_rmotriz.json'
d = json.loads(open(p, encoding='utf-8').read())
BUJ = 'Limpieza o cambio de bujías (tipo y estado)'
BOB = 'Revisión de bobinas'
ROT = 'Revisión de rótulas, bujes y trapecios'
MAPA = {
    'Cambio de bujías': BUJ,
    'Revisión de bobina': BOB,
    'Revisión de rótulas': ROT,
    'Revisión de bujes y trapecios': ROT,
}
cambios = {}
for s in d['servicios']:
    if not s['subservicios']:
        continue
    antes = [x['nombre'] for x in s['subservicios']]
    nuevo, vistos = [], set()
    for x in s['subservicios']:
        n = MAPA.get(x['nombre'], x['nombre'])
        if n in vistos:
            continue
        vistos.add(n)
        nuevo.append({'nombre': n, 'horas': x['horas']})
    if antes != [x['nombre'] for x in nuevo]:
        cambios[s['codigo']] = (len(antes), len(nuevo))
    s['subservicios'] = nuevo
open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))
print(cambios)
por = {s['codigo']: s for s in d['servicios']}
todos = set()
for c in ('SV094', 'SV095', 'SV096', 'SV097', 'SV098', 'SV099', 'SV071', 'SV072'):
    todos |= {x['nombre'] for x in por[c]['subservicios']}
print({c: len(por[c]['subservicios']) for c in ('SV094', 'SV095', 'SV096', 'SV097', 'SV098', 'SV099', 'SV071', 'SV072')}, len(todos))
for n in sorted(todos):
    print(' -', n)
