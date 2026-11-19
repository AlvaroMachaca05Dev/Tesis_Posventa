import sys, os
# Capa R8.6: línea temporal con matriz categorías × visitas (comprimido), servicios con etiqueta de categoría (detalle),
# nota con lista de checks, historial de ODS por visita y datos de ejemplo (clientes, vehículos y ODS).
src, dst = sys.argv[1], sys.argv[2]
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'r86')
s = open(src, encoding='utf-8').read()
def rep(old, new, count=1):
    global s
    n = s.count(old); assert n == count, (old[:80], n); s = s.replace(old, new)
rep("</style></head>", open(os.path.join(d, 'estilos.css'), encoding='utf-8').read() + "</style></head>")
layer = open(os.path.join(d, 'a_timeline.js'), encoding='utf-8').read() + chr(10) + open(os.path.join(d, 'b_ciclos.js'), encoding='utf-8').read()
i = s.rindex("\nrender();\n</script>"); s = s[:i] + "\n" + layer + s[i:]
rep("R_Motriz R8.5 · demo local", "R_Motriz R8.6 · demo local · rev. 18-nov d")
rep("<title>R Motriz · Espacio de trabajo R8.5</title>", "<title>R Motriz · Espacio de trabajo R8.6</title>")
open(dst, 'w', encoding='utf-8').write(s); print('OK', len(s))
