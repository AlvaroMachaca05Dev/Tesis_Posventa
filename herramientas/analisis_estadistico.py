# -*- coding: utf-8 -*-
"""Análisis estadístico de la validación (tesis, sección «Plan de análisis de los datos»).

Uso:  python herramientas/analisis_estadistico.py mediciones.csv [reajustes.csv] [sus.csv]

mediciones.csv  columnas: vehiculo, tiempo_manual, tiempo_sistema, prox_manual, prox_sistema
reajustes.csv   columna:  completo (1 o 0), una fila por reajuste
sus.csv         columnas: persona, p1 … p10 (1 a 5)

Requiere SciPy:  pip install scipy
Los CSV con datos reales del taller no se guardan en el repositorio.
"""
import csv
import math
import statistics as st
import sys

from scipy import stats

ALFA = 0.05


def leer(ruta):
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def descriptivos(nombre, x):
    q1, q2, q3 = st.quantiles(x, n=4)
    media, desv = st.mean(x), st.stdev(x)
    moda = st.multimode(x)
    print(f"  {nombre}: n={len(x)} media={media:.2f} mediana={q2:.2f} moda={moda[0]:.2f}"
          f" Q1={q1:.2f} Q3={q3:.2f} rango={max(x) - min(x):.2f} varianza={desv ** 2:.2f}"
          f" desv={desv:.2f} CV={desv / media if media else float('nan'):.2f}"
          f" asimetria={stats.skew(x, bias=False):.2f} curtosis={stats.kurtosis(x, bias=False):.2f}")


def pareada(codigo, antes, despues, alternativa):
    """Shapiro-Wilk sobre las diferencias; t pareada si son normales, Wilcoxon si no."""
    dif = [d - a for a, d in zip(antes, despues)]
    descriptivos("antes", antes)
    descriptivos("despues", despues)
    w, p_norm = stats.shapiro(dif)
    normal = p_norm >= ALFA
    print(f"  Shapiro-Wilk de las diferencias: W={w:.3f} p={p_norm:.4f} -> {'normal' if normal else 'no normal'}")
    n = len(dif)
    if normal:
        t, p = stats.ttest_rel(despues, antes, alternative=alternativa)
        efecto = st.mean(dif) / st.stdev(dif)
        print(f"  t de Student pareada: t={t:.3f} gl={n - 1} p={p:.4f} d de Cohen={efecto:.2f}")
    else:
        r = stats.wilcoxon(despues, antes, alternative=alternativa, method="approx")
        z = stats.norm.isf(r.pvalue) if alternativa != "two-sided" else stats.norm.isf(r.pvalue / 2)
        print(f"  Wilcoxon: W={r.statistic:.1f} p={r.pvalue:.4f} r={abs(z) / math.sqrt(n):.2f}")
        p = r.pvalue
    print(f"  {codigo}: {'se rechaza H0' if p < ALFA else 'no se rechaza H0'} (alfa={ALFA})")


def main(args):
    sys.stdout.reconfigure(encoding="utf-8")
    if not args:
        sys.exit(__doc__)
    med = leer(args[0])
    col = lambda c: [float(f[c]) for f in med]
    print("HE-1 Tiempo de generación del plan (min): se espera sistema < manual")
    pareada("HE-1", col("tiempo_manual"), col("tiempo_sistema"), "less")
    print("HE-3 Mantenimientos próximos identificados: se espera sistema > manual")
    pareada("HE-3", col("prox_manual"), col("prox_sistema"), "greater")
    if len(args) > 1:
        x = [int(f["completo"]) for f in leer(args[1])]
        k, n = sum(x), len(x)
        r = stats.binomtest(k, n, 0.90, alternative="greater")
        ic = r.proportion_ci(confidence_level=0.95)
        print(f"HE-2 Reajustes completos: {k}/{n} = {k / n:.3f} IC95%=[{ic.low:.3f}, {ic.high:.3f}]"
              f" binomial p={r.pvalue:.4f} -> {'se rechaza H0' if r.pvalue < ALFA else 'no se rechaza H0'}")
    if len(args) > 2:
        sus = []
        for f in leer(args[2]):
            v = [int(f[f"p{i}"]) for i in range(1, 11)]
            sus.append(2.5 * sum((v[i] - 1) if i % 2 == 0 else (5 - v[i]) for i in range(10)))
        q1, q2, q3 = st.quantiles(sus, n=4)
        dif = [s - 68 for s in sus if s != 68]
        r = stats.wilcoxon(dif, alternative="greater")
        print(f"HE-4 SUS: n={len(sus)} mediana={q2:.1f} Q1={q1:.1f} Q3={q3:.1f} Wilcoxon p={r.pvalue:.4f}"
              f" -> {'se rechaza H0' if r.pvalue < ALFA else 'no se rechaza H0'}")


if __name__ == "__main__":
    main(sys.argv[1:])
