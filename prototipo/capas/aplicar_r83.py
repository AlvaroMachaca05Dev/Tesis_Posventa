import sys, os
# Capa R8.3: planes preventivos por combustible y uso, con categorías plegables y tipos de visita.
src, dst = sys.argv[1], sys.argv[2]
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'r83')
s = open(src, encoding='utf-8').read()
def rep(old, new, count=1):
    global s
    n = s.count(old); assert n == count, (old[:80], n); s = s.replace(old, new)
rep("</style></head>", open(os.path.join(d, 'estilos.css'), encoding='utf-8').read() + "</style></head>")
layer = open(os.path.join(d, 'a_planes.js'), encoding='utf-8').read()
i = s.rindex("\nrender();\n</script>"); s = s[:i] + "\n" + layer + s[i:]
rep("R_Motriz R7.8 · demo local", "R_Motriz R8.3 · demo local")
rep("<title>R Motriz · Espacio de trabajo R7.8</title>", "<title>R Motriz · Espacio de trabajo R8.3</title>")
open(dst, 'w', encoding='utf-8').write(s); print('OK', len(s))
