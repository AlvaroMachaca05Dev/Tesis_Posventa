base = 'F:/Tesis/Tesis_Posventa/prototipo/'
p = base + 'capas/r86/a_timeline.js'
s = open(p, encoding='utf-8').read()

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b, 1)

# 1. la visita con afinamiento usa el paquete real «menor/mayor + afinamiento» (sin mezclar los dos afinamientos)
rep("lines=lines.concat(r86Afi().filter(a=>!lines.some(l=>l.n===a.n)))}",
    "lines=r86Lineas(clave==='MAY'?'MAYAF':'MENAF')}")

# 2. contador de servicios distintos, cobertura de paquetes y cotización por ítem o por paquete
s += r'''
/* --- Selección sin repetidos y cotización por ítem o por paquete del plan --- */
const R86_PCODE={EXP:'SV094',MEN:'SV095',MAY:'SV096',MENAF:'SV097',MAYAF:'SV098',REV:'SV099'};
function r86Unicos(){return new Set(selectedPlanData().map(x=>x.name))}
reminderPanel=function(){const n=r86Unicos().size;return `<div class="panel reminderbar"><b>${n} servicios seleccionados</b><span>Marca los checks de las visitas que quieres recordar o cotizar.</span>${button('Enviar recordatorio por WhatsApp','sendMaintenanceReminder()',true)}${button('＋ Agregar a cotización','r73TlToQuote()')}${button('Crear tarea de contacto','createMaintenanceTask()')}</div>`};
/* Un paquete solo cuenta si todos sus servicios están seleccionados; el más grande «consume» a los menores y no se solapan. */
function r86Cobertura(U){
  const ks=Object.keys(R86_PCODE).sort((a,b)=>R84_PAQ[b].l.length-R84_PAQ[a].l.length),cov=new Set(),paq=[];
  ks.forEach(k=>{const L=R84_PAQ[k].l.map(x=>x.n);if(L.every(n=>U.has(n))&&L.every(n=>!cov.has(n))){paq.push(k);L.forEach(n=>cov.add(n))}});
  return {paq,sueltos:[...U].filter(n=>!cov.has(n))};
}
r73TlToQuote=function(){
  const items=selectedPlanData();if(!items.length)return toast('Selecciona al menos un servicio.');
  const U=r86Unicos(),cob=r86Cobertura(U);
  if(!cob.paq.length)return r86CrearCot('item');
  const pk=cob.paq.map(k=>{const c=db.catalog.find(x=>x.code===R86_PCODE[k]);return {k,n:c?.name||R84_PAQ[k].n,p:c?.price,h:c?.hours,m:R84_PAQ[k].l.length}});
  modal(`<h2>¿Cómo generar la cotización?</h2><p>Seleccionaste servicios que completan ${pk.length>1?'paquetes del plan':'un paquete del plan'}.</p>
  <div class="r86-opc"><b>Por paquete del plan</b><ul>${pk.map(x=>`<li>${esc(x.n)} · ${x.p!=null?money(x.p):'precio por confirmar'} · ${x.h} h <span class="muted">(${x.m} servicios en su ficha)</span></li>`).join('')}${cob.sueltos.length?`<li>${cob.sueltos.length} servicio${cob.sueltos.length>1?'s':''} suelto${cob.sueltos.length>1?'s':''}: ${esc(cob.sueltos.join(', '))}</li>`:''}</ul></div>
  <div class="r86-opc"><b>Por ítem</b><ul><li>${U.size} servicios distintos, uno por línea</li></ul></div>
  <footer>${button('Cancelar','closeModal()')}${button('Por ítem','closeModal();r86CrearCot(\'item\')')}${button('Por paquete del plan','closeModal();r86CrearCot(\'paquete\')',true)}</footer>`);
};
function r86LineaCot(c,name,x){return {id:uid(),type:'servicio',code:c?.code||'',name:c?.name||name,catalog:c?.id||null,hours:c?.hours||0,qty:c?.hours||0,price:c?.price??null,cost:0,discount:0,tech:null,approved:false,announced:true,createdBy:actor,external:!c,fromTimeline:{km:x?.colKm,date:x?.colDate}}}
function r86CrearCot(modo){
  const m=timelineModel(),items=selectedPlanData(),U=r86Unicos(),cob=r86Cobertura(U),lines=[],x0=items[0];
  if(modo==='paquete')cob.paq.forEach(k=>{const c=db.catalog.find(z=>z.code===R86_PCODE[k]),l=r86LineaCot(c,R84_PAQ[k].n,x0);l.ficha={servicios:R84_PAQ[k].l.map(z=>({n:z.n,h:z.h})),horas:c?.hours};lines.push(l)});
  const nombres=modo==='paquete'?cob.sueltos:[...U];
  nombres.forEach(n=>{const it=items.find(z=>z.name===n),c=r73CatFor(n);lines.push(r86LineaCot(c,n,it))});
  const q=r73NewQuoteRecord({client:m.v.client,vehicle:m.v.id,branch:r73UserSede(),lines});
  selectedPlanItems.clear();R86.sel.clear();r72Log('q:'+q.id,'Cotización desde línea temporal',lines.length+' líneas: '+lines.map(l=>l.name).join(', '));save('Cotización desde línea temporal',q.code);setTimeout(()=>r73OpenQuote(q.id));
}
/* La cotización por paquete muestra el paquete y, al pie, su ficha con los servicios y sus tiempos. */
const r86OpenQuoteBase=r73OpenQuote;
r73OpenQuote=function(id){
  r86OpenQuoteBase(id);
  try{
    const q=r73Quote(id),fl=(q?q.lines:[]).filter(l=>l.ficha);if(!fl.length)return;
    const b=document.getElementById('modalbody'),foot=b.querySelector('footer');
    const html=fl.map(l=>`<section class="r86-ficha"><h3>Ficha · ${esc(l.name)}</h3><p>Tiempo del paquete: <b>${l.ficha.horas??'—'} h</b> · Total: <b>${l.price!=null?money(l.price):'por confirmar'}</b></p><table><tbody>${l.ficha.servicios.map(z=>`<tr><td>${esc(z.n)}</td><td class="r86-fh">${z.h} h</td></tr>`).join('')}</tbody></table></section>`).join('');
    foot?foot.insertAdjacentHTML('beforebegin',html):b.insertAdjacentHTML('beforeend',html);
  }catch(e){console.warn('r86 ficha',e)}
};
'''
rep("const sel=selectedPlanData().length,btn=", "const sel=r86Unicos().size,btn=")
open(p, 'w', encoding='utf-8').write(s)

p = base + 'capas/r86/estilos.css'
t = open(p, encoding='utf-8').read()
t += '''
.r86-opc{border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:8px 0}.r86-opc ul{margin:6px 0 0;padding-left:18px}
.r86-ficha{border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:12px 0}.r86-ficha h3{margin:0 0 4px}.r86-ficha table{width:100%;border-collapse:collapse;font-size:12.5px}.r86-ficha td{padding:2px 4px;border-bottom:1px solid #1d3047}.r86-fh{text-align:right;color:var(--mut)}
'''
open(p, 'w', encoding='utf-8').write(t)
print('ok')
