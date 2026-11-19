# -*- coding: utf-8 -*-
"""Demanda de consultas de documento y de placa a partir del historial real (cotización de las APIs).

Uso: python herramientas/demanda_consultas.py <ods.xlsx> <Backup-Tuulapp.xlsx> <chat.txt> [salida.json]
Cuenta por mes las órdenes de clientes nuevos y recurrentes, los clientes nuevos, los vehículos nuevos
(de clientes nuevos y de clientes que ya existían) y las actualizaciones de datos pedidas por WhatsApp.
Los datos reales no se guardan en el repositorio.
"""
import json
import re
import sys
from datetime import datetime

import pandas as pd

GENERICOS = {'', 'nan', 'none', '0', '0000', '00000000', '99999999', '11111111'}


def doc_valido(d):
    d = re.sub(r'\D', '', str(d))
    return d if d.lstrip('0') and str(d).strip().lower() not in GENERICOS and len(d) >= 8 else None


def main(ruta_ods, ruta_backup, ruta_chat, salida=None):
    df = pd.read_excel(ruta_ods)
    df = df[~df['Anulada'].astype(str).str.lower().str.startswith('s')]
    df['fecha'] = pd.to_datetime(df['Fecha/Ingreso'], errors='coerce')
    df['placa'] = df['Vehiculo'].astype(str).str.extract(r'Placa:\s*([A-Za-z0-9\- ]+)')[0].str.upper().str.replace(r'[^A-Z0-9]', '', regex=True)
    o = df.groupby('# ODS').agg(fecha=('fecha', 'min'), placa=('placa', 'first'), doc=('Identificación', 'first')).reset_index()
    o['doc'] = o['doc'].map(doc_valido)
    o = o.sort_values('fecha')
    o['cliente_nuevo'] = o['doc'].notna() & ~o.duplicated('doc')
    o['vehiculo_nuevo'] = o['placa'].notna() & ~o.duplicated('placa')
    o['veh_nuevo_cliente_existente'] = o['vehiculo_nuevo'] & ~o['cliente_nuevo'] & o['doc'].notna()
    o['mes'] = o['fecha'].dt.to_period('M')
    # ventana estable: los 12 meses completos más recientes (los primeros meses del historial inflan los «nuevos»)
    ultimo = o['mes'].max()
    meses = pd.period_range(ultimo - 12, ultimo - 1, freq='M')
    v = o[o['mes'].isin(meses)]
    por_mes = v.groupby('mes').agg(ordenes=('# ODS', 'count'), clientes_nuevos=('cliente_nuevo', 'sum'), vehiculos_nuevos=('vehiculo_nuevo', 'sum'),
                                   veh_nuevo_cliente_existente=('veh_nuevo_cliente_existente', 'sum'), sin_documento=('doc', lambda s: s.isna().sum()))
    por_mes['ordenes_recurrentes'] = por_mes['ordenes'] - por_mes['clientes_nuevos']
    R = dict(ventana=[str(meses[0]), str(meses[-1])], meses=len(meses),
             promedio=por_mes.mean().round(1).to_dict(), maximo=por_mes.max().to_dict(),
             proporcion_ordenes_de_clientes_nuevos=float(v['cliente_nuevo'].sum() / len(v)),
             por_mes={str(k): {c: int(x) for c, x in fila.items()} for k, fila in por_mes.iterrows()})

    # Clientes registrados en Tuulapp por mes (fecha de registro del respaldo)
    cl = pd.read_excel(ruta_backup, sheet_name='Clientes')
    cl['f'] = pd.to_datetime(cl['FECHA_REGISTRO'], errors='coerce')
    reg = cl.dropna(subset=['f']).groupby(cl['f'].dt.to_period('M')).size()
    reg = reg[reg.index.isin(meses)]
    R['clientes_registrados_tuulapp'] = dict(promedio=float(reg.mean()), maximo=int(reg.max()), por_mes={str(k): int(x) for k, x in reg.items()})
    veh = pd.read_excel(ruta_backup, sheet_name='Vehiculos')
    tit = veh.groupby('DOCUMENTO')['PLACA'].nunique()
    R['vehiculos_por_titular'] = dict(titulares=int(len(tit)), con_mas_de_uno=int((tit > 1).sum()), proporcion=float((tit > 1).mean()))

    # Actualizaciones de datos en el chat de WhatsApp
    lineas = open(ruta_chat, encoding='utf-8', errors='replace').read().splitlines()
    pat = re.compile(r'^\[(\d{1,2}/\d{1,2}/\d{2}), [^\]]+\] ([^:]+): (.*)$')
    act = []
    for l in lineas:
        m = pat.match(l)
        if not m or not re.search(r'actualizaci[oó]n de (sus )?(datos|veh)', m.group(3), re.I):
            continue
        txt = m.group(3).lower()
        cliente = bool(re.search(r'nombre|dni|celular|cliente \(|correo', txt)) or 'datos (' in txt and not re.search(r'datos \((vin|a[ñn]o|color|modelo)', txt)
        vehiculo = bool(re.search(r'vin|a[ñn]o|color|modelo|veh[ií]culo|placa|motor|serie', txt))
        act.append(dict(fecha=datetime.strptime(m.group(1), '%m/%d/%y'), cliente=cliente, vehiculo=vehiculo))
    a = pd.DataFrame(act)
    dias = (a['fecha'].max() - a['fecha'].min()).days + 1
    R['whatsapp'] = dict(sede='Unión', desde=str(a['fecha'].min().date()), hasta=str(a['fecha'].max().date()), dias=int(dias),
                         actualizaciones=int(len(a)), con_datos_de_cliente=int(a['cliente'].sum()), con_datos_de_vehiculo=int(a['vehiculo'].sum()),
                         por_mes_30_dias=dict(total=round(len(a) / dias * 30, 1), cliente=round(a['cliente'].sum() / dias * 30, 1), vehiculo=round(a['vehiculo'].sum() / dias * 30, 1)))
    if salida:
        with open(salida, 'w', encoding='utf-8') as f: json.dump(R, f, ensure_ascii=False, indent=1, default=str)
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))


if __name__ == '__main__':
    if len(sys.argv) < 4: sys.exit(__doc__)
    main(*sys.argv[1:5])
