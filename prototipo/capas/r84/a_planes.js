/* --------------------------------------------------------------------------
   R8.4 · Planes preventivos y línea temporal con el modelo del sistema
   - Cuatro planes (combustible × uso). La cajera solo elige esas dos cosas.
   - Cada plan es un ciclo de visitas (express, menor, mayor) con el afinamiento
     y la revisión completa dentro del ciclo; cada visita se despliega para ver
     los servicios que incluye (con su tiempo, sin precios).
   - El catálogo recibe los servicios con precio y horas del grupo G1.
   - La línea temporal proyecta las visitas del plan del vehículo desde su
     último registro, con el historial de ODS y las marcas de afinamiento y
     revisión completa.
   -------------------------------------------------------------------------- */
const R84={sel:null,veh:null};
const R84_COMB={GAS:'Gasolina',DIE:'Diésel'},R84_USO={P:'Normal',S:'Severo'};
function r84Combustible(v){return /^(d4|4d5|d-?4|1kd|2kd|d4cb|4d56)/i.test(v.engine||'')||/hilux|h-?1|l200|ranger|d-?max|frontier/i.test(v.model||'')?'DIE':'GAS'}
function r84Sembrar(){
  if(db.r84&&db.r84.v===1)return;
  db.r84={v:1,planes:R84_PLANES.map(p=>({...structuredClone(p),id:'P84-'+p.codigo,activo:true}))};
  const cods=new Set(db.catalog.map(c=>c.code));
  R84_SERVICIOS.forEach(s=>{if(!cods.has(s.c))db.catalog.push({id:uid(),code:s.c,name:s.n,type:'servicio',hours:s.h,cost:null,price:s.p,notes:s.t+' · '+s.k})});
  db.vehicles.forEach(v=>{if(!v.fuel)v.fuel=r84Combustible(v)});
  try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}
}
const r84Km=n=>Number(n).toLocaleString('es-PE');
const r84Meses=n=>n+(n===1?' mes':' meses');
const r84PlanDe=v=>{r84Sembrar();return db.r84.planes.find(p=>p.activo&&p.comb===(v.fuel||r84Combustible(v))&&p.uso===(v.use==='S'?'S':'P'))||null};
/* Proyección de n visitas: la revisión completa reemplaza a la primera visita que le corresponde desde su mes; el afinamiento se suma a la primera visita menor o mayor desde el suyo. */
function r84Proyeccion(p,n){
  const c=p.ciclo,out=[];let sigRev=c.rev.meses,sigAf=c.afin?c.afin.meses:Infinity;
  for(let i=0;i<n;i++){
    const mes=c.meses*(i+1),km=c.km*(i+1);let clave=c.sec[i%c.sec.length];const etiquetas=[];
    if(mes>=sigRev&&clave===c.rev.reemplaza){etiquetas.push('Revisión completa en lugar de esta visita');sigRev+=c.rev.meses}
    if(c.afin&&mes>=sigAf&&c.afin.con.includes(clave)){etiquetas.push('+ Afinamiento');sigAf+=c.afin.meses}
    out.push({n:i+1,clave,mes,km,etiquetas,rev:etiquetas.some(e=>e.startsWith('Revisión'))});
  }
  return out;
}
function r84Lista(clave,rev){
  const p=R84_PAQ[rev?'REV':clave];
  return `<ul class="r84-lista">${p.l.map(x=>`<li>${esc(x.n)} <span class="muted">· ${x.h} h</span></li>`).join('')}</ul>`;
}
function r84Visita(v,p){
  const nombre=R84_PAQ[v.clave].n;
  return `<details class="r84-visita"><summary><span class="r84-num">${v.n}</span><b>${esc(nombre)}</b>${v.etiquetas.map(e=>`<span class="pill">${esc(e)}</span>`).join('')}<span class="r84-cuando">${r84Km(v.km)} km o ${r84Meses(v.mes)}</span></summary>${r84Lista(v.clave,v.rev)}${v.etiquetas.includes('+ Afinamiento')?r84Afi():''}</details>`;
}
function r84Afi(){return R84_AFI.map(a=>`<div class="r84-sub"><b>${esc(a.t)}</b><ul class="r84-lista">${a.l.map(x=>`<li>${esc(x.n)} <span class="muted">· ${x.h} h</span></li>`).join('')}</ul></div>`).join('')}
function r84Extra(letra,titulo,detalle,cuando,cuerpo){
  return `<details class="r84-visita r84-extra"><summary><span class="r84-num">${letra}</span><b>${esc(titulo)}</b><span class="muted">· ${esc(detalle)}</span><span class="r84-cuando">${esc(cuando)}</span></summary>${cuerpo}</details>`;
}
function r84Reglas(p){
  const c=p.ciclo,paq=k=>R84_PAQ[k].n;
  return `<div class="r84-reglas"><h3>Reglas del plan</h3><ul><li><b>Intervalo:</b> cada ${r84Km(c.km)} km o ${r84Meses(c.meses)}, lo que ocurra primero.</li><li><b>Afinamiento:</b> ${c.afin?`cada ${r84Km(c.afin.km)} km o ${r84Meses(c.afin.meses)}, con ${c.afin.con.map(paq).join(' o ')}.`:'no lleva.'}</li><li><b>Revisión completa:</b> cada ${r84Meses(c.rev.meses)}, en lugar de ${paq(c.rev.reemplaza)}.</li></ul><p class="muted">${esc(c.resumen)}</p></div>`;
}
function r84Sel(id){R84.sel=id;render()}
function r84Cuerpo(p){
  const c=p.ciclo,proy=r84Proyeccion(p,c.sec.length);
  return `<div class="r84-ciclo"><div><h2>Ciclo del plan</h2><div class="r84-visitas">${proy.map(v=>r84Visita(v,p)).join('')}
  ${c.afin?r84Extra('A','Afinamiento',`se hace con ${c.afin.con.map(k=>R84_PAQ[k].n).join(' o ')}`,`cada ${r84Km(c.afin.km)} km o ${r84Meses(c.afin.meses)}`,r84Afi()):''}
  ${r84Extra('R','Revisión completa',`en lugar de ${R84_PAQ[c.rev.reemplaza].n}`,`cada ${r84Meses(c.rev.meses)}`,r84Lista('REV',true))}
  <div class="r84-repite">↻ Luego el ciclo se repite desde la visita 1 (${c.sec.length} visitas, ${r84Meses(c.meses*c.sec.length)})</div></div></div>${r84Reglas(p)}</div>`;
}
views.planes=()=>{
  r84Sembrar();const ps=db.r84.planes;if(!ps.find(p=>p.id===R84.sel))R84.sel=ps[0]?.id;const p=ps.find(x=>x.id===R84.sel);
  const usados=p?db.vehicles.filter(v=>r84PlanDe(v)?.id===p.id).length:0;
  return heading('Planes preventivos','',p?button('Modificar plan',`r84Editar('${p.id}')`)+button('Modificar reglas',`r84EditarReglas('${p.id}')`)+button('Duplicar',`r84Duplicar('${p.id}')`)+button('Eliminar',`r84PedirBorrar('${p.id}')`):'')+
  `<div class="tabs r84-tabs">${ps.map(x=>`<button type="button" class="${x.id===R84.sel?'selected':''}${x.activo?'':' r84-off'}" onclick="r84Sel('${x.id}')">${esc(x.nombre)}</button>`).join('')}</div>`+
  (p?`<div class="panel r84-cab"><span><b>Combustible</b> ${R84_COMB[p.comb]}</span><span><b>Uso</b> ${R84_USO[p.uso]}</span><span><b>Visita</b> ${r84Km(p.ciclo.km)} km o ${r84Meses(p.ciclo.meses)}</span><span><b>Afinamiento</b> ${p.ciclo.afin?'cada '+r84Km(p.ciclo.afin.km)+' km':'no lleva'}</span><span><b>Revisión completa</b> cada ${r84Meses(p.ciclo.rev.meses)}</span><span><b>Vehículos</b> ${usados}</span><span class="pill ${p.activo?'green':'gray'}">${p.activo?'Activo':'Inactivo'}</span></div>${r84Cuerpo(p)}`:'<div class="panel empty">No hay planes.</div>');
};
function r84Editar(id){const p=db.r84.planes.find(x=>x.id===id);
  form('Editar plan',field('nombre','Nombre',p.nombre,'text','required maxlength="80"')+select('activo','Estado',[['1','Activo'],['0','Inactivo']],p.activo?'1':'0'),d=>{p.nombre=d.nombre.trim()||p.nombre;p.activo=d.activo==='1';save('Plan preventivo',p.nombre)})}
function r84EditarReglas(id){const p=db.r84.planes.find(x=>x.id===id),c=p.ciclo,paq=Object.keys(R84_PAQ).filter(k=>['EXP','MEN','MAY'].includes(k));
  form('Editar reglas · '+p.nombre,field('km','Visita cada (km)',c.km,'number','min="1000" step="500" required')+field('meses','o cada (meses)',c.meses,'number','min="1" max="24" required')+
    field('sec','Secuencia de visitas (EXP, MEN, MAY separados por coma)',c.sec.join(', '),'text','required')+
    (p.comb==='GAS'?field('afkm','Afinamiento cada (km)',c.afin?.km??15000,'number','min="1000"')+field('afm','Afinamiento cada (meses)',c.afin?.meses??12,'number','min="1"'):'')+
    field('rm','Revisión completa cada (meses)',c.rev.meses,'number','min="1" required')+select('rr','Reemplaza a',paq.map(k=>[k,R84_PAQ[k].n]),c.rev.reemplaza),
    d=>{const sec=d.sec.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);if(!sec.length||sec.some(x=>!paq.includes(x)))return toast('La secuencia usa solo EXP, MEN y MAY.');
      Object.assign(c,{km:+d.km,meses:+d.meses,sec,rev:{meses:+d.rm,reemplaza:d.rr}});if(p.comb==='GAS')c.afin={km:+d.afkm,meses:+d.afm,con:c.afin?.con||['MEN','MAY']};save('Reglas del plan',p.nombre)})}
function r84Duplicar(id){const p=db.r84.planes.find(x=>x.id===id),n=structuredClone(p);n.id='P84-'+uid();n.codigo=p.codigo.replace(/-COPIA\d*$/,'')+'-COPIA';n.nombre=p.nombre.replace(/ \(copia\)$/,'')+' (copia)';n.activo=true;db.r84.planes.push(n);R84.sel=n.id;save('Plan duplicado',p.nombre)}
function r84PedirBorrar(id){const p=db.r84.planes.find(x=>x.id===id),usa=db.vehicles.filter(v=>r84PlanDe(v)?.id===id).length;
  if(usa)return modal(`<h2>No se puede eliminar</h2><p>El plan «${esc(p.nombre)}» lo usan ${usa} vehículo(s). Duplícalo y edita la copia, o desactívalo.</p><footer>${button('Cerrar','closeModal()',true)}</footer>`);
  modal(`<h2>¿Eliminar este plan?</h2><p>Se eliminará «${esc(p.nombre)}».</p><footer>${button('Cancelar','closeModal()')}${button('Eliminar',`r84Borrar('${id}')`,true)}</footer>`)}
function r84Borrar(id){db.r84.planes=db.r84.planes.filter(x=>x.id!==id);R84.sel=null;closeModal();save('Plan eliminado',id)}

/* ------------------------------- Línea temporal ------------------------------- */
function r84Fecha(base,meses){const d=new Date(base+'T12:00:00');d.setMonth(d.getMonth()+meses);return d.toISOString().slice(0,10)}
const r84TlAnterior=views.timeline;
views.timeline=()=>{
  r84Sembrar();
  const v=vehicle(R84.veh&&db.vehicles.find(x=>x.id===R84.veh)?R84.veh:db.vehicles[0].id);R84.veh=v.id;
  const p=r84PlanDe(v),hist=historyFor(v).filter(o=>o.km!=null),ult=hist.at(-1),kmBase=ult?ult.km:v.km||0,fechaBase=ult?ult.date:today();
  const proy=p?r84Proyeccion(p,Math.max(12,p.ciclo.sec.length*2)):[];
  const filtro=`<div class="filterbar"><label>Vehículo<select onchange="R84.veh=this.value;render()">${db.vehicles.map(x=>`<option value="${x.id}" ${x.id===v.id?'selected':''}>${esc(x.plate+' · '+x.model)}</option>`).join('')}</select></label><label>Combustible<select onchange="vehicle('${v.id}').fuel=this.value;save('Combustible del vehículo','${v.id}')">${Object.entries(R84_COMB).map(([k,t])=>`<option value="${k}" ${(v.fuel||r84Combustible(v))===k?'selected':''}>${t}</option>`).join('')}</select></label><label>Uso<select onchange="vehicle('${v.id}').use=this.value;save('Uso del vehículo','${v.id}')">${Object.entries(R84_USO).map(([k,t])=>`<option value="${k}" ${(v.use==='S'?'S':'P')===k?'selected':''}>${t}</option>`).join('')}</select></label></div>`;
  const hito=(o)=>`<div class="r84-hito r84-real"><span class="r84-num">✓</span><div><b>ODS #${esc(o.code)}</b><div class="sub">${esc(o.date)} · ${r84Km(o.km)} km</div></div><button type="button" onclick="openOrder('${o.id}')">Ver</button></div>`;
  const futuro=proy.map(x=>{const km=kmBase+x.km,fecha=r84Fecha(fechaBase,x.mes);
    return `<div class="r84-hito"><details class="r84-visita"><summary><span class="r84-num">${x.n}</span><b>${esc(R84_PAQ[x.clave].n)}</b>${x.etiquetas.map(e=>`<span class="pill">${esc(e)}</span>`).join('')}<span class="r84-cuando">${r84Km(km)} km · ${fecha.slice(0,7)}</span></summary>${r84Lista(x.clave,x.rev)}${x.etiquetas.includes('+ Afinamiento')?r84Afi():''}</details></div>`}).join('');
  return heading('Línea temporal','Visitas del plan proyectadas desde el último registro',button('Imprimir / PDF','window.print()'))+filtro+
  `<div class="panel"><div class="row spread"><div><span class="pill">${esc(v.plate)}</span><h2 class="space">${esc(v.brand)} ${esc(v.model)}</h2><div class="sub">${p?esc(p.nombre):'Sin plan para esta combinación'}</div></div><div><b>${r84Km(kmBase)} km</b><div class="sub">${ult?'Último registro: '+esc(ult.date):'Último kilometraje del vehículo'}</div></div></div>
  ${p?`<p class="banner">Proyección ilustrativa: cada visita cuenta desde el último registro (cada ${r84Km(p.ciclo.km)} km o ${r84Meses(p.ciclo.meses)}). Los ciclos reales se reajustan con cada ODS cerrada.</p>`:''}
  <div class="r84-linea">${hist.length?'<h3>Historial</h3>'+hist.map(hito).join(''):''}<h3>Próximas visitas</h3>${futuro||'<div class="empty">No hay plan para este combustible y uso.</div>'}</div></div>${p?`<div class="panel space">${r84Reglas(p)}</div>`:''}`;
};
