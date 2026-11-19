"""Migración inicial (S4, RN-11): verifica una carga contra el archivo intermedio. Solo lee.
Uso (desde la raíz): python herramientas/migracion/verificar_carga.py <base> [staging.json]
Compara conteos por tabla, claves de origen, totales en soles y relaciones; imprime OK/FALLA por control.
"""
import json, os, sys
import psycopg2

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
base = sys.argv[1]
st = json.load(open(sys.argv[2] if len(sys.argv) > 2 else os.path.join(RAIZ, '.local/migracion/staging.json'), encoding='utf-8'))
rep = json.load(open(os.path.join(RAIZ, f'.local/migracion/reporte_{base}.json'), encoding='utf-8'))
url = [l for l in open(os.path.join(RAIZ, '.env')) if l.startswith('DATABASE_URL')][0].split('=', 1)[1].strip().strip('"').split('?')[0]
cur = psycopg2.connect(url.rsplit('/', 1)[0] + '/' + base).cursor()
q = lambda s, *a: (cur.execute(s, a), cur.fetchall())[1]
sis = st['sistema']
rech = {}
for r in rep['rechazos']:
    rech[r['tabla']] = rech.get(r['tabla'], 0) + 1
fallas = 0
def control(nombre, ok, detalle=''):
    global fallas
    fallas += not ok
    print(('OK   ' if ok else 'FALLA'), nombre, detalle)

esperado = {
    'Usuario': len(st['personas']), 'Cliente': len(st['clientes']), 'Vehiculo': len(st['vehiculos']),
    'OrdenServicio': len(st['ordenes']), 'DetalleODS': sum(len(o['detalles']) for o in st['ordenes']),
    'LecturaKm': len(st['lecturas']), 'NotaVenta': len(st['notas']),
    'DetalleNota': sum(len(n['detalles']) for n in st['notas']), 'Abono': sum(len(n['abonos']) for n in st['notas']),
}
for tabla, n in esperado.items():
    claves = q('select count(*) from "ClaveOrigen" where sistema=%s and tabla=%s', sis, tabla)[0][0]
    reales = q(f'select count(*) from "{tabla}" t join "ClaveOrigen" k on k."registroId"=t.id and k.sistema=%s and k.tabla=%s', sis, tabla)[0][0]
    control(f'{tabla}: archivo {n} = cargadas {reales} + rechazadas {rech.get(tabla, 0)}', n == reales + rech.get(tabla, 0) and claves == reales,
            f'(claves de origen {claves})')
dup = q('select count(*) from (select sistema,tabla,"idOrigen" from "ClaveOrigen" group by 1,2,3 having count(*)>1) x')[0][0]
control('Claves de origen únicas', dup == 0)
tot_st = round(sum(d['total'] for o in st['ordenes'] for d in o['detalles']), 2)
tot_db = float(q('select coalesce(sum(d.total),0) from "DetalleODS" d join "ClaveOrigen" k on k."registroId"=d.id and k.sistema=%s', sis)[0][0])
control('Total en soles de los detalles de ODS', abs(tot_st - tot_db) < 1, f'archivo {tot_st:,.2f} · base {tot_db:,.2f}')
tn_st = round(sum(n['total'] for n in st['notas']), 2)
tn_db = float(q('select coalesce(sum(n.total),0) from "NotaVenta" n join "ClaveOrigen" k on k."registroId"=n.id and k.sistema=%s', sis)[0][0])
control('Total en soles de las notas de venta', abs(tn_st - tn_db) < 1, f'archivo {tn_st:,.2f} · base {tn_db:,.2f}')
ta_st = round(sum(a['valor'] for n in st['notas'] for a in n['abonos']), 2)
ta_db = float(q('select coalesce(sum(a.valor),0) from "Abono" a join "ClaveOrigen" k on k."registroId"=a.id and k.sistema=%s', sis)[0][0])
control('Total en soles de los abonos', abs(ta_st - ta_db) < 1, f'archivo {ta_st:,.2f} · base {ta_db:,.2f}')
huerf = q('select count(*) from "Vehiculo" v left join "Cliente" c on c.id=v."clienteId" where c.id is null')[0][0]
control('Todo vehículo tiene titular', huerf == 0)
sinloc = q('select count(*) from "OrdenServicio" o join "ClaveOrigen" k on k."registroId"=o.id and k.sistema=%s where o."localId" is null or o."creadoPorId" is null', sis)[0][0]
control('Toda ODS tiene local y creador', sinloc == 0)
dobles = q('select count(*) from "Abono" where "ordenId" is not null and "notaId" is not null')[0][0]
control('Ningún abono cuenta dos veces (ODS y nota a la vez)', dobles == 0)
enl = q('select count(*) from "DetalleODS" d join "ClaveOrigen" k on k."registroId"=d.id and k.sistema=%s where d."servicioId" is not null', sis)[0][0]
print(f'     Detalles enlazados al catálogo: {enl}')
for serie, ult in q('select serie, ultimo from "CorrelativoSerie" order by 1'):
    print(f'     Correlativo {serie}: {ult}')
print('Resultado:', 'TODO OK' if not fallas else f'{fallas} controles fallaron')
sys.exit(1 if fallas else 0)
