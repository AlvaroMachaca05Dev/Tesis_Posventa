/* --------------------------------------------------------------------------
   R7.8 · Reportes con un solo formato y Posventa en Métricas (05/11/2026).
   - Todos los reportes: filtros a la izquierda, gráfico a la derecha, tabla abajo (sin filtros por columna) y descarga.
   - Reportes: Ventas por ítems, Operaciones, Rentabilidades, IGV y detracciones, Técnicos y Garantías.
     «Ventas generales» se quita y «Posventa» pasa a Métricas, junto al NPS.
   - Rentabilidades: filtro por responsables (uno o varios) y por tipo: productos internos (cajera),
     productos externos (logístico), servicios internos (técnicos) y servicios externos («Servicios externos»).
   - Garantías: filtros por fechas, mes y técnico.
   -------------------------------------------------------------------------- */
const R78_REP=new Set(['rep_items','rep_ops','rep_rent','rep_igv','rep_tec','rep_gar']);
(function(){const rep=R75_NAV.find(n=>n.sec==='Reportes');if(rep)rep.items=rep.items.filter(i=>!['rep_post','rep_ventas'].includes(i));r75Rebuild();r75Nav()})();
/* ---------- clase de cada ítem: interno o externo ---------- */
const R78_CLASES=[['pi','Productos internos'],['pe','Productos externos'],['si','Servicios internos'],['se','Servicios externos']];
function r78Clase(l){const u=db.users.find(x=>x.id===(l.type==='servicio'?l.tech:l.logistic));if(l.type==='servicio')return r78EsExterno(u)?'se':'si';return u?.role==='Logístico'?'pe':'pi'}
const r78RespId=l=>(l.type==='servicio'?l.tech:l.logistic)||'';
function r78RentF(){const f=r75RentF();f.resp??=[];f.clases??=[];return f}
function r78Marca(k,v){const f=r78RentF(),a=f[k];f[k]=a.includes(v)?a.filter(x=>x!==v):[...a,v];render()}
/* Mismas filas que antes, más el responsable y la clase; respetan los filtros nuevos. */
r75RentRows=function(){const f=r78RentF(),rows=[];r72NoteRows().forEach(r=>{const o=r.o,d=f.tipoFiltro==='salida'?String(o.closed||'').slice(0,10):o.date;if(!r72InRange(d,f))return;
  (o.lines||[]).forEach(l=>{const cl=r78Clase(l),rid=r78RespId(l);if(f.clases.length&&!f.clases.includes(cl))return;if(f.resp.length&&!f.resp.includes(rid))return;
    const cat=db.catalog.find(c=>c.id===l.catalog||c.code===l.code),qty=l.type==='servicio'?(+l.hours||+l.qty||1):(+l.qty||0),cu=+l.cost||0,cost=r72LineCost(l)??0,sale=r72LineTotal(l)??0,gain=r2(sale-cost);
    rows.push([o.date,String(o.closed||'').slice(0,10)||'—',o.state,r.c.name||'—',r.v.plate||'—',o.code,r.n.code,l.type==='servicio'?'Servicio':'Producto',l.code||'—',cat?.category||(l.type==='servicio'?'Servicios':'—'),l.type==='servicio'?'—':(cat?.brand||'—'),l.name,money(cu),money(l.price),money(l.discount||0),money(0),qty,money(cost),money(sale),money(sale),money(gain),sale?(gain/sale*100).toFixed(2)+'%':'0.00%',db.users.find(u=>u.id===rid)?.name||'—',(R78_CLASES.find(x=>x[0]===cl)||[])[1]])})});return rows};
if(!R75_RENT_HEAD.includes('Responsable'))R75_RENT_HEAD.push('Responsable','Clase');
/* ---------- gráfico de barras simple (SVG) ---------- */
function r78Barras(datos,fmt=money){const max=Math.max(1,...datos.map(d=>Math.abs(+d[1]||0))),w=100/Math.max(1,datos.length);
  return `<svg class="r78-barras" viewBox="0 0 100 62" preserveAspectRatio="none" role="img">${datos.map((d,i)=>{const h=Math.abs(+d[1]||0)/max*44;return `<rect x="${i*w+w*.18}" y="${50-h}" width="${w*.64}" height="${h}" rx="1" fill="${(+d[1]||0)<0?'#ff7b72':'#3b82f6'}"><title>${esc(d[0])}: ${esc(fmt(+d[1]||0))}</title></rect>`}).join('')}</svg>
  <div class="r78-barras-et">${datos.map(d=>`<span><b>${esc(fmt(+d[1]||0))}</b>${esc(d[0])}</span>`).join('')}</div>`}
/* ---------- filtros extra de Rentabilidades y Garantías ---------- */
function r78RentFiltros(){const f=r78RentF(),g=(t,rol)=>{const us=db.users.filter(u=>u.active!==false&&(rol==='ext'?r78EsExterno(u):u.role===rol&&!r78EsExterno(u)));return us.length?`<fieldset class="r78-chks"><legend>${t}</legend>${us.map(u=>`<label class="r78-chk"><input type="checkbox" ${f.resp.includes(u.id)?'checked':''} onchange="r78Marca('resp','${u.id}')">${esc(u.name)}</label>`).join('')}</fieldset>`:''};
  return `<fieldset class="r78-chks"><legend>Tipo</legend>${R78_CLASES.map(([k,t])=>`<label class="r78-chk"><input type="checkbox" ${f.clases.includes(k)?'checked':''} onchange="r78Marca('clases','${k}')">${t}</label>`).join('')}</fieldset>${g('Cajeras','Cajera')}${g('Logísticos','Logístico')}${g('Técnicos','Técnico')}${g('Jefes de taller','Jefe de taller')}${g('Servicios externos','ext')}`}
function r78RentGrafico(){const rows=r75RentRows(),num=s=>parseFloat(String(s).replace(/[^\d.-]/g,''))||0;return R78_CLASES.map(([k,t])=>[t,r2(rows.filter(r=>r[23]===t).reduce((a,r)=>a+num(r[20]),0))])}
R78.gar??={desde:'',hasta:'',mes:'',tec:''};
function r78GarSet(k,v){R78.gar[k]=v;render()}
function r78GarFilas(){const f=R78.gar,rows=[];db.orders.filter(o=>!o.deleted&&o.warranty).forEach(o=>{const d=String(o.date||'');if(f.desde&&d<f.desde)return;if(f.hasta&&d>f.hasta)return;if(f.mes&&d.slice(0,7)!==f.mes)return;
  const org=db.orders.find(x=>x.id===o.warranty.from);(o.lines||[]).filter(l=>l.warranty).forEach(l=>{const ol=(org?.lines||[]).find(x=>x.id===l.warranty.line)||{},tecs=[ol.tech,org?.tech,l.tech,o.tech].filter(Boolean);if(f.tec&&!tecs.includes(f.tec))return;
    rows.push({mes:d.slice(0,7),c:[esc(d),esc(org?.code||o.warranty.fromCode),esc(o.code),esc(l.name),esc(l.type),esc(tech(ol.tech)||ol.technicianName||tech(org?.tech)||'—'),esc(tech(org?.tech)||org?.technicianName||'—'),esc(tech(l.tech)||tech(o.tech)||'—'),esc(tech(o.tech)||o.technicianName||'—'),esc(client(vehicle(o.vehicle).client).name||'—'),esc(vehicle(o.vehicle).plate||'')]})})});return rows}
const R78_GAR_HEAD=['Fecha','ODS de origen','ODS que atiende la garantía','Servicio / producto','Tipo','Responsable del ítem (origen)','Técnico de la ODS de origen','Responsable del ítem (garantía)','Técnico de la ODS de garantía','Cliente','Placa'];
views.rep_gar=()=>{const f=R78.gar,rows=r78GarFilas(),meses=[...new Set(rows.map(r=>r.mes))].sort(),tecs=db.users.filter(u=>['Técnico','Jefe de taller'].includes(u.role));
  return heading('Garantías','')+`<div class="r72-filters r78-garfil"><label class="r72-ig"><span>Desde</span><input type="date" value="${f.desde}" onchange="r78GarSet('desde',this.value)"></label><label class="r72-ig"><span>Hasta</span><input type="date" value="${f.hasta}" onchange="r78GarSet('hasta',this.value)"></label><label class="r72-ig"><span>Mes</span><input type="month" value="${f.mes}" onchange="r78GarSet('mes',this.value)"></label><label class="r72-ig"><span>Técnico</span><select onchange="r78GarSet('tec',this.value)">${r72Opt(tecs.map(u=>[u.id,u.name]),f.tec,'Todos')}</select></label></div>
  <div class="panel r72-chart r78-graf"><h3>Garantías por mes</h3>${meses.length?r78Barras(meses.map(m=>[m,rows.filter(r=>r.mes===m).length]),x=>String(x)):'<p class="sub">Sin garantías en este rango</p>'}</div>
  <div class="panel">${table(R78_GAR_HEAD,rows.map(r=>r.c))}</div>`};
/* ---------- formato único: se reordena la pantalla después de dibujarla ---------- */
function r78CsvTabla(nombre){const t=document.querySelector('.r78-rep-tabla table');if(!t)return toast('No hay tabla para descargar.');const fil=[...t.querySelectorAll('tr')].filter(r=>!r.classList.contains('r74-frow')).map(r=>[...r.children].map(c=>'"'+c.innerText.replace(/"/g,'""').trim()+'"').join(';'));
  r75Save(new Blob(['﻿'+fil.join('\r\n')],{type:'text/csv;charset=utf-8'}),nombre+'_'+today()+'.csv')}
function r78Reporte(){if(page==='inicio')document.querySelectorAll('.r78-posventa tr.r74-frow').forEach(r=>r.remove());if(!R78_REP.has(page))return;const v=document.querySelector('main')?.lastElementChild;if(!v||v.querySelector('.r78-rep'))return;
  v.querySelectorAll('tr.r74-frow').forEach(r=>r.remove());v.querySelectorAll('p.banner,.heading .muted').forEach(x=>x.remove());
  const rep=document.createElement('div');rep.className='r78-rep';const izq=document.createElement('div');izq.className='panel r78-rep-fil';izq.innerHTML='<h3>Filtros</h3>';const der=document.createElement('section');der.className='r78-rep-graf';const abajo=document.createElement('div');abajo.className='r78-rep-tabla';
  v.querySelectorAll('.r77-sedebar,.r72-filters,.r77-kf').forEach(x=>izq.appendChild(x));
  if(page==='rep_rent'){izq.insertAdjacentHTML('beforeend',r78RentFiltros());der.insertAdjacentHTML('beforeend',`<div class="panel r78-graf"><h3>Ganancia por tipo</h3>${r78Barras(r78RentGrafico())}</div>`)}
  if(page==='rep_igv'){const ns=db.notes.filter(n=>(!R77I.rf.from||String(n.date)>=R77I.rf.from)&&(!R77I.rf.to||String(n.date)<=R77I.rf.to));der.insertAdjacentHTML('beforeend',`<div class="panel r78-graf"><h3>IGV y detracciones</h3>${r78Barras([['Vendido',r2(ns.reduce((a,n)=>a+(+n.total||0),0))],['IGV',r2(ns.reduce((a,n)=>a+(+n.igvAmount||0),0))],['Detracciones',r2(ns.reduce((a,n)=>a+(n.detraction?.amount||0),0))]])}</div>`)}
  v.querySelectorAll('.r72-chart,.r78-graf,.r72-rent,.r77-cards,.r72-total').forEach(x=>{if(!der.contains(x))der.appendChild(x)});
  if(!izq.querySelector('.r72-dl,button[onclick*="Csv"],button[onclick*="Excel"]'))izq.insertAdjacentHTML('beforeend',`<button type="button" class="primary r72-dl" onclick="r78CsvTabla('${page}')">⭳ DESCARGAR</button>`);
  [...v.children].filter(x=>!x.classList.contains('heading')).forEach(x=>{if(x.querySelector('table')||x.matches('h3,.row.spread'))abajo.appendChild(x);else if(x.matches('.r72-report,.r72-rgrid,.r75-rfil,p.sub'))x.querySelectorAll('table').length?abajo.appendChild(x):x.remove()});
  v.querySelectorAll('.r72-report,.r72-rgrid,.r75-rfil').forEach(x=>{if(!x.querySelector('table'))x.remove()});
  rep.append(izq,der);v.appendChild(rep);v.appendChild(abajo)}
const r78RenderBase=render;
render=function(...a){const out=r78RenderBase(...a);try{r78Reporte()}catch(err){console.warn('formato de reporte',err)}return out};
/* ---------- Posventa en Métricas: reemplaza «Satisfacción del cliente» y junta NPS y reporte de posventa ---------- */
const r78RepPost=views.rep_post;
const r78InicioBase=views.inicio;
views.inicio=()=>{let h=r78InicioBase().replace('Satisfacción del cliente','Posventa');if(R75M.tab!=='satisfaccion'||!r78RepPost)return h;
  const meses=r75Range(),charts={...R75M.charts};R76P.from=meses[0];R76P.to=meses.at(-1);let p=r78RepPost();R75M.charts={...charts,...R75M.charts};
  p=p.replace(/^[\s\S]*?<div class="filterbar">[\s\S]*?<\/div>/,'');return h+`<section class="r78-posventa"><h2>Seguimiento de posventa</h2>${p}</section>`};
