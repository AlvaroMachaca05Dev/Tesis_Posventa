/* --------------------------------------------------------------------------
   R8.7 · Vista genérica (ajustes) y formulario de vehículo como en localhost
   - Genérica: Guardar, cotización y tarea avisan que no hay vehículo; «＋» crea el vehículo con el combustible, uso, aceite y km simulados.
   - Consulta de km: fecha y hora de la captura, km actual, último cambio de aceite y cuándo fue (lista estandarizada o fecha exacta).
   - Vehículo: número de motor (detecta familia, código y grupo; la cajera no crea familias), combustible, grupo, uso y tipo de aceite.
   -------------------------------------------------------------------------- */
/* Familias de motor de muestra (en el sistema real se mantienen desde la vista del responsable del sistema). */
const R87_FAMILIAS=[['Kappa 1.2','G4LA','G2','GAS'],['Kappa 1.4','G4LC','G2','GAS'],['Gamma 1.6','G4FC','G3','GAS'],['Gamma 1.6 D','G4FG','G3','GAS'],['Epsilon 1.1','G4HG','G1','GAS'],['Toyota NZ 1.5','1NZ','G2','GAS'],['Toyota KD 3.0','1KD','G4','DIE'],['Toyota KD 2.5','2KD','G4','DIE'],['Hyundai D4CB 2.5','D4CB','G4','DIE'],['Mitsubishi 4D56','4D56','G4','DIE']];
function r87Familia(nro){const s=String(nro||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!s)return null;const f=R87_FAMILIAS.filter(([,c])=>s.startsWith(c)).sort((a,b)=>b[1].length-a[1].length)[0];return f?{familia:f[0],codigo:f[1],grupo:f[2],fuel:f[3]}:null}
/* --- cuándo fue el último cambio de aceite: lista estandarizada (por mes, con unas pocas opciones cercanas) --- */
const R87_CUANDO=[['','No recuerda'],['semana0','Esta semana'],['semana1','La semana pasada'],['sem23','Hace 2 o 3 semanas'],['mes1','El mes pasado'],['m2','Hace 2 meses'],['m3','Hace 3 meses o más'],['exacta','Fecha exacta']];
function r87FechaCuando(op,exacta,base){
  const h=new Date((base||today())+'T12:00:00'),d=new Date(h),dia=n=>{d.setDate(d.getDate()-n)},mes=(m,di)=>{d.setDate(1);d.setMonth(d.getMonth()-m);d.setDate(di)};
  if(op==='semana0')dia(3);else if(op==='semana1')dia(9);else if(op==='sem23')dia(17);else if(op==='mes1')mes(1,15);else if(op==='m2')mes(2,15);else if(op==='m3')mes(3,15);else if(op==='exacta')return exacta||null;else return null;
  const iso=d.toISOString().slice(0,10),tope=base||today();return iso>tope?tope:iso;
}
r87ConsultaGen=function(){
  form('Consulta de kilometraje',field('captura','Fecha de la consulta',R87.g.captura||today(),'date',`required max="${today()}"`)+field('km','Kilometraje actual',R87.g.km??'','number','min="0" step="1" required')+field('aceite','Último cambio de aceite (km)',R87.g.aceite??'','number','min="0" step="1"')+
    select('cuando','¿Cuándo fue el último cambio de aceite?',R87_CUANDO,R87.g.cuando||'')+field('exacta','Fecha exacta (si la sabe)',R87.g.cuando==='exacta'?R87.g.fechaAc||'':'','date',`max="${today()}" oninput="if(this.value)this.form.querySelector('[name=cuando]').value='exacta'"`),d=>{
    const km=+d.km,ac=d.aceite===''?null:+d.aceite;
    if(!(km>=0))throw Error('Escribe el kilometraje actual.');
    if(ac!=null&&ac>km)throw Error('El último cambio de aceite no puede ser mayor que el kilometraje actual.');
    if(d.cuando==='exacta'&&!d.exacta)throw Error('Escribe la fecha exacta o elige otra opción.');
    if(!d.captura||d.captura>today())throw Error('La fecha de la consulta no puede ser futura.');
    if(d.exacta&&d.exacta>d.captura)throw Error('El cambio de aceite no puede ser posterior a la consulta.');
    Object.assign(R87.g,{km,aceite:ac,cuando:d.cuando||'',captura:d.captura,fechaAc:r87FechaCuando(d.cuando,d.exacta,d.captura)});R86.sel.clear();closeModal();render();
  });
};
/* el modelo genérico usa la fecha del último cambio de aceite si se indicó */
const r87ModeloGenBase=r87ModeloGen;
r87ModeloGen=function(){
  if(!R87.g.fechaAc)return r87ModeloGenBase();
  const M=r87ModeloGenBase(),p=M.p,limite=(new Date(today()+'T12:00:00').getFullYear()+2)+'-12-31',kmAc=M.ult.km,f=R87.g.fechaAc,v=M.v,kmAct=R87.g.km??0;
  M.ult.date=f;M.tr[0].desde.date=f;
  M.fut=r87Visitas(p,{rate:0,aceite0:{km:kmAc,date:f},pos0:Math.round(kmAc/p.km)%p.sec.length,limite}).map(x=>{const vencido=x.km<=kmAct||x.date<today();return {fk:'f'+x.k,k:x.k,clave:x.clave,nombre:R87_NOMBRE[x.clave],tags:x.af?['+ Afinamiento']:[],lines:r87Lineas(v,x),km:x.km,date:x.date,vencido,porVencer:!vencido&&(x.km-kmAct<=r87Ventana(p)||r87Dias(today(),x.date)<=5),hito:x.k}});
  return M;
};
/* en la genérica no hay vehículo: Guardar, cotización y tarea solo avisan */
const r87SinVeh=()=>toast('No hay ningún vehículo asignado para guardar esto: elige uno en el buscador o créalo con ＋.');
r87GuardarGen=r87SinVeh;
const r87VistaGenBase=r87VistaGen;
r87VistaGen=function(){
  let h=r87VistaGenBase();
  h=h.replace('<button type="button" class="primary r87-guardar" onclick="r87GuardarGen()">Guardar</button>','<button type="button" data-r87b="2" onclick="r87SinVeh()">＋ Agregar a<br>cotización</button><button type="button" data-r87b="2" onclick="r87SinVeh()">Crear tarea<br>de contacto</button>');
  if(R87.g.km!=null){const c=R87.g.cuando,t=R87.g.fechaAc?`${esc(r86Fmt(R87.g.fechaAc))}${c&&c!=='exacta'?' · estimada':''}${c==='m3'?' · por confirmar':''}`:(R87.g.aceite!=null?'sin fecha de aceite':'');h=h.replace(/(Último cambio de aceite:<\/span><b>[^<]*<\/b><small>)[^<]*/,`$1${t}`)}
  return h;
};
/* «＋» desde la genérica: el vehículo nuevo toma el combustible, uso, aceite y km simulados, y la línea pasa a él */
const r87NuevoBase=r86NuevoVeh;
r86NuevoVeh=function(){R87.desdeGen=R87.gen?{...R87.g}:null;r87NuevoBase()};
const r87TlGen2=views.timeline;
views.timeline=()=>{
  if(R86.nv!=null&&db.vehicles.length>R86.nv){
    const v=db.vehicles.at(-1),g=R87.desdeGen;
    if(g){if(!v.fuel)v.fuel=g.fuel;if(!v.use)v.use=g.use;if(!v.oil)v.oil=g.oil;if(g.km!=null&&!v.km)v.km=g.km;if(g.km!=null){const M=(R87.gen=true,r87ModeloGen());v.r87aceite={km:M.ult.km,date:M.ult.date}}db.r87.base[v.id]={cod:r87Info(v).cod,por:r87Quien(),at:today()}}
    R87.gen=false;R87.desdeGen=null;r87Persistir();
  }
  return r87TlGen2();
};
/* --- formulario de vehículo como en localhost: número de motor con detección, combustible, grupo, uso y tipo de aceite --- */
const r87EditVeh2=editVehicle;
editVehicle=function(id){
  r87EditVeh2(id);
  try{
    const f=document.getElementById('editor');if(!f||f.dataset.r87v)return;f.dataset.r87v='1';
    const v=id?vehicle(id):{},g=!id&&R87.desdeGen?R87.desdeGen:null,grid=f.querySelector('.formgrid')||f;
    const motor=f.querySelector('[name=engine]')?.closest('label');
    /* el grupo y el plan anteriores se reemplazan: el grupo sale del número de motor (o a mano) y el plan, del combustible, uso y aceite */
    f.querySelectorAll('[name=group]:not([data-r87]),[name=plan]').forEach(e=>{const l=e.closest('label');if(l)l.style.display='none';e.disabled=true});
    const grupos=(db.r74groups||[]).filter(x=>x.active!==false);
    const sel=(name,label,opts,val)=>`<label>${label}<select name="${name}" data-r87="1">${opts.map(([a,b])=>`<option value="${a}" ${String(val??'')===String(a)?'selected':''}>${b}</option>`).join('')}</select></label>`;
    const html=`<label>Número de motor<input name="nroMotor" data-r87="1" value="${esc(v.nroMotor||v.serial||'')}" oninput="r87PrevMotor(this)" autocomplete="off"><small class="r87-mot" aria-live="polite"></small></label>`+
      sel('fuel','Combustible',[['','Sin definir'],['GAS','Gasolina'],['DIE','Diésel']],v.fuel||g?.fuel||'')+
      sel('group','Grupo',[['','Automático']].concat(grupos.map(x=>[x.id,x.name||x.code||x.id])),v.groupManual?v.group:'')+
      (f.querySelector('[name=oil]')?'':sel('oil','Tipo de aceite',[['','Sin definir'],['Mineral','Mineral'],['Semisintético','Semisintético'],['Sintético','Sintético'],['Full sintético','Full sintético']],v.oil||g?.oil||''));
    if(motor){motor.insertAdjacentHTML('beforebegin',html);motor.style.display='none'}else grid.insertAdjacentHTML('beforeend',html);
    if(g){const u=f.querySelector('[name=use]');if(u)u.value=g.use;const o=f.querySelector('[name=oil]');if(o&&!o.value)o.value=g.oil}
    r87PrevMotor(f.querySelector('[name=nroMotor]'));
    f.addEventListener('submit',()=>{
      const val=k=>f.querySelector(`[name=${k}]`)?.value??'',det=r87Familia(val('nroMotor')),plate=val('plate');
      const datos={nroMotor:val('nroMotor').trim(),fuel:val('fuel')||det?.fuel||'',engine:det?.codigo||v.engine||'',familia:det?.familia||null,oil:val('oil')};
      const grp=val('group');
      setTimeout(()=>{const x=id?vehicle(id):db.vehicles.slice().reverse().find(y=>String(y.plate).toUpperCase()===String(plate).toUpperCase());if(!x)return;Object.assign(x,datos);if(grp){x.group=grp;x.groupManual=true}else if(det){const gg=grupos.find(z=>String(z.code||z.name||'').toUpperCase().includes(det.grupo));if(gg&&!x.groupManual)x.group=gg.id}r87Persistir();render()},0);
    },true);
  }catch(e){console.warn('r87 form vehículo',e)}
};
function r87PrevMotor(inp){
  const out=inp?.closest('label')?.querySelector('.r87-mot');if(!out)return;const d=r87Familia(inp.value);
  out.textContent=!inp.value.trim()?'':d?`Familia ${d.familia} · código ${d.codigo} · grupo ${d.grupo} · ${d.fuel==='DIE'?'diésel':'gasolina'}`:'Sin familia detectada: avisa al responsable del sistema.';
  const fu=inp.form?.querySelector('[name=fuel]');if(d&&fu&&!fu.value)fu.value=d.fuel;
}
/* --- vencido y por vencer (DEC-119): vencida = su km o su fecha ya pasó; la primera no vencida siempre es «por vencer» (con lo que falta);
   si lo vencido abarca un ciclo completo, el vehículo queda «fuera de plan» y se sugiere la revisión completa --- */
const r87ModeloVenc=r86Modelo;
r86Modelo=function(){
  const M=r87ModeloVenc();if(!M?.fut)return M;
  const hoy=today();
  M.fut.forEach(c=>{c.vencido=c.km<=M.cur||c.date<hoy;c.porVencer=false;c.falta=null});
  const pv=M.fut.find(c=>!c.vencido);
  if(pv){pv.porVencer=true;const km=pv.km-M.cur,dias=Math.max(0,Math.round(r87Dias(hoy,pv.date)));pv.falta=km<=dias*(M.p?M.p.km/(M.p.meses*30.4375):30)?`faltan ${r84Km(km)} km`:`faltan ${dias} días`}
  M.fueraPlan=!!M.p&&M.fut.filter(c=>c.vencido).length>=M.p.sec.length;
  return M;
};
const r87CabVenc=r86Cab;
r86Cab=function(M,c,i){const h=r87CabVenc(M,c,i);return c.porVencer&&c.falta?h.replace('<span class="r87-pv">por vencer</span>',`<span class="r87-pv">por vencer</span><small>${c.falta}</small>`):h};
const r87MatrizVenc=r86Matriz;
r86Matriz=function(M){const h=r87MatrizVenc(M);return M.fueraPlan?`<p class="r87-fuera" role="status"><b>Fuera de plan:</b> lo vencido supera un ciclo completo; se sugiere la revisión completa.</p>`+h:h};
/* buscador de vehículo: al abrirlo, la primera opción es «Vista genérica (sin vehículo)» para volver a ella */
const r87VBuscarBase=r86VBuscar;
r86VBuscar=function(q){
  r87VBuscarBase(q);
  const l=document.getElementById('r86-vl');if(!l)return;
  l.querySelector('em')?.remove();
  l.insertAdjacentHTML('afterbegin',`<button type="button" class="r87-gen-op" onmousedown="r87IrGenerica()"><b>Vista genérica</b> <small>sin seleccionar vehículo</small></button>`);
  l.hidden=false;
};
r86VTecla=function(e){if(e.key==='Enter'){e.preventDefault();const b=document.querySelector('#r86-vl button:not(.r87-gen-op)')||document.querySelector('#r86-vl .r87-gen-op');if(b)b.dispatchEvent(new MouseEvent('mousedown'))}};
/* nota de una ODS: solo lectura (se actualiza editando la ODS); visita = express, menor o mayor, con afinamiento si la ODS lo trae */
const R87_AFI_N=new Set(R84_AFI.flatMap(a=>a.l.map(l=>l.n)));
function r87VisitaOds(o){const paq=db.r86.paq[o.id]&&db.r86.paq[o.id]!=='REV'&&db.r86.paq[o.id]!=='NINGUNA'?db.r86.paq[o.id]:r86Inferir([o]);if(!paq||paq==='REV')return {paq:null,txt:'Ninguna'};const af=(paq==='MEN'||paq==='MAY')&&o.lines.some(l=>l.type==='servicio'&&[...R87_AFI_N].some(n=>r86Igual(n,l.name)));return {paq,txt:R86_NOMF[paq]+(af?' + afinamiento':'')}}
function r87NotaOds(){
  const N=R86.nota,M=r86Modelo(),col=r86Cols(M).find(c=>c.fk===N.fk);if(!col){r86CerrarNota();return}
  const o=col.orders.find(x=>x.id===N.oid)||col.orders[0],vis=r87VisitaOds(o),esp=vis.paq?r86Lineas(vis.paq):[],hecho=r86Hecho(o,esp);
  let el=document.getElementById('r86-nota');if(!el){el=document.createElement('div');el.id='r86-nota';el.className='r86-nota';el.setAttribute('role','dialog');document.body.appendChild(el)}
  el.style.left=Math.max(8,N.x)+'px';el.style.top=Math.max(8,N.y)+'px';setTimeout(()=>r86Ajustar(el));
  el.innerHTML=`<header><div><b>ODS #${esc(o.code)}</b><small>${esc(r87Fd(o))}${o.km!=null?' · '+r84Km(o.km)+' km':''}</small></div><button type="button" aria-label="Cerrar" onclick="r86CerrarNota()">✕</button></header>
  <div class="r86-sec">Visita del plan: <b>${esc(vis.txt)}</b></div>
  <div class="r86-sec"><b>Servicios de la ODS</b><ul class="r86-ul">${o.lines.filter(l=>l.type==='servicio').map(l=>`<li>${esc(l.name)}</li>`).join('')||'<li class="muted">Sin servicios</li>'}</ul></div>
  ${esp.length?`<div class="r86-sec"><b>Servicios del plan que sí se cumplieron</b> <span class="muted">${hecho.size}/${esp.length}</span><ul class="r86-ul">${esp.map(e=>`<li class="${hecho.has(e.n)?'r86-ok':'r86-no'}">${hecho.has(e.n)?'✓':'○'} ${esc(e.n)}</li>`).join('')}</ul></div>`:''}
  <footer><button type="button" onclick="r86CerrarNota();openOrder('${o.id}')">Ver ODS</button></footer>`;
}
const r87PintarOds=r86PintarNota;
r86PintarNota=function(){if(R86.nota?.tipo==='ods'&&document.querySelector('.r86-tl')){r87NotaOds();return}r87PintarOds()};
/* selector de vehículo como lista desplegable: «Vista genérica» primero y los vehículos en orden alfabético por placa (unos 4 visibles, el resto con la barra) */
r86VBuscar=function(q){
  const l=document.getElementById('r86-vl');if(!l)return;const t=normal(q);
  const L=db.vehicles.filter(x=>!x.deleted&&(!t||normal([x.plate,x.brand,x.model,x.vin,client(x.client).name].join(' ')).includes(t))).sort((a,b)=>String(a.plate).localeCompare(String(b.plate))).slice(0,100);
  l.innerHTML=`<button type="button" class="r87-gen-op" onmousedown="r87IrGenerica()"><b>Vista genérica</b><small>sin seleccionar vehículo</small></button>`+
    (L.map(x=>`<button type="button" onmousedown="r86ElegirVeh('${x.id}')"><b>${esc([x.brand,x.model].filter(Boolean).join(' '))}${x.brand||x.model?', ':''}${esc(x.plate)}</b><small>${esc(client(x.client).name||'')}${x.vin?' · VIN: '+esc(x.vin):''}</small></button>`).join('')||'<em>Sin resultados. Usa ＋ para crear el vehículo.</em>');
  l.hidden=false;
};
/* Historial: oculto en la vista genérica; en detalle, dos celdas fijas (categoría y nombre) en lugar de una que ocupa dos columnas */
const r87MatrizHist=r86Matriz;
r86Matriz=function(M){
  let h=r87MatrizHist(M);
  if(M.gen)return h.replace(/<tr class="r86-hist">[\s\S]*?<\/tr>/,'');
  return h.replace('<td class="r86-k" colspan="2"><b>Historial</b>','<td class="r86-cc"></td><td class="r86-k"><b>Historial</b>');
};
