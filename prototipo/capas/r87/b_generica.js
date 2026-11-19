/* --------------------------------------------------------------------------
   R8.7 · Vista genérica de la línea de tiempo (antes de elegir un vehículo)
   - Combustible, uso y aceite eligen el plan; el ciclo arranca en 0 km (no hay historial).
   - «Consulta de km» simula el km actual y el último cambio de aceite: desde ahí se proyectan las visitas.
   - «Guardar» crea el vehículo con su placa (y, si se quiere, su cliente) y le asigna el plan.
   -------------------------------------------------------------------------- */
R87.gen=true;
R87.g={fuel:'GAS',use:'P',oil:'Semisintético',km:null,aceite:null};
const r87GenVeh=()=>({id:'gen',plate:'Vista genérica',brand:'',model:'',fuel:R87.g.fuel,use:R87.g.use,oil:R87.g.oil,client:null});
function r87ModeloGen(){
  r84Sembrar();r86Sembrar();r87Sembrar();
  const g=R87.g,v=r87GenVeh(),p=r87PlanDe(v),hoy=today();
  const kmAct=g.km??0,kmAc=g.aceite??(g.km!=null?Math.floor(kmAct/p.km)*p.km:0),L=p.sec.length,pos0=Math.round(kmAc/p.km)%L;
  const fechaAc=r86Fecha(hoy,-Math.max(0,kmAct-kmAc)/(p.km/p.meses));
  const ult={key:'gen',fk:'pgen',km:kmAc,date:fechaAc,paq:null,orders:[],esp:[],hecho:new Set()};
  const limite=(new Date(hoy+'T12:00:00').getFullYear()+2)+'-12-31';
  const fut=r87Visitas(p,{rate:0,aceite0:{km:kmAc,date:fechaAc},pos0,limite}).map(x=>{
    const vencido=g.km!=null&&x.km<=kmAct,porVencer=!vencido&&g.km!=null&&x.km-kmAct<=r87Ventana(p);
    return {fk:'f'+x.k,k:x.k,clave:x.clave,nombre:R87_NOMBRE[x.clave],tags:x.af?['+ Afinamiento']:[],lines:r87Lineas(v,x),km:x.km,date:x.date,vencido,porVencer,hito:x.k};
  });
  return {m:{v,hist:[],rate:0,estimate:kmAct,rateInfo:{pts:[]}},v,p:{...p,nombre:r87Nom(p)},paso:p.km,cur:kmAct,past:[],fut,ult,
    tr:[{cod:p.cod,ace:p.ace,desde:{km:kmAc,date:fechaAc},prov:false}],info:{cod:p.cod,prov:false},borrador:false,asignado:true,gen:true};
}
/* el modelo de la línea usa la vista genérica mientras no se elija un vehículo; un vehículo sin ODS usa su último cambio de aceite registrado */
const r87ModeloVeh=r86Modelo;
r86Modelo=function(){
  if(R87.gen)return r87ModeloGen();
  const M=r87ModeloVeh();
  if(!M.ult&&M.v.r87aceite&&M.p){
    const a=M.v.r87aceite,limite=(new Date(today()+'T12:00:00').getFullYear()+2)+'-12-31';
    M.ult={key:'ac',fk:'pac',km:a.km,date:a.date,paq:null};
    M.fut=r87Visitas(M.p,{rate:M.m.rate,aceite0:{km:a.km,date:a.date},pos0:Math.round(a.km/M.p.km)%M.p.sec.length,limite}).map(x=>{const vencido=x.km<=M.cur;return {fk:'f'+x.k,k:x.k,clave:x.clave,nombre:R87_NOMBRE[x.clave],tags:x.af?['+ Afinamiento']:[],lines:r87Lineas(M.v,x),km:x.km,date:x.date,vencido,porVencer:!vencido&&x.km-M.cur<=r87Ventana(M.p),hito:x.k}});
    M.tr=[{cod:M.info.cod,ace:M.info.cod.slice(-1),desde:{km:a.km,date:a.date},prov:M.info.prov}];
  }
  return M;
};
/* elegir un vehículo sale de la vista genérica */
const r87ElegirBase=r86ElegirVeh;
r86ElegirVeh=function(id){R87.gen=false;r87ElegirBase(id)};
function r87IrGenerica(){R87.gen=true;R86.sel.clear();render()}
function r87SetGen(k,v){R87.g[k]=v;R86.sel.clear();render()}
const r87Sel=(id,label,opts,val,fn)=>`<label>${label}<select aria-label="${label}" onchange="${fn}">${opts.map(([v,t])=>`<option value="${v}" ${String(val)===String(v)?'selected':''}>${t}</option>`).join('')}</select></label>`;
const r87VistaSel=()=>{const d=R73.tlMode==='detalle';return `<div class="seg r87-vista" role="group" aria-label="Vista"><button type="button" class="${d?'':'primary'}" onclick="R73.tlMode='compacto';render()">Comprimido</button><button type="button" class="${d?'primary':''}" onclick="R73.tlMode='detalle';render()">Detalle</button></div>`};
function r87BarraSel(extra){
  const n=r86Unicos().size;
  return `<span class="r87-sel"><b class="r87-cnt">${n} servicios<br>seleccionados</b><button type="button" data-r87b="2" class="primary" onclick="sendMaintenanceReminder()">Enviar recordatorio<br>por WhatsApp</button>${extra}</span>`;
}
/* consulta de km de la vista genérica: km actual y último cambio de aceite */
function r87ConsultaGen(){
  form('Consulta de kilometraje',field('km','Kilometraje actual',R87.g.km??'','number','min="0" step="1" required')+field('aceite','Último cambio de aceite (km)',R87.g.aceite??'','number','min="0" step="1"'),d=>{
    const km=+d.km,ac=d.aceite===''?null:+d.aceite;
    if(!(km>=0))throw Error('Escribe el kilometraje actual.');
    if(ac!=null&&ac>km)throw Error('El último cambio de aceite no puede ser mayor que el kilometraje actual.');
    R87.g.km=km;R87.g.aceite=ac;R86.sel.clear();closeModal();render();
  });
}
function r87LimpiarGen(){R87.g.km=null;R87.g.aceite=null;render()}
/* guardar la vista genérica como un vehículo (placa obligatoria, cliente opcional) */
function r87GuardarGen(){
  const M=r86Modelo();
  form('Guardar en un vehículo',field('placa','Placa','','text','required maxlength="10"')+field('marca','Marca','','text','maxlength="40"')+field('modelo','Modelo','','text','maxlength="40"')+
    select('cliente','Cliente',[['','Sin cliente'],['__nuevo','＋ Nuevo cliente']].concat(db.clients.filter(c=>!c.deleted).slice(0,200).map(c=>[c.id,c.name])),'')+field('nuevo','Nombre del cliente nuevo','','text','maxlength="80"')+
    `<p class="muted" style="grid-column:1/-1">Se agregará el plan ${esc(M.p.cod)} a este vehículo.</p>`,d=>{
    const placa=String(d.placa||'').trim().toUpperCase(),norm=x=>String(x||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
    if(!norm(placa))throw Error('Escribe la placa.');
    if(db.vehicles.some(v=>!v.deleted&&norm(v.plate)===norm(placa)))throw Error('Esa placa ya existe: elígela en el buscador.');
    let cliente=d.cliente||null;
    if(cliente==='__nuevo'){const nom=String(d.nuevo||'').trim();if(!nom)throw Error('Escribe el nombre del cliente nuevo.');const c={id:uid(),name:nom,doc:'',docType:'DNI',phone:'',email:'',country:'PE'};db.clients.push(c);cliente=c.id}
    const g=R87.g,kmAc=M.ult.km,v={id:uid(),client:cliente,plate:placa,brand:String(d.marca||'').trim(),model:String(d.modelo||'').trim(),year:'',vin:'',engine:'',serial:'',km:g.km??kmAc,use:g.use,oil:g.oil,fuel:g.fuel,r87aceite:{km:kmAc,date:M.ult.date},createdAt:new Date().toISOString()};
    db.vehicles.push(v);db.r87.base[v.id]={cod:M.p.cod,por:r87Quien(),at:today()};
    R87.gen=false;timelineVehicle=v.id;simKm=null;R86.sel.clear();closeModal();save('Vehículo guardado desde la línea temporal',placa);
  });
}
function r87VistaGen(){
  const M=r86Modelo(),g=R87.g,p=M.p,n=x=>x==null?'—':Math.round(x).toLocaleString('es-PE'),sig=M.fut.find(c=>!c.vencido)||M.fut[0];
  const c=(l,val,d)=>`<div class="r87-rc"><span>${l}:</span><b>${val}</b><small>${d||''}</small></div>`;
  const head=`<div class="r76-tlh"><h1>Línea temporal</h1><div class="r76-sbtn"><button type="button" class="r76-mini ${R87.resOculto?'':'on'}" aria-expanded="${!R87.resOculto}" onclick="R87.resOculto=!R87.resOculto;render()">${R87.resOculto?'▸':'▾'} Resumen</button><button type="button" class="r76-mini" onclick="r87ConsultaGen()">⏱ Consulta de km</button><button type="button" class="r76-mini" onclick="r73TlRules()">⚙ Reglas</button><button type="button" class="r76-mini" onclick="r87Imprimir()">Imprimir / PDF</button></div></div>`;
  const res=R87.resOculto?'':`<div class="r87-resumen">`+c('Último cambio de aceite',g.km!=null?n(M.ult.km)+' km':'—',g.aceite!=null?'según el cliente':g.km!=null?'estimado':'')+c('Km actual',g.km!=null?n(g.km)+' km':'—',g.km!=null?`simulado <button type="button" class="r76-mini" onclick="r87LimpiarGen()">Restablecer</button>`:'')+
    c('Plan',esc(p.cod),esc(p.nombre))+c('Visita',`${r84Km(p.km)} km o ${r84Meses(p.meses)}`,`${p.sec.length} visitas · ciclo de ${r84Meses(p.meses*p.sec.length)}`)+
    c('Combustible y uso',R87_COMB[r87Comb(M.v)]+' · '+R87_USO[r87Uso(M.v)],R87_ACE[p.ace])+c('Afinamiento',r87Afrec(p),'')+c('Horizonte',`${p.horizonte} ciclo${p.horizonte>1?'s':''}`,r84Meses(p.meses*p.sec.length*p.horizonte))+
    c('Próxima visita',sig?`${esc(sig.nombre)}${sig.tags.length?' + afinamiento':''}`:'—',sig?r84Km(sig.km)+' km · '+r86Fmt(sig.date)+' (est.)':'')+`</div>`;
  const barra=`<div class="filterbar">${r86BuscadorVeh({plate:'Vista genérica',brand:'',model:''})}`+
    r87Sel('comb','Combustible',[['GAS','Gasolina'],['DIE','Diésel']],g.fuel,"r87SetGen('fuel',this.value)")+
    r87Sel('uso','Uso',[['P','Particular'],['S','Profesional']],g.use,"r87SetGen('use',this.value)")+
    r87Sel('aceite','Aceite',[['Mineral','Mineral'],['Semisintético','Semisintético'],['Sintético','Sintético'],['Full sintético','Full sintético']],g.oil,"r87SetGen('oil',this.value)")+
    r87VistaSel()+`<button type="button" onclick="r86Pantalla()">${R86.pc?'Salir de pantalla completa':'Pantalla completa'}</button>`+
    r87BarraSel(`<button type="button" class="primary r87-guardar" onclick="r87GuardarGen()">Guardar</button>`)+`</div>`;
  const ley='<p class="r72-legend"><span class="r86-ok">✓</span> Hecho · ○ Pendiente · <span class="r86-venc">Vencido</span> · <span class="r87-pv">por vencer</span> · <i class="r86-lr"></i> última visita · <i class="r86-ly"></i> hoy</p>';
  setTimeout(()=>{document.querySelectorAll('input[data-ind="1"]').forEach(e=>e.indeterminate=true);r86PintarNota()});
  return head+res+`<div id="r86-pc" class="r86-pc ${R86.pc?'r86-fs':''} r87-gen">`+barra+ley+r86Matriz(M)+'</div>';
}
const r87TlVeh=views.timeline;
views.timeline=()=>{
  if(R87.gen)return r87VistaGen();
  let h=r87TlVeh();
  /* vista en lista, selección en dos filas y acceso a la vista genérica */
  h=h.replace(/<div class="seg">[\s\S]*?<\/div>/,r87VistaSel());
  h=h.replace(/<b>(\d+) servicios seleccionados<\/b>/,'<b class="r87-cnt">$1 servicios<br>seleccionados</b>');
  h=h.replace('<div class="r76-sbtn">','<div class="r76-sbtn"><button type="button" class="r76-mini" onclick="r87IrGenerica()">Vista genérica</button>');
  return h;
};
/* impresión de la vista genérica: sin datos de cliente */
const r87HtmlImpBase=r87HtmlImpresion;
r87HtmlImpresion=function(M){return r87HtmlImpBase(M).replace('>Vista genérica<','>Genérico<')};
