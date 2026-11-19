/* --------------------------------------------------------------------------
   R8.6 · Línea temporal: se respeta la matriz de R8.3 (columnas = visitas, línea roja = última visita)
   - Comprimido: filas = categorías; el cruce con cada visita muestra «seleccionados/que le tocan» (0/6).
     Clic en el número abre una nota (sin difuminar la pantalla) con los servicios de esa categoría en esa visita
     como lista de checks. El check del cruce marca toda la categoría y el de la cabecera toda la visita.
     Los paquetes (express, menor, mayor…) solo ayudan a agrupar los servicios de golpe.
   - Detalle: una fila por servicio, con una etiqueta de color que indica su categoría (no se agrupa).
   - Historial: al final, las ODS de cada visita; clic en una ODS permite marcar qué servicios del plan sí se cumplieron.
   - Visitas pasadas: «hechos/esperados» según lo que se hizo en la ODS (3/6).
   - Proyección: siempre arranca con el servicio express; ciclo y medio como máximo y no más allá del fin del año actual + 2 (hoy, 2028). Aceite mineral/semisintético/sin definir: 5.000 km; sintético y full sintético: 7.500 km.
   - Pendiente: planes por tipo de aceite (hasta 8) y cambio de aceite a mitad de vida del vehículo.
   -------------------------------------------------------------------------- */
const R86={sel:new Set(),nota:null};
const R86_NOM={EXP:'Express',MEN:'Menor',MAY:'Mayor',REV:'Rev. completa'};
const R86_CATS=[...new Set(R85_CATS.map(c=>c[0]).concat('Otros'))];
const R86_CORTO={'Motor y lubricación':'Motor','Encendido y afinamiento':'Encendido','Embrague y caja':'Embrague','Filtros':'Filtros','Refrigeración y clima':'Refriger.','Frenos':'Frenos','Tracción y ejes':'Tracción','Distribución y correas':'Distrib.','Suspensión y dirección':'Suspens.','Neumáticos':'Neumát.','Eléctrico, escáner y pruebas':'Eléctrico'};
const r86CatIdx=c=>Math.max(0,R86_CATS.indexOf(c));
const r86Paso=v=>/sint/i.test(v.oil||'')&&!/semi/i.test(v.oil||'')?7500:5000;
const r86Sig=s=>new Set(normal(String(s).replace(/\s*-?\s*[\d.]+\s*h?\s*-?\s*$/,'')).split(/[^a-z0-9]+/).filter(w=>w.length>3&&!['cambio','revision','servicio','limpieza','ajuste'].includes(w)));
function r86Igual(plan,ods){const a=r86Sig(plan),b=r86Sig(ods);if(!a.size||!b.size)return false;const sub=(x,y)=>[...x].every(t=>y.has(t));return sub(b,a)||sub(a,b)}
function r86Fecha(base,meses){const d=new Date(base+'T12:00:00');d.setDate(d.getDate()+Math.round(meses*30.4375));return d.toISOString().slice(0,10)}
const r86Aceite=n=>/aceite.*(motor)|filtro de aceite/.test(normal(n))&&/aceite/.test(normal(n));
const r86Lineas=k=>R84_PAQ[k].l.map(l=>({n:l.n,h:l.h,c:r85Cat(l.n)}));
const r86Afi=()=>R84_AFI.flatMap(a=>a.l.map(l=>({n:l.n,h:l.h,c:r85Cat(l.n)})));
/* --- datos de ejemplo (clientes, vehículos y ODS con servicios del plan) --- */
/* Dos ODS reales recientes del DEM-679 (septiembre 2026), sin datos personales: técnicos como «Técnico demo». */
function r86SembrarDem679(){
  if(!db.vehicles.find(v=>v.id==='v1'))return;
  const mk=(code,ext,date,time,km,tec,closed,lines,comment)=>({id:'legacy-'+code,code,externalId:ext,vehicle:'v1',tech:null,technicianName:tec,km,rawKm:String(km),state:'Archivada',date,closed,origin:'Tuulapp histórico completo',billing:'Sin dato histórico',comment,
    lines:lines.map((l,i)=>({id:'legacy-'+code+'-'+i,name:l[0],originalDescription:l[1]||'',type:l[2],qty:l[3],price:l[4],cost:l[4],marginOriginal:0,amountOriginal:l[4]*l[3],hours:l[2]==='servicio'?l[5]:null,tech:null,technicianName:tec,approved:true,announced:true,discount:0})),
    source:'Historial facilitado 2026-11-17',archived:true,approval:'Aprobada',branch:'union',attentionType:'Mantenimiento',rootTaskState:'Pendiente',productStage:'Solicitud',time,odsType:'Express',rm:1});
  const nuevas=[mk('13325','2026090713325','2026-09-07','10:37',291044,'Técnico demo 2','2026-09-10',[['Revisión de amortiguador posterior lado R','','servicio',1,15,0.25]],'Se desarchivó para modificar el técnico'),
    mk('13442','2026091613442','2026-09-16','13:04',291152,'Técnico demo 3','2026-09-16',[['Cambio de aceite de motor - 0.25','Cambio de aceite de motor - 0.25','servicio',1,10,0.25],['FILTRO HYUNDAI M20','Cambio de aceite de motor - 0.25','producto',1,18],['Aceite Shield 20w-50 1/4','Aceite Shield 20w-50 1/4','producto',3,37]],'Un practicante realizó el cambio de aceite')];
  let ch=false;nuevas.forEach(o=>{if(!db.orders.find(x=>x.id===o.id)){db.orders.push(o);ch=true}});
  const v=db.vehicles.find(x=>x.id==='v1');if(ch&&(v.km||0)<291152)v.km=291152;
  if(ch){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}}
}
function r86Sembrar(){
  r86SembrarDem679();
  if(db.r86?.v===1)return;
  const nombres=k=>R84_PAQ[k].l.map(l=>l.n);
  const mk=(id,code,veh,date,km,names)=>({id,code,externalId:'R86'+code,vehicle:veh,tech:null,technicianName:'Técnico demo 1',km,rawKm:String(km),state:'Archivada',date,closed:date,origin:'Demostración R8.6',billing:'Sin dato histórico',
    lines:names.map((n,i)=>({id:id+'-'+i,name:n,type:'servicio',qty:1,price:0,cost:0,hours:0.25,tech:null,technicianName:'Técnico demo 1',approved:true,announced:true,discount:0})),source:'Demostración',archived:true,approval:'Aprobada',branch:'union',attentionType:'Mantenimiento',rootTaskState:'Pendiente',productStage:'Solicitud',time:'09:00',odsType:'Mantenimiento',rm:1});
  const cl=[{id:'c86a',name:'Marcos Quispe Huamán',doc:'40111222',phone:'959000111',email:'',docType:'DNI',country:'PE'},{id:'c86b',name:'Transportes Andina S.A.C.',doc:'20555666777',phone:'959000222',email:'',docType:'RUC',country:'PE'}];
  const ve=[{id:'v86a',client:'c86a',plate:'DEM-701',brand:'Kia',model:'Rio',year:2020,vin:'',engine:'G4LC',serial:'',km:57000,use:'P',plan:'G2-PIC',group:'G2',fuel:'GAS',oil:'Sintético'},
            {id:'v86b',client:'c86b',plate:'DEM-702',brand:'Toyota',model:'Hilux',year:2019,vin:'',engine:'1KD',serial:'',km:95500,use:'P',plan:'G2-PIC',group:'G4',fuel:'DIE',oil:'Full sintético'}];
  const or=[mk('r86-o1','R601','v86a','2026-03-10',42000,nombres('EXP')),
            mk('r86-o2','R602','v86a','2026-05-28',49500,nombres('MEN').slice(0,12)),
            mk('r86-o3','R603','v86a','2026-08-20',57000,nombres('MAY').slice(0,20)),
            mk('r86-o4','R611','v86b','2026-07-15',88000,nombres('EXP')),
            mk('r86-o5','R612','v86b','2026-10-30',95500,nombres('MEN').slice(0,12))];
  cl.forEach(c=>{if(!db.clients.find(x=>x.id===c.id))db.clients.push(c)});
  ve.forEach(x=>{if(!db.vehicles.find(y=>y.id===x.id))db.vehicles.push(x)});
  or.forEach(o=>{if(!db.orders.find(y=>y.id===o.id))db.orders.push(o)});
  db.r86={v:1,cumple:{},paq:{'r86-o1':'EXP','r86-o2':'MEN','r86-o3':'MAY','r86-o4':'EXP','r86-o5':'MEN'}};
  try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}
}
/* --- modelo de la línea: columnas pasadas (ODS) y futuras (visitas proyectadas) --- */
function r86Hecho(o,esperadas){
  const man=db.r86.cumple[o.id];if(man)return new Set(man);
  const s=new Set(),sv=o.lines.filter(l=>l.type==='servicio');
  esperadas.forEach(e=>{if(sv.some(l=>r86Igual(e.n,l.name)))s.add(e.n)});return s;
}
function r86Inferir(orders){
  const man=orders.map(o=>db.r86.paq[o.id]).find(Boolean);if(man)return man==='NINGUNA'?null:man;
  const sv=orders.flatMap(o=>o.lines.filter(l=>l.type==='servicio'));
  if(!sv.some(l=>r86Aceite(l.name)))return null;
  let mejor=null,mc=-1,ms=0;
  ['EXP','MEN','MAY'].forEach(k=>{const L=r86Lineas(k),c=L.filter(e=>sv.some(l=>r86Igual(e.n,l.name))).length;
    if(c/L.length>=0.5&&(c>mc||(c===mc&&L.length>ms))){mejor=k;mc=c;ms=L.length}});
  return mejor||'EXP';
}
/* Historial unificado por meses: una columna por mes con todas sus ODS. El km y la fecha de la columna salen de la ODS del cambio de aceite (o, si no hay, de la última con km). */
function r86Meses(hist){
  const g=new Map();
  hist.forEach(o=>{const k=o.date.slice(0,7);if(!g.has(k))g.set(k,[]);g.get(k).push(o)});
  return [...g.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,orders])=>{
    const conKm=orders.filter(o=>o.km!=null),aceite=conKm.filter(o=>o.lines.some(l=>l.type==='servicio'&&r86Aceite(l.name))),bo=aceite.at(-1)||conKm.at(-1);
    return {key:k,kind:'mes',orders,km:bo?bo.km:null,date:bo?bo.date:orders.at(-1).date};
  });
}
/* Afinamiento del vehículo: inyección por defecto; si el vehículo es carburado (v.afin==='carb') se usa el afinamiento de carburador. */
const r86AfinIdx=v=>v&&v.afin==='carb'?0:1;
const r86AfinLineas=v=>R84_AFI[r86AfinIdx(v)].l.map(l=>({n:l.n,h:l.h,c:r85Cat(l.n)}));
function r86Modelo(){
  r84Sembrar();r86Sembrar();
  const m=timelineModel(),v=m.v,p=r84PlanDe(v),paso=r86Paso(v),cur=Math.round(simKm??m.estimate),past=r86Meses(m.hist);
  const sec=p?p.ciclo.sec:[],L=sec.length||1;
  const pcols=past.map(c=>{const paq=r86Inferir(c.orders),esp=paq?r86Lineas(paq):[],hecho=new Set();c.orders.forEach(o=>r86Hecho(o,esp).forEach(x=>hecho.add(x)));
    return {...c,fk:'p'+c.key,paq,esp,hecho}});
  const visitas=pcols.filter(c=>c.paq&&c.km!=null),ult=visitas.at(-1)||pcols.filter(c=>c.km!=null).at(-1);
  const pos=-1;
  const fut=[];
  if(p&&ult){
    const c=p.ciclo,mesesPaso=c.meses*paso/c.km,kmMes=m.rate?paso/m.rate:Infinity,paso_m=Math.min(mesesPaso,kmMes);
    const desde=visitas.length>1?(new Date(visitas.at(-1).date)-new Date(visitas[0].date))/86400000/30.4375:0;
    let sigRev=Math.max(1,c.rev.meses-desde),sigAf=c.afin?Math.max(1,c.afin.meses-desde):Infinity;
    const limite=(new Date(today()+'T12:00:00').getFullYear()+2)+'-12-31';
    for(let k=1;k<=Math.ceil(L*1.5);k++){
      const mes=mesesPaso*k;let clave=sec[(pos+k)%L],tags=[],lines;
      if(mes>=sigRev&&clave===c.rev.reemplaza){sigRev+=c.rev.meses;clave='REV'}
      lines=r86Lineas(clave);
      if(c.afin&&mes>=sigAf&&c.afin.con.includes(clave==='REV'?c.rev.reemplaza:clave)){tags.push('+ Afinamiento');sigAf+=c.afin.meses;lines=lines.concat(r86AfinLineas(v).filter(a=>!lines.some(l=>l.n===a.n)))}
      const km=ult.km+paso*k,date=r86Fecha(ult.date,paso_m*k);
      if(date>limite)break;
      fut.push({fk:'f'+k,k,clave,nombre:R86_NOM[clave],tags,lines,km,date,vencido:km<=cur});
    }
  }
  return {m,v,p,paso,cur,past:pcols,fut,ult};
}
const r86Cols=M=>M.past.concat(M.fut);
const r86Key=(v,fk,n)=>v.id+'|'+fk+'|'+n;
function r86Contar(M,col,cat){
  if(col.fk[0]==='f'){const L=col.lines.filter(l=>!cat||l.c===cat),s=L.filter(l=>R86.sel.has(r86Key(M.v,col.fk,l.n))).length;return {n:L.length,s,L}}
  const L=col.esp.filter(l=>!cat||l.c===cat),s=L.filter(l=>col.hecho.has(l.n)).length;return {n:L.length,s,L};
}
/* --- selección --- */
function r86Render(){const sc=document.querySelector('.r86-scroll'),l=sc?.scrollLeft||0,y=window.scrollY;R86.mantener=true;render();const n=document.querySelector('.r86-scroll');if(n)n.scrollLeft=l;window.scrollTo(0,y);r86PintarNota()}
function r86Poner(M,col,lines,on){lines.forEach(l=>{const k=r86Key(M.v,col.fk,l.n);on?R86.sel.add(k):R86.sel.delete(k)})}
function r86SelCat(fk,cat,on){const M=r86Modelo(),col=r86Cols(M).find(c=>c.fk===fk);if(!col)return;r86Poner(M,col,r86Contar(M,col,cat).L,on);r86Render()}
function r86SelCol(fk,on){const M=r86Modelo(),col=r86Cols(M).find(c=>c.fk===fk);if(!col)return;r86Poner(M,col,col.lines,on);r86Render()}
function r86SelLinea(fk,i,on){const M=r86Modelo(),col=r86Cols(M).find(c=>c.fk===fk),l=r86Contar(M,col,R86.nota?.cat||null).L[i];if(l)r86Poner(M,col,[l],on);r86Render()}
function r86SelLineaN(fk,n,on){const M=r86Modelo(),col=r86Cols(M).find(c=>c.fk===fk),l=col.lines.find(x=>x.n===n);if(l)r86Poner(M,col,[l],on);r86Render()}
selectedPlanData=function(){const M=r86Modelo(),out=[];M.fut.forEach(col=>col.lines.forEach(l=>{if(R86.sel.has(r86Key(M.v,col.fk,l.n)))out.push({key:r86Key(M.v,col.fk,l.n),name:l.n,km:col.km,date:col.date,colKm:col.km,colDate:col.date})}));return out};
/* --- nota (sin difuminar la pantalla) --- */
function r86Nota(ev,tipo,fk,cat){
  const r=ev.currentTarget.getBoundingClientRect();
  R86.nota={tipo,fk,cat,x:Math.min(r.left,window.innerWidth-380),y:Math.min(r.bottom+6,window.innerHeight-120)};r86PintarNota();
}
function r86CerrarNota(){R86.nota=null;document.getElementById('r86-nota')?.remove()}
function r86Ajustar(el){const r=el.getBoundingClientRect();if(r.bottom>window.innerHeight-8)el.style.top=Math.max(8,window.innerHeight-8-r.height)+'px'}
function r86PintarNota(){
  let el=document.getElementById('r86-nota');const N=R86.nota;
  if(!N||!document.querySelector('.r86-tl')){el?.remove();if(N&&!document.querySelector('.r86-tl'))R86.nota=null;return}
  const M=r86Modelo(),col=r86Cols(M).find(c=>c.fk===N.fk);if(!col){r86CerrarNota();return}
  if(!el){el=document.createElement('div');el.id='r86-nota';el.className='r86-nota';el.setAttribute('role','dialog');document.body.appendChild(el)}
  el.style.left=Math.max(8,N.x)+'px';el.style.top=Math.max(8,N.y)+'px';setTimeout(()=>r86Ajustar(el));
  const futura=col.fk[0]==='f',cab=futura?`${col.nombre}${col.tags.map(t=>' · '+t).join('')} · ${r84Km(col.km)} km`:`${col.paq?R86_NOM[col.paq]:'ODS'} · ${col.km!=null?r84Km(col.km)+' km':'sin km'} · ${col.date}`;
  if(N.tipo==='ods'){
    const o=col.orders.find(x=>x.id===N.oid)||col.orders[0],paq=db.r86.paq[o.id]||r86Inferir([o])||'NINGUNA',esp=paq==='NINGUNA'?[]:r86Lineas(paq),hecho=r86Hecho(o,esp);
    el.innerHTML=`<header><div><b>ODS #${esc(o.code)}</b><small>${esc(o.date)}${o.km!=null?' · '+r84Km(o.km)+' km':''}</small></div><button type="button" aria-label="Cerrar" onclick="r86CerrarNota()">✕</button></header>
    <div class="r86-sec"><label>Visita del plan <select onchange="r86CambiarPaq('${o.id}',this.value)">${[['NINGUNA','Ninguna'],['EXP','Express'],['MEN','Menor'],['MAY','Mayor'],['REV','Revisión completa']].map(([k,t])=>`<option value="${k}" ${k===paq?'selected':''}>${t}</option>`).join('')}</select></label></div>
    <div class="r86-sec"><b>Servicios de la ODS</b><ul class="r86-ul">${o.lines.filter(l=>l.type==='servicio').map(l=>`<li>${esc(l.name)}</li>`).join('')||'<li class="muted">Sin servicios</li>'}</ul></div>
    ${esp.length?`<div class="r86-sec"><b>Servicios del plan que sí se cumplieron</b> <span class="muted">${hecho.size}/${esp.length}</span><ul class="r86-ul r86-checks">${esp.map(e=>`<li><label><input type="checkbox" ${hecho.has(e.n)?'checked':''} onchange="r86Cumple('${o.id}',${esp.indexOf(e)},this.checked)"> ${esc(e.n)} <span class="r86-tag" style="--h:${r86CatIdx(e.c)*31}">${esc(e.c)}</span></label></li>`).join('')}</ul></div>`:''}
    <footer><button type="button" onclick="r86CerrarNota();openOrder('${o.id}')">Ver ODS</button></footer>`;
    return;
  }
  const {n,s,L}=r86Contar(M,col,N.cat);
  if(futura){
    el.innerHTML=`<header><div><b>${esc(N.cat)}</b><small>${esc(cab)}</small></div><button type="button" aria-label="Cerrar" onclick="r86CerrarNota()">✕</button></header>
    <label class="r86-todo"><input type="checkbox" id="r86-todo" ${s===n?'checked':''} onchange="r86SelCat('${col.fk}',${JSON.stringify(N.cat).replace(/"/g,'&quot;')},this.checked)"> Seleccionar toda la categoría <span>${s}/${n}</span></label>
    <ul class="r86-ul r86-checks">${L.map((l,i)=>`<li><label><input type="checkbox" ${R86.sel.has(r86Key(M.v,col.fk,l.n))?'checked':''} onchange="r86SelLinea('${col.fk}',${i},this.checked)"> ${esc(l.n)} <small class="muted">${l.h} h</small></label></li>`).join('')}</ul>`;
    const t=el.querySelector('#r86-todo');if(t)t.indeterminate=s>0&&s<n;
  }else{
    el.innerHTML=`<header><div><b>${esc(N.cat)}</b><small>${esc(cab)}</small></div><button type="button" aria-label="Cerrar" onclick="r86CerrarNota()">✕</button></header>
    <div class="r86-sec"><b>Hechos en esta visita</b> <span>${s}/${n}</span></div>
    <ul class="r86-ul">${L.map(l=>`<li class="${col.hecho.has(l.n)?'r86-ok':'r86-no'}"><span>${col.hecho.has(l.n)?'✓':'○'}</span> ${esc(l.n)}</li>`).join('')}</ul>`;
  }
}
function r86Cumple(oid,i,on){const o=db.orders.find(x=>x.id===oid),paq=db.r86.paq[oid]||r86Inferir([o])||'NINGUNA',esp=r86Lineas(paq),act=r86Hecho(o,esp);on?act.add(esp[i].n):act.delete(esp[i].n);db.r86.cumple[oid]=[...act];save('Servicios cumplidos',o.code);r86Render()}
function r86CambiarPaq(oid,k){db.r86.paq[oid]=k;delete db.r86.cumple[oid];save('Visita del plan de la ODS',oid);r86Render()}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&R86.nota)r86CerrarNota()});
/* --- matriz --- */
const r86Fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'2-digit'});
/* Línea amarilla = hoy (o la simulación): va a la derecha de la última visita vencida; las vencidas se tiñen suave. */
function r86Hoy(M,c){
  if(c.fk[0]!=='f')return ' r86-pas';
  const ven=M.fut.filter(x=>x.vencido),ult=ven.at(-1);let cl=c.vencido?' r86-vc':'';
  if(ult){if(c===ult)cl+=' r86-hoy2'}else if(c.k===1)cl+=' r86-hoy';
  return cl;
}
const R86_NOMF={EXP:'Servicio express',MEN:'Mantenimiento menor',MAY:'Mantenimiento mayor',REV:'Revisión completa'};
function r86Cab(M,c,i){
  const t=r86Contar(M,c,null);
  if(c.fk[0]==='p'){
    const info=c.paq?`<i class="r86-info" tabindex="0" title="Visita: ${esc(R86_NOMF[c.paq])}">ⓘ</i>`:'',ultima=i===M.past.length-1;
    return `<th class="r86-p r86-pas ${ultima?'r86-ult':''}">${esc(r72MonthName(c.key))}<small>${c.km!=null?r84Km(c.km)+' km':'sin km'} · ${c.orders.length} ODS</small>${ultima?'<small>última visita</small>':''}${c.paq?`<span class="r86-i2"><span class="r86-tot">${t.s}/${t.n}</span>${info}</span>`:''}</th>`;
  }
  const nombre=R86_NOMF[c.clave]+c.tags.map(x=>' · '+x.replace(/^\+ /,'con ')).join('');
  const afin=c.tags.some(x=>/Afin/.test(x)),conAf=afin?' + Afinamiento':'';
  return `<th class="r86-f ${r86Hoy(M,c)}"><label class="r86-hk"><input type="checkbox" data-ind="${t.s>0&&t.s<t.n?1:0}" ${t.s===t.n&&t.n?'checked':''} onchange="r86SelCol('${c.fk}',this.checked)" title="Seleccionar toda la visita"><b>${r84Km(c.km)} km</b></label><small>${r86Fmt(c.date)} · est.${c.vencido?' · <span class="r86-venc">vencido</span>':''}</small><span class="r86-i2"><span class="r86-tot">${t.s}/${t.n}</span><i class="r86-info" tabindex="0" title="${esc(nombre)}">ⓘ</i></span></th>`;
}
function r86Celda(M,c,cat,i){
  const t=r86Contar(M,c,cat),ult=c.fk[0]==='p'&&i===M.past.length-1?' r86-ult':'',hoy=r86Hoy(M,c);
  if(!t.n)return `<td class="${ult}${hoy}"></td>`;
  const cj=JSON.stringify(cat).replace(/"/g,'&quot;');
  if(c.fk[0]==='f')return `<td class="${ult}${hoy}"><label class="r86-c ${t.s===t.n?'r86-full':t.s?'r86-part':''}"><input type="checkbox" data-ind="${t.s>0&&t.s<t.n?1:0}" ${t.s===t.n?'checked':''} onchange="r86SelCat('${c.fk}',${cj},this.checked)"><button type="button" onclick="r86Nota(event,'cat','${c.fk}',${cj})">${t.s}/${t.n}</button></label></td>`;
  return `<td class="${ult}${hoy}"><div class="r86-c ${t.s===t.n?'r86-ok':t.s?'r86-part':'r86-cero'}"><button type="button" onclick="r86Nota(event,'cat','${c.fk}',${cj})">${t.s}/${t.n}</button></div></td>`;
}
function r86Matriz(M){
  const cols=r86Cols(M),det=R73.tlMode==='detalle';
  if(!M.p)return '<div class="panel empty">Este vehículo no tiene un plan para su combustible y uso.</div>';
  if(!M.ult)return '<div class="panel empty">El vehículo no tiene ODS con kilometraje para proyectar visitas.</div>';
  const todas=[];const vistas=new Map();
  cols.forEach(c=>(c.fk[0]==='f'?c.lines:c.esp).forEach(l=>{if(!vistas.has(l.n)){vistas.set(l.n,l);todas.push(l)}}));
  const afi=new Set(R84_AFI.flatMap(x=>x.l.map(l=>l.n))),rk=l=>afi.has(l.n)?5:Math.max(0,['EXP','MEN','MAY','REV'].findIndex(k=>R84_PAQ[k].l.some(x=>x.n===l.n)));
  const crk=c=>{const L=todas.filter(l=>l.c===c);return L.some(l=>afi.has(l.n))?5:Math.min(...L.map(rk))};
  const cats=R86_CATS.filter(c=>todas.some(l=>l.c===c)).sort((x,y)=>crk(x)-crk(y)||r86CatIdx(x)-r86CatIdx(y));
  const orig=new Map(todas.map((l,i)=>[l.n,i]));
  todas.sort((a,b)=>rk(a)-rk(b)||cats.indexOf(a.c)-cats.indexOf(b.c)||orig.get(a.n)-orig.get(b.n));
  let filas='';
  if(!det)filas=cats.map(cat=>`<tr><td class="r86-k"><b>${esc(cat)}</b></td>${cols.map((c,i)=>r86Celda(M,c,cat,i)).join('')}</tr>`).join('');
  else filas=todas.map(l=>`<tr><td class="r86-cc" title="${esc(l.c)}"><span class="r86-tag" style="--h:${r86CatIdx(l.c)*31}">${esc(R86_CORTO[l.c]||l.c)}</span></td><td class="r86-k r86-s"><span>${esc(l.n)}</span></td>${cols.map((c,i)=>{
    const ult=c.fk[0]==='p'&&i===M.past.length-1?' r86-ult':'',hoy=r86Hoy(M,c);
    if(c.fk[0]==='f'){const e=c.lines.some(x=>x.n===l.n);return `<td class="${ult}${hoy}">${e?`<label class="r86-c"><input type="checkbox" ${R86.sel.has(r86Key(M.v,c.fk,l.n))?'checked':''} onchange="r86SelLineaN('${c.fk}',${JSON.stringify(l.n).replace(/"/g,'&quot;')},this.checked)"></label>`:''}</td>`}
    const e=c.esp.some(x=>x.n===l.n);return `<td class="${ult}${hoy}">${e?(c.hecho.has(l.n)?'<span class="r86-ok">✓</span>':'<span class="r86-cero">○</span>'):''}</td>`}).join('')}</tr>`).join('');
  const ods=cols.map((c,i)=>{const ult=c.fk[0]==='p'&&i===M.past.length-1?' r86-ult':'',hoy=r86Hoy(M,c);
    return `<td class="${ult}${hoy}">${c.fk[0]==='p'?c.orders.map(o=>`<button type="button" class="ods-chip r73-chip2 r86-chip" onclick="r86Nota(event,'ods','${c.fk}',null);R86.nota.oid='${o.id}';r86PintarNota()"><b>#${esc(o.code)}</b>${o.km==null?' <span class="r72-tag">sin km</span>':''}</button>`).join(''):''}</td>`}).join('');
  return `<div class="r86-scroll r86-tl ${det?'r86-detv':''}"><table class="r86m ${det?'r86-det':''}"><thead><tr>${det?'<th class="r86-cc">Categoría</th>':''}<th class="r86-k">${det?'Servicio':'Categoría'}</th>${cols.map((c,i)=>r86Cab(M,c,i)).join('')}</tr></thead><tbody>${filas}<tr class="r86-hist"><td class="r86-k" ${det?'colspan="2"':''}><b>Historial</b><small>ODS por visita</small></td>${ods}</tr></tbody></table></div>`;
}
views.timeline=()=>{
  r84Sembrar();r86Sembrar();
  if(R86.nv!=null&&db.vehicles.length>R86.nv){timelineVehicle=db.vehicles.at(-1).id;simKm=null;R86.nv=null}
  const h=r84TlAnterior(),i0=h.indexOf('<p class="r72-legend">');if(i0<0)return h;
  const M=r86Modelo();
  const leyenda=`<p class="r72-legend"><span class="r86-ok">✓</span> Hecho · ○ Pendiente · <span class="r86-venc">Vencido</span> · <i class="r86-lr"></i> última visita · <i class="r86-ly"></i> hoy · ${M.paso.toLocaleString('es-PE')} km por visita · ${esc(M.v.oil||'aceite sin definir')}</p>`;
  setTimeout(()=>{document.querySelectorAll('input[data-ind="1"]').forEach(e=>e.indeterminate=true);const sc=document.querySelector('.r86-scroll');if(sc){if(R86.mantener)R86.mantener=false;else sc.scrollLeft=sc.scrollWidth}const pc=document.getElementById('r86-pc');if(pc&&R86.pc)pc.style.background=getComputedStyle(document.body).backgroundColor;r86PintarNota()});
  let pre=h.slice(0,i0).replace(/Plan <b>[^<]*<\/b>/,'Plan <b>'+esc(M.p?M.p.nombre:'sin plan')+'</b>');
  pre=pre.replace(/<label>Vehículo<select[\s\S]*?<\/select><\/label>/,()=>r86BuscadorVeh(M.v));
  const iF=pre.indexOf('<div class="filterbar">'),iC=pre.lastIndexOf('</div>');
  if(iF<0||iC<iF)return pre+leyenda+r86Matriz(M);
  const sel=r86Unicos().size,btn=`<button type="button" class="${R86.pc?'primary':''}" onclick="r86Pantalla()">${R86.pc?'Salir de pantalla completa':'Pantalla completa'}</button><button type="button" onclick="r86Solo()">Solo la línea</button>`+(R86.pc?`<span class="r86-selc"><b>${sel}</b> seleccionados</span><button type="button" onclick="r73TlToQuote()">＋ Agregar a cotización</button>`:'');
  const bar=pre.slice(iF,iC)+btn+pre.slice(iC);
  return pre.slice(0,iF)+`<div id="r86-pc" class="r86-pc ${R86.pc?'r86-fs':''} ${R86.pc&&R86.solo?'r86-solo':''}">`+(R86.pc&&R86.solo?`<div class="r86-flot"><button type="button" onclick="R86.solo=false;r86Render()">Mostrar controles</button><button type="button" class="primary" onclick="r86Pantalla()">Salir</button></div>`:'')+bar+leyenda+r86Matriz(M)+'</div>';
};

function r86Pantalla(){
  R86.pc=!R86.pc;if(!R86.pc)R86.solo=false;
  try{if(R86.pc)document.documentElement.requestFullscreen?.().catch(()=>{});else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})}catch(e){}
  r86Render();
}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&R86.pc){R86.pc=false;if(document.querySelector('.r86-tl'))r86Render()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&R86.pc&&!R86.nota&&!document.fullscreenElement){R86.pc=false;r86Render()}});

function r86Solo(){if(!R86.pc){R86.pc=true;try{document.documentElement.requestFullscreen?.().catch(()=>{})}catch(e){}}R86.solo=true;r86Render()}
/* --- buscador de vehículo por placa, con «+» para crear uno (y su cliente) --- */
function r86BuscadorVeh(v){
  return `<label class="r86-vlab">Vehículo<span class="r86-veh"><input id="r86-vq" type="search" autocomplete="off" placeholder="Buscar por placa" value="${esc(v.plate+' · '+v.brand+' '+v.model)}" onfocus="this.select();r86VBuscar('')" oninput="r86VBuscar(this.value)" onkeydown="r86VTecla(event)" onblur="setTimeout(()=>{const l=document.getElementById('r86-vl');if(l)l.hidden=true},180)"><button type="button" class="r86-mas" title="Nuevo vehículo" onclick="r86NuevoVeh()">＋</button><span id="r86-vl" class="r86-vl" hidden></span></span></label>`;
}
function r86VBuscar(q){
  const l=document.getElementById('r86-vl');if(!l)return;const t=normal(q);
  const L=db.vehicles.filter(x=>!x.deleted&&(!t||normal([x.plate,x.brand,x.model,client(x.client).name].join(' ')).includes(t))).slice(0,8);
  l.innerHTML=L.map(x=>`<button type="button" onmousedown="r86ElegirVeh('${x.id}')"><b>${esc(x.plate)}</b> ${esc(x.brand)} ${esc(x.model)} <small>${esc(client(x.client).name||'')}</small></button>`).join('')||'<em>Sin resultados. Usa ＋ para crear el vehículo.</em>';
  l.hidden=false;
}
function r86VTecla(e){if(e.key==='Enter'){e.preventDefault();const b=document.querySelector('#r86-vl button');if(b)b.dispatchEvent(new MouseEvent('mousedown'))}}
function r86ElegirVeh(id){timelineVehicle=id;simKm=null;selectedPlanItems.clear();render()}
function r86NuevoVeh(){R86.nv=db.vehicles.length;editVehicle()}
/* En el formulario de vehículo se puede crear el cliente ahí mismo. */
const r86EditVehBase=editVehicle;
editVehicle=function(id){
  r86EditVehBase(id);
  try{
    const f=document.getElementById('editor'),sel=f?.querySelector('[name=client]');if(!sel||f.querySelector('.r86-nc'))return;
    sel.closest('label').insertAdjacentHTML('afterend',`<div class="r86-nc" style="grid-column:1/-1"><button type="button" onclick="this.nextElementSibling.hidden=!this.nextElementSibling.hidden">＋ Nuevo cliente</button><div class="r86-ncf" hidden><label>Nombre o razón social<input data-nc="name"></label><label>Documento<input data-nc="doc" inputmode="numeric"></label><label>Celular<input data-nc="phone"></label></div></div>`);
    f.addEventListener('submit',ev=>{
      const g=k=>f.querySelector('[data-nc="'+k+'"]')?.value.trim()||'';if(!g('name'))return;
      const doc=g('doc'),dup=doc&&db.clients.find(c=>!c.deleted&&c.doc===doc);
      if(dup){ev.preventDefault();ev.stopImmediatePropagation();return toast('Ya existe un cliente con ese documento: elígelo en la lista.')}
      const c={id:uid(),name:g('name'),doc,docType:/^\d{11}$/.test(doc)?'RUC':'DNI',phone:g('phone'),email:'',country:'PE'};
      db.clients.push(c);sel.insertAdjacentHTML('beforeend',`<option value="${c.id}">${esc(c.name)}</option>`);sel.value=c.id;
    },true);
  }catch(e){console.warn('r86',e)}
};

/* --- Selección sin repetidos y cotización por ítem o por paquete del plan --- */
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
/* Ficha del servicio: un ojito junto a la línea (cotización y ODS) despliega, justo debajo, un recuadro pequeño con lo que incluye y sus tiempos. */
R86.fichas=new Set();
function r86FichaDe(l){
  if(l.ficha)return l.ficha;
  if(l.type!=='servicio')return null;
  const c=l.catalog?db.catalog.find(x=>x.id===l.catalog):null,code=c?.code||l.code,k=Object.keys(R86_PCODE).find(z=>R86_PCODE[z]===code);
  if(k)return {servicios:R84_PAQ[k].l.map(z=>({n:z.n,h:z.h})),horas:c?.hours};
  const ia=code==='SV071'?0:code==='SV072'?1:-1;
  return ia>=0?{servicios:R84_AFI[ia].l.map(z=>({n:z.n,h:z.h})),horas:c?.hours}:null;
}
function r86FichaTog(id){R86.fichas.has(id)?R86.fichas.delete(id):R86.fichas.add(id);const e=document.querySelector('#modalbody .r78-largo');if(e){r78Editor(e.dataset.k.slice(2));return}r72Refresh()}
const R86_OJO='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>';
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

/* «Guardar cambios» guarda y cierra la cotización (antes se quedaba abierta). */
const r86QuoteSaveBase=r77QuoteSave;
r77QuoteSave=function(id){r86QuoteSaveBase(id);closeModal();render()};
