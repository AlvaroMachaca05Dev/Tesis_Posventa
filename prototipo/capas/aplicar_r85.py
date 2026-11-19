import sys, os
# Capa R8.5: tres propuestas para la vista comprimida de las líneas del plan preventivo (matriz por categoría, escalera, tarjetas).
src, dst = sys.argv[1], sys.argv[2]
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'r85')
s = open(src, encoding='utf-8').read()
def rep(old, new, count=1):
    global s
    n = s.count(old); assert n == count, (old[:80], n); s = s.replace(old, new)
rep("</style></head>", open(os.path.join(d, 'estilos.css'), encoding='utf-8').read() + "</style></head>")
layer = open(os.path.join(d, 'a_lineas.js'), encoding='utf-8').read()
i = s.rindex("\nrender();\n</script>"); s = s[:i] + "\n" + layer + s[i:]
rep("R_Motriz R8.4 · demo local", "R_Motriz R8.5 · demo local")
rep("<title>R Motriz · Espacio de trabajo R8.4</title>", "<title>R Motriz · Espacio de trabajo R8.5</title>")
open(dst, 'w', encoding='utf-8').write(s); print('OK', len(s))
