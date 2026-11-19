base = 'F:/Tesis/Tesis_Posventa/prototipo/capas/r86/'
p = base + 'a_timeline.js'
s = open(p, encoding='utf-8').read()

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b, 1)

# 1. el afinamiento va al final como bloque aparte: todo lo demas queda apiñado arriba
rep("rk=l=>afi.has(l.n)?1.5:", "rk=l=>afi.has(l.n)?5:")
rep("L.some(l=>afi.has(l.n))?1.5:Math.min", "L.some(l=>afi.has(l.n))?5:Math.min")

# 2. cabecera compacta: km, fecha, contador y un simbolo de info con el tipo de visita
i0 = s.index("function r86Cab(")
i1 = s.index("function r86Celda(")
nueva = r'''const R86_NOMF={EXP:'Servicio express',MEN:'Mantenimiento menor',MAY:'Mantenimiento mayor',REV:'Revisión completa'};
function r86Cab(M,c,i){
  const t=r86Contar(M,c,null);
  if(c.fk[0]==='p'){
    const info=c.paq?`<i class="r86-info" tabindex="0" title="Visita: ${esc(R86_NOMF[c.paq])}">ⓘ</i>`:'';
    return `<th class="r86-p ${i===M.past.length-1?'r86-ult':''}">${c.kind==='mes'?esc(r72MonthName(c.date.slice(0,7)))+'<small>sin km · '+c.orders.length+' ODS</small>':(c.km!=null?r84Km(c.km)+' km':'<span class="r72-tag">sin km</span>')+'<small>'+esc(c.date)+(i===M.past.length-1?' · última visita':'')+'</small>'}${c.paq?`<span class="r86-i2"><span class="r86-tot">${t.s}/${t.n}</span>${info}</span>`:''}</th>`;
  }
  const nombre=R86_NOMF[c.clave]+c.tags.map(x=>' · '+x.replace(/^\+ /,'con ')).join('');
  const afin=c.tags.some(x=>/Afin/.test(x)),conAf=afin?' + Afinamiento':'';
  return `<th class="r86-f ${c.k===1?'r86-hoy':''}"><label class="r86-hk"><input type="checkbox" data-ind="${t.s>0&&t.s<t.n?1:0}" ${t.s===t.n&&t.n?'checked':''} onchange="r86SelCol('${c.fk}',this.checked)" title="Seleccionar toda la visita"><b>${r84Km(c.km)} km</b></label><small>${r86Fmt(c.date)} · est.${c.vencido?' · <span class="r86-venc">vencido</span>':''}</small><span class="r86-i2"><span class="r86-tot">${t.s}/${t.n}</span><i class="r86-info" tabindex="0" title="${esc(nombre)}">ⓘ</i></span></th>`;
}
'''
s = s[:i0] + nueva + s[i1:]

# 3. scroll hacia la derecha por defecto
rep("const sc=document.querySelector('.r86-scroll'),u=sc?.querySelector('th.r86-ult');if(sc&&u&&R86.auto!==M.v.id){R86.auto=M.v.id;sc.scrollLeft=Math.max(0,u.offsetLeft-210-240)}",
    "const sc=document.querySelector('.r86-scroll');if(sc){if(R86.mantener)R86.mantener=false;else sc.scrollLeft=sc.scrollWidth}")
rep("function r86Render(){const sc=document.querySelector('.r86-scroll'),l=sc?.scrollLeft||0,y=window.scrollY;render();",
    "function r86Render(){const sc=document.querySelector('.r86-scroll'),l=sc?.scrollLeft||0,y=window.scrollY;R86.mantener=true;render();")
open(p, 'w', encoding='utf-8').write(s)

p = base + 'estilos.css'
t = open(p, encoding='utf-8').read()
t += '''
/* cabecera compacta con simbolo de info */
.r86-i2{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:2px}
.r86-info{font-style:normal;cursor:help;color:#9ec3ff;font-size:12px;line-height:1}
.r86m .r86-tot{display:inline!important;font-size:10.5px;color:var(--mut)}.r86m.r86-det .r86-tot{display:inline!important}
/* detalle: servicio al ras del nombre, sin espacio sobrante */
.r86m.r86-det td.r86-s,.r86m.r86-det th.r86-k{width:1%;min-width:0;max-width:none;white-space:nowrap;overflow:visible}
.r86m.r86-det th,.r86m.r86-det td{min-width:96px;width:96px}
.r86m.r86-det td.r86-cc,.r86m.r86-det th.r86-cc{min-width:78px;width:78px}
.r86m.r86-det td.r86-s,.r86m.r86-det th.r86-k{min-width:0;width:1%}
.r86m.r86-det .r86-chip{display:inline-flex!important;align-items:center;gap:3px;white-space:nowrap;padding:1px 4px!important;font-size:10px!important;margin:1px 0!important}
.r86m.r86-det .r86-chip .r72-tag{font-size:9px;padding:0 4px;margin:0}
.r86m.r86-hist-chips .r86-chip{white-space:nowrap}
.r86-chip{white-space:nowrap}
'''
open(p, 'w', encoding='utf-8').write(t)
print('ok')
