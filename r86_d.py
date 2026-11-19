base = 'F:/Tesis/Tesis_Posventa/prototipo/'
p = base + 'capas/r86/a_timeline.js'
s = open(p, encoding='utf-8').read()

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:80]
    s = s.replace(a, b, 1)

# la proyección siempre arranca con el servicio express, y dura ciclo y medio como máximo y hasta el fin del año actual + 2
i0 = s.index("  let pos=-1;visitas.forEach(")
i1 = s.index("  const fut=[];")
s = s[:i0] + "  const pos=-1;\n" + s[i1:]
rep("    for(let k=1;k<=L*2;k++){", "    const limite=(new Date(today()+'T12:00:00').getFullYear()+2)+'-12-31';\n    for(let k=1;k<=Math.ceil(L*1.5);k++){")
rep("      const km=ult.km+paso*k;\n      fut.push({fk:'f'+k,k,clave,nombre:R86_NOM[clave],tags,lines,km,date:r86Fecha(ult.date,paso_m*k),vencido:km<=cur});",
    "      const km=ult.km+paso*k,date=r86Fecha(ult.date,paso_m*k);\n      if(date>limite)break;\n      fut.push({fk:'f'+k,k,clave,nombre:R86_NOM[clave],tags,lines,km,date,vencido:km<=cur});")
s = s.replace("   - Proyección de al menos 2 ciclos completos.", "   - Proyección: siempre arranca con el servicio express; ciclo y medio como máximo y no más allá del fin del año actual + 2 (hoy, 2028).")
open(p, 'w', encoding='utf-8').write(s)

p = base + 'capas/r86/estilos.css'
t = open(p, encoding='utf-8').read()
a = ".r86-fs .r86m thead th{position:static}\n"
assert a in t
t = t.replace(a, "")
t += """
/* las esquinas (Categoría y Servicio) quedan fijas también en pantalla completa y en «solo la línea» */
.r86m thead th.r86-cc,.r86m thead th.r86-k{position:sticky!important;left:0;z-index:8}
.r86m thead th.r86-cc + th.r86-k{left:78px}
.r86m thead th.r86-k:first-child{left:0}
"""
open(p, 'w', encoding='utf-8').write(t)
print('ok')
