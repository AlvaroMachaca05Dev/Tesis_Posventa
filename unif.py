import json
p = 'F:/Tesis/Tesis_Posventa/database/seeds/precarga/s6/catalogo_rmotriz.json'
raw = open(p, encoding='utf-8').read()
d = json.loads(raw)
MANG = 'Revisión de mangueras y fugas (motor / refrigerante / caja)'
EMB = 'Revisión de embrague y su líquido'
MAPA = {
    'Revisión de soportes de motor y de caja': ['Revisión de soportes de motor', 'Revisión de soportes de caja'],
    'Revisión de mangueras': [MANG],
    'Revisión de mangueras y fugas a detalle': [MANG],
    'Revisión de fugas (motor / refrigerante / caja)': [MANG],
    'Revisión de embrague': [EMB],
    'Revisión de líquido de embrague': [EMB],
}
cambios = {}
for s in d['servicios']:
    if not s['subservicios']:
        continue
    antes = [x['nombre'] for x in s['subservicios']]
    nuevo, vistos = [], set()
    for x in s['subservicios']:
        for n in MAPA.get(x['nombre'], [x['nombre']]):
            if n in vistos:
                continue
            vistos.add(n)
            nuevo.append({'nombre': n, 'horas': x['horas']})
    despues = [x['nombre'] for x in nuevo]
    if antes != despues:
        cambios[s['codigo']] = (len(antes), len(despues))
    s['subservicios'] = nuevo
open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))
print(cambios)
