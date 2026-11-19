base = 'F:/Tesis/Tesis_Posventa/prototipo/'
p = base + 'capas/r86/a_timeline.js'
s = open(p, encoding='utf-8').read()

i0 = s.index("const R86_OJO=")
nuevo = r'''const R86_OJO='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>';
const r86Ojo=(l)=>{const a=R86.fichas.has(l.id);return `<button type="button" class="r86-ojo ${a?'on':''}" title="${a?'Ocultar':'Ver'} ficha" aria-label="${a?'Ocultar':'Ver'} ficha de ${esc(l.name)}" aria-expanded="${a}" onclick="r86FichaTog('${l.id}')">${R86_OJO}</button>`};
const r86FilaFicha=(l,f,cols)=>`<tr class="r86-fila-ficha"><td colspan="${cols}"><div class="r86-fichab" role="group" aria-label="Ficha de ${esc(l.name)}"><b>Servicios:</b><ul>${f.servicios.map(z=>`<li>${esc(z.n)} · ${z.h} h</li>`).join('')}</ul></div></td></tr>`;
/* Cotización: el ojito va entre «Tipo» e «Ítem»; se quitan los textos H-H / precio final que engordan la fila. */
const r86GridBase=r72Grid;
r72Grid=function(k,o){
  let h=r86GridBase(k,o);
  try{
    const box=r72Box(k);if(!box||!(box.lines||[]).length)return h;
    h=h.replace(/<small class="sub">(H-H|und\.|precio final|por unidad)<\/small>/g,'').replace(/<th>Tipo<\/th>/g,'<th>Tipo</th><th class="r86-oj"></th>');
    return h.replace(/<tr class="[^"]*">\s*<td class="r72-ck">[\s\S]*?<\/tr>/g,row=>{
      const m=row.match(/r72Toggle\('[^']*','([^']+)'/);if(!m)return row;
      const l=box.lines.find(x=>x.id===m[1]);if(!l)return row;
      const f=r86FichaDe(l),out=row.replace('<td class="r72-item">',`<td class="r86-oj">${f?r86Ojo(l):''}</td><td class="r72-item">`);
      return out+(f&&R86.fichas.has(l.id)?r86FilaFicha(l,f,15):'');
    });
  }catch(e){console.warn('r86 ficha',e);return h}
};
/* Orden de servicio: el detalle tiene buscador del catálogo (como la cotización), el ojito entre «Tipo» y «Detalle» y la ficha bajo la línea. */
const r86Ods78Base=r78Editor;
r78Editor=function(id){r86Ods78Base(id);try{r86OdsPost(id)}catch(e){console.warn('r86 ods',e)}};
function r86OdsPost(id){
  const o=db.orders.find(x=>x.id===id),tb=document.getElementById('modalbody')?.querySelector('table');if(!o||!tb||tb.querySelector('.r86-oj'))return;
  const ths=[...tb.querySelectorAll('thead th')],ti=ths.findIndex(t=>/^tipo$/i.test(t.textContent.trim()));if(ti<0)return;
  ths[ti].insertAdjacentHTML('afterend','<th class="r86-oj"></th>');
  const filas=[...tb.querySelectorAll('tbody > tr')],cols=ths.length+1;
  filas.forEach((tr,i)=>{
    const l=o.lines[i];if(!l||tr.children.length<3)return;
    const f=l.type==='servicio'?r86FichaDe(l):null;
    tr.children[1].insertAdjacentHTML('afterend',`<td class="r86-oj">${f?r86Ojo(l):''}</td>`);
    const td=tr.children[3],inp=td.querySelector('input');
    if(inp&&!inp.disabled)td.innerHTML=`<div class="r72-combo"><input class="r78-largo" data-k="o:${id}" data-l="${l.id}" data-type="${l.type}" value="${esc(l.name||'')}" placeholder="Escribe para buscar…" autocomplete="off" oninput="r72Suggest(this)" onfocus="r72Suggest(this)" onkeydown="r72SugKey(event,this)" onblur="r72SugHide(this)" onchange="r86OdsNombre('${id}',${i},'${l.id}',this.value)"><div class="r72-sug" hidden></div></div>`;
    if(f&&R86.fichas.has(l.id))tr.insertAdjacentHTML('afterend',r86FilaFicha(l,f,cols));
  });
}
function r86OdsNombre(id,i,lid,val){if(R72.picked?.id===lid&&Date.now()-R72.picked.at<800)return;r78Item(id,i,'name',val)}
const r86PickBase=r72Pick;
r72Pick=function(k,l,c){const r=r86PickBase(k,l,c);try{if(String(k).startsWith('o:')&&document.getElementById('modalbody')?.querySelector('.r78-largo')&&db.orders.find(x=>x.id===k.slice(2)))r78Editor(k.slice(2))}catch(e){console.warn(e)}return r};
'''
s = s[:i0] + nuevo
# la ficha mostrada por r86FichaTog debe refrescar también el editor de la ODS
s = s.replace("function r86FichaTog(id){R86.fichas.has(id)?R86.fichas.delete(id):R86.fichas.add(id);r72Refresh()}",
              "function r86FichaTog(id){R86.fichas.has(id)?R86.fichas.delete(id):R86.fichas.add(id);const e=document.querySelector('#modalbody .r78-largo');if(e){r78Editor(e.dataset.k.slice(2));return}r72Refresh()}")
open(p, 'w', encoding='utf-8').write(s)

p = base + 'capas/r86/estilos.css'
t = open(p, encoding='utf-8').read()
t += '''
th.r86-oj,td.r86-oj{width:28px;min-width:28px;padding:0 2px;text-align:center}
'''
open(p, 'w', encoding='utf-8').write(t)
print('ok')
