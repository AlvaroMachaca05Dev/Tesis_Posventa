# -*- coding: utf-8 -*-
"""Estimación KLM (Keystroke-Level Model) del tiempo de registro de cliente y vehículo (HE-1).

Uso: python herramientas/klm_registro.py [carpeta_figura]
Compara el registro en el sistema anterior del taller (todo escrito a mano, con la placa consultada en SUNARP y
copiada desde una imagen) con el sistema propuesto (consulta de DNI o RUC y consulta vehicular por placa).
Tiempos de los operadores: Card, Moran y Newell (1983). Es una estimación analítica, no una medición con usuarios.
"""
import json
import sys

K_TEXTO = 0.28   # tecla, mecanógrafo promedio (40 palabras por minuto)
K_CODIGO = 0.50  # tecla de un código sin sentido (VIN, serie, motor)
P = 1.10         # apuntar con el mouse
BB = 0.20        # hacer clic
H = 0.40         # pasar la mano del mouse al teclado
M = 1.35         # preparación mental: leer, buscar o decidir

ESCRIBIR = 'escribir'


def ir():  # ir a un campo con el mouse y volver al teclado
    return [('P', P), ('BB', BB), ('H', H)]


def campo(caracteres, k=K_TEXTO, leer=True):
    ops = ir()
    if leer: ops.append(('M', M))
    ops.append((f'{caracteres}K', caracteres * k))
    return ops


def elegir():  # elegir una opción de una lista
    return [('P', P), ('BB', BB), ('M', M), ('P', P), ('BB', BB)]


def cambiar_ventana():
    return [('P', P), ('BB', BB)]


def esperar(seg):
    return [('R', seg)]


def total(ops): return sum(t for _, t in ops)


def teclas(ops): return sum(int(o[:-1]) for o, _ in ops if o.endswith('K') and o[:-1].isdigit())


def escenarios():
    E = {}
    # Sistema anterior · cliente con DNI: todo se dicta y se escribe
    cli = elegir() + campo(8) + campo(28) + campo(9) + [('P', P), ('BB', BB)]
    # Sistema anterior · vehículo: consulta en SUNARP (placa y código de verificación) y se copia desde la imagen
    sunarp = cambiar_ventana() + campo(7, leer=False) + campo(6, K_CODIGO) + [('P', P), ('BB', BB)] + esperar(4.0)
    copiar = []
    for c, k in [(7, K_TEXTO), (10, K_TEXTO), (4, K_TEXTO), (6, K_TEXTO), (17, K_CODIGO), (17, K_CODIGO), (11, K_CODIGO)]:
        copiar += cambiar_ventana() + [('M', M)] + campo(c, k, leer=False)  # mirar la imagen y escribir en el formulario
    veh = sunarp + elegir() + copiar + [('P', P), ('BB', BB)]
    E['anterior_cliente_dni'] = cli
    E['anterior_vehiculo'] = veh
    # Sistema anterior · cliente con RUC: razón social y dirección fiscal a mano
    E['anterior_cliente_ruc'] = elegir() + campo(11) + campo(35) + campo(45) + campo(9) + [('P', P), ('BB', BB)]

    # Sistema propuesto · cliente: documento + Consultar
    cons = [('P', P), ('BB', BB)] + esperar(2.0) + [('M', M)]
    E['propuesto_cliente_dni'] = elegir() + campo(8) + cons + campo(9) + [('P', P), ('BB', BB)]
    E['propuesto_cliente_ruc'] = elegir() + campo(11) + cons + campo(9) + [('P', P), ('BB', BB)]
    # Sistema propuesto · vehículo: placa + Consultar; completo o con VIN y serie faltantes
    base = campo(7, leer=False) + [('P', P), ('BB', BB)] + esperar(3.0) + [('M', M)]
    E['propuesto_vehiculo_completo'] = base + [('P', P), ('BB', BB)]
    faltan = []
    for c in (17, 17):
        faltan += cambiar_ventana() + [('M', M)] + campo(c, K_CODIGO, leer=False)
    E['propuesto_vehiculo_parcial'] = base + faltan + [('P', P), ('BB', BB)]
    return E


def main(carpeta=None):
    E = escenarios()
    R = {k: dict(segundos=round(total(v), 1), teclas=teclas(v), operadores=len(v)) for k, v in E.items()}
    casos = {
        'Cliente con DNI y vehículo (consulta completa)': ('anterior_cliente_dni', 'anterior_vehiculo', 'propuesto_cliente_dni', 'propuesto_vehiculo_completo'),
        'Cliente con DNI y vehículo (faltan VIN y serie)': ('anterior_cliente_dni', 'anterior_vehiculo', 'propuesto_cliente_dni', 'propuesto_vehiculo_parcial'),
        'Cliente con RUC y vehículo (consulta completa)': ('anterior_cliente_ruc', 'anterior_vehiculo', 'propuesto_cliente_ruc', 'propuesto_vehiculo_completo'),
    }
    C = {}
    for n, (a1, a2, p1, p2) in casos.items():
        ta = total(E[a1]) + total(E[a2]); tp = total(E[p1]) + total(E[p2])
        ka = teclas(E[a1]) + teclas(E[a2]); kp = teclas(E[p1]) + teclas(E[p2])
        C[n] = dict(anterior_s=round(ta, 1), propuesto_s=round(tp, 1), reduccion=round(1 - tp / ta, 3), teclas_anterior=ka, teclas_propuesto=kp)
    salida = dict(operadores=dict(K_texto=K_TEXTO, K_codigo=K_CODIGO, P=P, BB=BB, H=H, M=M), escenarios=R, casos=C)
    print(json.dumps(salida, ensure_ascii=False, indent=1))
    if carpeta:
        sys.path.insert(0, 'F:/Tesis/_py')
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False})
        nombres = ['DNI, consulta\ncompleta', 'DNI, faltan\nVIN y serie', 'RUC, consulta\ncompleta']
        a = [v['anterior_s'] for v in C.values()]; p = [v['propuesto_s'] for v in C.values()]
        x = range(len(nombres))
        fig, ax = plt.subplots(figsize=(7, 3.2))
        ax.bar([i - .2 for i in x], a, .4, label='Sistema actual del taller', color='#94a3b8')
        ax.bar([i + .2 for i in x], p, .4, label='Sistema propuesto', color='#2563eb')
        for i in x:
            ax.text(i - .2, a[i], f'{a[i]:.0f} s', ha='center', va='bottom', fontsize=9)
            ax.text(i + .2, p[i], f'{p[i]:.0f} s', ha='center', va='bottom', fontsize=9)
        ax.set_xticks(list(x)); ax.set_xticklabels(nombres); ax.set_ylabel('Segundos estimados (KLM)'); ax.legend(frameon=False, loc='upper center', bbox_to_anchor=(0.5, 1.18), ncol=2); ax.set_ylim(0, max(a) * 1.12)
        fig.tight_layout(); fig.savefig(f'{carpeta}/R06_klm_registro.png', dpi=200); plt.close(fig)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
