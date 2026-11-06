import sys, os, re
# Capa R7.8: lo decidido el 28/10/2026 para clientes y vehículos, más los nombres de las fechas de la ODS.
src, dst = sys.argv[1], sys.argv[2]
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'r78')
s = open(src, encoding='utf-8').read()
def rep(old, new, count=1):
    global s
    n = s.count(old); assert n == count, (old[:80], n); s = s.replace(old, new)
rep("</style></head>", open(os.path.join(d, 'estilos.css'), encoding='utf-8').read() + "</style></head>")
layer = '\n'.join(open(os.path.join(d, f), encoding='utf-8').read() for f in ['a_maestros.js', 'b_ods.js', 'c_nota.js', 'd_kardex.js', 'e_responsables.js', 'f_reportes.js', 'g_espacio.js', 'h_s5.js'])
i = s.rindex("\nrender();\n</script>"); s = s[:i] + "\n" + layer + s[i:]
# La fecha de salida de la ODS pasa a llamarse fecha de cierre y la de ingreso, fecha de inicio (DEC-61).
# Solo textos que se ven en pantalla; los encabezados de exportación e importación no se tocan.
for viejo, nuevo in [('<label>Fecha de ingreso<', '<label>Fecha de inicio<'), ('<label>Hora de ingreso<', '<label>Hora de inicio<'),
                     ("[['ingreso','Fecha de ingreso'],['salida','Fecha de salida']]", "[['ingreso','Fecha de inicio'],['salida','Fecha de cierre']]"),
                     ('>Fecha de ingreso</option>', '>Fecha de inicio</option>'), ('>Fecha de salida</option>', '>Fecha de cierre</option>'),
                     ("select('policy','Fecha de salida'", "select('policy','Fecha de cierre'"), ('fecha de salida', 'fecha de cierre')]:
    print(viejo[:50], '->', nuevo[:40], s.count(viejo)); s = s.replace(viejo, nuevo)
rep("R_Motriz R7.7 · demo local", "R_Motriz R7.8 · demo local")
rep("<title>R Motriz · Espacio de trabajo R7.7</title>", "<title>R Motriz · Espacio de trabajo R7.8</title>")
open(dst, 'w', encoding='utf-8').write(s); print('OK', len(s))
