import json, sys
ev, dst = sys.argv[1], sys.argv[2]
for n in ['api', 'web']:
    d = json.load(open(f'{ev}/{n}.json', encoding='utf-8'))
    res = []
    for s in d['testResults']:
        arch = s['name'].replace(chr(92), '/')
        arch = arch[arch.find('apps/'):] if 'apps/' in arch else arch
        for t in s['assertionResults']:
            res.append({'archivo': arch, 'prueba': ' › '.join((t.get('ancestorTitles') or []) + [t['title']]),
                        'estado': t['status'], 'ms': t.get('duration')})
    json.dump({'fecha': '2026-11-05', 'conjunto': n, 'aprobadas': d['numPassedTests'], 'total': d['numTotalTests'], 'pruebas': res},
              open(f'{dst}/ejecucion_{n}_2026-11-05.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(n, d['numPassedTests'], d['numTotalTests'])
