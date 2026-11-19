import sys, os, re
# Capa R8.7: ocho planes (combustible × uso × aceite) con código y ciclo simétrico, línea de tiempo por plan, tramos,
# «por vencer», descuento por servicios hechos y renombre de uso a particular / profesional.
src, dst = sys.argv[1], sys.argv[2]
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'r87')
s = open(src, encoding='utf-8').read()
def rep(old, new, count=1):
    global s
    n = s.count(old); assert n == count, (old[:80], n); s = s.replace(old, new)
# constantes de R8.6 que la capa redefine
rep("const r86Paso=", "var r86Paso=")
rep("const r86AfinIdx=", "var r86AfinIdx=")
# uso severo -> profesional, uso normal -> particular (interfaz)
s = s.replace("['S','Severo']", "['S','Profesional']").replace(">Severo</option>", ">Profesional</option>")
s = s.replace("'Severo'", "'Profesional'").replace("Severo: km", "Profesional: km").replace(" / Severo", " / Profesional").replace("Regla de uso severo", "Regla de uso profesional")
rep("</style></head>", open(os.path.join(d, 'estilos.css'), encoding='utf-8').read() + "</style></head>")
layer = open(os.path.join(d, 'a_planes.js'), encoding='utf-8').read() + chr(10) + open(os.path.join(d, 'b_generica.js'), encoding='utf-8').read() + chr(10) + open(os.path.join(d, 'c_vehiculo.js'), encoding='utf-8').read()
i = s.rindex("\nrender();\n</script>"); s = s[:i] + "\n" + layer + s[i:]
rep("R_Motriz R8.6 · demo local · rev. 18-nov d", "R_Motriz R8.7 · demo local · rev. 19-nov")
rep("<title>R Motriz · Espacio de trabajo R8.6</title>", "<title>R Motriz · Espacio de trabajo R8.7</title>")
open(dst, 'w', encoding='utf-8').write(s); print('OK', len(s))
