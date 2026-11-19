/* --------------------------------------------------------------------------
   R8.7 · Ocho planes (combustible × uso × aceite) con código, ciclo simétrico y línea de tiempo por plan
   - Código = combustible (G/D) + uso (P particular / R profesional) + aceite (M mineral o semisintético / S sintético o full sintético).
   - La cajera solo elige combustible y uso; el aceite sale del vehículo (o del nombre del aceite de la última ODS).
   - El paso entre visitas es el intervalo del aceite (lo que ocurra primero: km o meses). El ciclo se repite igual y ninguno pasa de 24 meses.
   - La revisión completa NO forma parte de ningún ciclo: es un paquete suelto, oferta opcional cada 12 meses.
   - Un cambio de uso o de aceite cambia el código: abre un tramo nuevo con fecha, quién y orden. Los vencimientos salen de las últimas ODS (no se reinicia desde el express).
   - Descuento en soles por servicios ya hechos al cotizar una visita.
   -------------------------------------------------------------------------- */
const R87={vista:'ciclo',sel:'GP-M',borrador:{}};
const R87_COMB={G:'Gasolina',D:'Diésel'},R87_USO={P:'particular',R:'profesional'},R87_ACE={M:'Mineral o semisintético',S:'Sintético o full sintético'};
const R87_NOMBRE={EXP:'Express',MEN:'Menor',MAY:'Mayor'};
const R87_TOK=['EXP','MEN','MAY','MEN+AF','MAY+AF'];
/* tipo de aceite de motor por su nombre: «semi» primero (contiene «sintético»), luego sintético / full / 100 %, luego mineral; si no dice nada, no cambia */
function r87TipoAceite(t){const s=normal(t||'');if(!s)return null;if(/semi/.test(s))return 'M';if(/sintetico/.test(s))return 'S';if(/mineral/.test(s))return 'M';return null}
const r87EsAceiteMotor=l=>l.type==='producto'&&/aceite/.test(normal((l.name||'')+' '+(l.originalDescription||'')))&&!/caja|transmision|hidraul|diferencial|atf|ddc|frenos|refriger/.test(normal((l.name||'')+' '+(l.originalDescription||'')));
function r87Aceite(v){
  const d=r87TipoAceite(v.oil);if(d)return {a:d,prov:false};
  const os=db.orders.filter(o=>o.vehicle===v.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  for(const o of os)for(const l of o.lines||[]){if(r87EsAceiteMotor(l)){const t=r87TipoAceite((l.name||'')+' '+(l.originalDescription||''));if(t)return {a:t,prov:false}}}
  return {a:'M',prov:true};
}
const r87Comb=v=>(v.fuel||r84Combustible(v))==='DIE'?'D':'G';
const r87Uso=v=>v.use==='S'?'R':'P';
function r87Info(v){const a=r87Aceite(v);return {cod:r87Comb(v)+r87Uso(v)+'-'+a.a,prov:a.prov}}
/* uso y aceite «asignados» = ya guardados en el vehículo (congelados); sin ellos la línea acepta un borrador que se guarda aparte */
const r87Asignado=v=>!!v.use&&!!r87TipoAceite(v.oil);
const r87Efectivo=v=>{const b=R87.borrador[v.id];return b?{...v,use:b.use??v.use,oil:b.oil??v.oil,fuel:b.fuel||v.fuel}:v};
const r87PlanDe=v=>{r87Sembrar();const c=r87Info(v).cod;return db.r87.planes.find(p=>p.cod===c&&p.activo)||null};
const r87NomBase=p=>`${R87_COMB[p.comb]} · uso ${R87_USO[p.uso]} · ${p.ace==='S'?'sintético':'mineral o semisintético'}`;
const r87Nom=p=>p.nombre||r87NomBase(p);
const r87Af=p=>p.comb==='G';
/* Servicios a elegir (*): la cajera escoge uno de cada grupo; al marcar uno, el otro queda bloqueado. Se sobreentiende el tipo de motor. */
const R87_ALT={afin:['Limpieza y mantenimiento de carburador','Limpieza de inyectores y obturador / IAC']};
const r87AltGrupo=n=>{const g=Object.keys(R87_ALT).find(k=>R87_ALT[k].includes(n));return g?{id:g,opts:R87_ALT[g]}:null};
function r87AfinUnion(){
  const a=R84_AFI[0].l,b=R84_AFI[1].l,out=[];
  new Set([...a,...b].map(l=>l.n)).forEach(n=>{const e=a.find(l=>l.n===n)||b.find(l=>l.n===n),g=r87AltGrupo(n);out.push({n,h:e.h,c:r85Cat(n),...(g?{alt:g.id}:{})})});
  return out;
}
const r87SelVeh=(v,n)=>[...R86.sel].some(k=>k.startsWith(v.id+'|')&&k.split('|')[2]===n);
/* el tipo de afinamiento sale de lo que la cajera marcó; si no marcó, del vehículo (inyección por defecto) */
var r86AfinIdx=v=>v&&r87SelVeh(v,R87_ALT.afin[0])?0:v&&r87SelVeh(v,R87_ALT.afin[1])?1:(v&&v.afin==='carb'?0:1);
/* --- datos --- */
function r87Planes(){
  const defs=[['G','P','M',5000,4,['EXP','EXP','MEN+AF','EXP','EXP','MAY+AF'],1,'Cada 3 visitas: dos express y una visita con afinamiento; primero el menor y luego el mayor.'],
    ['G','P','S',7500,6,['EXP','MEN+AF','EXP','MAY+AF'],1,'Cada 2 visitas: un express y una visita con afinamiento; primero el menor y luego el mayor.'],
    ['G','R','M',5000,1,['EXP','EXP','MEN+AF','EXP','EXP','MAY+AF'],2,'Cada 3 visitas: dos express y un menor o mayor, ambos con afinamiento.'],
    ['G','R','S',7500,2,['EXP','MEN+AF','EXP','MAY+AF'],2,'Cada 2 visitas: un express y una visita con afinamiento; primero el menor y luego el mayor.'],
    ['D','P','M',5000,4,['EXP','EXP','MEN','EXP','EXP','MAY'],1,'Cada 3 visitas: dos express y una visita de menor o mayor; primero el menor y luego el mayor.'],
    ['D','P','S',7500,6,['EXP','MEN','EXP','MAY'],1,'Cada 2 visitas: un express y una visita de menor o mayor; primero el menor y luego el mayor.'],
    ['D','R','M',5000,1,['EXP','EXP','MEN','EXP','EXP','MAY'],2,'Cada 3 visitas: dos express y un menor o mayor.'],
    ['D','R','S',7500,2,['EXP','MEN','EXP','MAY'],2,'Cada 2 visitas: un express y una visita de menor o mayor.']];
  return defs.map(([comb,uso,ace,km,meses,sec,horizonte,patron])=>({cod:comb+uso+'-'+ace,comb,uso,ace,km,meses,sec,horizonte,patron,activo:true}));
}
function r87Persistir(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}}
/* ODS de ejemplo del mismo mes y posterior a la última visita (20-ago) de DEM-701: servicios del plan ya hechos, para el descuento al cotizar */
function r87SembrarOds(){
  if(!db.vehicles.find(v=>v.id==='v86a'))return;
  const id='r87-o1';if(db.orders.find(o=>o.id===id))return;
  const nombres=['Revisión de refrigerante','Revisión de batería'];
  db.orders.push({id,code:'R604',externalId:'R87R604',vehicle:'v86a',tech:null,technicianName:'Técnico demo 1',km:58000,rawKm:'58000',state:'Archivada',date:'2026-08-28',closed:'2026-08-28',origin:'Demostración R8.7',billing:'Sin dato histórico',
    lines:nombres.map((n,i)=>({id:id+'-'+i,name:n,type:'servicio',qty:1,price:0,cost:0,hours:0.25,tech:null,technicianName:'Técnico demo 1',approved:true,announced:true,discount:0})),source:'Demostración',archived:true,approval:'Aprobada',branch:'union',attentionType:'Mantenimiento',rootTaskState:'Pendiente',productStage:'Solicitud',time:'09:00',odsType:'Revisión',rm:1});
}
function r87Sembrar(){
  r84Sembrar();r86Sembrar();
  if(!db.r87||db.r87.v!==1){db.r87={v:1,planes:r87Planes(),cambios:{},base:{}};r87Persistir()}
  if(!db.r87.cambios){db.r87.cambios={};db.r87.base={};r87Persistir()}
  /* secuencia nueva del uso profesional con aceite mineral o semisintético (E, E, menor, E, E, mayor) */
  db.r87.planes.forEach(x=>{const viejo=x.cod==='GR-M'?'EXP,MEN,EXP,MEN,EXP,MAY+AF':x.cod==='DR-M'?'EXP,MEN,EXP,MEN,EXP,MAY':null;if(viejo&&x.sec.join(',')===viejo){x.sec=x.cod==='GR-M'?['EXP','EXP','MEN','EXP','EXP','MAY+AF']:['EXP','EXP','MEN','EXP','EXP','MAY'];x.patron=x.cod==='GR-M'?'Cada 3 visitas: dos express y un menor o mayor; el afinamiento va con el mayor.':'Cada 3 visitas: dos express y un menor o mayor.'}});
  /* DEC-119: profesional con dos afinamientos por ciclo (GR-M) y ciclo de 4 con sintético (GR-S, DR-S) */
  const R87_PROF={'GR-M':[['EXP','EXP','MEN+AF','EXP','EXP','MAY+AF'],'Cada 3 visitas: dos express y un menor o mayor, ambos con afinamiento.',['EXP,MEN,EXP,MEN,EXP,MAY+AF','EXP,EXP,MEN,EXP,EXP,MAY+AF']],'GR-S':[['EXP','MEN+AF','EXP','MAY+AF'],'Cada 2 visitas: un express y una visita con afinamiento; primero el menor y luego el mayor.',['EXP,MEN,MAY+AF']],'DR-S':[['EXP','MEN','EXP','MAY'],'Cada 2 visitas: un express y una visita de menor o mayor.',['EXP,MEN,MAY']]};
  db.r87.planes.forEach(x=>{const n=R87_PROF[x.cod];if(n&&n[2].includes(x.sec.join(','))){x.sec=n[0];x.patron=n[1]}});
  r87SembrarOds();
}
/* --- motor de visitas: el paso es el intervalo del aceite; la secuencia del plan se repite --- */
function r87Pos0(p,paq){
  if(paq==='REV')paq='MAY';
  if(paq==='MEN'||paq==='MAY'){const i=p.sec.findIndex(t=>t.startsWith(paq));if(i>=0)return (i+1)%p.sec.length}
  return 0;
}
function r87Visitas(p,o){
  const L=p.sec.length,rate=o.rate>0?o.rate:0,dm=rate?Math.min(p.meses,p.km/rate):p.meses,stepKm=rate?Math.min(p.km,rate*dm):p.km,out=[];
  for(let k=1;k<=L*p.horizonte;k++){
    const t=dm*k,date=r86Fecha(o.aceite0.date,t);if(o.limite&&date>o.limite)break;
    const tok=p.sec[(o.pos0+k-1)%L];
    out.push({k,t,tok,clave:tok.slice(0,3),af:tok.endsWith('+AF'),km:Math.round(o.aceite0.km+stepKm*k),date});
  }
  return out;
}
const r87Fd=o=>o.closed||o.date;
function r86Meses(hist){
  const g=new Map();
  hist.forEach(o=>{const k=r87Fd(o).slice(0,7);if(!g.has(k))g.set(k,[]);g.get(k).push(o)});
  return [...g.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,orders])=>{
    orders.sort((a,b)=>r87Fd(a).localeCompare(r87Fd(b)));
    const conKm=orders.filter(o=>o.km!=null),aceite=conKm.filter(o=>o.lines.some(l=>l.type==='servicio'&&r86Aceite(l.name))),bo=aceite.at(-1)||conKm.at(-1);
    return {key:k,kind:'mes',orders,km:bo?bo.km:null,date:bo?r87Fd(bo):r87Fd(orders.at(-1))};
  });
}
const r87Dias=(a,b)=>(new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000;
const r87Ventana=p=>p.uso==='R'?500:100;
function r87Lineas(v,x){
  const L=r86Lineas(x.clave);
  return x.af?L.concat(r87AfinUnion().filter(a=>!L.some(l=>l.n===a.n))):L;
}
function r86Contar(M,col,cat){
  if(col.fk[0]==='f'){
    const L=col.lines.filter(l=>!cat||l.c===cat),fijas=L.filter(l=>!l.alt),grupos=[...new Set(L.filter(l=>l.alt).map(l=>l.alt))],on=l=>R86.sel.has(r86Key(M.v,col.fk,l.n));
    return {n:fijas.length+grupos.length,s:fijas.filter(on).length+grupos.filter(g=>L.some(l=>l.alt===g&&on(l))).length,L};
  }
  const L=col.esp.filter(l=>!cat||l.c===cat),s=L.filter(l=>col.hecho.has(l.n)).length;return {n:L.length,s,L};
}
/* marcar en bloque no elige alternativas; elegir una desmarca la otra en todas las visitas */
function r86Poner(M,col,lines,on){
  const una=lines.length===1&&lines[0].alt;
  lines.forEach(l=>{
    const k=r86Key(M.v,col.fk,l.n);
    if(on&&l.alt&&!una)return;
    if(on&&una)M.fut.forEach(c=>c.lines.forEach(o=>{if(o.alt===l.alt&&o.n!==l.n)R86.sel.delete(r86Key(M.v,c.fk,o.n))}));
    on?R86.sel.add(k):R86.sel.delete(k);
  });
}
const r87Completa=(M,c)=>{const t=r86Contar(M,c,null);return c.lines.length>0&&t.s===t.n};
function r86Cobertura(U){
  const M=r86Modelo(),v=M.v,L=k=>new Set(r86ListaPaq(k,v).map(x=>x.n));
  const completas=M.fut.filter(c=>r87Completa(M,c));
  let A=[...new Set(completas.flatMap(c=>c.tags.some(t=>/Afin/.test(t))?[c.clave,'AF']:[c.clave]))];
  A=A.filter(k=>!A.some(o=>o!==k&&L(o).size>L(k).size&&[...L(k)].every(n=>L(o).has(n))));
  const resto=new Set([...U]);A.forEach(k=>L(k).forEach(n=>resto.delete(n)));
  ['MAY','MEN','AF','EXP'].forEach(k=>{if(A.includes(k))return;const l=[...L(k)];if(l.every(n=>resto.has(n))){A.push(k);l.forEach(n=>resto.delete(n))}});
  A.sort((a,b)=>r86ListaPaq(b,v).length-r86ListaPaq(a,v).length);
  return {paq:A,sueltos:[...resto]};
}
/* asterisco en los servicios a elegir y bloqueo del que no corresponde */
function r87Marcar(){
  try{
    const M=r86Modelo(),bloq=n=>{const g=r87AltGrupo(n);return !!g&&g.opts.some(o=>o!==n&&r87SelVeh(M.v,o))};
    const ast=n=>`<sup class="r87-ast" title="A elegir: ${esc(R87_ALT.afin.join(' o '))}">*</sup>`;
    document.querySelectorAll('#r86-nota .r86-checks li').forEach(li=>{
      const lab=li.querySelector('label');if(!lab||lab.querySelector('.r87-ast'))return;
      const n=R87_ALT.afin.find(x=>lab.textContent.includes(x));if(!n)return;
      const sm=lab.querySelector('small');sm?sm.insertAdjacentHTML('beforebegin',ast(n)+' '):lab.insertAdjacentHTML('beforeend',ast(n));
      if(bloq(n)){const i=lab.querySelector('input');if(i)i.disabled=true;lab.classList.add('r87-bloq')}
    });
    document.querySelectorAll('.r86m td.r86-s span').forEach(sp=>{
      const n=R87_ALT.afin.find(x=>sp.textContent.trim()===x);if(!n||sp.querySelector('.r87-ast'))return;
      sp.insertAdjacentHTML('beforeend',ast(n));
      if(bloq(n))sp.closest('tr').querySelectorAll('input[type=checkbox]').forEach(i=>{if(!i.checked)i.disabled=true});
    });
  }catch(e){console.warn('r87 marcar',e)}
}
const r87PintarBase=r86PintarNota;
r86PintarNota=function(){r87PintarBase();r87Marcar()};
/* --- tramos del plan: un cambio de plan guardado en el vehículo (ya asignado) parte la línea en la última visita; lo anterior queda congelado.
   La primera asignación de uso y aceite vale para todo el historial y no parte nada. --- */
function r87Derivar(v,pcols){
  r87Sembrar();
  const C=db.r87.cambios[v.id]||[],cur=r87Info(v),B=db.r87.base[v.id];
  const ini=pcols.find(c=>c.km!=null)||pcols[0],d0=ini?{km:ini.km,date:ini.date}:{km:v.km||0,date:today()};
  const T=[{cod:C.length?C[0].antes:cur.cod,desde:d0,por:B?.por||null}];
  C.forEach(e=>T.push({cod:e.cod,desde:{km:e.km,date:e.date},por:e.por,despues:e.despues}));
  T.at(-1).cod=cur.cod;
  T.forEach((t,i)=>{
    t.ace=t.cod.slice(-1);
    const n=T[i+1];if(!n)return;
    const o=db.orders.filter(x=>x.vehicle===v.id&&String(r87Fd(x))<=n.despues).sort((a,b)=>String(r87Fd(a)).localeCompare(String(r87Fd(b)))).at(-1);
    t.hasta=o?o.code:null;
  });
  T.at(-1).prov=cur.prov;
  return T;
}
/* --- modelo de la línea (sustituye al de R8.6) --- */
function r86Modelo(){
  r84Sembrar();r86Sembrar();r87Sembrar();
  const m=timelineModel(),v=r87Efectivo(m.v),p=r87PlanDe(v),cur=Math.round(simKm??m.estimate),past=r86Meses(m.hist);
  const pcols=past.map(c=>{const paq=r86Inferir(c.orders),esp=paq?r86Lineas(paq):[],hecho=new Set();c.orders.forEach(o=>r86Hecho(o,esp).forEach(x=>hecho.add(x)));
    return {...c,fk:'p'+c.key,paq,esp,hecho}});
  const visitas=pcols.filter(c=>c.paq&&c.km!=null),ult=visitas.at(-1)||pcols.filter(c=>c.km!=null).at(-1);
  const tr=r87Derivar(v,pcols),fut=[];
  if(p&&ult){
    const limite=(new Date(today()+'T12:00:00').getFullYear()+2)+'-12-31',vs=r87Visitas(p,{rate:m.rate,aceite0:{km:ult.km,date:ult.date},pos0:r87Pos0(p,ult.paq),limite}),hoy=today();
    vs.forEach(x=>{
      const vencido=x.km<=cur,porVencer=!vencido&&(x.km-cur<=r87Ventana(p)||r87Dias(hoy,x.date)<=5);
      fut.push({fk:'f'+x.k,k:x.k,clave:x.clave,nombre:R87_NOMBRE[x.clave],tags:x.af?['+ Afinamiento']:[],lines:r87Lineas(v,x),km:x.km,date:x.date,vencido,porVencer,hito:x.k});
    });
  }
  return {m,v,p:p?{...p,nombre:r87Nom(p)}:null,paso:p?p.km:5000,cur,past:pcols,fut,ult,tr,info:r87Info(v),borrador:!!R87.borrador[v.id],asignado:r87Asignado(m.v)};
}
var r86Paso=v=>r87PlanDe(v)?.km||5000;
Object.assign(R86_NOM,{});
/* cabecera: etiqueta «por vencer» junto a «vencido» */
const r87CabBase=r86Cab;
r86Cab=function(M,c,i){const h=r87CabBase(M,c,i).replace('<small>última visita</small>','');return c.porVencer?h.replace(' · est.',' · est. · <span class="r87-pv">por vencer</span>'):h};
/* resumen en dos filas, sin controles de uso/aceite (se editan en el vehículo) ni «solo la línea» */
function r87Resumen(M){
  const m=M.m,v=M.v,rd=r74LastRead(v),ri=m.rateInfo,t=M.tr.at(-1),uv=db.orders.filter(o=>o.vehicle===v.id&&o.km!=null).sort((a,b)=>r87Fd(a).localeCompare(r87Fd(b))).at(-1),p=M.p,n=x=>x==null||isNaN(x)?'—':Math.round(x).toLocaleString('es-PE'),sig=M.fut.find(c=>!c.vencido)||M.fut[0];
  const c=(l,val,d)=>`<div class="r87-rc"><span>${l}:</span><b>${val}</b><small>${d||''}</small></div>`;
  const sim=`<div class="r87-rc"><span>Simulación:</span><b class="r87-sim"><input type="number" aria-label="Simular kilometraje" min="0" step="100" value="${simKm==null?'':simKm}" placeholder="${n(m.estimate)}" onchange="simKm=this.value===''?null:+this.value;render()"> km${simKm!=null?'<button type="button" class="r76-mini" onclick="simKm=null;render()">Restablecer</button>':''}</b></div>`;
  return `<div class="r87-resumen">`+
    c('Último cambio de aceite',M.ult?n(M.ult.km)+' km':'—',M.ult?'salida '+esc(M.ult.date):'')+
    c('Hoy estimado','≈ '+n(m.estimate)+' km',m.rate?n(m.rate)+' km/mes · últimas '+(ri?.pts?.length||0)+' visitas':'sin tasa')+
    (()=>{const a=uv?{km:uv.km,date:r87Fd(uv),t:'visita · ODS #'+esc(uv.code)}:null,b=rd?{km:rd.km,date:rd.date,t:'consulta'}:null,u=[a,b].filter(Boolean).sort((x,y)=>String(x.date).localeCompare(String(y.date))).at(-1);return c('Última consulta',u?n(u.km)+' km':'Sin consultas',u?esc(u.date)+' · '+u.t:'')})()+sim+
    c('Plan',`${esc(t.cod)}${M.borrador?' <span class="pill gray">Sin guardar</span>':t.prov?' <span class="pill gray">Por confirmar</span>':''}`,'desde '+r86Fmt(t.desde.date)+' · '+r84Km(t.desde.km)+' km')+
    c('Combustible y uso',R87_COMB[r87Comb(v)]+' · '+R87_USO[r87Uso(v)],R87_ACE[t.ace])+
    c('Visita',p?`${r84Km(p.km)} km o ${r84Meses(p.meses)}`:'sin plan',p?`${p.sec.length} visitas · ciclo de ${r84Meses(p.meses*p.sec.length)}`:'')+
    c('Próxima visita',sig?`${esc(sig.nombre)}${sig.tags.length?' + afinamiento':''}`:'—',sig?r84Km(sig.km)+' km · '+r86Fmt(sig.date)+' (est.)':'')+`</div>`;
}
const r87TlBase=views.timeline;
views.timeline=()=>{
  let h=r87TlBase();
  try{
    const M=r86Modelo(),v=M.v;
    h=h.replace(/<button type="button" class="r76-mini[^"]*" aria-expanded="[^"]*" onclick="r76TlTog\(\)">[^<]*<\/button>/,'');
    const i0=h.indexOf('<div class="r76-km'),i1=h.indexOf('<div class="panel reminderbar">');
    if(i0>=0&&i1>i0)h=h.slice(0,i0)+(R87.resOculto?'':r87Resumen(M))+h.slice(i1);
    h=h.replace('<div class="r76-sbtn">',`<div class="r76-sbtn"><button type="button" class="r76-mini ${R87.resOculto?'':'on'}" aria-expanded="${!R87.resOculto}" onclick="R87.resOculto=!R87.resOculto;render()">${R87.resOculto?'▸':'▾'} Resumen</button>`);
    h=h.replace('onclick="window.print()">Imprimir / PDF','onclick="r87Imprimir()">Imprimir / PDF');
    let sel='';
    const ir=h.indexOf('<div class="panel reminderbar">');
    if(ir>=0){
      const fin=h.indexOf('</div>',ir)+6,rb=h.slice(ir,fin),cnt=(rb.match(/<b>[^<]*<\/b>/)||[''])[0],btn=[...rb.matchAll(/<button[^>]*>[^<]*<\/button>/g)].map(x=>x[0].replace(/class="primary"/,'class="primary"'));
      h=h.slice(0,ir)+h.slice(fin);
      if(!h.includes('r86-selc'))sel=`<span class="r87-sel">${cnt}${btn.map(b=>b.replace('Enviar recordatorio por WhatsApp','Enviar recordatorio<br>por WhatsApp').replace('＋ Agregar a cotización','＋ Agregar a<br>cotización').replace('Crear tarea de contacto','Crear tarea<br>de contacto').replace('<button ','<button data-r87b="2" ')).join('')}</span>`;
    }
    h=h.replace(/<label>Uso<select[\s\S]*?<\/select><\/label>/,'').replace(/<label>Aceite<select[\s\S]*?<\/select><\/label>/,'').replace(/<button type="button"[^>]*onclick="r86Solo\(\)">Solo la línea<\/button>/,'');
    const real=db.vehicles.find(x=>x.id===v.id)||v,libre=!M.asignado;
    h=h.replace('<div class="seg">',`${r87Selectores(v,!libre)}<div class="seg">`);
    h=h.replace('<button type="button" class="r86-mas" title="Nuevo vehículo" onclick="r86NuevoVeh()">＋</button>',`<button type="button" class="r86-mas" title="Nuevo vehículo" aria-label="Nuevo vehículo" onclick="r86NuevoVeh()">＋</button><button type="button" class="r86-mas r87-ed" title="Editar vehículo" aria-label="Editar vehículo" onclick="editVehicle('${v.id}')">✎</button>`);
    const gu=libre?`<button type="button" class="primary r87-guardar" ${v.use&&r87TipoAceite(v.oil)?'':'disabled'} onclick="r87Guardar()">Guardar</button>`:'';
    const grupo=sel?sel.replace(/<\/span>$/,gu+'</span>'):(gu?`<span class="r87-sel">${gu}</span>`:'');
    if(grupo)h=h.replace(/(<button type="button"[^>]*onclick="r86Pantalla\(\)">[^<]*<\/button>)/,'$1'+grupo);
    h=h.replace(/<p class="r72-legend">[\s\S]*?<\/p>/,'<p class="r72-legend"><span class="r86-ok">✓</span> Hecho · ○ Pendiente · <span class="r86-venc">Vencido</span> · <span class="r87-pv">por vencer</span> · <i class="r86-lr"></i> última visita · <i class="r86-ly"></i> hoy</p>');
  }catch(e){console.warn('r87 tl',e)}
  return h;
};
/* fila «Plan» sobre las columnas: agrupa las visitas por tramo; lo anterior al tramo actual queda congelado */
const r87MatrizBase=r86Matriz;
r86Matriz=function(M){
  const h=r87MatrizBase(M);if(!M.p||!M.ult)return h;
  const cols=r86Cols(M),T=M.tr,det=R73.tlMode==='detalle',idx=c=>{let k=0;T.forEach((t,i)=>{if(i>0&&c.date>t.despues)k=i});return k},g=[];
  cols.forEach(c=>{const k=idx(c),u=g.at(-1);if(u&&u.k===k)u.n++;else g.push({k,n:1,fk:c.fk})});
  const celdas=g.map(x=>{const t=T[x.k];return `<th colspan="${x.n}" class="r87-pg ${x.k===T.length-1?'r87-pa':'r87-pf'}"><div class="r87-pw"><span class="r87-pc1"><b>${esc(t.cod)}</b><i class="r86-info" tabindex="0" title="Detalle del plan" onclick="r86Nota(event,'plan','${x.fk}',${x.k})">ⓘ</i><small>desde ${r86Fmt(t.desde.date)} · ${r84Km(t.desde.km)} km${t.hasta?' · hasta ODS #'+esc(t.hasta):''}${t.por?' · '+esc(t.por):''}</small></span></div></th>`}).join('');
  const esq=det?'<th class="r86-cc r87-pe"></th><th class="r86-k r87-pe">Plan</th>':'<th class="r86-k r87-pe">Plan</th>';
  return h.replace('<thead>','<thead><tr class="r87-prow">'+esq+celdas+'</tr>');
};
/* nota con el detalle del tramo (mismo estilo que la nota de cada visita) */
function r87NotaPlan(){
  const N=R86.nota,M=r86Modelo(),t=M.tr[N.cat];if(!t){r86CerrarNota();return}
  const pl=db.r87.planes.find(x=>x.cod===t.cod),actual=N.cat===M.tr.length-1;
  let el=document.getElementById('r86-nota');
  if(!el){el=document.createElement('div');el.id='r86-nota';el.className='r86-nota';el.setAttribute('role','dialog');document.body.appendChild(el)}
  el.style.left=Math.max(8,N.x)+'px';el.style.top=Math.max(8,N.y)+'px';setTimeout(()=>r86Ajustar(el));
  const fila=(a,b)=>`<li><b>${a}</b> ${b}</li>`;
  el.innerHTML=`<header><div><b>Plan ${esc(t.cod)}</b><small>${actual?'Plan actual':'Tramo anterior, congelado'}</small></div><button type="button" aria-label="Cerrar" onclick="r86CerrarNota()">✕</button></header>
  <div class="r86-sec"><ul class="r86-ul">${[fila('Desde',r86Fmt(t.desde.date)+' · '+r84Km(t.desde.km)+' km'),t.por?fila('Registrado por',esc(t.por)):'',t.hasta?fila('Hasta','ODS #'+esc(t.hasta)):'',fila('Combustible',R87_COMB[t.cod[0]]),fila('Uso',R87_USO[t.cod[1]]),fila('Aceite',R87_ACE[t.ace]),pl?fila('Visita',`${r84Km(pl.km)} km o ${r84Meses(pl.meses)}`):'',pl?fila('Ciclo',`${pl.sec.length} visitas · ${r84Meses(pl.meses*pl.sec.length)}`):'',t.prov?fila('Estado','Por confirmar'):''].join('')}</ul></div>`;
}
const r87PintarBase2=r86PintarNota;
r86PintarNota=function(){if(R86.nota?.tipo==='plan'&&document.querySelector('.r86-tl')){r87NotaPlan();return}r87PintarBase2()};
/* --- cotización: precio por combustible y descuento en soles por servicios ya hechos --- */
function r87Hechas(M){
  const ult=M.ult;if(!ult)return new Set();const s=new Set();
  db.orders.filter(o=>o.vehicle===M.v.id&&String(r87Fd(o))>String(ult.date)).forEach(o=>o.lines.filter(l=>l.type==='servicio').forEach(l=>['EXP','MEN','MAY'].flatMap(r86Lineas).concat(r87AfinUnion()).forEach(e=>{if(r86Igual(e.n,l.name))s.add(e.n)})));
  return s;
}
function r87InfoPaq(k,M){
  const v=M.v,d=r87Comb(v)==='D',cod=r86CodigoPaq(k,v),c=db.catalog.find(x=>x.code===cod),lista=r86ListaPaq(k,v),base=R84_PAQ[k];
  const precio=base?(d?base.d:base.g):(c?.price??null);
  let desc=0;
  if(precio!=null){
    const hechas=r87Hechas(M),t=lista.filter(l=>hechas.has(l.n)).reduce((a,l)=>a+l.h*(/^revisi/i.test(normal(l.n))?0.5:1),0);
    desc=Math.floor(t*(d?80:50)/5)*5;desc=Math.min(desc,Math.max(0,Math.floor((precio-5)/5)*5));
  }
  return {k,cod,c,nom:c?.name||k,precio,desc,horas:c?.hours,lista};
}
r73TlToQuote=function(){
  const items=selectedPlanData();if(!items.length)return toast('Selecciona al menos un servicio.');
  const U=r86Unicos(),cob=r86Cobertura(U),M=r86Modelo();
  if(!cob.paq.length)return r86CrearCot('item');
  const pk=cob.paq.map(k=>r87InfoPaq(k,M));
  modal(`<h2>¿Cómo generar la cotización?</h2><p>${pk.length>1?`Hay ${pk.length} paquetes del plan en lo que seleccionaste; son paquetes separados, cada uno va en su propio ítem.`:'Lo que seleccionaste completa un paquete del plan.'} ¿Quieres agruparlos por paquete o separarlos por ítem?</p>
  <div class="r86-opc"><b>Agrupar por paquete</b><ul>${pk.map(x=>`<li>${esc(x.c?.code?x.c.code+' - ':'')}${esc(x.nom)} · ${x.precio!=null?money(x.precio):'precio por confirmar'}${x.desc?` · descuento por servicios hechos −${money(x.desc)}`:''} · ${x.horas} h <span class="muted">(${x.lista.length} servicios en su ficha)</span></li>`).join('')}${cob.sueltos.length?`<li>${cob.sueltos.length} servicio${cob.sueltos.length>1?'s':''} suelto${cob.sueltos.length>1?'s':''}: ${esc(cob.sueltos.join(', '))}</li>`:''}</ul></div>
  <div class="r86-opc"><b>Separar por ítem</b><ul><li>${U.size} servicios distintos, uno por línea</li></ul></div>
  <footer>${button('Cancelar','closeModal()')}${button('Separar por ítem','closeModal();r86CrearCot(\'item\')')}${button('Agrupar por paquete','closeModal();r86CrearCot(\'paquete\')',true)}</footer>`);
};
function r86CrearCot(modo){
  const M=r86Modelo(),items=selectedPlanData(),U=r86Unicos(),cob=r86Cobertura(U),lines=[],x0=items[0],v=M.v;
  if(modo==='paquete')cob.paq.forEach(k=>{const i=r87InfoPaq(k,M),l=r86LineaCot(i.c,k,x0);if(i.precio!=null)l.price=i.precio;l.discount=i.desc||0;l.ficha={servicios:i.lista.map(z=>({n:z.n,h:z.h})),horas:i.horas};lines.push(l)});
  const nombres=modo==='paquete'?cob.sueltos:[...U];
  nombres.forEach(n=>{const it=items.find(z=>z.name===n),c=db.catalog.find(z=>z.type==='servicio'&&!z.deleted&&normal(z.name)===normal(n));lines.push(r86LineaCot(c,n,it))});
  const q=r73NewQuoteRecord({client:v.client,vehicle:v.id,branch:r73UserSede(),lines});
  selectedPlanItems.clear();R86.sel.clear();r72Log('q:'+q.id,'Cotización desde línea temporal',lines.length+' líneas: '+lines.map(l=>l.name).join(', '));save('Cotización desde línea temporal',q.code);setTimeout(()=>r73OpenQuote(q.id));
}
/* --- pantalla «Planes preventivos» --- */
function r87Elegir(cod){R87.sel=cod;render()}
function r87Filtro(p){
  return `<div class="filterbar"><label>Plan<select id="r87-plan" onchange="r87Elegir(this.value)">${db.r87.planes.map(x=>`<option value="${x.cod}" ${x.cod===p.cod?'selected':''}>${x.cod} · ${esc(r87Nom(x))}${x.activo?'':' (inactivo)'}</option>`).join('')}</select></label></div>`;
}
/* un solo botón para desplegar o plegar las visitas del ciclo */
function r87Etiqueta(){const b=document.getElementById('r87-tog');if(!b)return;const ds=[...document.querySelectorAll('.r84-ciclo details')];b.textContent=ds.length&&ds.every(d=>d.open)?'Plegar todo':'Desplegar todo'}
function r87Alternar(){const ds=[...document.querySelectorAll('.r84-ciclo details')],todas=ds.every(d=>d.open);ds.forEach(d=>d.open=!todas);r87Etiqueta()}
const r87Hito=(p,i)=>`${r84Km(p.km*i)} km o ${r84Meses(p.meses*i)}`;
const r87Afrec=p=>{if(!r87Af(p))return 'no lleva';const n=p.sec.filter(t=>t.endsWith('+AF')).length,m=p.meses*p.sec.length,aa=n*12/m;return 'lleva · '+(aa===1?'una vez al año':aa===2?'dos veces al año':`${n} ${n===1?'vez':'veces'} cada ${r84Meses(m)}`)};
function r87Franja(p){
  const usados=db.vehicles.filter(v=>!v.deleted&&r87Info(v).cod===p.cod).length,L=p.sec.length,c=p.cod;
  const menu=`<details class="r87-menu" ontoggle="r87PosMenu(this)"><summary aria-label="Acciones del plan" title="Acciones">⋯</summary><div class="r87-menu-i"><button type="button" onclick="r87Cerrar();r87Editar('${c}')">Editar plan</button><button type="button" onclick="r87Cerrar();r87EditarReglas('${c}')">Editar reglas</button><button type="button" onclick="r87Cerrar();r87PedirBorrar('${c}')">Eliminar</button></div></details>`;
  return `<div class="panel r87-tabla"><table class="r87-cab"><thead><tr><th>Acciones</th><th>Plan</th><th>Combustible</th><th>Uso</th><th>Aceite</th><th>Código</th><th>Visita</th><th>Ciclo</th><th>Afinamiento</th><th>Vehículos</th><th>Estado</th></tr></thead>
  <tbody><tr><td>${menu}</td><td>${esc(r87Nom(p))}</td><td>${R87_COMB[p.comb]}</td><td>${R87_USO[p.uso][0].toUpperCase()+R87_USO[p.uso].slice(1)}</td><td>${R87_ACE[p.ace]}</td><td><span class="pill">${p.cod}</span></td><td>${r84Km(p.km)} km o ${r84Meses(p.meses)}</td><td>${L} visitas · ${r84Meses(p.meses*L)} · ${r84Km(p.km*L)} km</td><td>${r87Afrec(p)}</td><td>${usados}</td><td><span class="pill ${p.activo?'green':'gray'}">${p.activo?'Activo':'Inactivo'}</span></td></tr></tbody></table></div>`;
}
function r87PosMenu(d){if(!d.open)return;const r=d.querySelector('summary').getBoundingClientRect(),m=d.querySelector('.r87-menu-i');m.style.left=r.left+'px';m.style.top=(r.bottom+6)+'px'}
function r87Cerrar(){document.querySelectorAll('.r87-menu[open]').forEach(d=>d.open=false)}
document.addEventListener('click',e=>{if(!e.target.closest('.r87-menu'))r87Cerrar()});
/* afinamiento: una sola lista; los servicios a elegir llevan * */
function r87AfiHtml(){
  return `<div class="r84-sub"><b>Afinamiento</b><ul class="r84-lista">${r87AfinUnion().map(x=>`<li>${esc(x.n)}${x.alt?'<sup class="r87-ast" title="A elegir: carburado o inyección">*</sup>':''} <span class="muted">· ${x.h} h</span></li>`).join('')}</ul></div>`;
}
function r87Tarjeta(p,tok,i){
  const clave=tok.slice(0,3),af=tok.endsWith('+AF'),nombre=R87_NOMBRE[clave];
  return `<details class="r84-visita" ontoggle="r87Etiqueta()"><summary><span class="r84-num">${i}</span><b>${nombre}</b>${af?'<span class="pill">+ afinamiento</span>':''}<span class="r84-cuando">${r87Hito(p,i)}</span></summary>${r84Lista(clave,false)}${af?r87AfiHtml():''}</details>`;
}
function r87Reglas(p){
  const L=p.sec.length,h=p.horizonte,af=r87Af(p);
  const afTxt=!af?'no lleva.':`en los menores y mayores marcados con afinamiento, nunca con el express; ${p.uso==='P'?'una vez al año':'dos veces al año'}. Los servicios con * se escogen: carburado o inyección, no ambos.`;
  return `<div class="r84-reglas"><h3>Reglas del plan</h3><ul><li><b>Intervalo:</b> el del aceite, cada ${r84Km(p.km)} km o ${r84Meses(p.meses)}, lo que ocurra primero.</li><li><b>Ciclo:</b> ${L} visitas, ${r84Meses(p.meses*L)} y ${r84Km(p.km*L)} km; después se repite igual.</li><li><b>Afinamiento:</b> ${afTxt}</li><li><b>Mini patrón:</b> ${esc(p.patron||'')}</li><li><b>Absorción:</b> un paquete superior reemplaza a los inferiores de la misma visita.</li><li><b>Horizonte:</b> de 1 a 2 ciclos completos dentro de 24 meses; en este plan, ${h} ciclo${h>1?'s':''} (${r84Meses(p.meses*L*h)}).</li></ul></div>`;
}
function r87Ciclo(p){
  const L=p.sec.length;
  return `<div class="r84-ciclo"><div><div class="r87-hrow"><h2>Ciclo del plan</h2><button type="button" id="r87-tog" onclick="r87Alternar()">Desplegar todo</button></div><div class="r84-visitas">${p.sec.map((t,i)=>r87Tarjeta(p,t,i+1)).join('')}
  <div class="r84-repite">↻ Luego el ciclo se repite desde la visita 1 (${L} visitas, ${r84Meses(p.meses*L)})</div></div></div>${r87Reglas(p)}</div>`;
}
views.planes=()=>{
  r87Sembrar();const ps=db.r87.planes;
  if(!ps.length)return heading('Planes preventivos','','')+'<div class="panel empty">No hay planes.</div>';
  const p=ps.find(x=>x.cod===R87.sel)||ps[0];R87.sel=p.cod;
  return heading('Planes preventivos','','')+r87Filtro(p)+r87Franja(p)+r87Ciclo(p);
};
function r87Editar(cod){
  const p=db.r87.planes.find(x=>x.cod===cod);
  form('Editar plan · '+p.cod,field('nombre','Nombre del plan',r87Nom(p),'text','required maxlength="80"')+select('activo','Estado',[['1','Activo'],['0','Inactivo']],p.activo?'1':'0'),
    d=>{p.nombre=d.nombre.trim()||r87NomBase(p);if(p.nombre===r87NomBase(p))delete p.nombre;p.activo=d.activo==='1';save('Plan preventivo',p.cod)});
}
function r87PedirBorrar(cod){
  const p=db.r87.planes.find(x=>x.cod===cod),usa=db.vehicles.filter(v=>!v.deleted&&r87Info(v).cod===cod).length;
  if(usa)return modal(`<h2>No se puede eliminar</h2><p>El plan ${esc(p.cod)} lo usan ${usa} vehículo(s). Desactívalo, o cambia el uso o el aceite de esos vehículos.</p><footer>${button('Cerrar','closeModal()',true)}</footer>`);
  modal(`<h2>¿Eliminar este plan?</h2><p>Se eliminará ${esc(p.cod+' · '+r87Nom(p))}.</p><footer>${button('Cancelar','closeModal()')}${button('Eliminar',`r87Borrar('${cod}')`,true)}</footer>`);
}
function r87Borrar(cod){closeModal();db.r87.planes=db.r87.planes.filter(x=>x.cod!==cod);R87.sel=db.r87.planes[0]?.cod;save('Plan eliminado',cod)}
function r87EditarReglas(cod){
  const p=db.r87.planes.find(x=>x.cod===cod);
  form('Editar reglas · '+p.cod,field('km','Visita cada (km)',p.km,'number','min="1000" step="500" required')+field('meses','o cada (meses)',p.meses,'number','min="1" max="24" required')+
    field('sec','Secuencia (EXP, MEN, MAY, MEN+AF, MAY+AF separados por coma)',p.sec.join(', '),'text','required')+
    select('hz','Ciclos en la línea de tiempo',[['1','1 ciclo'],['2','2 ciclos']],String(p.horizonte))+field('patron','Mini patrón',p.patron||'','text','maxlength="160"'),
    d=>{const sec=d.sec.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean),L=sec.length;
      if(!L||sec.some(x=>!R87_TOK.includes(x)))return toast('La secuencia usa solo EXP, MEN, MAY, MEN+AF y MAY+AF.');
      if(!r87Af(p)&&sec.some(x=>x.endsWith('+AF')))return toast('El diésel no lleva afinamiento.');
      if(+d.meses*L*+d.hz>24)return toast('Los ciclos de la línea no pueden pasar de 24 meses.');
      Object.assign(p,{km:+d.km,meses:+d.meses,sec,horizonte:+d.hz,patron:d.patron.trim()});save('Reglas del plan',p.cod)});
}

/* --- Vehículos: el grupo ya no se relaciona con el plan (solo da el combustible); el plan sale de combustible, uso y aceite --- */
views.vehiculos=()=>{
  r87Sembrar();
  return heading('Vehículos','',button('+ Vehículo','editVehicle()',true))+`<div class="panel">${table(['Acciones','Placa','Marca','Modelo','Año','Color','Titular','Combustible','Uso','Aceite','Plan','Último kilometraje','ODS','Registro'],db.vehicles.filter(v=>!v.deleted).map(v=>{
    const r=(v.kmReads||[]).at(-1),t=client(v.client),km=r?.km??v.km,i=r87Info(v),a=r87Aceite(v);
    return[r73Act(r73Btn('edit','Editar / traspasar',`editVehicle('${v.id}')`),r73Btn('del','Eliminar',`r73DelVehicle('${v.id}')`,'r73-red'),r73Btn('⏱','Registrar kilometraje',`r74KmConsult('${v.id}')`),r73Btn('↗','Línea temporal',`timelineVehicle='${v.id}';simKm=null;go('timeline')`)),
      `<b>${esc(v.plate)}</b>`,esc(v.brand),esc(v.model),esc(v.year),esc(v.color||'—'),`${esc(t.name||'—')}<br><small class="sub">${esc(r78TipoCorto(t.docType))} ${esc(t.doc||'—')}</small>`,
      R87_COMB[r87Comb(v)],r87Uso(v)==='R'?'Profesional':'Particular',a.prov?'—':R87_ACE[a.a],
      `<span class="pill">${esc(i.cod)}</span>${i.prov?' <span class="pill gray">Por confirmar</span>':''}`,
      km!=null&&km!==''?(+km).toLocaleString('es-PE')+' km':'—',db.orders.filter(o=>o.vehicle===v.id).length,esc(r78Fecha(v.createdAt))]}))}</div>`;
};

/* --- uso y aceite sin asignar: se juega con un borrador y se guarda en el vehículo; ya guardado, solo se edita desde el vehículo --- */
function r87Selectores(v,off){
  const O=['','Mineral','Semisintético','Sintético','Full sintético'];
  const F=v.fuel||r84Combustible(v);
  return `<label>Combustible<select aria-label="Combustible" ${off?'disabled':''} onchange="r87Borr('fuel',this.value)"><option value="GAS" ${F==='GAS'?'selected':''}>Gasolina</option><option value="DIE" ${F==='DIE'?'selected':''}>Diésel</option></select></label><label>Uso<select aria-label="Uso" ${off?'disabled':''} onchange="r87Borr('use',this.value)"><option value="">Sin definir</option><option value="P" ${v.use==='P'?'selected':''}>Particular</option><option value="S" ${v.use==='S'?'selected':''}>Profesional</option></select></label><label>Aceite<select aria-label="Aceite" ${off?'disabled':''} onchange="r87Borr('oil',this.value)">${O.map(o=>`<option value="${o}" ${(v.oil||'')===o?'selected':''}>${o||'Sin definir'}</option>`).join('')}</select></label>`;
}
function r87Borr(campo,val){const v=timelineModel().v,b=R87.borrador[v.id]||{use:v.use||'',oil:v.oil||''};b[campo]=val;R87.borrador[v.id]=b;render()}
function r87Alerta(titulo,cuerpo,okTxt,fn){
  document.getElementById('r87-alerta')?.remove();
  const d=document.createElement('div');d.id='r87-alerta';d.className='r87-alerta';d.setAttribute('role','alertdialog');d.setAttribute('aria-label',titulo);
  d.innerHTML=`<div class="r87-ab"><h3>${titulo}</h3><p>${cuerpo}</p><footer><button type="button" onclick="r87AlertaOk(false)">Cancelar</button><button type="button" class="primary" onclick="r87AlertaOk(true)">${okTxt}</button></footer></div>`;
  (document.querySelector('dialog[open]')||document.body).appendChild(d);R87.alertaFn=fn;
}
function r87AlertaOk(ok){document.getElementById('r87-alerta')?.remove();const f=R87.alertaFn;R87.alertaFn=null;if(ok&&f)f()}
const r87Quien=()=>actorUser()?.name||actor;
function r87Guardar(){
  const v0=timelineModel().v,b=R87.borrador[v0.id]||{},use=b.use??v0.use,oil=b.oil??v0.oil;
  if(!use||!r87TipoAceite(oil))return toast('Elige el uso y el tipo de aceite.');
  const cod=r87Info({...v0,use,oil}).cod;
  r87Alerta('Guardar en el vehículo',`Uso <b>${use==='S'?'profesional':'particular'}</b> y aceite <b>${esc(oil)}</b>: el plan queda en <b>${cod}</b> para todo el historial. Después, uso y aceite solo se editan desde el vehículo.`,'Guardar',()=>{
    v0.use=use;v0.oil=oil;delete R87.borrador[v0.id];db.r87.base[v0.id]={cod,por:r87Quien(),at:today()};save('Uso y aceite del vehículo',v0.plate);
  });
}
function r87RegistrarCambio(v,antes,cod){
  const keep=timelineVehicle;timelineVehicle=v.id;let M;
  try{M=r86Modelo()}finally{timelineVehicle=keep}
  const last=M.past.at(-1);
  (db.r87.cambios[v.id]=db.r87.cambios[v.id]||[]).push({antes,cod,despues:last?last.date:today(),km:Math.round(M.m.estimate),date:today(),por:r87Quien()});
  r87Persistir();
}
/* al editar el vehículo: asignar por primera vez no parte nada; cambiar un plan ya asignado pide confirmar y parte la línea en la última visita */
const r87EditVehBase=editVehicle;
editVehicle=function(id){
  r87EditVehBase(id);
  try{
    const f=document.getElementById('editor');if(!f||!id||f.dataset.r87)return;f.dataset.r87='1';
    f.addEventListener('submit',ev=>{
      if(R87.pasa){R87.pasa=false;return}
      const v=db.vehicles.find(x=>x.id===id);if(!v)return;
      const use=f.querySelector('[name=use]')?.value||'',oil=f.querySelector('[name=oil]')?.value||'';
      const antes=r87Info(v).cod,nuevo={...v,use,oil},despAs=!!use&&!!r87TipoAceite(oil),desp=r87Info(nuevo).cod;
      if(r87Asignado(v)&&despAs&&antes!==desp){
        ev.preventDefault();ev.stopImmediatePropagation();
        r87Alerta('Cambio de plan',`El plan del vehículo pasa de <b>${antes}</b> a <b>${desp}</b>. Lo anterior queda congelado con el plan ${antes} y, desde la última visita, se aplica ${desp}.`,'Aceptar',()=>{r87RegistrarCambio(v,antes,desp);R87.pasa=true;f.requestSubmit()});
      }else if(!r87Asignado(v)&&despAs){
        db.r87.base[id]={cod:desp,por:r87Quien(),at:today()};
      }
    },true);
  }catch(e){console.warn('r87 vehículo',e)}
};

/* --- Imprimir / PDF: solo lo que queda a la derecha de la línea roja, en una hoja horizontal con formato de tabla --- */
function r87HtmlImpresion(M){
  const v=M.v,t=M.tr.at(-1),cols=M.fut,cl=client(v.client)||{};
  const afi=new Set(R84_AFI.flatMap(x=>x.l.map(l=>l.n))),rk=l=>afi.has(l.n)?5:Math.max(0,['EXP','MEN','MAY'].findIndex(k=>R84_PAQ[k].l.some(x=>x.n===l.n)));
  const vistas=new Map();cols.forEach(c=>c.lines.forEach(l=>{if(!vistas.has(l.n))vistas.set(l.n,l)}));
  const orden=new Map([...vistas.keys()].map((n,i)=>[n,i])),filas=[...vistas.values()].sort((a,b)=>rk(a)-rk(b)||r86CatIdx(a.c)-r86CatIdx(b.c)||orden.get(a.n)-orden.get(b.n));
  const nom=c=>R87_NOMBRE[c.clave]+(c.tags.length?' + afin.':'');
  const info=[['Placa',v.plate],['Vehículo',`${v.brand||''} ${v.model||''}${v.year?' '+v.year:''}`],['Cliente',cl.name||'—'],['Plan',`${t.cod} · ${R87_COMB[r87Comb(v)]} · uso ${R87_USO[r87Uso(v)]} · ${R87_ACE[t.ace]}`],['Visita',M.p?`cada ${r84Km(M.p.km)} km o ${r84Meses(M.p.meses)}`:'—'],['Km estimado hoy','≈ '+r84Km(M.cur)+' km'],['Emitido',r86Fmt(today())]];
  return `<div class="r87-pr"><header><div><b>R Motriz</b><span>Plan de mantenimiento</span></div><div class="r87-pr-t">Próximas visitas · ${esc(t.cod)}</div></header>
  <table class="r87-pr-i"><tbody><tr>${info.map(([a,b])=>`<td><small>${a}</small><b>${esc(String(b))}</b></td>`).join('')}</tr></tbody></table>
  <table class="r87-pr-m"><thead><tr><th class="c">Categoría</th><th class="s">Servicio</th>${cols.map(c=>`<th>${esc(nom(c))}<small>${r84Km(c.km)} km</small><small>${r86Fmt(c.date)}</small></th>`).join('')}</tr></thead>
  <tbody>${filas.map(l=>`<tr><td class="c">${esc(R86_CORTO[l.c]||l.c)}</td><td class="s">${esc(l.n)}${l.alt?'*':''}</td>${cols.map(c=>`<td>${c.lines.some(x=>x.n===l.n)?'●':''}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <footer>● incluido en la visita · * a elegir: carburado o inyección · km y fechas estimados</footer></div>`;
}
function r87Imprimir(){
  const M=r86Modelo();if(!M.p||!M.fut.length)return toast('No hay visitas proyectadas para imprimir.');
  let d=document.getElementById('r87-print');if(!d){d=document.createElement('div');d.id='r87-print';document.body.appendChild(d)}
  d.innerHTML=r87HtmlImpresion(M);document.body.classList.add('r87-imprimiendo');
  setTimeout(()=>window.print(),50);
}
window.addEventListener('afterprint',()=>{document.body.classList.remove('r87-imprimiendo');document.getElementById('r87-print')?.remove()});

/* --- Recordatorio por WhatsApp: sin precios, con el paquete que corresponde según el plan --- */
sendMaintenanceReminder=function(){
  const M=r86Modelo(),items=selectedPlanData(),c=client(M.v.client)||{};if(!items.length)return toast('Selecciona al menos un servicio.');
  const g={};items.forEach(x=>(g[x.colKm]??={date:x.colDate,list:[]}).list.push(x));
  const col=km=>M.fut.find(f=>f.km===+km),mes=d=>d?' (aprox. '+new Date(d+'T12:00:00').toLocaleDateString('es-PE',{month:'long',year:'numeric'})+')':'';
  const cuerpo=Object.entries(g).sort((a,b)=>a[0]-b[0]).map(([km,v])=>{const f=col(km),nom=f?R86_NOMF[f.clave]+(f.tags.length?' con afinamiento':''):'Servicio del plan';
    return `\n${nom}, a los ${(+km).toLocaleString('es-PE')} km${mes(v.date)}, el cual contiene:\n`+[...new Set(v.list.map(x=>x.name))].map(n=>'• '+n).join('\n')}).join('\n');
  const msg=`Hola @Nombre 👋\n\nLe saludamos de parte de R Motriz. Pasábamos por aquí para recordarle que, según el plan de mantenimiento preventivo de su vehículo ${M.v.plate}, le corresponde el(los) siguiente(s) servicio(s):\n${cuerpo}\n\n¿Desea que le armemos una cotización? Estaremos atentos a su respuesta 😊`;
  const envio=msg.replace('@Nombre',(c.name||'').split(' ')[0]||'');
  modal(`<div class="r87-rec"><h2>Recordatorio preparado</h2><textarea class="wide" rows="17" aria-label="Mensaje">${esc(msg)}</textarea><footer>${c.phone?button('Abrir WhatsApp',`window.open('https://wa.me/${String(c.phone).replace(/\D/g,'')}?text='+encodeURIComponent(${JSON.stringify(envio)}),'_blank')`,true):''}${button('Agregar a cotización','closeModal();r73TlToQuote()')}${button('Cerrar','closeModal()')}</footer></div>`);
};
