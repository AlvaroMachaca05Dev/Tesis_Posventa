import sys, os
# Capa R8.4: planes preventivos y línea temporal con el modelo del sistema (4 planes por combustible y uso, ciclo de visitas,
# afinamiento y revisión completa dentro del ciclo) y servicios del catálogo con precio y horas del grupo G1.
src, dst = sys.argv[1], sys.argv[2]
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'r84')
s = open(src, encoding='utf-8').read()
def rep(old, new, count=1):
    global s
    n = s.count(old); assert n == count, (old[:80], n); s = s.replace(old, new)
rep("</style></head>", open(os.path.join(d, 'estilos.css'), encoding='utf-8').read() + "</style></head>")
layer = open(os.path.join(d, 'datos.js'), encoding='utf-8').read() + "\n" + open(os.path.join(d, 'a_planes.js'), encoding='utf-8').read()
i = s.rindex("\nrender();\n</script>"); s = s[:i] + "\n" + layer + s[i:]
rep("R_Motriz R8.3 · demo local", "R_Motriz R8.4 · demo local")
rep("<title>R Motriz · Espacio de trabajo R8.3</title>", "<title>R Motriz · Espacio de trabajo R8.4</title>")
open(dst, 'w', encoding='utf-8').write(s); print('OK', len(s))
