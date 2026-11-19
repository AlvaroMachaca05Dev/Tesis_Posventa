# -*- coding: utf-8 -*-
"""Análisis estadístico del historial de órdenes del sistema anterior del taller (capítulo de resultados).

Uso: python herramientas/analisis_historial.py <ReporteOperación.xlsx> <carpeta_figuras> [salida.json]
Lee el reporte de operación exportado (una fila por ítem de cada ODS), lo agrupa por orden y por vehículo,
calcula estadística descriptiva e inferencial y guarda figuras sin datos personales.
Requiere pandas, scipy y matplotlib. Los datos reales no se guardan en el repositorio.
"""
import json
import os
import re
import sys
import unicodedata

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

ALFA = 0.05
ACTIVO_DIAS = 180  # cliente activo: volvió dentro de 6 meses (criterio del taller)
KM_RECOMENDADO = 5000  # lo que hoy se recomienda al cliente en el taller
AZUL, GRIS, VERDE = '#2563eb', '#94a3b8', '#15803d'


def norm_texto(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\s*-\s*[\d.,]+\s*(-\s*)?$', '', s)  # quita el sufijo de horas «- 0.25 -»
    s = re.sub(r'\(.*?\)', ' ', s)
    s = re.sub(r'\b(r|l|der|izq|derecho|izquierdo|delantero|posterior|trasero)\b', ' ', s)
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def resumen(x):
    x = pd.Series(x, dtype=float).dropna()
    q1, q2, q3 = x.quantile([.25, .5, .75])
    moda = x.round(0).mode()
    return dict(n=int(len(x)), media=float(x.mean()), mediana=float(q2), moda=float(moda.iloc[0]) if len(moda) else None,
                q1=float(q1), q3=float(q3), minimo=float(x.min()), maximo=float(x.max()), rango=float(x.max() - x.min()),
                varianza=float(x.var()), desv=float(x.std()), cv=float(x.std() / x.mean()) if x.mean() else None,
                asimetria=float(stats.skew(x, bias=False)), curtosis=float(stats.kurtosis(x, bias=False)))


def normalidad(x):
    x = np.asarray(pd.Series(x).dropna(), float)
    m = x if len(x) <= 5000 else np.random.default_rng(1).choice(x, 5000, replace=False)
    w, p = stats.shapiro(m)
    return dict(prueba='Shapiro-Wilk', n=int(len(m)), W=float(w), p=float(p), normal=bool(p >= ALFA))


def wilcoxon_una(x, ref, alternativa):
    x = np.asarray(pd.Series(x).dropna(), float)
    d = x - ref
    d = d[d != 0]
    r = stats.wilcoxon(d, alternative=alternativa, method='approx')
    z = stats.norm.isf(r.pvalue) if alternativa != 'two-sided' else stats.norm.isf(r.pvalue / 2)
    return dict(prueba='Wilcoxon de una muestra', referencia=ref, alternativa=alternativa, n=int(len(d)), W=float(r.statistic),
                p=float(r.pvalue), r=float(abs(z) / np.sqrt(len(d))), mediana=float(np.median(x)))


def main(ruta, carpeta, salida=None):
    os.makedirs(carpeta, exist_ok=True)
    plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False})
    df = pd.read_excel(ruta)
    anuladas = int((df['Anulada'].astype(str).str.lower().str.startswith('s')).sum())
    df = df[~df['Anulada'].astype(str).str.lower().str.startswith('s')].copy()
    df['fecha'] = pd.to_datetime(df['Fecha/Ingreso'], errors='coerce')
    df['km'] = pd.to_numeric(df['Kilometraje/Millas'], errors='coerce')
    df['placa'] = df['Vehiculo'].astype(str).str.extract(r'Placa:\s*([A-Za-z0-9\- ]+)')[0].str.upper().str.replace(r'[^A-Z0-9]', '', regex=True)
    corte = df['fecha'].max()
    R = dict(fuente=os.path.basename(ruta), desde=str(df['fecha'].min().date()), hasta=str(corte.date()), lineas=int(len(df)), lineas_anuladas_excluidas=anuladas, estados={str(k): int(v) for k, v in df.groupby('Estado')['# ODS'].nunique().items()})

    # Órdenes
    ods = df.groupby('# ODS').agg(fecha=('fecha', 'min'), placa=('placa', 'first'), doc=('Identificación', 'first'),
                                  km=('km', 'max'), total=('Total', 'sum'), factura=('# Factura', 'first'),
                                  motivo=('Motivo/Ingreso', 'first')).reset_index()
    ods['doc'] = ods['doc'].astype(str).str.strip()
    R['ods'] = int(len(ods)); R['clientes'] = int(ods['doc'].nunique()); R['vehiculos'] = int(ods['placa'].nunique())
    meses = (corte - df['fecha'].min()).days / 30.44
    R['ods_por_mes'] = float(len(ods) / meses)

    # Calidad del registro
    R['calidad'] = dict(
        ods_sin_km=float((ods['km'].fillna(0) <= 0).mean()),
        ods_sin_documento=float(ods['doc'].isin(['', 'nan', 'None', '0', '00000000']).mean()),
        ods_sin_factura=float(ods['factura'].isna().mean()),
        ods_sin_placa=float(ods['placa'].isna().mean()),
    )
    o2 = ods.dropna(subset=['placa']).sort_values(['placa', 'fecha'])
    o2['km_prev'] = o2.groupby('placa')['km'].shift()
    valid = o2.dropna(subset=['km_prev'])
    valid = valid[(valid['km'] > 0) & (valid['km_prev'] > 0)]
    R['calidad']['km_menor_que_la_visita_anterior'] = float((valid['km'] < valid['km_prev']).mean())

    # Nombres de servicios
    mo = df[df['Tipo'] == 'mano de obra'].copy()
    mo['norm'] = mo['Item'].map(norm_texto)
    R['servicios'] = dict(lineas=int(len(mo)), nombres_distintos=int(mo['Item'].nunique()),
                          nombres_normalizados=int(mo['norm'].nunique()), catalogo_estandar=93,
                          nombres_usados_una_vez=int((mo['Item'].value_counts() == 1).sum()))
    aceite = mo[mo['norm'].str.contains('aceite de motor')]
    R['servicios']['variantes_cambio_aceite'] = int(aceite['Item'].nunique())
    rev = mo[mo['norm'].str.contains('revision|diagnost|escan')]
    R['servicios']['lineas_revision_diagnostico'] = int(len(rev))
    R['servicios']['revision_en_cero'] = int((rev['Total'] <= 0).sum())
    R['servicios']['ods_con_revision'] = int(rev['# ODS'].nunique())

    # Visitas por vehículo y retorno
    pv = o2.groupby('placa').agg(visitas=('# ODS', 'count'), primera=('fecha', 'min'), ultima=('fecha', 'max'))
    R['visitas'] = resumen(pv['visitas'])
    frec = pv['visitas'].clip(upper=5).value_counts().sort_index()
    R['visitas']['frecuencias'] = {('5 o más' if k == 5 else str(int(k))): int(v) for k, v in frec.items()}
    R['visitas']['una_sola_visita'] = float((pv['visitas'] == 1).mean())
    o2['dias'] = o2.groupby('placa')['fecha'].diff().dt.days
    o2['dkm'] = o2['km'] - o2['km_prev']
    dias = o2['dias'].dropna(); dias = dias[dias > 0]
    R['intervalo_dias'] = resumen(dias)
    R['intervalo_dias']['normalidad'] = normalidad(dias)
    R['intervalo_dias']['wilcoxon_vs_180'] = wilcoxon_una(dias, ACTIVO_DIAS, 'two-sided')
    dkm = o2.loc[(o2['dkm'] > 0) & (o2['dkm'] < 60000) & (o2['dias'] > 0), 'dkm']
    R['intervalo_km'] = resumen(dkm)

    # Cambio de aceite: intervalo real frente a los 5 000 km que se recomiendan
    ods_aceite = set(aceite['# ODS'])
    oa = o2[o2['# ODS'].isin(ods_aceite) & (o2['km'] > 0)].sort_values(['placa', 'fecha']).copy()
    oa['dkm'] = oa.groupby('placa')['km'].diff()
    oa['dias'] = oa.groupby('placa')['fecha'].diff().dt.days
    ka = oa.loc[(oa['dkm'] > 0) & (oa['dkm'] < 40000), 'dkm']
    R['aceite_km'] = resumen(ka)
    R['aceite_km']['normalidad'] = normalidad(ka)
    R['aceite_km']['wilcoxon_vs_5000'] = wilcoxon_una(ka, KM_RECOMENDADO, 'greater')
    R['aceite_km']['pasan_de_5000'] = float((ka > KM_RECOMENDADO).mean())
    R['aceite_km']['pasan_de_7500'] = float((ka > 7500).mean())

    # Retención con el criterio de 6 meses
    elegibles = pv[pv['primera'] <= corte - pd.Timedelta(days=ACTIVO_DIAS)].copy()
    seg = o2[o2['placa'].isin(elegibles.index)].copy()
    seg = seg.merge(elegibles[['primera']], left_on='placa', right_index=True)
    volvio = seg[(seg['fecha'] > seg['primera']) & (seg['fecha'] <= seg['primera'] + pd.Timedelta(days=ACTIVO_DIAS))].groupby('placa').size()
    elegibles['volvio_6m'] = elegibles.index.isin(volvio.index)
    k, n = int(elegibles['volvio_6m'].sum()), int(len(elegibles))
    ic = stats.binomtest(k, n).proportion_ci(0.95)
    R['retencion'] = dict(elegibles=n, volvieron_6m=k, proporcion=k / n, ic95=[float(ic.low), float(ic.high)])
    pv['activo'] = pv['ultima'] >= corte - pd.Timedelta(days=ACTIVO_DIAS)
    R['retencion']['activos_al_corte'] = float(pv['activo'].mean())
    R['retencion']['vehiculos_inactivos'] = int((~pv['activo']).sum())

    # Primera visita preventiva o correctiva frente al retorno (independientes)
    primera = o2.groupby('placa').first()
    elegibles['preventiva'] = primera.loc[elegibles.index, '# ODS'].isin(ods_aceite).values
    tabla = pd.crosstab(elegibles['preventiva'], elegibles['volvio_6m'])
    chi2, p, gl, esp = stats.chi2_contingency(tabla)
    nn = tabla.values.sum()
    R['chi2_tipo_vs_retorno'] = dict(tabla={('Preventiva' if i else 'Otra'): {('Volvió' if j else 'No volvió'): int(tabla.loc[i, j]) for j in tabla.columns} for i in tabla.index},
                                     chi2=float(chi2), gl=int(gl), p=float(p), v_cramer=float(np.sqrt(chi2 / (nn * (min(tabla.shape) - 1)))),
                                     proporcion_prev=float(tabla.loc[True, True] / tabla.loc[True].sum()), proporcion_otra=float(tabla.loc[False, True] / tabla.loc[False].sum()))
    o2['grupo'] = np.where(o2.groupby('placa')['# ODS'].shift().isin(ods_aceite), 'Preventiva', 'Otra')
    a = o2.loc[(o2['grupo'] == 'Preventiva') & (o2['dias'] > 0), 'dias']; b = o2.loc[(o2['grupo'] == 'Otra') & (o2['dias'] > 0), 'dias']
    u = stats.mannwhitneyu(a, b, alternative='two-sided')
    zu = stats.norm.isf(u.pvalue / 2)
    R['mann_whitney_dias'] = dict(prueba='U de Mann-Whitney', n_prev=int(len(a)), n_otra=int(len(b)), U=float(u.statistic), p=float(u.pvalue),
                                  r=float(zu / np.sqrt(len(a) + len(b))), mediana_prev=float(a.median()), mediana_otra=float(b.median()))

    # Ticket por orden y correlación con las visitas
    tk = ods['total'][ods['total'] > 0]
    R['ticket'] = resumen(tk)
    gasto = o2.groupby('placa')['total'].sum()
    rho, prho = stats.spearmanr(pv['visitas'], gasto.loc[pv.index])
    R['spearman_visitas_gasto'] = dict(rho=float(rho), p=float(prho), n=int(len(pv)))

    # Figuras
    m = ods.set_index('fecha').resample('MS').size()
    fig, ax = plt.subplots(figsize=(7, 3)); ax.bar(m.index.strftime('%b %y'), m.values, color=AZUL)
    ax.set_ylabel('Órdenes'); ax.tick_params(axis='x', rotation=60); fig.tight_layout(); fig.savefig(f'{carpeta}/R01_ordenes_por_mes.png', dpi=200); plt.close(fig)
    fig, ax = plt.subplots(figsize=(6, 3)); ax.bar(list(R['visitas']['frecuencias'].keys()), list(R['visitas']['frecuencias'].values()), color=AZUL)
    ax.set_xlabel('Visitas del vehículo en el periodo'); ax.set_ylabel('Vehículos'); fig.tight_layout(); fig.savefig(f'{carpeta}/R02_visitas_por_vehiculo.png', dpi=200); plt.close(fig)
    fig, ax = plt.subplots(1, 2, figsize=(8, 3))
    ax[0].hist(dias.clip(upper=420), bins=28, color=AZUL); ax[0].axvline(ACTIVO_DIAS, color='#dc2626', ls='--'); ax[0].set_xlabel('Días entre visitas'); ax[0].set_ylabel('Visitas')
    ax[1].boxplot([dias], vert=False, widths=.5, patch_artist=True, boxprops=dict(facecolor='#dbeafe')); ax[1].axvline(ACTIVO_DIAS, color='#dc2626', ls='--'); ax[1].set_yticks([]); ax[1].set_xlabel('Días entre visitas')
    fig.tight_layout(); fig.savefig(f'{carpeta}/R03_dias_entre_visitas.png', dpi=200); plt.close(fig)
    fig, ax = plt.subplots(1, 2, figsize=(8, 3))
    ax[0].hist(ka, bins=25, color=VERDE); ax[0].axvline(KM_RECOMENDADO, color='#dc2626', ls='--'); ax[0].set_xlabel('Km entre cambios de aceite'); ax[0].set_ylabel('Cambios')
    ax[1].boxplot([ka], vert=False, widths=.5, patch_artist=True, boxprops=dict(facecolor='#dcfce7')); ax[1].axvline(KM_RECOMENDADO, color='#dc2626', ls='--'); ax[1].set_yticks([]); ax[1].set_xlabel('Km entre cambios de aceite')
    fig.tight_layout(); fig.savefig(f'{carpeta}/R04_km_entre_cambios_aceite.png', dpi=200); plt.close(fig)
    fig, ax = plt.subplots(figsize=(6, 3))
    vals = [R['servicios']['nombres_distintos'], R['servicios']['nombres_normalizados'], R['servicios']['catalogo_estandar']]
    ax.barh(['Nombres escritos en el\nsistema anterior', 'Mismos nombres sin\ntildes ni horas', 'Catálogo estandarizado'], vals, color=[GRIS, GRIS, AZUL])
    for i, v in enumerate(vals): ax.text(v, i, f' {v}', va='center')
    ax.set_xlabel('Nombres distintos de mano de obra'); fig.tight_layout(); fig.savefig(f'{carpeta}/R05_nombres_de_servicios.png', dpi=200); plt.close(fig)

    if salida:
        with open(salida, 'w', encoding='utf-8') as f: json.dump(R, f, ensure_ascii=False, indent=1, default=str)
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))


if __name__ == '__main__':
    if len(sys.argv) < 3: sys.exit(__doc__)
    main(*sys.argv[1:4])
