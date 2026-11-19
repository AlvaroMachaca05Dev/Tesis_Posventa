base = 'F:/Tesis/Tesis_Posventa/prototipo/'
p = base + 'capas/r86/a_timeline.js'
s = open(p, encoding='utf-8').read()

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b, 1)

# la visita con afinamiento = paquete base + afinamiento del vehículo (carburado o inyección), no el paquete combinado
rep("lines=r86Lineas(clave==='MAY'?'MAYAF':'MENAF')}", "lines=lines.concat(r86AfinLineas(v).filter(a=>!lines.some(l=>l.n===a.n)))}")
rep("function r86Modelo(){", '''/* Afinamiento del vehículo: inyección por defecto; si el vehículo es carburado (v.afin==='carb') se usa el afinamiento de carburador. */
const r86AfinIdx=v=>v&&v.afin==='carb'?0:1;
const r86AfinLineas=v=>R84_AFI[r86AfinIdx(v)].l.map(l=>({n:l.n,h:l.h,c:r85Cat(l.n)}));
function r86Modelo(){''')

i0 = s.index("/* --- Selección sin repetidos y cotización por ítem o por paquete del plan --- */")
i1 = s.index("/* Ficha del servicio: un ojito")
nuevo = r'''/* --- Selección sin repetidos y cotización por ítem o por paquete del plan --- */
const R86_PCODE={EXP:'SV094',MEN:'SV095',MAY:'SV096',MENAF:'SV097',MAYAF:'SV098',REV:'SV099'};
const r86CodigoPaq=(k,v)=>k==='AF'?(r86AfinIdx(v)?'SV072':'SV071'):R86_PCODE[k];
const r86ListaPaq=(k,v)=>k==='AF'?R84_AFI[r86AfinIdx(v)].l:R84_PAQ[k].l;
function r86Unicos(){return new Set(selectedPlanData().map(x=>x.name))}
reminderPanel=function(){const n=r86Unicos().size;return `<div class="panel reminderbar"><b>${n} servicios seleccionados</b><span>Marca los checks de las visitas que quieres recordar o cotizar.</span>${button('Enviar recordatorio por WhatsApp','sendMaintenanceReminder()',true)}${button('＋ Agregar a cotización','r73TlToQuote()')}${button('Crear tarea de contacto','createMaintenanceTask()')}</div>`};
/* Cada visita seleccionada completa es su paquete (y, si lleva afinamiento, el afinamiento es otro paquete aparte); solo se descarta uno contenido en otro. */
function r86Cobertura(U){
  const M=r86Modelo(),v=M.v,L=k=>new Set(r86ListaPaq(k,v).map(x=>x.n));
  const completas=M.fut.filter(c=>c.lines.length&&c.lines.every(l=>R86.sel.has(r86Key(v,c.fk,l.n))));
  let A=[...new Set(completas.flatMap(c=>c.tags.some(t=>/Afin/.test(t))?[c.clave,'AF']:[c.clave]))];
  A=A.filter(k=>!A.some(o=>o!==k&&L(o).size>L(k).size&&[...L(k)].every(n=>L(o).has(n))));
  const resto=new Set([...U]);A.forEach(k=>L(k).forEach(n=>resto.delete(n)));
  /* un paquete completado a mano con servicios sueltos también cuenta, sin solaparse con los anteriores */
  ['REV','MAY','MEN','AF','EXP'].forEach(k=>{if(A.includes(k))return;const l=[...L(k)];if(l.every(n=>resto.has(n))){A.push(k);l.forEach(n=>resto.delete(n))}});
  A.sort((a,b)=>r86ListaPaq(b,v).length-r86ListaPaq(a,v).length);
  return {paq:A,sueltos:[...resto]};
}
r73TlToQuote=function(){
  const items=selectedPlanData();if(!items.length)return toast('Selecciona al menos un servicio.');
  const U=r86Unicos(),cob=r86Cobertura(U),v=timelineModel().v;
  if(!cob.paq.length)return r86CrearCot('item');
  const pk=cob.paq.map(k=>{const c=db.catalog.find(x=>x.code===r86CodigoPaq(k,v));return {k,n:c?.name||k,cod:c?.code||'',p:c?.price,h:c?.hours,m:r86ListaPaq(k,v).length}});
  modal(`<h2>¿Cómo generar la cotización?</h2><p>${pk.length>1?`Hay ${pk.length} paquetes del plan en lo que seleccionaste; son paquetes separados, cada uno va en su propio ítem.`:'Lo que seleccionaste completa un paquete del plan.'} ¿Quieres agruparlos por paquete o separarlos por ítem?</p>
  <div class="r86-opc"><b>Agrupar por paquete</b><ul>${pk.map(x=>`<li>${esc(x.cod?x.cod+' - ':'')}${esc(x.n)} · ${x.p!=null?money(x.p):'precio por confirmar'} · ${x.h} h <span class="muted">(${x.m} servicios en su ficha)</span></li>`).join('')}${cob.sueltos.length?`<li>${cob.sueltos.length} servicio${cob.sueltos.length>1?'s':''} suelto${cob.sueltos.length>1?'s':''}: ${esc(cob.sueltos.join(', '))}</li>`:''}</ul></div>
  <div class="r86-opc"><b>Separar por ítem</b><ul><li>${U.size} servicios distintos, uno por línea</li></ul></div>
  <footer>${button('Cancelar','closeModal()')}${button('Separar por ítem','closeModal();r86CrearCot(\'item\')')}${button('Agrupar por paquete','closeModal();r86CrearCot(\'paquete\')',true)}</footer>`);
};
function r86LineaCot(c,name,x){return {id:uid(),type:'servicio',code:c?.code||'',name:c?.name||name,catalog:c?.id||null,hours:c?.hours||0,qty:c?.hours||0,price:c?.price??null,cost:0,discount:0,tech:null,approved:false,announced:true,createdBy:actor,external:!c,fromTimeline:{km:x?.colKm,date:x?.colDate}}}
function r86CrearCot(modo){
  const m=timelineModel(),items=selectedPlanData(),U=r86Unicos(),cob=r86Cobertura(U),lines=[],x0=items[0],v=m.v;
  if(modo==='paquete')cob.paq.forEach(k=>{const c=db.catalog.find(z=>z.code===r86CodigoPaq(k,v)),l=r86LineaCot(c,k,x0);l.ficha={servicios:r86ListaPaq(k,v).map(z=>({n:z.n,h:z.h})),horas:c?.hours};lines.push(l)});
  const nombres=modo==='paquete'?cob.sueltos:[...U];
  nombres.forEach(n=>{const it=items.find(z=>z.name===n),c=db.catalog.find(z=>z.type==='servicio'&&!z.deleted&&normal(z.name)===normal(n));lines.push(r86LineaCot(c,n,it))});
  const q=r73NewQuoteRecord({client:v.client,vehicle:v.id,branch:r73UserSede(),lines});
  selectedPlanItems.clear();R86.sel.clear();r72Log('q:'+q.id,'Cotización desde línea temporal',lines.length+' líneas: '+lines.map(l=>l.name).join(', '));save('Cotización desde línea temporal',q.code);setTimeout(()=>r73OpenQuote(q.id));
}
'''
s = s[:i0] + nuevo + s[i1:]

# la ficha de un servicio del catálogo: también para los afinamientos
rep("const c=l.catalog?db.catalog.find(x=>x.id===l.catalog):null,code=c?.code||l.code,k=Object.keys(R86_PCODE).find(z=>R86_PCODE[z]===code);\n  return k?{servicios:R84_PAQ[k].l.map(z=>({n:z.n,h:z.h})),horas:c?.hours}:null;",
    "const c=l.catalog?db.catalog.find(x=>x.id===l.catalog):null,code=c?.code||l.code,k=Object.keys(R86_PCODE).find(z=>R86_PCODE[z]===code);\n  if(k)return {servicios:R84_PAQ[k].l.map(z=>({n:z.n,h:z.h})),horas:c?.hours};\n  const ia=code==='SV071'?0:code==='SV072'?1:-1;\n  return ia>=0?{servicios:R84_AFI[ia].l.map(z=>({n:z.n,h:z.h})),horas:c?.hours}:null;")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
