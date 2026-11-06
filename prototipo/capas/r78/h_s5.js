/* --------------------------------------------------------------------------
   R7.8 · Slice S5 (05/11/2026): solapamiento de servicios igual que el sistema.
   - Cada regla es Automática (se descuenta sola y se avisa) u Opcional (la alerta lo sugiere y la cajera decide).
   - El descuento va en soles redondos (múltiplo de 5): uno estándar y, si se quiere, uno por grupo del vehículo.
   - Una línea recibe un solo descuento (el mayor) y nunca más que su total. Las horas compartidas se siguen descontando.
   -------------------------------------------------------------------------- */
const S5_MODO={AUTOMATICO:'Automático',OPCIONAL:'Opcional'};
const s5Grupos=()=>(db.r74groups||[]).filter(g=>g.active!==false).map(g=>g.id);
function s5Monto(r,o){const v=db.vehicles.find(x=>x.id===o.vehicle),g=v?.group;const m=g&&r.montos&&r.montos[g]!=null&&r.montos[g]!==''?+r.montos[g]:+(r.monto??0);return isFinite(m)?m:0}
function s5Total(l){return Math.max(0,(+l.price||0)*((l.type==='servicio')?1:(+l.qty||1))-(+l.discount||0))}
/* después de detectar: monto de la regla y, si es automática, se aplica sola */
const s5ScanBase=r77SolScan;
/* una regla sin horas compartidas igual se detecta: se le da un ahorro mínimo que el redondeo deja en cero */
r77SolScan=function(){const S0=r77SolDb(),cero=S0.rules.filter(r=>!(+r.reduce>0));cero.forEach(r=>r.reduce=0.0001);let out=[];try{out=s5ScanBase()}finally{cero.forEach(r=>r.reduce=0)}try{const S=r77SolDb();let ch=false;
  db.orders.forEach(o=>{(o.solapes||[]).forEach(e=>{if(e.s5)return;const r=S.rules.find(x=>x.id===e.rule);if(!r)return;e.s5=true;ch=true;
    const b=o.lines.find(l=>l.id===e.bLine);const otro=(o.solapes||[]).filter(x=>x!==e&&x.bLine===e.bLine&&x.state==='aplicado').length;
    e.amount=e.suggest=Math.min(s5Monto(r,o),b?s5Total(b):0);e.modo=r.modo||'OPCIONAL';
    if(e.modo==='AUTOMATICO'&&b&&!otro&&e.amount>0&&e.state==='pendiente'){b.discount=r2((+b.discount||0)+e.amount);e.state='aplicado';e.applied=e.amount;r7Log(o.id,'Descuento por solapamiento',e.aName+' + '+e.bName+' · descuento '+money(e.amount)+' en «'+e.bName+'» (automático)')}})});
  if(ch){try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}}}catch(err){console.warn('s5 solape',err)}return out};
/* el monto de una opcional no pasa del de la regla */
r77SolAmt=function(oid,eid,v){const o=db.orders.find(x=>x.id===oid),e=o?.solapes?.find(x=>x.id===eid);if(!e)return;e.amount=Math.max(0,Math.min(+e.suggest||0,Math.round((+v||0)/5)*5))};
r77SolApply=function(oid,eid){const o=db.orders.find(x=>x.id===oid),e=o?.solapes?.find(x=>x.id===eid);if(!o||!e||(e.state!=='pendiente'&&e.state!=='mantenido'))return;const b=o.lines.find(l=>l.id===e.bLine);if(!b)return;const amt=Math.max(0,Math.min(+e.suggest||0,+e.amount||0));b.discount=r2((+b.discount||0)+amt);e.state='aplicado';e.applied=amt;r7Log(o.id,'Descuento por solapamiento',e.aName+' + '+e.bName+' · descuento '+money(amt)+' en «'+e.bName+'»');r72Commit('Descuento por solapamiento',o.code)};
/* alerta amarilla en la orden: texto de la regla y botones solo en las opcionales */
const s5OpenB=r72OpenOrder;
r72OpenOrder=function(id,...x){const out=s5OpenB(id,...x);try{const o=db.orders.find(y=>y.id===id),p=document.querySelector('#modalbody .r77-sol');if(!o||!p)return out;const S=r77SolDb(),lock=o.state==='Archivada'&&!o.editGrant;
  p.outerHTML=`<div class="r77-pane r77-sol s5-aviso">${o.solapes.map(e=>{const r=S.rules.find(z=>z.id===e.rule)||{},t=(r.alerta||'{a} y {b} comparten trabajo. '+(e.modo==='AUTOMATICO'?'Se descontó S/ {d}.':'Puedes descontar hasta S/ {d}.')).replace('{d}',e.suggest).replace('{a}',e.aName).replace('{b}',e.bName);
    const reactivar=`${button('Aplicar '+money(e.suggest),`r77SolAmt('${o.id}','${e.id}',${e.suggest});r77SolApply('${o.id}','${e.id}')`,true)}`;
    return `<div class="r77-solrow"><span>${esc(t)}</span><span>${e.state==='pendiente'&&!lock?`${button('Aplicar '+money(e.suggest),`r77SolAmt('${o.id}','${e.id}',${e.suggest});r77SolApply('${o.id}','${e.id}')`,true)}${button('Mantener montos',`r77SolKeep('${o.id}','${e.id}')`)}`:e.state==='mantenido'&&!lock?`<span class="pill">Montos mantenidos</span> ${reactivar}`:`<span class="pill ${e.state==='aplicado'?'green':''}">${e.state==='aplicado'?'Descuento '+money(e.applied):'Montos mantenidos'}</span>`}</span></div>`}).join('')}</div>`}catch(err){console.warn('s5 panel',err)}return out};
/* módulo «Solapamientos de servicios»: modo, descuento estándar y por grupo */
r77SolEdit=function(id){const S=r77SolDb(),r=id?S.rules.find(x=>x.id===id):{a:'',b:'',reduce:0,modo:'OPCIONAL',monto:10,montos:{},source:'',active:true},sv=db.catalog.filter(c=>c.type==='servicio'&&!c.deleted).map(c=>[c.code,c.code+' · '+c.name]),gs=s5Grupos();
  form(id?'Editar solapamiento':'Nuevo solapamiento',select('a','Servicio base (el que ya se hace)',sv,r.a)+select('b','Servicio que lleva el descuento',sv,r.b)+select('modo','Modo',Object.entries(S5_MODO),r.modo||'OPCIONAL')+field('monto','Descuento estándar (S/, múltiplo de 5)',r.monto??10,'number','min="0" step="5" required')+gs.map(g=>field('g_'+g,'Descuento en '+g+' (S/)',r.montos?.[g]??'','number','min="0" step="5"')).join('')+field('reduce','Horas compartidas (H-H)',r.reduce||0,'number','min="0" step="0.05"')+field('alerta','Texto de la alerta ({d} = monto)',r.alerta||'')+field('source','Fuente',r.source||'')+`<label class="r72-inl"><input type="checkbox" name="active" ${r.active!==false?'checked':''}> Activo</label>`,d=>{
    if(d.a===d.b)throw Error('Elige dos servicios distintos.');if(+d.monto%5)throw Error('El descuento va en soles redondos, múltiplo de 5.');const montos={};gs.forEach(g=>{if(d['g_'+g]!==''&&d['g_'+g]!=null){if(+d['g_'+g]%5)throw Error('El descuento de '+g+' debe ser múltiplo de 5.');montos[g]=+d['g_'+g]}});
    if(!id&&S.rules.some(x=>x.a===d.a&&x.b===d.b))throw Error('Ese par ya tiene una regla.');
    const o={a:d.a,b:d.b,modo:d.modo,monto:+d.monto,montos,reduce:+d.reduce||0,alerta:d.alerta,source:d.source,active:!!d.active,demo:false};if(id)Object.assign(r,o);else S.rules.push({id:uid(),codigo:'SOL-'+String(S.rules.length+1).padStart(2,'0'),...o});R73.lastText='Solapamiento guardado';save('Solapamiento guardado',d.a+' + '+d.b)})};
views.solapes=()=>{const S=r77SolDb(),nm=c=>{const x=r77SolCat(c);return x?x.code+' · '+x.name:c+' (no existe)'};S.rules.forEach((r,i)=>{r.codigo??='SOL-'+String(i+1).padStart(2,'0');r.modo??='OPCIONAL';r.monto??=10});
  return heading('Solapamientos de servicios','',button('+ Nuevo','r77SolEdit()',true))+`<div class="panel">${table(['Acciones','Código','Servicio base','Servicio con descuento','Modo','Descuento estándar','Descuento por grupo','Horas compartidas','Estado'],S.rules.map(r=>[r73Act(r73Btn('edit','Editar',`r77SolEdit('${r.id}')`),r73Btn('del','Eliminar',`r77SolDel('${r.id}')`,'r73-red')),esc(r.codigo),esc(nm(r.a)),esc(nm(r.b)),`<span class="pill ${r.modo==='AUTOMATICO'?'green':'s5-ambar'}">${S5_MODO[r.modo]}</span>`,money(r.monto),esc(Object.entries(r.montos||{}).map(([g,m])=>g+' '+money(m)).join(' · ')||'—'),r.reduce?r.reduce+' h':'—',`<span class="pill ${r.active!==false?'green':'red'}">${r.active!==false?'Activo':'Inactivo'}</span>`]))}</div>`};
