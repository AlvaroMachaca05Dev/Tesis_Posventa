/* --------------------------------------------------------------------------
   R8.5 · Propuestas para la vista comprimida de las líneas del plan
   Problema: cada visita (express, menor, mayor, revisión completa) lleva entre 5 y 38 líneas;
   la vista detallada de todas juntas es muy larga. Se prueban tres formas de verlas,
   todas horizontales y sin desplazamiento lateral a 1366 px (100 % de zoom):
     A · Matriz por categoría   filas = líneas, columnas = paquetes; las categorías se pliegan.
     B · Escalera               cada paquete muestra solo lo que AGREGA al anterior.
     C · Tarjetas por categoría cada categoría es una tarjeta con sus líneas y mini marcas por paquete.
   -------------------------------------------------------------------------- */
const R85={vista:'ciclo',prop:'A',abiertas:new Set()};
const R85_PAQ=[['EXP','Express'],['MEN','Menor'],['MAY','Mayor'],['AF','Afinamiento'],['REV','Rev. completa']];
const R85_CORTO={EXP:'E',MEN:'m',MAY:'M',AF:'A',REV:'R'};
const R85_CATS=[
 ['Motor y lubricación',/cambio de aceite y filtro de motor/i],
 ['Encendido y afinamiento',/buj[ií]a|bobina|chicote|inyector|obturador|presi[oó]n de bomba|carburador|iac/i],
 ['Embrague y caja',/embrague|aceite de caja|soportes de caja/i],
 ['Filtros',/filtro/i],
 ['Refrigeración y clima',/refrigerante|manguera|aire acondicionado/i],
 ['Frenos',/freno|pastilla|zapata|disco|tambor|vac[ií]o/i],
 ['Tracción y ejes',/palier|diferencial|capuchon/i],
 ['Distribución y correas',/distribuci[oó]n|correa/i],
 ['Suspensión y dirección',/amortiguador|r[oó]tula|buje|terminal|direcci[oó]n|trapecio|cremallera/i],
 ['Neumáticos',/neum[aá]tico/i],
 ['Eléctrico, escáner y pruebas',/bater[ií]a|limpiaparabrisas|luces|esc[aá]ner|escaneo|prueba de ruta/i],
 ['Motor y lubricación',/aceite|fugas|soportes de motor|escape|ventilaci[oó]n|motor/i],
];
const r85Cat=n=>(R85_CATS.find(([,re])=>re.test(n))||['Otros'])[0];
/* Líneas del plan: unión de lo que lleva cada paquete, con el tiempo y los paquetes que la incluyen. */
function r85Lineas(plan){
  const mapa=new Map();
  const poner=(clave,l)=>{const e=mapa.get(l.n)||{n:l.n,h:l.h,en:new Set(),c:r85Cat(l.n)};e.en.add(clave);mapa.set(l.n,e)};
  ['EXP','MEN','MAY','REV'].forEach(k=>R84_PAQ[k].l.forEach(l=>poner(k,l)));
  if(plan.ciclo.afin)R84_AFI.forEach(a=>a.l.forEach(l=>poner('AF',l)));
  return [...mapa.values()];
}
const r85Paquetes=plan=>R85_PAQ.filter(([k])=>k!=='AF'||plan.ciclo.afin);
function r85Horas(lineas,k){return Math.round(lineas.filter(l=>l.en.has(k)).reduce((a,l)=>a+l.h,0)*100)/100}
function r85Cabecera(plan,lineas){
  return r85Paquetes(plan).map(([k,t])=>`<div class="r85-ph"><b>${t}</b><span>${lineas.filter(l=>l.en.has(k)).length} líneas · ${r85Horas(lineas,k)} h</span></div>`).join('');
}
const r85Agrupar=lineas=>[...new Set(R85_CATS.map(([c])=>c).concat('Otros'))].map(c=>({c,l:lineas.filter(x=>x.c===c)})).filter(g=>g.l.length);
/* A · Matriz por categoría */
function r85A(plan,lineas){
  const ps=r85Paquetes(plan),cols=`grid-template-columns:minmax(0,1fr) repeat(${ps.length},84px)`;
  const grupos=r85Agrupar(lineas);
  return `<div class="r85-matriz"><div class="r85-fila r85-cab" style="${cols}"><span></span>${ps.map(([k,t])=>`<span class="r85-th"><b>${t}</b><small>${lineas.filter(l=>l.en.has(k)).length} · ${r85Horas(lineas,k)} h</small></span>`).join('')}</div>
  ${grupos.map(g=>{const abierta=R85.abiertas.has(g.c);
    return `<div class="r85-grupo"><button type="button" class="r85-fila r85-catfila" style="${cols}" onclick="r85Alternar('${g.c}')" aria-expanded="${abierta}"><span><i>${abierta?'▾':'▸'}</i> ${esc(g.c)} <small class="muted">(${g.l.length})</small></span>${ps.map(([k])=>`<span class="r85-n">${g.l.filter(l=>l.en.has(k)).length||'·'}</span>`).join('')}</button>
    ${abierta?g.l.map(l=>`<div class="r85-fila r85-linea" style="${cols}"><span>${esc(l.n)} <small class="muted">${l.h} h</small></span>${ps.map(([k])=>`<span class="r85-n">${l.en.has(k)?'●':''}</span>`).join('')}</div>`).join(''):''}</div>`}).join('')}</div>`;
}
/* B · Escalera: cada paquete solo con lo que agrega al anterior */
function r85B(plan,lineas){
  const orden=r85Paquetes(plan).map(([k])=>k).filter(k=>k!=='AF');
  const previo=[];
  const cols=orden.map((k,i)=>{
    const nuevas=lineas.filter(l=>l.en.has(k)&&!previo.some(p=>l.en.has(p)));
    const hereda=i?lineas.filter(l=>l.en.has(k)&&previo.some(p=>l.en.has(p))).length:0;
    previo.push(k);
    const t=R85_PAQ.find(x=>x[0]===k)[1];
    return `<div class="r85-col"><header><b>${t}</b><span>${lineas.filter(l=>l.en.has(k)).length} líneas · ${r85Horas(lineas,k)} h</span>${i?`<small class="muted">incluye lo anterior (${hereda}) y agrega ${nuevas.length}</small>`:'<small class="muted">base</small>'}</header>
      ${r85Agrupar(nuevas).map(g=>`<section><h4>${esc(g.c)}</h4><ul>${g.l.map(l=>`<li>${esc(l.n)} <small class="muted">${l.h} h</small></li>`).join('')}</ul></section>`).join('')||'<p class="muted">Sin líneas nuevas.</p>'}</div>`}).join('');
  const af=plan.ciclo.afin?`<div class="r85-col r85-af"><header><b>Afinamiento</b><span>${lineas.filter(l=>l.en.has('AF')).length} líneas · ${r85Horas(lineas,'AF')} h</span><small class="muted">se suma al menor o al mayor</small></header><ul>${lineas.filter(l=>l.en.has('AF')).map(l=>`<li>${esc(l.n)} <small class="muted">${l.h} h</small></li>`).join('')}</ul></div>`:'';
  return `<div class="r85-escalera">${cols}${af}</div>`;
}
/* C · Tarjetas por categoría */
function r85C(plan,lineas){
  const ps=r85Paquetes(plan);
  return `<div class="r85-tarjetas"><div class="r85-leyenda">${ps.map(([k,t])=>`<span><b>${R85_CORTO[k]}</b> ${t} · ${lineas.filter(l=>l.en.has(k)).length}</span>`).join('')}</div>
  <div class="r85-grid">${r85Agrupar(lineas).map(g=>`<article class="r85-card"><h4>${esc(g.c)} <small class="muted">${g.l.length}</small></h4>${g.l.map(l=>`<div class="r85-item"><span>${esc(l.n)}</span><span class="r85-marcas">${ps.map(([k])=>`<i class="${l.en.has(k)?'on':''}">${R85_CORTO[k]}</i>`).join('')}</span></div>`).join('')}</article>`).join('')}</div></div>`;
}
function r85Set(campo,valor){R85[campo]=valor;render()}
function r85Alternar(c){R85.abiertas.has(c)?R85.abiertas.delete(c):R85.abiertas.add(c);render()}
function r85Todas(si){R85.abiertas=si?new Set(R85_CATS.map(([c])=>c).concat('Otros')):new Set();render()}
const r85PlanesVista=views.planes;
views.planes=()=>{
  if(R85.vista==='ciclo')return r85PlanesVista().replace('<div class="tabs r84-tabs">',`<div class="tabs r85-vistas"><button type="button" class="selected">Ciclo del plan</button><button type="button" onclick="r85Set('vista','lineas')">Líneas del plan · propuestas</button></div><div class="tabs r84-tabs">`);
  r84Sembrar();const ps=db.r84.planes,p=ps.find(x=>x.id===R84.sel)||ps[0];R84.sel=p.id;const lineas=r85Lineas(p);
  const propuestas=[['A','A · Matriz por categoría'],['B','B · Escalera (solo lo nuevo)'],['C','C · Tarjetas por categoría']];
  const cuerpo=R85.prop==='A'?r85A(p,lineas):R85.prop==='B'?r85B(p,lineas):r85C(p,lineas);
  return heading('Planes preventivos','',R85.prop==='A'?button('Desplegar todo','r85Todas(true)')+button('Plegar todo','r85Todas(false)'):'')+
  `<div class="tabs r85-vistas"><button type="button" onclick="r85Set('vista','ciclo')">Ciclo del plan</button><button type="button" class="selected">Líneas del plan · propuestas</button></div>
  <div class="tabs r84-tabs">${ps.map(x=>`<button type="button" class="${x.id===p.id?'selected':''}" onclick="R84.sel='${x.id}';render()">${esc(x.nombre)}</button>`).join('')}</div>
  <div class="panel r85-barra"><b>Propuesta</b>${propuestas.map(([k,t])=>`<button type="button" class="${R85.prop===k?'primary':''}" onclick="r85Set('prop','${k}')">${t}</button>`).join('')}<span class="muted">${lineas.length} líneas distintas en ${r85Paquetes(p).length} paquetes · ${esc(p.nombre)}</span></div>
  <div class="panel r85-cuerpo">${cuerpo}</div>`;
};
