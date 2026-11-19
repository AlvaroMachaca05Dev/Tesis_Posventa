base = 'F:/Tesis/Tesis_Posventa/prototipo/'
p = base + 'capas/r86/a_timeline.js'
s = open(p, encoding='utf-8').read()

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b, 1)

# 1. historial unificado por meses
rep("cur=Math.round(simKm??m.estimate),{past}=r73Cols(m);", "cur=Math.round(simKm??m.estimate),past=r86Meses(m.hist);")
rep("function r86Modelo(){", r'''/* Historial unificado por meses: una columna por mes con todas sus ODS. El km y la fecha de la columna salen de la ODS del cambio de aceite (o, si no hay, de la última con km). */
function r86Meses(hist){
  const g=new Map();
  hist.forEach(o=>{const k=o.date.slice(0,7);if(!g.has(k))g.set(k,[]);g.get(k).push(o)});
  return [...g.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,orders])=>{
    const conKm=orders.filter(o=>o.km!=null),aceite=conKm.filter(o=>o.lines.some(l=>l.type==='servicio'&&r86Aceite(l.name))),bo=aceite.at(-1)||conKm.at(-1);
    return {key:k,kind:'mes',orders,km:bo?bo.km:null,date:bo?bo.date:orders.at(-1).date};
  });
}
function r86Modelo(){''')
# cabecera de columnas pasadas por mes
i0 = s.index("  if(c.fk[0]==='p'){\n    const info=")
i1 = s.index("  const nombre=R86_NOMF[c.clave]")
nuevo = r'''  if(c.fk[0]==='p'){
    const info=c.paq?`<i class="r86-info" tabindex="0" title="Visita: ${esc(R86_NOMF[c.paq])}">ⓘ</i>`:'',ultima=i===M.past.length-1;
    return `<th class="r86-p r86-pas ${ultima?'r86-ult':''}">${esc(r72MonthName(c.key))}<small>${c.km!=null?r84Km(c.km)+' km':'sin km'} · ${c.orders.length} ODS</small>${ultima?'<small>última visita</small>':''}${c.paq?`<span class="r86-i2"><span class="r86-tot">${t.s}/${t.n}</span>${info}</span>`:''}</th>`;
  }
'''
s = s[:i0] + nuevo + s[i1:]
# 2. el pasado se tiñe rojizo (via r86Hoy)
rep("  if(c.fk[0]!=='f')return '';\n  const ven=", "  if(c.fk[0]!=='f')return ' r86-pas';\n  const ven=")
open(p, 'w', encoding='utf-8').write(s)

p = base + 'capas/r86/estilos.css'
t = open(p, encoding='utf-8').read()
t += '''
/* historial por meses: varias ODS por columna, una debajo de otra; lo ya pasado se tiñe rojizo */
.r86-hist td .r86-chip,.r86m.r86-det .r86-chip{display:flex!important;width:max-content;max-width:100%;margin:2px auto!important}
.r86m td.r86-pas{background:rgba(232,88,79,.06)}.r86m th.r86-pas{background:#2d2436!important}
.r86m tr.r86-hist td.r86-pas{background:rgba(232,88,79,.08)}
'''
open(p, 'w', encoding='utf-8').write(t)
print('ok')
