base = 'F:/Tesis/Tesis_Posventa/prototipo/'
p = base + 'capas/r86/a_timeline.js'
s = open(p, encoding='utf-8').read()

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b, 1)

# 1. cobertura por visitas completas: cada visita completa es su paquete; solo se descarta un paquete contenido en otro
i0 = s.index("/* Un paquete solo cuenta si todos sus servicios")
i1 = s.index("r73TlToQuote=function(){")
nuevo = r'''/* Cada visita seleccionada completa es su paquete; solo se descarta uno que esté contenido en otro (el express dentro del menor). Dos paquetes distintos van como dos ítems. */
function r86Cobertura(U){
  const M=r86Modelo(),L=k=>new Set(R84_PAQ[k].l.map(x=>x.n));
  const clave=c=>c.clave==='REV'||c.clave==='EXP'?c.clave:(c.tags.some(t=>/Afin/.test(t))?(c.clave==='MAY'?'MAYAF':'MENAF'):c.clave);
  let A=[...new Set(M.fut.filter(c=>c.lines.length&&c.lines.every(l=>R86.sel.has(r86Key(M.v,c.fk,l.n)))).map(clave))];
  A=A.filter(k=>!A.some(o=>o!==k&&L(o).size>L(k).size&&[...L(k)].every(n=>L(o).has(n))));
  const resto=new Set([...U]);A.forEach(k=>L(k).forEach(n=>resto.delete(n)));
  /* un paquete completado a mano con servicios sueltos también cuenta, sin solaparse con los anteriores */
  Object.keys(R86_PCODE).sort((a,b)=>R84_PAQ[b].l.length-R84_PAQ[a].l.length).forEach(k=>{if(A.includes(k))return;const l=[...L(k)];if(l.every(n=>resto.has(n))){A.push(k);l.forEach(n=>resto.delete(n))}});
  A.sort((a,b)=>R84_PAQ[b].l.length-R84_PAQ[a].l.length);
  return {paq:A,sueltos:[...resto]};
}
'''
s = s[:i0] + nuevo + s[i1:]

rep("<p>Seleccionaste servicios que completan ${pk.length>1?'paquetes del plan':'un paquete del plan'}.</p>",
    "<p>${pk.length>1?`Hay ${pk.length} paquetes del plan en lo que seleccionaste; son paquetes separados, cada uno va en su propio ítem.`:'Lo que seleccionaste completa un paquete del plan.'} ¿Quieres agruparlos por paquete o separarlos por ítem?</p>")
rep("<b>Por paquete del plan</b><ul>", "<b>Agrupar por paquete</b><ul>")
rep("<b>Por ítem</b><ul>", "<b>Separar por ítem</b><ul>")
rep("${button('Por ítem','closeModal();r86CrearCot(\\'item\\')')}${button('Por paquete del plan','closeModal();r86CrearCot(\\'paquete\\')',true)}",
    "${button('Separar por ítem','closeModal();r86CrearCot(\\'item\\')')}${button('Agrupar por paquete','closeModal();r86CrearCot(\\'paquete\\')',true)}")

# 2. «Guardar cambios» de la cotización guarda y cierra el modal
s += r'''
/* «Guardar cambios» guarda y cierra la cotización (antes se quedaba abierta). */
const r86QuoteSaveBase=r77QuoteSave;
r77QuoteSave=function(id){r86QuoteSaveBase(id);closeModal();render()};
'''
open(p, 'w', encoding='utf-8').write(s)
print('ok')
