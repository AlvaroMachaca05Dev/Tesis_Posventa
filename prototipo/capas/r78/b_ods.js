/* --------------------------------------------------------------------------
   R7.8 · Órdenes de servicio (decisiones del 28/10/2026: DEC-61, 67, 71, 72, 80)
   - Lista en tarjetas verticales (como Tuulapp) con los botones a la derecha:
     Facturar, Editar, Estado, Bitácora, Abono/pago, Imprimir (PDF, ticket, recepción), Eliminar.
   - Filtros: fechas desde/hasta, búsqueda rápida, cliente, vehículo y cantidad a mostrar.
   - Etiqueta «Sin comprobante» / «Con comprobante»; al hacer clic se listan los comprobantes.
   - Botón 📅: fechas de inicio y cierre (fecha y hora en un campo), solo el Superadministrador.
   - Editar ODS en UNA sola pantalla: «Datos del comprobante» arriba, ítems, solo el TOTAL
     y abajo los abonos y pagos. Sin pestañas, sin paquetes ni solapamientos.
   - Cierre: sin nota de venta solo se cierra una ODS «No aprobada».
   - Ocultos: estado crediticio y saldo por cobrar (clientes); Paquetes y Solapamientos (menú).
   -------------------------------------------------------------------------- */
R78.f={desde:'',hasta:'',cliente:'',vehiculo:'',n:10};

/* menú: Paquetes y Solapamientos ocultos */
R75_NAV.forEach(n=>{if(n.items)n.items=n.items.filter(i=>!['paquetes','solapes'].includes(i))});
const r78NavIds=R75_NAV.map(n=>n.id).filter(Boolean);['paquetes','solapes'].forEach(id=>{const i=R75_NAV.findIndex(n=>n.id===id);if(i>=0)R75_NAV.splice(i,1)});
r75Rebuild();

/* cierre: sin nota de venta solo una ODS «No aprobada» */
const r78SetStateB=r7SetOrderState;
r7SetOrderState=function(id,value){const o=db.orders.find(x=>x.id===id);
  if(o&&value==='Archivada'&&o.state!=='Archivada'&&!db.notes.some(n=>n.order===id)&&o.approval!=='No aprobada'){toast('Para cerrar sin nota de venta, la decisión del cliente debe ser «No aprobada». Emite la nota de venta o cambia la decisión.');try{render()}catch{}return}
  if(o&&o.state==='Archivada'&&value!=='Archivada'&&o.closed&&!confirm('La ODS sale de «Cerrado»: se borrará su fecha de cierre. ¿Continuar?')){try{render()}catch{}return}
  if(o&&o.state==='Archivada'&&value!=='Archivada')o.closed=null;
  return r78SetStateB(id,value)};

/* ---------- lista en tarjetas ---------- */
const r78Notas=id=>db.notes.filter(n=>n.order===id);
const r78Hace=iso=>{if(!iso)return'';const m=Math.round((Date.now()-new Date(iso))/60000);return m<60?'hace '+m+' min':m<1440?'hace '+Math.round(m/60)+' h':'hace '+Math.round(m/1440)+' días'};
function r78Filtro(k,v){R78.f[k]=v;render()}
function r78Comprobantes(id,btn){const ns=r78Notas(id),box=btn.closest('article').querySelector('.r78-comp');box.hidden=!box.hidden;box.innerHTML=ns.length?ns.map(n=>`<code>${esc(n.code)}</code>`).join(', ')+' <button type="button" class="r78-mini" onclick="navigator.clipboard?.writeText(\''+ns.map(n=>n.code).join(', ')+'\');toast(\'Copiado\')">Copiar</button>':'Esta ODS todavía no tiene comprobantes.'}
function r78Estado(e,btn,id){e.stopPropagation();r77MenuShow(btn,states.map(s=>({icon:'⇄',label:R77_TABL[s]||s,fn:()=>r7SetOrderState(id,s)})))}
function r78Imprimir(e,btn,id){e.stopPropagation();r77MenuShow(btn,[{icon:'📄',label:'PDF',fn:()=>r77PrintOrder(id,'pdf')},{icon:'🧾',label:'Ticket',fn:()=>r77PrintOrder(id,'ticket')},{icon:'📋',label:'Recepción (con términos y condiciones)',fn:()=>r78Recepcion(id)}])}
function r78Recepcion(id){const o=db.orders.find(x=>x.id===id),v=vehicle(o.vehicle),c=client(v.client),w=window.open('','_blank');if(!w)return toast('Permite ventanas emergentes para imprimir.');
  const t=db.settings?.terminos||'El taller no se responsabiliza por objetos de valor dejados en el vehículo. Los repuestos cambiados se entregan al cliente si los solicita. El vehículo no recogido en 7 días genera cargo por cochera.';
  w.document.write(`<title>Recepción ${esc(o.code)}</title><body style="font-family:Arial;padding:24px"><h2>Recepción del vehículo · ODS ${esc(o.code)}</h2><p><b>Cliente:</b> ${esc(c.name||'')} (${esc(c.doc||'')})<br><b>Vehículo:</b> ${esc([v.brand,v.model,v.year,v.plate].filter(Boolean).join(' · '))}<br><b>Kilometraje:</b> ${esc(o.km??'')}<br><b>Tipo de atención:</b> ${esc(o.attentionType||'')}<br><b>Fecha de inicio:</b> ${esc(o.date||'')} ${esc(o.time||'')}</p><h3>Términos y condiciones</h3><p>${esc(t)}</p><br><br><p>______________________<br>Firma del cliente</p></body>`);w.document.close();w.print()}
function r78Visible(o){const f=R78.f,v=vehicle(o.vehicle),c=client(v.client),q=String(query||'').toLowerCase().trim();
  if(o.deleted||o.state!==odsState)return false;if(f.desde&&String(o.date||'')<f.desde)return false;if(f.hasta&&String(o.date||'')>f.hasta)return false;
  if(f.cliente&&v.client!==f.cliente)return false;if(f.vehiculo&&o.vehicle!==f.vehiculo)return false;
  return !q||`${o.code} ${v.plate} ${c.name||''} ${c.doc||''}`.toLowerCase().includes(q)}
orderCards=function(){if(!states.includes(odsState))odsState=states[0];const lista=db.orders.filter(r78Visible).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))),ver=lista.slice(0,+R78.f.n||10);
  if(!ver.length)return '<div class="panel empty">No hay órdenes en este proceso con esos filtros.</div>';
  return ver.map(o=>{const v=vehicle(o.vehicle),c=client(v.client),ns=r78Notas(o.id),last=db.comments.filter(x=>x.order===o.id).at(-1),tot=total(o);
    const btn=(ic,t,fn,cls='')=>`<button type="button" class="r78-ac ${cls}" title="${t}" aria-label="${t}" onclick="event.stopPropagation();${fn}">${ic}</button>`;
    return `<article class="r78-card"><div class="r78-info">
      <div><b>Consecutivo:</b> #${esc(o.code)} <button type="button" class="r78-tag ${ns.length?'si':''}" onclick="event.stopPropagation();r78Comprobantes('${o.id}',this)">${ns.length?'Con comprobante':'Sin comprobante'}</button></div>
      <div class="r78-comp" hidden></div>
      <div><b>Fecha de inicio:</b> ${esc(o.date||'—')} ${esc(o.time||'')} · <b>Fecha de cierre:</b> ${o.closed?esc(String(o.closed).slice(0,16).replace('T',' ')):'—'}</div>
      <div><b>Cliente:</b> ${esc(c.name||'—')}${c.doc?' ('+esc(c.doc)+')':''}</div>
      <div><b>Vehículo:</b> ${esc([v.brand&&'Marca: '+v.brand,v.model&&'Modelo: '+v.model,v.year&&'Año: '+v.year,'Placa: '+(v.plate||'—'),v.vin&&'VIN: '+v.vin,o.km!=null&&'Kilometraje: '+o.km].filter(Boolean).join(', '))}</div>
      <div><b>Tipo de atención:</b> ${esc(o.attentionType||'—')} · <b>Decisión:</b> ${esc(o.approval||'Pendiente')}</div>
      ${o.obs||o.observations?`<div><b>Comentarios:</b> ${esc(o.obs||o.observations)}</div>`:''}
      <div><b>Técnico:</b> ${esc(tech(o.tech)||o.technicianName||'Sin asignar')} · <b>Usuario:</b> ${esc(o.createdByName||o.createdBy||'—')} · <b>Total:</b> ${tot==null?'—':money(tot)}</div>
      ${last?`<div class="r78-last">💬 ${esc(last.kind||'')}: ${esc(String(last.text||'').slice(0,140))} (${r78Hace(last.date)})</div>`:''}
    </div><div class="r78-acts">
      ${btn('$','Facturar (nota de venta)',`newNoteR5('${o.id}')`)}${btn('✎','Editar',`r72OpenOrder('${o.id}')`)}${r78EsSuper()?btn('📅','Fechas de inicio y cierre',`r78Fechas('${o.id}')`):'<button type="button" class="r78-ac" title="Solo el Superadministrador corrige las fechas" aria-label="Fechas de inicio y cierre" disabled>📅</button>'}${btn('⇄','Estado de la orden',`r78Estado(event,this,'${o.id}')`)}${btn('💬','Bitácora',`orderChat('${o.id}')`)}${btn('💵','Registrar abono o pago',`r72Pay('order','${o.id}',false)`)}${btn('🖨','Imprimir',`r78Imprimir(event,this,'${o.id}')`)}${btn('🗑','Eliminar',`r77OdsDelete('${o.id}')`,'rojo')}
    </div></article>`}).join('')+(lista.length>ver.length?`<p class="sub">Mostrando ${ver.length} de ${lista.length}.</p>`:'')};
const r78OdsViewB=views.ods;
views.ods=()=>{const h=r78OdsViewB(),f=R78.f;
  const filtros=`<div class="r78-filtros"><label class="r78-q">Búsqueda rápida<input type="search" placeholder="Cliente, placa o consecutivo" value="${esc(query||'')}" onchange="query=this.value;render()"></label><label>Ingresos desde<input type="date" value="${f.desde}" onchange="r78Filtro('desde',this.value)"></label><label>Ingresos hasta<input type="date" value="${f.hasta}" onchange="r78Filtro('hasta',this.value)"></label>
    <label>Buscar por cliente<select onchange="r78Filtro('cliente',this.value)">${r72Opt(db.clients.filter(c=>!c.deleted).map(c=>[c.id,(c.doc?c.doc+' · ':'')+c.name]),f.cliente,'Todos')}</select></label>
    <label>Buscar por vehículo<select onchange="r78Filtro('vehiculo',this.value)">${r72Opt(db.vehicles.filter(v=>!v.deleted).map(v=>[v.id,v.plate]),f.vehiculo,'Todos')}</select></label>
    <label>Mostrar<select onchange="r78Filtro('n',this.value)">${[10,25,50,100].map(n=>`<option ${+f.n===n?'selected':''}>${n}</option>`).join('')}</select></label></div>`;
  return h.replace('<div class="filterbar">',filtros+'<div class="filterbar" hidden>')};

/* ---------- editar ODS en una sola pantalla (igual que localhost, 28/10) ----------
   Cabecera: título · cotización previa · Estado · Decisión del cliente · Salir.
   «Datos del comprobante» plegable en 3 filas de hasta 8 cajas (sin Color); descuento abajo a la derecha.
   Ítems: Tipo (servicio o producto en la misma lista), Detalle, Referencia, Costo, Rent., Precio, Desc., Responsable, Cant./H-H, Total.
   Sin columna Impuesto ni textos de ayuda bajo las filas. Abajo: evidencias y estado del vehículo a la izquierda; TOTAL y abonos a la derecha. */
const R78_DECISIONES=['Pendiente de aprobación','Aprobada para cotizar','Aprobada para comprar','No aprobada'];
const r78EsSuper=()=>['Superadministrador','Administrador'].includes(r72Role()); /* el prototipo no tiene Superadministrador: lo representa el Administrador */
const r78Linea=l=>{const p=+l.price||0,base=l.type==='servicio'?p:p*(+l.qty||0);return r2(base*(1-(+l.discPct||0)/100))};
R78.ui={plegado:false,cliente:false};
r72OpenOrder=function(id){const o=db.orders.find(x=>x.id===id);if(!o)return;o.lines??=[];R72.open={kind:'order',id};r78Editor(id)};
/* «+ Nueva orden» abre el mismo editor con una fila vacía; la orden recibe su código al pulsar «Crear orden». */
r72NewOrder=function(){db.orders=db.orders.filter(x=>!x.draft78);const n=r72Now(),o={id:uid(),code:'',draft78:true,vehicle:'',client78:'',tech:'',km:null,state:'Recepción',date:n.date,time:n.time,createdAt:new Date().toISOString(),origin:'demo',billing:'No facturado',attentionType:'Mantenimiento preventivo',odsType:'Avanzada',approval:'Pendiente de aprobación',branch:'union',lines:[{id:uid(),type:'servicio',name:'',qty:1,price:0,discPct:0,discount:0}],rootTaskState:'Pendiente',productStage:'Solicitud',archived:false};
  db.orders.unshift(o);R72.open={kind:'order',id:o.id};
  if(!R78.cierre){R78.cierre=true;$('modal').addEventListener('close',()=>{if(db.orders.some(x=>x.draft78)){db.orders=db.orders.filter(x=>!x.draft78);try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}render()}})}
  r78Editor(o.id)};
function r78Crear(id){const o=db.orders.find(x=>x.id===id);if(!o.vehicle)return toast('Elige el vehículo.');
  if(o.state==='Archivada'&&o.approval!=='No aprobada')return toast('Para cerrar sin nota de venta, la decisión del cliente debe ser «No aprobada».');
  o.lines=o.lines.filter(l=>l.name);o.code=r72OrderCode();delete o.draft78;delete o.client78;
  if(o.km!=null)vehicle(o.vehicle).km=Math.max(+vehicle(o.vehicle).km||0,o.km);if(o.state==='Archivada')o.closedAt=new Date().toISOString();r7Log(o.id,'ODS',`ODS ${o.code} creada en ${R77_TABL[o.state]||o.state}, ${o.approval}.`);save('ODS creada',o.code);closeModal();render()}
function r78Editor(id){const o=db.orders.find(x=>x.id===id),nueva=!!o.draft78,v=o.vehicle?vehicle(o.vehicle):{},c=v.client?client(v.client):{},lock=o.state==='Archivada'&&!o.editGrant,dis=lock?'disabled':'',vc=R78.ui.cliente,dn=nueva?'disabled':'';
  const ro=(l,val)=>`<label>${l}<input value="${esc(val??'')}" disabled></label>`;
  const set=(f)=>`onchange="r78Set('${id}','${f}',this.value)"`;
  const resp=db.users.filter(u=>['Técnico','Jefe de taller'].includes(u.role)&&u.active!==false).map(u=>[u.id,u.name]);
  const abonos=db.advances.filter(x=>x.order===id),tot=r2(o.lines.reduce((a,l)=>a+r78Linea(l),0)),pag=r2(abonos.reduce((a,x)=>a+(+x.amount||0),0));
  const n=(i,f,val)=>`<input class="r78-num" value="${esc(val??'')}" ${dis} onchange="r78Item('${id}',${i},'${f}',this.value)">`;
  const filas=o.lines.map((l,i)=>{const rent=l.cost&&l.price?r2((l.price/l.cost-1)*100):'';return `<tr><td>${i+1}</td>
    <td><select ${dis} onchange="r78Item('${id}',${i},'type',this.value)"><option value="servicio" ${l.type==='servicio'?'selected':''}>Servicio</option><option value="producto" ${l.type!=='servicio'?'selected':''}>Producto</option></select></td>
    <td><input class="r78-largo" value="${esc(l.name||'')}" ${dis} onchange="r78Item('${id}',${i},'name',this.value)"></td>
    ${vc?'':`<td><input class="r78-medio" value="${esc(l.code||l.ref||'')}" ${dis} onchange="r78Item('${id}',${i},'code',this.value)"></td><td>${n(i,'cost',l.cost)}</td><td>${n(i,'rent',rent)}</td>`}
    <td>${n(i,'price',l.price)}</td><td>${n(i,'discPct',l.discPct||0)}</td>
    ${vc?'':`<td><select ${dis} onchange="r78Item('${id}',${i},'${l.type==='servicio'?'tech':'logistic'}',this.value)">${l.type==='servicio'?r72Opt(r78RespServ(),l.tech,'—'):r72Opt(r78RespProd(),l.logistic,'—')}</select></td>`}
    <td>${n(i,'qty',l.qty??1)}</td><td class="r78-der">${money(r78Linea(l))}</td>
    <td>${lock?'':`<button type="button" class="r78-mini" title="Quitar ítem" onclick="r78Quitar('${id}',${i})">🗑</button>`}</td></tr>`}).join('');
  const ev=o.evidence||[],est=o.estadoVehiculo||{},llenos=Object.values(est).filter(x=>Array.isArray(x)?x.length:x&&x!=='Sin registrar').length;
  $('modal').classList.remove('r78-chico');$('modal').classList.add('r78-ancho');
  modal(`<div class="r78-ods">
  <div class="r78-cab"><h2>${nueva?'Nueva orden de servicio':'Orden de servicio '+esc(o.code)}</h2>
    <label class="r78-cot">¿Deseas enlazar una cotización previa?<select ${dis} onchange="r78Set('${id}','quote',this.value)">${r72Opt((db.r72quotes||[]).filter(q=>!q.order||q.order===id).map(q=>[q.id,q.code||q.id]),o.quote,'Sin cotización')}</select></label>
    <label>Estado<select onchange="${nueva?`r78Set('${id}','state',this.value)`:`r7SetOrderState('${id}',this.value);r78Editor('${id}')`}">${states.map(s=>`<option value="${s}" ${o.state===s?'selected':''}>${esc(R77_TABL[s]||s)}</option>`).join('')}</select></label>
    <label>Decisión del cliente<select ${set('approval')}>${R78_DECISIONES.map(d=>`<option ${(o.approval||'Pendiente de aprobación')===d?'selected':''}>${d}</option>`).join('')}</select></label>
    <button type="button" onclick="closeModal()">Salir</button></div>
  <section class="r78-comprobante ${R78.ui.plegado?'cerrado':''}"><h3><button type="button" class="r78-plegar" onclick="R78.ui.plegado=!R78.ui.plegado;r78Editor('${id}')">${R78.ui.plegado?'▸':'▾'} Datos del comprobante</button></h3>
  ${R78.ui.plegado?'':`<div class="r78-rejilla">
    ${nueva?`<label>Cliente<select ${set('client78')}>${r72Opt(db.clients.filter(x=>!x.deleted).map(x=>[x.id,(x.doc?x.doc+' ':'')+x.name]),o.client78||v.client||'','Seleccionar…')}</select></label>
    <label>Vehículo<select ${set('vehicle')}>${r72Opt(db.vehicles.filter(x=>!x.deleted&&(!o.client78||x.client===o.client78)).map(x=>[x.id,x.plate]),o.vehicle,'Seleccionar…')}</select></label>`
    :ro('Cliente',(c.doc?c.doc+' ':'')+(c.name||''))+ro('Vehículo',v.plate)}
    <label>Tipo de atención<select ${dis} ${set('attentionType')}>${['Mantenimiento preventivo','Mantenimiento correctivo','Preventivo y correctivo','Auxilio mecánico','Evaluación y diagnóstico','Garantía','Siniestro','Inspección 360','Inspección por compra','Otro'].map(t=>`<option ${o.attentionType===t?'selected':''}>${t}</option>`).join('')}</select></label>
    <label>Kilometraje<input value="${esc(o.km??'')}" ${dis} ${set('km')}></label>
    ${ro('Placa',v.plate)}${ro('Marca',v.brand)}${ro('Modelo',v.model)}${ro('Año',v.year)}
    <label>Técnico<select ${dis} ${set('tech')}>${r72Opt(resp,o.tech,'No asignado')}</select></label>
    <label>Jefe de taller (opcional)<select ${dis} ${set('chief')}>${r72Opt(db.users.filter(u=>u.role==='Jefe de taller').map(u=>[u.id,u.name]),o.chief,'No asignado')}</select></label>
    ${ro('Nro. serie',v.serial)}${ro('Nro. VIN',v.vin)}${ro('Nro. motor',v.engine)}
    <label class="r78-desc">Descuento (%) a todos los ítems<span><input id="r78pct" ${dis}><button type="button" ${dis} onclick="r78DescTodos('${id}')">Aplicar</button></span></label>
    <label class="r78-mitad">Observaciones<textarea rows="2" ${dis} ${set('obs')}>${esc(o.obs||'')}</textarea></label>
    <label class="r78-mitad">Recomendaciones<textarea rows="2" ${dis} ${set('recom')}>${esc(o.recom||'')}</textarea></label>
  </div>`}</section>
  <div class="r78-fila"><h3>Detalle</h3><button type="button" onclick="R78.ui.cliente=!R78.ui.cliente;r78Editor('${id}')">👁 ${vc?'Ver costos (vista interna)':'Vista del cliente (ocultar costos)'}</button></div>
  <div class="r78-items"><table><thead><tr><th>#</th><th>Tipo</th><th>Detalle</th>${vc?'':'<th>Referencia</th><th>Costo</th><th>Rent. (%)</th>'}<th>Precio unit.</th><th>Desc. (%)</th>${vc?'':'<th>Responsable</th>'}<th>Cant./H-H</th><th class="r78-der">Total</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>
  ${lock?'':`<button type="button" class="r78-agregar" onclick="r78Agregar('${id}')">+ Agregar ítem</button>`}
  <div class="r78-pie"><section><div class="r78-fila"><h3>Evidencias de ingreso <span class="sub">(${(o.evidence||[]).length}/${R78_MAX_FOTOS})</span></h3><button type="button" ${dn} onclick="r78EstadoVeh('${id}')">🚗 Estado del vehículo${llenos?' ('+llenos+')':''}</button></div>
      ${lock?'':`<div class="r78-fila izq"><label class="r78-boton">📁 Cargar fotos<input type="file" accept="image/*" multiple hidden ${(o.evidence||[]).length>=R78_MAX_FOTOS?'disabled':''} onchange="r78Subir('${id}',this.files)"></label><button type="button" class="r78-boton" ${(o.evidence||[]).length>=R78_MAX_FOTOS?'disabled':''} onclick="r78Camara('${id}')">📷 Tomar foto</button><input id="r78cam-${id}" type="file" accept="image/*" capture="environment" hidden onchange="r78Subir('${id}',this.files)"></div>`}
      <div class="r78-galeria">${ev.length?ev.map((e,i)=>`<figure><img src="${e.data}" alt="${esc(e.name)}"><figcaption>${esc(e.name)}</figcaption>${lock?'':`<button type="button" class="r78-mini" onclick="r78QuitarEv('${id}',${i})">✕</button>`}</figure>`).join(''):'<p class="sub">Sin fotos todavía.</p>'}</div></section>
    <section class="r78-abonos"><div class="r78-total"><span>TOTAL</span><b>${money(tot)}</b></div>
      <div class="r78-fila"><h3>Abonos / pagos</h3>${lock?'':`<button type="button" class="r78-verde" ${dn} onclick="r72Pay('order','${id}',false)">$ Registrar abono</button>`}</div>
      <table><thead><tr><th>Fecha</th><th>Método</th><th>Concepto</th><th class="r78-der">Valor</th></tr></thead><tbody>${abonos.map(a=>`<tr><td>${esc(String(a.date||'').slice(0,16).replace('T',' '))}</td><td>${esc(a.method||'')}</td><td>${esc(a.concept||'')}</td><td class="r78-der">${money(a.amount)}</td></tr>`).join('')||'<tr><td colspan="4" class="sub r78-der">No hay abonos registrados</td></tr>'}</tbody></table>
      <div class="r78-suma"><b>Total abonos</b><b>${money(pag)}</b></div><div class="r78-suma"><span>Pendiente por pagar</span><span>${money(r2(tot-pag))}</span></div></section></div>
  <div class="r78-fila fin"><button type="button" onclick="closeModal()">Salir</button>${nueva?`<button type="button" class="primary" onclick="r78Crear('${id}')">Crear orden</button>`:`<button type="button" class="primary" onclick="save('ODS guardada','${esc(o.code)}');closeModal()">Guardar cambios</button>`}</div></div>`)}
function r78Set(id,f,val){const o=db.orders.find(x=>x.id===id);const antes=o[f];o[f]=f==='km'?(val===''?null:+val):val;
  if(f==='client78')o.vehicle='';else if(f==='vehicle'&&val)o.client78=vehicle(val).client||o.client78;if(f==='approval'&&antes!==val)r7Log(id,'Decisión',`Decisión del cliente: ${antes||'Pendiente de aprobación'} → ${val}`);save('ODS modificada',o.code);r78Editor(id)}
function r78Item(id,i,f,val){const o=db.orders.find(x=>x.id===id),l=o.lines[i],num=+String(val).replace(',','.');
  if(['type','name','code','tech'].includes(f))l[f]=val;else if(val!==''&&!Number.isFinite(num))return r78Editor(id);
  else if(f==='rent'){if(l.cost)l.price=r2(l.cost*(1+num/100))}else if(f==='cost'){l.cost=val===''?null:num}else l[f]=num;
  l.discount=r2((l.type==='servicio'?+l.price||0:(+l.price||0)*(+l.qty||0))*(+l.discPct||0)/100);save('Detalle actualizado',o.code);r78Editor(id)}
function r78Agregar(id){const o=db.orders.find(x=>x.id===id);o.lines.push({id:uid(),type:'servicio',name:'',qty:1,price:0,discPct:0,discount:0,createdAt:new Date().toISOString()});
  if(!['Pendiente de aprobación','No aprobada'].includes(o.approval||'Pendiente de aprobación')){r7Log(id,'Decisión',`Decisión del cliente: ${o.approval} → Pendiente de aprobación (ítem nuevo)`);o.approval='Pendiente de aprobación'}save('Ítem agregado',o.code);r78Editor(id)}
function r78Quitar(id,i){const o=db.orders.find(x=>x.id===id),[l]=o.lines.splice(i,1);r7Log(id,'Ítems',`Ítem quitado: ${l.name||'(sin detalle)'}`);save('Ítem quitado',o.code);r78Editor(id)}
function r78DescTodos(id){const p=+String($('r78pct').value).replace(',','.');if(!Number.isFinite(p)||p<0||p>100)return toast('El descuento debe estar entre 0 y 100 %.');const o=db.orders.find(x=>x.id===id);o.lines.forEach(l=>{l.discPct=p});save('Descuento a todos los ítems',o.code);r78Editor(id)}
const R78_MAX_FOTOS=5;
function r78Subir(id,files){const o=db.orders.find(x=>x.id===id);o.evidence??=[];let lista=[...files];if(lista.some(f=>!/^image\//.test(f.type))){toast('Solo se aceptan fotos.');lista=lista.filter(f=>/^image\//.test(f.type))}
  const libres=R78_MAX_FOTOS-o.evidence.length;if(lista.length>libres){toast(`Máximo ${R78_MAX_FOTOS} fotos por orden.`);lista=lista.slice(0,Math.max(0,libres))}lista.forEach(f=>{if(f.size>3e6)return toast(f.name+': en el prototipo cada archivo puede pesar hasta 3 MB.');const r=new FileReader();r.onload=()=>{o.evidence.push({name:f.name,data:r.result});if(!o.draft78){r7Log(id,'Evidencia','Evidencia de ingreso agregada: '+f.name);save('Evidencia agregada',o.code)}r78Editor(id)};r.readAsDataURL(f)})}
function r78QuitarEv(id,i){const o=db.orders.find(x=>x.id===id);if(!confirm('¿Quitar '+o.evidence[i].name+'?'))return;const [e]=o.evidence.splice(i,1);r7Log(id,'Evidencia','Evidencia de ingreso quitada: '+e.name);save('Evidencia quitada',o.code);r78Editor(id)}
/* Estado del vehículo: ventana compacta, casi cuadrada */
function r78EstadoVeh(id){const o=db.orders.find(x=>x.id===id),e=o.estadoVehiculo||{},lock=o.state==='Archivada'&&!o.editGrant,dis=lock?'disabled':'';
  const t=(k,l,ph='')=>`<label>${l}<input name="${k}" value="${esc(e[k]||'')}" placeholder="${ph}" ${dis}></label>`;
  const ch=(k,l,ops)=>`<fieldset><legend>${l}</legend>${ops.map(x=>`<label class="r78-chk"><input type="checkbox" name="${k}" value="${esc(x)}" ${(e[k]||[]).includes(x)?'checked':''} ${dis}>${esc(x)}</label>`).join('')}</fieldset>`;
  $('modal').classList.remove('r78-ancho');$('modal').classList.add('r78-chico');
  modal(`<form class="r78-estado" onsubmit="event.preventDefault();r78GuardarEstado('${id}',this)"><div class="r78-fila"><h3>Estado del vehículo · ODS ${esc(o.code)}</h3></div>
    <div class="r78-rej2">${t('objetosValor','Objetos de valor','Especifique objetos')}<label>Nivel de combustible<select name="combustible" ${dis}>${['Sin registrar','Reserva','1/4','1/2','3/4','Lleno'].map(x=>`<option ${e.combustible===x?'selected':''}>${x}</option>`).join('')}</select></label>
    ${ch('fluidos','Fluidos a nivel',['Aceite de motor','Líquido de frenos','Líquido de embrague','Refrigerante','Aceite hidráulico','Limpia parabrisas'])}${ch('inventario','Inventario',['Llanta de repuesto','Kit de carretera','Herramientas','Botiquín','Extintor'])}
    ${t('otrosFluidos','Otros fluidos')}${t('otrosInventario','Otros (inventario)')}
    ${ch('danos','Daños',['Rayado','Fogueado','Sumido','Picado','Golpeado','No presenta daños'])}<div class="r78-col">${t('documentos','Documentos','Documentos del vehículo')}${t('otrosDanos','Otros daños')}</div>
    <label class="r78-doble">Comentarios<textarea name="comentarios" rows="2" ${dis}>${esc(e.comentarios||'')}</textarea></label></div>
    <div class="r78-fila fin"><button type="button" onclick="r78Editor('${id}')">Cancelar</button>${lock?'':'<button class="primary">Guardar</button>'}</div></form>`)}
function r78GuardarEstado(id,f){const o=db.orders.find(x=>x.id===id),fd=new FormData(f),e={};for(const k of ['objetosValor','combustible','otrosFluidos','otrosInventario','documentos','otrosDanos','comentarios'])e[k]=fd.get(k)||'';for(const k of ['fluidos','inventario','danos'])e[k]=fd.getAll(k);
  o.estadoVehiculo=e;r7Log(id,'Ingreso','Estado del vehículo actualizado');save('Estado del vehículo',o.code);r78Editor(id)}
/* Fechas de inicio y cierre: fecha y hora en un solo campo (como en ClickUp); solo el Superadministrador */
function r78Fechas(id){if(!r78EsSuper())return toast('Solo el Superadministrador corrige las fechas de inicio y de cierre.');const o=db.orders.find(x=>x.id===id),ini=(o.date||'')+'T'+(o.time||'00:00'),cie=o.closed?String(o.closed).slice(0,16):'';
  $('modal').classList.remove('r78-ancho');$('modal').classList.add('r78-chico');
  modal(`<form class="r78-estado" onsubmit="event.preventDefault();r78GuardarFechas('${id}',this)"><h3>Fechas · ODS ${esc(o.code)}</h3><div class="r78-rej2">
    <label>Fecha de inicio<input type="datetime-local" name="ini" value="${esc(ini)}" required></label>
    <label>Fecha de cierre<input type="datetime-local" name="cie" value="${esc(cie)}" ${o.state==='Archivada'?'':'disabled title="Se asigna al pasar a Cerrado"'}></label></div>
    <div class="r78-fila fin"><button type="button" onclick="closeModal()">Cancelar</button><button class="primary">Guardar fechas</button></div></form>`)}
function r78GuardarFechas(id,f){const o=db.orders.find(x=>x.id===id),ini=f.ini.value,cie=f.cie.disabled?null:f.cie.value;
  if(new Date(ini)>new Date(Date.now()+864e5)||(cie&&new Date(cie)>new Date(Date.now()+864e5)))return toast('La fecha no puede ser futura.');
  if(cie&&cie<ini)return toast('La fecha de cierre no puede ser anterior a la de inicio.');
  const antes=(o.date||'')+' '+(o.time||'');if(ini.replace('T',' ')!==antes.trim()){o.date=ini.slice(0,10);o.time=ini.slice(11,16);r7Log(id,'Fechas',`Fecha de inicio corregida: ${antes} → ${ini.replace('T',' ')}`)}
  if(cie&&cie!==String(o.closed||'').slice(0,16)){r7Log(id,'Fechas',`Fecha de cierre corregida: ${String(o.closed||'—').slice(0,16).replace('T',' ')} → ${cie.replace('T',' ')}`);o.closed=cie+':00'}
  save('Fechas corregidas',o.code);closeModal()}

/* ---------- clientes: sin estado crediticio ni saldo por cobrar; vehículos: último kilometraje ---------- */
const r78ClientFormB2=r78ClientForm;
r78ClientForm=function(title,fields,fn){fields=fields.replace(/<label>Estado crediticio<select name="credit">[\s\S]*?<\/select><\/label>/,'');return r78ClientFormB2(title,fields,fn)};
views.clientes=()=>heading('Clientes','Se enlazan por identificador interno: puedes corregir el documento o el nombre sin perder sus vehículos. El documento no se repite. Baja recuperable.',button('+ Cliente','editClient()',true))
  +`<label class="r72-inl"><input type="checkbox" ${showDeleted?'checked':''} onchange="showDeleted=this.checked;render()">Mostrar eliminados</label><div class="panel space">${table(['Acciones','Documento','Cliente','Nombre comercial','Móvil','Vehículos','Registro','Estado'],db.clients.filter(c=>showDeleted||!c.deleted).map(c=>[r73Act(r73Btn('edit','Editar',`editClient('${c.id}')`),c.generic?'':r73Btn(c.deleted?'↺':'del',c.deleted?'Restaurar':'Eliminar',`deleteClient('${c.id}')`,c.deleted?'':'r73-red'),r73Btn('◇','Vehículos',`clientVehicles('${c.id}')`)),
    esc(r78TipoCorto(c.docType)+' '+(c.doc||'—')),`<b>${esc(c.name)}</b>`,esc(c.tradeName||'—'),c.phone?esc(r78Pref(c.country)+' '+c.phone):'—',db.vehicles.filter(v=>v.client===c.id&&!v.deleted).length,esc(r78Fecha(c.createdAt)),c.deleted?'<span class="pill red">Eliminado</span>':'<span class="pill green">Activo</span>']))}</div>`;
views.vehiculos=()=>heading('Vehículos','La placa no se repite (se compara sin guiones ni mayúsculas). Puedes corregir la placa o traspasar el vehículo sin perder su historial.',button('+ Vehículo','editVehicle()',true))
  +`<div class="panel">${table(['Acciones','Placa','Marca','Modelo','Año','Color','Titular','Grupo','Plan','Último kilometraje','ODS','Registro'],db.vehicles.filter(v=>!v.deleted).map(v=>{const r=(v.kmReads||[]).at(-1),t=client(v.client),km=r?.km??v.km;
    return[r73Act(r73Btn('edit','Editar / traspasar',`editVehicle('${v.id}')`),r73Btn('del','Eliminar',`r73DelVehicle('${v.id}')`,'r73-red'),r73Btn('⏱','Registrar kilometraje',`r74KmConsult('${v.id}')`),r73Btn('↗','Línea temporal',`timelineVehicle='${v.id}';simKm=null;go('timeline')`)),
      `<b>${esc(v.plate)}</b>`,esc(v.brand),esc(v.model),esc(v.year),esc(v.color||'—'),`${esc(t.name||'—')}<br><small class="sub">${esc(r78TipoCorto(t.docType))} ${esc(t.doc||'—')}</small>`,
      v.group?`<span class="pill">${esc(v.group)}</span>`:'<span class="pill orange">Sin grupo</span>',v.plan?`<span class="pill">${esc(v.plan)}</span>`:'<span class="pill orange">Sin plan</span>',km!=null&&km!==''?(+km).toLocaleString('es-PE')+' km':'—',db.orders.filter(o=>o.vehicle===v.id).length,esc(r78Fecha(v.createdAt))]}))}</div>`;

/* 03/11: «Tomar foto» abre la cámara del navegador (computadora, tablet o celular, con permiso); si no se puede, la del sistema. */
function r78Camara(id){const nativa=()=>document.getElementById('r78cam-'+id)?.click();
  if(!(window.isSecureContext&&navigator.mediaDevices&&navigator.mediaDevices.getUserMedia))return nativa();
  const capa=document.createElement('div');capa.className='r78-capa-camara';capa.innerHTML='<div class="r78-camara"><video playsinline muted></video><div class="r78-fila fin"><button type="button" data-a="no">Cancelar</button><button type="button" class="primary" data-a="si" disabled>📷 Capturar</button></div></div>';
  document.body.appendChild(capa);const v=capa.querySelector('video'),si=capa.querySelector('[data-a=si]');let flujo=null;
  const cerrar=()=>{flujo&&flujo.getTracks().forEach(x=>x.stop());capa.remove()};capa.querySelector('[data-a=no]').onclick=cerrar;
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false}).then(s=>{flujo=s;v.srcObject=s;v.play();si.disabled=false}).catch(()=>{cerrar();toast('No se pudo abrir la cámara. Revisa el permiso de cámara del navegador.')});
  si.onclick=()=>{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);
    c.toBlob(b=>{cerrar();if(b)r78Subir(id,[new File([b],'foto-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.jpg',{type:'image/jpeg'})])},'image/jpeg',.9)}}
