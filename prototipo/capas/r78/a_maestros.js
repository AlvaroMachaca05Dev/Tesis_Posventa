/* --------------------------------------------------------------------------
   R7.8 · Clientes y vehículos (decisiones del 28/10/2026: DEC-69 y DEC-70)
   - Cliente: tipo de documento (DNI, Carné de extranjería, RUC), número de documento
     que no se repite, razón social o nombre, nombre comercial, país con prefijo,
     móvil sin prefijo, dirección fiscal, correo, ubigeo, comentario y fecha de registro.
   - «Clientes varios» (documento 0000): admite vehículos sin titular conocido.
   - Vehículo: la placa se compara sin guiones, espacios ni mayúsculas; si ya existe
     se avisa quién es el titular. Se agrega «Comentarios» y la fecha de registro.
   - El cliente del vehículo se busca por documento o por nombre.
   -------------------------------------------------------------------------- */
const R78={cur:null};
const R78_PAISES=[['PE','Perú','+51'],['AR','Argentina','+54'],['BO','Bolivia','+591'],['BR','Brasil','+55'],['CL','Chile','+56'],['CO','Colombia','+57'],['EC','Ecuador','+593'],['ES','España','+34'],['US','Estados Unidos','+1'],['MX','México','+52'],['PY','Paraguay','+595'],['UY','Uruguay','+598'],['VE','Venezuela','+58']];
const R78_TIPOS=[['DNI','DNI'],['CARNET_EXTRANJERIA','Carné de extranjería'],['RUC','RUC']];
const r78Pref=c=>(R78_PAISES.find(p=>p[0]===(c||'PE'))||R78_PAISES[0])[2];
const r78Norm=p=>String(p||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const r78TipoCorto=t=>t==='CARNET_EXTRANJERIA'||t==='Carné de extranjería'||t==='Carnet de extranjería'?'CE':(t||'DNI');
const r78Fecha=iso=>iso?new Date(iso).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'}):'—';

/* Datos: el cliente sin documento del prototipo pasa a ser «Clientes varios» (documento 0000). */
function r78Migrate(){let ch=false;
  db.clients.forEach(c=>{
    if(c.docType==='Carnet de extranjería'||c.docType==='Carné de extranjería'){c.docType='CARNET_EXTRANJERIA';ch=true}
    if(!c.country){c.country='PE';ch=true}
  });
  let v=db.clients.find(c=>c.generic||String(c.doc)==='0000');
  if(!v){const sin=db.clients.find(c=>!c.doc&&/Titular de/.test(c.name||''));
    if(sin){Object.assign(sin,{name:'Clientes varios',doc:'0000',docType:'DNI',generic:true,comment:'Titular de DEM-679: el prototipo no informa el nombre.'});ch=true}
    else{db.clients.push({id:uid(),name:'Clientes varios',doc:'0000',docType:'DNI',country:'PE',generic:true,credit:'Sin historial'});ch=true}}
  else if(!v.generic){v.generic=true;ch=true}
  if(ch){try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}}}
r78Migrate();

/* Se recuerda qué se está editando para excluirlo de las comprobaciones de duplicados. */
const r78EditClientB=editClient;
editClient=function(id){R78.cur={kind:'client',id:id||null};r78EditClientB(id);r78Maestro()};
const r78EditVehicleB=editVehicle;
editVehicle=function(id){R78.cur={kind:'vehicle',id:id||null};r78EditVehicleB(id);try{r78VehicleUi(id)}catch(e){console.warn('r78',e)}r78Maestro()};

const r78FormB=form;
form=function(title,fields,fn){
  if(/^(Nuevo|Editar) cliente$/.test(title)&&R78.cur?.kind==='client')return r78ClientForm(title,fields,fn);
  if(/^(Nuevo|Editar) vehículo$/.test(title)&&R78.cur?.kind==='vehicle')return r78VehicleForm(title,fields,fn);
  return r78FormB(title,fields,fn)};

function r78ClientForm(title,fields,fn){const id=R78.cur.id,c=id?client(id):{};
  /* tipo de documento: solo DNI, Carné de extranjería y RUC */
  fields=fields.replace(/<label>Tipo de documento<select name="docType">[\s\S]*?<\/select><\/label>/,select('docType','Tipo de documento',R78_TIPOS,c.docType||'DNI'));
  fields+=field('tradeName','Nombre comercial',c.tradeName||'')
    +select('country','País',R78_PAISES.map(p=>[p[0],p[1]+' ('+p[2]+')']),c.country||'PE')
    +field('fiscalAddress','Dirección fiscal',c.fiscalAddress||'')
    +field('ubigeo','Ubigeo',c.ubigeo||'')
    +field('comment','Comentario',c.comment||'','textarea','rows="2"')
    +(id?`<label>Fecha de registro<input value="${esc(r78Fecha(c.createdAt))} (no se puede editar)" disabled></label>`:'');
  const wrap=d=>{
    d.doc=String(d.doc||'').trim();if(!d.doc)throw Error('Escribe el número de documento.');
    const dup=db.clients.find(x=>!x.deleted&&x.id!==id&&String(x.doc).trim().toLowerCase()===d.doc.toLowerCase());
    if(dup)throw Error('Ese documento ya existe en el sistema ('+dup.name+').');
    if(c.generic&&d.doc!==c.doc)throw Error('«Clientes varios» no puede cambiar de documento.');
    const ph=String(d.phone||'').replace(/[\s-]/g,'');d.phone=ph;
    if(ph&&!/^\d+$/.test(ph))throw Error('El móvil solo lleva números, sin el prefijo del país.');
    if(ph&&(d.country||'PE')==='PE'&&ph.length!==9)throw Error('El móvil de Perú lleva 9 dígitos.');
    if(ph&&(d.country||'PE')!=='PE'&&(ph.length<6||ph.length>15))throw Error('El móvil debe tener entre 6 y 15 dígitos.');
    if(id)delete d.createdAt;else d.createdAt=new Date().toISOString();
    return fn(d)};
  r78FormB(title,fields,wrap);
  /* el prefijo del país aparece junto al móvil y cambia al elegir otro país */
  const f=$('editor');if(!f)return;const ph=f.querySelector('[name=phone]'),co=f.querySelector('[name=country]');
  if(ph){ph.placeholder='Sin prefijo';ph.insertAdjacentHTML('beforebegin',`<span class="r78-pref" id="r78pref">${r78Pref(co?.value)}</span>`);ph.parentElement.classList.add('r78-movil')}
  if(co)co.addEventListener('change',()=>{const p=document.getElementById('r78pref');if(p)p.textContent=r78Pref(co.value)});
  if(c.generic){const d=f.querySelector('[name=doc]'),t=f.querySelector('[name=docType]');if(d)d.disabled=true;if(t)t.disabled=true;
    f.querySelector('.formgrid')?.insertAdjacentHTML('beforeend','<p class="sub" style="grid-column:1/-1">«Clientes varios» sirve para registrar vehículos sin los datos del titular. Cuando los tengas, edita el vehículo y elige al cliente real.</p>')}}

function r78VehicleForm(title,fields,fn){const id=R78.cur.id,v=id?vehicle(id):{};
  fields+=field('remarks','Comentarios',v.remarks||'','textarea','rows="2"')
    +(id?`<label>Fecha de registro<input value="${esc(r78Fecha(v.createdAt))} (no se puede editar)" disabled></label>`:'');
  const wrap=d=>{
    const n=r78Norm(d.plate);if(!n)throw Error('Escribe la placa.');
    const dup=db.vehicles.find(x=>!x.deleted&&x.id!==id&&r78Norm(x.plate)===n);
    if(dup){const t=client(dup.client);throw Error('La placa '+dup.plate+' ya existe y pertenece a '+(t.name||'sin cliente')+' (documento '+(t.doc||'—')+').')}
    if(id)delete d.createdAt;else d.createdAt=new Date().toISOString();
    return fn(d)};
  r78FormB(title,fields,wrap)}

/* Cliente del vehículo: se busca por documento o por nombre y se ve a quién está enlazado. */
function r78VehicleUi(id){const f=$('editor');if(!f)return;const sel=f.querySelector('[name=client]');if(!sel||f.querySelector('.r78-find'))return;
  sel.closest('label').insertAdjacentHTML('beforebegin',`<label class="r78-find" style="grid-column:1/-1">Buscar cliente por documento o nombre<input type="search" placeholder="Escribe para filtrar la lista de clientes" oninput="r78FilterClients(this)"></label>`);
  const note=document.createElement('small');note.className='sub r78-link';sel.closest('label').appendChild(note);
  const show=()=>{const c=client(sel.value);note.textContent=c?.id?'Cliente elegido: '+(c.doc||'sin documento')+' · '+c.name:''};sel.addEventListener('change',show);show();
  if(id)sel.closest('label').insertAdjacentHTML('beforeend','<small class="sub">Para traspasar el vehículo a otro titular, elige otro cliente.</small>')}
function r78FilterClients(inp){const q=String(inp.value||'').toLowerCase().trim(),sel=inp.closest('form').querySelector('[name=client]');if(!sel)return;
  [...sel.options].forEach(o=>{o.hidden=!!q&&!o.text.toLowerCase().includes(q)});
  const cur=sel.selectedOptions[0];
  if(q&&(!cur||cur.hidden)){const first=[...sel.options].find(o=>!o.hidden);if(first){sel.value=first.value;sel.dispatchEvent(new Event('change'))}}}

/* «Clientes varios» no se puede eliminar. */
const r78DeleteClientB=deleteClient;
deleteClient=function(id){const c=client(id);if(c?.generic)return toast('«Clientes varios» no se puede eliminar.');r78DeleteClientB(id)};

/* Listas: campos nuevos y fecha de registro. */
views.clientes=()=>heading('Clientes','Se enlazan por identificador interno: puedes corregir el documento o el nombre sin perder sus vehículos. El documento no se repite. Baja recuperable.',button('+ Cliente','editClient()',true))
  +`<label class="r72-inl"><input type="checkbox" ${showDeleted?'checked':''} onchange="showDeleted=this.checked;render()">Mostrar eliminados</label><div class="panel space">${table(['Acciones','Documento','Cliente','Nombre comercial','Móvil','Estado crediticio','Vehículos','Saldo por cobrar','Registro','Estado'],db.clients.filter(c=>showDeleted||!c.deleted).map(c=>{const s=r73Docs('cobrar').filter(d=>d.party===c.id).reduce((a,d)=>a+d.saldo,0);
    return[r73Act(r73Btn('edit','Editar',`editClient('${c.id}')`),c.generic?'':r73Btn(c.deleted?'↺':'del',c.deleted?'Restaurar':'Eliminar',`deleteClient('${c.id}')`,c.deleted?'':'r73-red'),r73Btn('◇','Vehículos',`clientVehicles('${c.id}')`),s?r73Btn('$','Cuenta por cobrar',`r73Account('cobrar','${c.id}')`):''),
      esc(r78TipoCorto(c.docType)+' '+(c.doc||'—')),`<b>${esc(c.name)}</b>`,esc(c.tradeName||'—'),c.phone?esc(r78Pref(c.country)+' '+c.phone):'—',`<span class="pill">${esc(c.credit||(s?'Con deuda':'Sin historial'))}</span>`,db.vehicles.filter(v=>v.client===c.id&&!v.deleted).length,money(s),esc(r78Fecha(c.createdAt)),c.deleted?'<span class="pill red">Eliminado</span>':'<span class="pill green">Activo</span>']}))}</div>`;
views.vehiculos=()=>heading('Vehículos','La placa no se repite (se compara sin guiones ni mayúsculas). Grupo y plan se asignan por reglas. Puedes corregir la placa o traspasar el vehículo sin perder su historial.',button('+ Vehículo','editVehicle()',true))
  +`<div class="panel">${table(['Acciones','Placa','Marca','Modelo','Año','Color','Titular','Grupo','Plan','Última consulta de km','ODS','Registro'],db.vehicles.filter(v=>!v.deleted).map(v=>{const r=(v.kmReads||[]).at(-1),t=client(v.client);
    return[r73Act(r73Btn('edit','Editar / traspasar',`editVehicle('${v.id}')`),r73Btn('del','Eliminar',`r73DelVehicle('${v.id}')`,'r73-red'),r73Btn('⏱','Registrar consulta de km',`r74KmConsult('${v.id}')`),r73Btn('↗','Línea temporal',`timelineVehicle='${v.id}';simKm=null;go('timeline')`)),
      `<b>${esc(v.plate)}</b>`,esc(v.brand),esc(v.model),esc(v.year),esc(v.color||'—'),`${esc(t.name||'—')}<br><small class="sub">${esc(r78TipoCorto(t.docType))} ${esc(t.doc||'—')}</small>`,
      v.group?`<span class="pill">${esc(v.group)}</span>`:'<span class="pill orange">Sin grupo</span>',v.plan?`<span class="pill">${esc(v.plan)}</span>`:'<span class="pill orange">Sin plan</span>',r?`${r.km.toLocaleString('es-PE')} km · ${esc(r.date)} ${esc(r.time||'')}`:'—',db.orders.filter(o=>o.vehicle===v.id).length,esc(r78Fecha(v.createdAt))]}))}</div>`;
/* 28/10: crear y editar cliente o vehículo en un modal centrado, casi cuadrado, de dos columnas (igual que localhost) */
const r78ModalB=modal;
modal=function(html){$('modal').classList.remove('r78-maestro');return r78ModalB(html)};
function r78Maestro(){const m=$('modal');if(m?.open){m.classList.remove('r78-ancho','r78-chico');m.classList.add('r78-maestro')}}
