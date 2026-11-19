/* --------------------------------------------------------------------------
   R8.3 · Planes preventivos por combustible y uso
   - Dos plantillas (gasolina y diésel), cada una en uso particular y uso severo.
   - Cada línea pertenece a una categoría y a un tipo de visita: express, menor,
     mayor, afinamiento o por kilometraje.
   - Las categorías se pliegan; «Ver todos» muestra también las líneas que no
     corresponden a la selección, para poder agregarlas a mano.
   -------------------------------------------------------------------------- */
const R83={plan:'GAS',uso:'P',visita:0,dist:'',caja:'',trac:'',cerradas:new Set(),todos:new Set()};
const R83_CATS=['Motor y lubricación','Filtros','Sistema de encendido (afinamiento de motor)','Refrigeración y clima','Frenos','Embrague y transmisión','Tracción','Distribución y correas','Suspensión y dirección','Neumáticos','Eléctrico y visibilidad'];
const R83_TIPOS={EXP:'Express',MEN:'Menor',MAY:'Mayor',AF:'Afinamiento',KM:'Por km'};
const R83_PLANES={GAS:'Gasolina',DIE:'Diésel'};
const R83_USOS={P:'Normal',S:'Severo'};
const R83_COD={dist:{cadena:'CA',correa:'CO'},caja:{mecanica:'ME',automatica:'AU'},trac:{'4x2':'2','4x4':'4'}};
function r83Codigo(){return ['PMP',R83.plan[0],R83_COD.dist[R83.dist]||'··',R83_COD.caja[R83.caja]||'··',R83_COD.trac[R83.trac]||'·',R83.uso==='P'?'N':'S'].join('-')}
/* c: categoría · n: línea · t: tipo de visita · f: combustible (G, D o vacío) · km: [gasolina, diésel] · q: requisito del vehículo */
const R83_SEMILLA_LINEAS=[
 [0,'Cambio de aceite y filtro de motor','EXP'],
 [0,'Revisión de fugas (motor / refrigerante / caja)','MEN'],
 [0,'Revisión de soportes de motor','MAY'],
 [0,'Revisión de sistema de escape','MAY'],
 [0,'Cambio o revisión de ventilación y emisiones (filtros / válvulas)','KM','',[60000,null]],
 [1,'Cambio o revisión de filtro de aire','MEN'],
 [1,'Cambio o revisión de filtro de cabina','MEN'],
 [1,'Cambio o revisión de filtro de combustible (externo / sumergible)','KM','',[30000,60000]],
 [1,'Revisión de filtro de partículas (DPF)','KM','D',[null,null]],
 [2,'Cambio o revisión de bujías','KM','G',[30000,null]],
 [3,'Revisión de líquido refrigerante','EXP'],
 [3,'Cambio de líquido refrigerante','KM','',[60000,60000]],
 [3,'Revisión de mangueras (refrigeración / dirección / frenos)','MAY'],
 [3,'Revisión de aire acondicionado','KM','',[null,null]],
 [4,'Revisión de líquido de frenos','EXP'],
 [4,'Cambio de líquido de frenos','KM','',[30000,30000]],
 [4,'Revisión de pastillas','MEN'],
 [4,'Revisión de zapatas','MEN'],
 [4,'Revisión de discos','MEN'],
 [4,'Revisión de tambores','MEN'],
 [4,'Cambio o revisión de bomba de vacío (servofreno)','KM','',[null,180000]],
 [5,'Cambio o revisión de líquido de embrague','KM','',[30000,30000],{caja:['mecanica']}],
 [5,'Revisión de embrague','MAY','',null,{caja:['mecanica']}],
 [5,'Cambio o revisión de aceite de caja (mecánica / automática / CVT / DCT / AMT)','KM','',[60000,30000]],
 [5,'Cambio o revisión de filtro de caja (automática / CVT / DCT)','KM','',[30000,null],{caja:['automatica']}],
 [5,'Revisión de soportes de caja','MAY'],
 [6,'Cambio o revisión de aceite de diferencial (trasero / delantero)','KM','',[30000,30000],{trac:['4x4']}],
 [6,'Cambio o revisión de aceite de caja de transferencia','KM','',[90000,90000],{trac:['4x4']}],
 [6,'Cambio o revisión de aceite y filtro del acoplamiento Haldex','KM','G',[30000,null],{trac:['4x4']}],
 [6,'Revisión de palieres y capuchones','MAY'],
 [7,'Cambio o revisión de correa de distribución','KM','',[90000,150000],{dist:['correa']}],
 [7,'Cambio o revisión de tensor y rodillos de distribución','KM','',[90000,90000],{dist:['correa']}],
 [7,'Revisión de cadena de distribución','KM','',[120000,120000],{dist:['cadena']}],
 [7,'Cambio o revisión de correa de accesorios','KM','',[60000,60000]],
 [7,'Cambio o revisión de tensor y rodillos de accesorios','KM','',[120000,null]],
 [7,'Cambio o revisión de correas auxiliares (bomba de agua / eje equilibrador / bomba de inyección)','KM','',[90000,90000]],
 [8,'Revisión de amortiguadores','MAY'],
 [8,'Revisión de rótulas','MAY'],
 [8,'Revisión de bujes y trapecios','MAY'],
 [8,'Revisión de terminales y cremallera de dirección','MAY'],
 [8,'Revisión de fluido de dirección hidráulica','MAY'],
 [9,'Revisión de neumáticos (desgaste / presión / espárragos)','MEN'],
 [10,'Revisión de batería','EXP'],
 [10,'Revisión de líquido limpiaparabrisas','EXP'],
 [10,'Revisión de luces','MEN'],
 [10,'Escaneo de fallas','MAY'],
 [2,'Análisis de gases inicial y final','AF','G'],
 [2,'Limpieza de inyectores','AF','G'],
 [2,'Limpieza de sensores MAP y MAF','AF'],
 [2,'Limpieza de obturador','AF'],
 [2,'Revisión de bujías, cables y bobinas','AF','G'],
 [2,'Calibración de mariposa','AF','G'],
 [2,'Lectura de opacidad inicial y final','AF','D'],
 [2,'Limpieza de bomba de alta presión e inyectores','AF','D'],
 [2,'Revisión de catalizador','AF','D'],
 [2,'Programación de actuadores','AF','D'],
];
const R83_SEMILLA_VISITAS={EXP:{P:{k:5000,m:4},S:{k:5000,m:1}},MEN:{P:{k:15000,m:12},S:{k:10000,m:2}},MAY:{P:{k:30000,m:24},S:{k:30000,m:6}},AF:{P:{k:15000,m:12},S:{k:20000,m:4}}};
function r83Sembrar(){
  if(db.r83&&db.r83.v===2)return;
  db.r83={v:2,visitas:structuredClone(R83_SEMILLA_VISITAS),lineas:R83_SEMILLA_LINEAS.map((x,i)=>({id:'L'+String(i+1).padStart(2,'0'),c:x[0],n:x[1],t:x[2],f:x[3]||'',
    km:x[4]?{GAS:{P:x[4][0],S:x[4][0]},DIE:{P:x[4][1],S:x[4][1]}}:null,q:x[5]||null})),extra:{}};
  try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}
}
const r83Km=n=>n?Number(n).toLocaleString('es-PE'):'—';
function r83Intervalo(l){if(l.t==='KM')return {k:l.km?.[R83.plan]?.[R83.uso]??null,m:null};return db.r83.visitas[l.t][R83.uso]}
function r83Corresponde(l){
  if(l.f&&l.f!==R83.plan[0])return false;
  if(l.q){for(const [a,vals] of Object.entries(l.q)){if(R83[a]&&!vals.includes(R83[a]))return false}}
  return true;
}
function r83Toca(l){if(!R83.visita)return true;const k=r83Intervalo(l).k;return !!k&&R83.visita%k===0}
function r83Agregada(l){return !!db.r83.extra[R83.plan+R83.uso+l.id]}
function r83TipoVisita(km){const v=db.r83.visitas,u=R83.uso,may=km%v.MAY[u].k===0,men=km%v.MEN[u].k===0,af=km%v.AF[u].k===0;return (may?'Mayor':men?'Menor':'Express')+(af?' + afinamiento':'')}
function r83Set(campo,valor){R83[campo]=campo==='visita'?+valor:valor;render()}
function r83Cat(i){R83.cerradas.has(i)?R83.cerradas.delete(i):R83.cerradas.add(i);render()}
function r83Todos(i){R83.todos.has(i)?R83.todos.delete(i):R83.todos.add(i);R83.cerradas.delete(i);render()}
function r83Plegar(si){R83.cerradas=new Set(si?R83_CATS.map((_,i)=>i):[]);render()}
function r83VerTodo(si){R83.todos=new Set(si?R83_CATS.map((_,i)=>i):[]);if(si)R83.cerradas=new Set();render()}
function r83Extra(id){const k=R83.plan+R83.uso+id;if(db.r83.extra[k])delete db.r83.extra[k];else db.r83.extra[k]=true;save('Plan preventivo','Línea '+id+(db.r83.extra[k]?' agregada':' quitada')+' · '+R83_PLANES[R83.plan]+' '+R83_USOS[R83.uso])}
function r83Editar(id){const l=db.r83.lineas.find(x=>x.id===id);
  if(l.t!=='KM')return r83EditarVisita(l.t);
  const a=l.km||(l.km={GAS:{P:null,S:null},DIE:{P:null,S:null}}),p=a[R83.plan];
  form(l.n,field('pk','Normal: km',p.P??'','number','min="1000" step="1000"')+field('sk','Severo: km',p.S??'','number','min="1000" step="1000"'),d=>{p.P=d.pk?+d.pk:null;p.S=d.sk?+d.sk:null;save('Plan preventivo',l.n+' · '+R83_PLANES[R83.plan])})}
function r83EditarVisita(t){const v=db.r83.visitas[t];
  form('Visita '+R83_TIPOS[t].toLowerCase(),field('pk','Normal: km',v.P.k,'number','min="1000" step="1000" required')+field('pm','Normal: meses',v.P.m,'number','min="1" required')+field('sk','Severo: km',v.S.k,'number','min="1000" step="1000" required')+field('sm','Severo: meses',v.S.m,'number','min="1" required'),d=>{v.P={k:+d.pk,m:+d.pm};v.S={k:+d.sk,m:+d.sm};save('Plan preventivo','Visita '+R83_TIPOS[t])})}
const R83_COLS='<colgroup><col style="width:34px"><col><col style="width:150px"><col style="width:110px"><col style="width:80px"><col style="width:52px"></colgroup>';
function r83Sel(campo,opciones){return `<select class="r83-sel" onchange="r83Set('${campo}',this.value)">${opciones.map(([v,t])=>`<option value="${v}" ${String(R83[campo])===String(v)?'selected':''}>${t}</option>`).join('')}</select>`}
function r83Fila(l,ok){const iv=r83Intervalo(l),extra=r83Agregada(l);
  return `<tr class="${ok?'':'r83-no'}${extra?' r83-extra':''}"><td class="r83-chk">${ok?'':`<input type="checkbox" ${extra?'checked':''} onchange="r83Extra('${l.id}')" aria-label="Agregar">`}</td><td>${esc(l.n)}</td><td><span class="r83-tipo r83-${l.t}">${R83_TIPOS[l.t]}</span></td><td class="r83-num">${r83Km(iv.k)}</td><td class="r83-num">${iv.m??'—'}</td><td class="r83-act">${r73Btn('edit','Editar',`r83Editar('${l.id}')`)}</td></tr>`}
views.planes=()=>{r83Sembrar();
  const u=R83.uso,v=db.r83.visitas,paso=v.EXP[u].k,tope=v.MAY[u].k*2,kms=[];for(let k=paso;k<=tope;k+=paso)kms.push(k);
  const tira=kms.map(k=>`<button type="button" class="r83-vis${R83.visita===k?' on':''}" onclick="r83Set('visita',${R83.visita===k?0:k})"><b>${k/1000}</b><span>${r83TipoVisita(k)}</span></button>`).join('');
  let total=0;
  const cuerpo=R83_CATS.map((nombre,i)=>{
    const todas=db.r83.lineas.filter(l=>l.c===i),propias=todas.filter(l=>(r83Corresponde(l)&&r83Toca(l))||r83Agregada(l));
    const ver=R83.todos.has(i),lista=ver?todas:propias;total+=propias.length;
    if(!propias.length&&!ver)return '';
    const abierta=!R83.cerradas.has(i);
    return `<section class="r83-cat${propias.length?'':' r83-vacia'}"><header><button type="button" class="r83-plega" onclick="r83Cat(${i})" aria-expanded="${abierta}"><span class="r83-flecha">${abierta?'▾':'▸'}</span><b>${nombre}</b><span class="r83-cuenta">${propias.length} de ${todas.length}</span></button><button type="button" class="r83-ver${ver?' on':''}" onclick="r83Todos(${i})">${ver?'Solo los del plan':'Ver todos'}</button></header>${abierta&&lista.length?`<div class="tablewrap"><table class="r83-tabla">${R83_COLS}<tbody>${lista.map(l=>r83Fila(l,(r83Corresponde(l)&&r83Toca(l)))).join('')}</tbody></table></div>`:''}</section>`}).join('');
  return heading('Planes preventivos','',button('Desplegar todo','r83Plegar(false)')+button('Plegar todo','r83Plegar(true)')+button(R83.todos.size===R83_CATS.length?'Solo los del plan':'Ver todos','r83VerTodo('+(R83.todos.size!==R83_CATS.length)+')'))+
  `<div class="panel r83-barra"><div class="r83-seg">${Object.entries(R83_PLANES).map(([k,t])=>`<button type="button" class="${R83.plan===k?'on':''}" onclick="r83Set('plan','${k}')">${t}</button>`).join('')}</div><div class="r83-seg">${Object.entries(R83_USOS).map(([k,t])=>`<button type="button" class="${R83.uso===k?'on':''}" onclick="r83Set('uso','${k}')">${t}</button>`).join('')}</div>
  <label>Distribución${r83Sel('dist',[['','Todas'],['correa','Correa'],['cadena','Cadena']])}</label><label>Caja${r83Sel('caja',[['','Todas'],['mecanica','Mecánica'],['automatica','Automática o automatizada']])}</label><label>Tracción${r83Sel('trac',[['','Todas'],['4x2','4x2'],['4x4','4x4']])}</label><span class="r83-total"><span class="r83-cod">${r83Codigo()}</span>${total} servicios</span></div>
  <div class="panel r83-tirawrap"><div class="r83-tira">${tira}</div><div class="r83-visitas">${['EXP','MEN','MAY','AF'].map(t=>`<button type="button" class="r83-tipo r83-${t}" onclick="r83EditarVisita('${t}')">${R83_TIPOS[t]} · ${r83Km(v[t][u].k)} km / ${v[t][u].m} m</button>`).join('')}</div></div>
  <div class="r83-cats"><table class="r83-tabla r83-cab">${R83_COLS}<thead><tr><th></th><th>Servicio</th><th>Visita</th><th class="r83-num">Cada (km)</th><th class="r83-num">Meses</th><th></th></tr></thead></table>${cuerpo}</div>`;
};
