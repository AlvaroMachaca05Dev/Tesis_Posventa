/* --------------------------------------------------------------------------
   R7.8 · Nota de venta en una sola pantalla, con el mismo formato que el editor de ODS (05/11/2026).
   - Se elige el local; la serie (N001 Unión, N002 Prohogar) y el número consecutivo los pone el sistema al emitir y no se muestran aquí.
   - Sin moneda, tipo de cambio, orden de compra, número de pedido, sucursal, dirección ni cuotas.
   - Tipo de IGV por ítem: Gravado (el precio incluye IGV), Exonerado o Inafecto. Subtotal sin IGV y total.
   - Pagos: la cajera agrega cada forma de pago (efectivo, Yape, Plin…) y se ve el vuelto y el saldo.
   - Detracción con tipo «Mantenimiento y reparación de bienes muebles» y su monto precalculado.
   -------------------------------------------------------------------------- */
const R78_TIPOS_IGV=['Gravado','Exonerado','Inafecto'];
const R78_METODOS=['Efectivo','Yape','Plin','Tarjeta','Transferencia o depósito'];
const R78_DETRACCIONES=[['mant','Mantenimiento y reparación de bienes muebles',12]];
const r78Tigv=l=>l.tigv||(l.igv===false?'Exonerado':'Gravado');
/* Total de la línea (precio con IGV incluido si es gravado) y su subtotal sin IGV. */
function r78NLinea(l){const pct=+l.discPct||0,bruto=l.type==='servicio'?(+l.price||0):(+l.qty||0)*(+l.price||0),tot=r2(bruto*(1-pct/100)),rate=r77Tax().igv;
  return {tot,sub:r78Tigv(l)==='Gravado'?r2(tot*100/(100+rate)):tot}}
function r78NTotales(s){const T={exonerada:0,inafecta:0,gravada:0,igv:0,total:0};
  s.lines.filter(l=>l.name?.trim()).forEach(l=>{const x=r78NLinea(l),t=r78Tigv(l);T.total+=x.tot;if(t==='Gravado'){T.gravada+=x.sub;T.igv+=x.tot-x.sub}else if(t==='Exonerado')T.exonerada+=x.tot;else T.inafecta+=x.tot});
  for(const k in T)T[k]=r2(T[k]);const tax=r77Tax(),d=R78_DETRACCIONES.find(x=>x[0]===s.detTipo)||R78_DETRACCIONES[0];
  T.detRate=d[2];T.detraccion=s.detOn&&T.total>tax.detMin?r2(T.total*d[2]/100):0;T.pagado=r2((s.pays||[]).reduce((a,p)=>a+(+p.amount||0),0));
  const cobrar=T.total,efectivo=r2((s.pays||[]).filter(p=>p.method==='Efectivo').reduce((a,p)=>a+(+p.amount||0),0));
  T.vuelto=efectivo>0&&T.pagado>cobrar?r2(Math.min(efectivo,T.pagado-cobrar)):0;T.saldo=Math.max(0,r2(cobrar-T.pagado+T.vuelto));return T}
/* Al cargar ítems desde ODS o cotización, el descuento en monto pasa a porcentaje y el IGV a tipo de IGV. */
function r78NNormal(s){s.lines.forEach(l=>{if(l.tigv===undefined)l.tigv=l.igv===false?'Exonerado':'Gravado';if(l.discPct===undefined){const b=l.type==='servicio'?(+l.price||0):(+l.qty||0)*(+l.price||0);l.discPct=b&&l.discount?r2(l.discount/b*100):0}});
  s.pays??=[];s.detTipo??='mant';
  // Se marca sola cuando hay servicios y el total supera el mínimo; si la cajera la cambia, manda lo que eligió.
  if(!s.detTocada){const t=r78NTotales({...s,detOn:false});s.detOn=s.lines.some(l=>l.name?.trim()&&r77LineDetra(l))&&t.total>r77Tax().detMin}}
function r78NSet(k,v){const s=R77.sale;r77SaleSet(k,v,false);if(k==='condition'&&v==='Crédito'&&s.due===s.date){const d=new Date(s.date);d.setDate(d.getDate()+30);s.due=d.toISOString().slice(0,10)}r77SaleRender()}
function r78NItem(i,f,v){const l=R77.sale.lines[i];if(!l)return;if(['qty','price','discPct'].includes(f)){const n=+String(v).replace(',','.');if(v!==''&&!isFinite(n))return r77SaleRender();l[f]=n||0}else l[f]=v;r77SaleRender()}
function r78NPago(){const s=R77.sale,T=r78NTotales(s),m=$('r78npm')?.value||'Efectivo',a=$('r78npa')?.value,n=+String($('r78npv')?.value||'').replace(',','.');
  if(!(n>0))return toast('Escribe el monto del pago.');s.pays.push({method:m,account:a,amount:r2(n)});r77SaleRender()}
function r78NQuitarPago(i){R77.sale.pays.splice(i,1);r77SaleRender()}
r77SaleRender=function(){const s=R77.sale;if(!s)return;r78NNormal(s);const T=r78NTotales(s),c=client(s.client),cred=s.condition==='Crédito';
  const quotes=(db.r72quotes||[]).filter(q=>!q.deleted&&r73QLines(q).some(l=>l.name)&&(!s.client||!q.client||q.client===s.client)),
    orders=db.orders.filter(o=>!o.deleted&&!o.draft78&&!db.notes.some(n=>n.order===o.id)&&(!s.client||vehicle(o.vehicle).client===s.client)&&(!s.vehicle||o.vehicle===s.vehicle)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const n=(i,f,val)=>`<input class="r78-num" value="${esc(val??'')}" onchange="r78NItem(${i},'${f}',this.value)">`;
  const filas=s.lines.map((l,i)=>{const x=r78NLinea(l);return `<tr><td>${i+1}</td>
    <td><select onchange="r78NItem(${i},'type',this.value)"><option value="servicio" ${l.type==='servicio'?'selected':''}>Servicio</option><option value="producto" ${l.type!=='servicio'?'selected':''}>Producto</option></select></td>
    <td><input class="r78-largo" value="${esc(l.name||'')}" onchange="r78NItem(${i},'name',this.value)"></td>
    <td><input class="r78-medio" value="${esc(l.code||'')}" onchange="r78NItem(${i},'code',this.value)"></td>
    <td>${n(i,'qty',l.qty??1)}</td><td>${n(i,'price',l.price)}</td><td>${n(i,'discPct',l.discPct||0)}</td>
    <td><select onchange="r78NItem(${i},'tigv',this.value)">${R78_TIPOS_IGV.map(t=>`<option ${r78Tigv(l)===t?'selected':''}>${t}</option>`).join('')}</select></td>
    <td class="r78-der">${money(x.sub)}</td><td class="r78-der">${money(x.tot)}</td>
    <td><button type="button" class="r78-mini" title="Quitar ítem" onclick="r77SaleDelLine(${i})">🗑</button></td></tr>`}).join('');
  const pagos=s.pays.map((p,i)=>`<tr><td>${esc(p.method)}</td><td>${esc(r73Acc(p.account)?.name||'—')}</td><td class="r78-der">${money(p.amount)}</td><td><button type="button" class="r78-mini" title="Quitar pago" onclick="r78NQuitarPago(${i})">✕</button></td></tr>`).join('')||'<tr><td colspan="4" class="sub r78-der">Sin pagos todavía</td></tr>';
  const fila=(t,v,cl='')=>`<div class="r78-suma ${cl}"><span>${t}</span><span>${v}</span></div>`;
  $('modal').classList.remove('r78-chico');$('modal').classList.add('r78-ancho');
  r77Open(`<div class="r78-ods r78-nota">
  <div class="r78-cab"><h2>Nueva nota de venta</h2>
    <label class="r78-cot">¿Deseas cargar los ítems de una orden de servicio?<span class="r78-en"><select id="r78no">${r72Opt(orders.map(o=>[o.id,'#'+o.code+' · '+o.date+' · '+(vehicle(o.vehicle).plate||'')]),s.order||'','Sin orden de servicio')}</select><button type="button" onclick="r77SaleLoadOrder($('r78no').value);r77SaleRender()">Cargar</button></span></label>
    <label class="r78-cot">¿O de una cotización?<span class="r78-en"><select id="r78nq">${r72Opt(quotes.map(q=>[q.id,q.code+' · '+(client(q.client).name||'sin cliente')]),s.quote||'','Sin cotización')}</select><button type="button" onclick="r77SaleLoadQuote($('r78nq').value)">Cargar</button></span></label>
    <button type="button" onclick="r77SaleExit()">Salir</button></div>
  <section class="r78-comprobante"><h3>Datos del comprobante</h3><div class="r78-rejilla">
    <label>Local<select onchange="r78NSet('branch',this.value)">${r72Opt((db.branches||[]).map(b=>[b.id,b.name||b.id]),s.branch)}</select></label>
    <label>Fecha de emisión<input type="date" value="${s.date}" onchange="r78NSet('date',this.value)"></label>
    <label>Fecha de vencimiento<input type="date" value="${s.due}" ${cred?'':'disabled'} onchange="r78NSet('due',this.value)"></label>
    <label>Condición<span class="r78-radios"><label class="r78-chk"><input type="radio" name="r78ncond" ${cred?'':'checked'} onchange="r78NSet('condition','Contado')">Contado</label><label class="r78-chk"><input type="radio" name="r78ncond" ${cred?'checked':''} onchange="r78NSet('condition','Crédito')">Crédito</label></span></label>
    <label class="r78-doble">Cliente<span class="r78-en"><select onchange="r78NSet('client',this.value)">${r72Opt(db.clients.filter(x=>!x.deleted).map(x=>[x.id,(x.doc?x.doc+' ':'')+x.name]),s.client,'Cliente varios')}</select><button type="button" onclick="r77SaleNew('client')">＋ Cliente</button></span></label>
    <label>Placa<select onchange="r78NSet('vehicle',this.value)">${r72Opt(db.vehicles.filter(x=>!x.deleted&&(!s.client||x.client===s.client)).map(x=>[x.id,x.plate]),s.vehicle,'Sin vehículo')}</select></label>
    <label>Documento<input disabled value="${esc(c.doc||'')}"></label>
    <label class="r78-desc">Observaciones<textarea rows="2" onchange="R77.sale.obs=this.value">${esc(s.obs||'')}</textarea></label>
    <label class="r78-desc">Comentario<textarea rows="2" onchange="R77.sale.comment=this.value">${esc(s.comment||'')}</textarea></label>
  </div></section>
  <div class="r78-fila"><h3>Detalle</h3><span class="r78-en r78-catalogo"><select onchange="R77.sale.cat=this.value;const c=db.catalog.find(x=>x.id===this.value);R77.sale.cprice=c?r77LPPrice(c.id,R77.sale.branch):'';R77.sale.cqty=1;R77.sale.cdisc=0">${r72Opt(db.catalog.filter(x=>!x.deleted).map(x=>[x.id,(x.code?x.code+' - ':'')+x.name+' · '+money(x.price||0)]),s.cat,'Buscar ítem del catálogo')}</select><button type="button" onclick="r77SaleAddCat()">＋ Agregar</button></span></div>
  <div class="r78-items"><table><thead><tr><th>#</th><th>Tipo</th><th>Ítem</th><th>Referencia</th><th>Cant./H-H</th><th>Precio unit.</th><th>Desc. (%)</th><th>Tipo de IGV</th><th class="r78-der">Subtotal</th><th class="r78-der">Total</th><th></th></tr></thead><tbody>${filas||'<tr><td colspan="11" class="sub">Sin ítems todavía</td></tr>'}</tbody></table></div>
  <button type="button" class="r78-agregar" onclick="r77SaleBlank()">+ Agregar ítem</button>
  <div class="r78-pie"><section class="r78-abonos"><div class="r78-fila"><h3>Historial de pagos</h3></div>
      <div class="r78-fila izq r78-pagar"><select id="r78npm">${R78_METODOS.map(m=>`<option>${m}</option>`).join('')}</select><select id="r78npa">${r72Opt(r73AccOpts(),s.account)}</select><input id="r78npv" inputmode="decimal" placeholder="Monto" value="${T.saldo&&!s.pays.length&&!cred?T.saldo:''}"><button type="button" class="r78-verde" onclick="r78NPago()">＋ Agregar pago</button></div>
      <table><thead><tr><th>Forma de pago</th><th>Cuenta</th><th class="r78-der">Monto</th><th></th></tr></thead><tbody>${pagos}</tbody></table>
      <div class="r78-fila izq r78-detra"><label class="r78-chk"><input type="checkbox" ${s.detOn?'checked':''} onchange="R77.sale.detOn=this.checked;R77.sale.detTocada=true;r77SaleRender()">Detracción</label>${s.detOn?`<label>Tipo de detracción<select onchange="R77.sale.detTipo=this.value;r77SaleRender()">${R78_DETRACCIONES.map(d=>`<option value="${d[0]}" ${s.detTipo===d[0]?'selected':''}>${d[1]} (${d[2]} %)</option>`).join('')}</select></label>`:''}</div></section>
    <section class="r78-abonos r78-totales">${fila('Exonerada',money(T.exonerada))}${fila('Inafecta',money(T.inafecta))}${fila('Gravada',money(T.gravada))}${fila('IGV ('+r77Tax().igv+' %)',money(T.igv))}
      <div class="r78-total"><span>TOTAL</span><b>${money(T.total)}</b></div>${fila('Detracción a depositar'+(s.detOn?' ('+T.detRate+' %)':''),money(T.detraccion))}${fila('Total formas de pago',money(T.pagado),'r78-verdetxt')}${T.vuelto?fila('Vuelto',money(T.vuelto)):''}${fila('Saldo',money(T.saldo),'r78-rojo')}</section></div>
  <div class="r78-fila fin"><button type="button" onclick="r77SaleExit()">Salir</button>${s.detOn&&T.detraccion&&s.lines.some(l=>l.type==='servicio')&&s.lines.some(l=>l.type!=='servicio')?`<button type="button" onclick="r77SaleSplit()">Separar servicios y productos</button>`:''}<button type="button" class="primary" onclick="r77SaleEmit()">Emitir nota de venta</button></div></div>`)};
/* Las líneas guardan el IGV como antes (igv true/false) y el descuento en monto, para que reportes y PDF sigan igual. */
function r78NAlGuardar(s){s.lines.forEach(l=>{l.igv=r78Tigv(l)==='Gravado';const b=l.type==='servicio'?(+l.price||0):(+l.qty||0)*(+l.price||0);l.discount=r2(b*(+l.discPct||0)/100)});const T=r78NTotales(s);s.detForce=!!T.detraccion;return T}
r77SaleEmit=function(){const d=R77.sale;if(!d)return;if(db.settings.useCajas&&!r77MyBox())return toast('Aperturar una caja antes de emitir.');const lines=d.lines.filter(l=>l.name?.trim());if(!lines.length)return toast('Agrega al menos un ítem.');
  const T=r78NAlGuardar(d),o=d.order&&db.orders.find(x=>x.id===d.order);
  if(T.total===0&&o?.attentionType!=='Garantía'&&!confirm('El total es cero y no es garantía. ¿Emitir de todos modos?'))return;
  if(d.condition==='Contado'&&T.saldo>0&&!confirm('Queda un saldo de '+money(T.saldo)+'. ¿Emitir de todos modos?'))return;
  const n=r77SaleMake(d,lines,0);n.observation=d.obs||'';n.comment=d.comment||'';n.taxes={exonerada:T.exonerada,inafecta:T.inafecta,gravada:T.gravada,igv:T.igv};
  if(!T.detraccion)delete n.detraction;else n.detraction={...(n.detraction||{}),rate:T.detRate,amount:T.detraccion,base:T.total,tipo:(R78_DETRACCIONES.find(x=>x[0]===d.detTipo)||R78_DETRACCIONES[0])[1],reason:n.detraction?.reason||'voluntaria',deposited:false};
  (d.pays||[]).forEach(p=>{const monto=p.method==='Efectivo'&&T.vuelto?r2(Math.max(0,p.amount-T.vuelto)):p.amount;if(!(monto>0))return;db.payments.push({id:uid(),order:o?.id||null,note:n.id,amount:monto,account:p.account,method:p.method,ref:'Pago nota de venta '+n.code,date:new Date().toISOString(),actor,seq:r73Seq()});const a=r73Acc(p.account);if(a)a.balance=r2((a.balance||0)+monto)});
  if(o){o.billing='Facturado';o.noteCode=n.code;r7Log(o.id,'Nota de venta emitida',n.code+' · '+d.condition+' · '+money(T.total)+(T.detraccion?' · detracción '+money(T.detraccion):''))}
  R77.sale=null;R73.lastText='Nota de venta '+n.code+' emitida';save('Nota de venta emitida',n.code);r78NotaVer(n.id)};
const r78NSplitBase=r77SaleSplit;
r77SaleSplit=function(){const s=R77.sale;if(s){const T=r78NAlGuardar(s);s.pay=T.pagado;s.method=s.pays[0]?.method||s.method;s.account=s.pays[0]?.account||s.account}r78NSplitBase()};
/* Los ítems de la ODS traen el descuento en porcentaje (discPct): se conserva al cargarlos en la nota. */
const r78NLoadOrderBase=r77SaleLoadOrder;
r77SaleLoadOrder=function(id){const s=R77.sale,n=s?s.lines.length:0;r78NLoadOrderBase(id);const o=db.orders.find(x=>x.id===id);if(!s||!o)return;(o.lines||[]).filter(l=>l.name).forEach((l,i)=>{const x=s.lines[n+i];if(x&&l.discPct!==undefined)x.discPct=+l.discPct||0})};
/* El formato de pantalla completa es solo para el editor de ODS y la nota de venta; al cerrar o abrir otra ventana se quita. */
const r78ModalBase=modal;
modal=function(html,...r){if(!/class="r78-ods/.test(String(html)))$('modal').classList.remove('r78-ancho');return r78ModalBase(html,...r)};
$('modal').addEventListener('close',()=>{if(!$('modal').open)$('modal').classList.remove('r78-ancho')});
/* ---------- Ver una nota ya emitida: la misma pantalla, con el historial de pagos y el registro de pagos ---------- */
const r78VerOriginal=r73ViewNote;
function r78NotaPagos(n){const ab=n.order?db.advances.filter(a=>a.order===n.order).map(a=>({date:a.date,method:a.method,account:a.account,amount:+a.amount||0,ref:a.concept||'Abono de la ODS'})):[];
  const ps=db.payments.filter(p=>n.order?p.order===n.order:p.note===n.id).map(p=>({date:p.date,method:p.method,account:p.account,amount:+p.amount||0,ref:p.ref||''}));return [...ab,...ps].sort((a,b)=>String(a.date).localeCompare(String(b.date)))}
function r78NotaVer(id){const n=db.notes.find(x=>x.id===id);if(!n)return;const s={lines:structuredClone(n.lines||[]),detOn:!!n.detraction,detTocada:true,pays:[]};r78NNormal(s);
  const T=r78NTotales(s),pagos=r78NotaPagos(n),pagado=r2(r73NotePaid(n)),det=n.detraction?.amount||0,saldo=Math.max(0,r2((+n.total||T.total)-pagado)),fila=(t,v,cl='')=>`<div class="r78-suma ${cl}"><span>${t}</span><span>${v}</span></div>`,ro=(l,v,cl='')=>`<label class="${cl}">${l}<input disabled value="${esc(v??'')}"></label>`;
  const filas=s.lines.map((l,i)=>{const x=r78NLinea(l);return `<tr><td>${i+1}</td><td>${l.type==='servicio'?'Servicio':'Producto'}</td><td>${esc(l.name||'')}</td><td>${esc(l.code||'')}</td><td class="r78-der">${l.qty??1}</td><td class="r78-der">${money(l.price)}</td><td class="r78-der">${l.discPct||0}</td><td>${r78Tigv(l)}</td><td class="r78-der">${money(x.sub)}</td><td class="r78-der">${money(x.tot)}</td></tr>`}).join('');
  const hist=pagos.map(p=>`<tr><td>${esc(String(p.date||'').slice(0,16).replace('T',' '))}</td><td>${esc(p.method||'')}</td><td>${esc(r73Acc(p.account)?.name||'—')}</td><td>${esc(p.ref)}</td><td class="r78-der">${money(p.amount)}</td></tr>`).join('')||'<tr><td colspan="5" class="sub r78-der">Sin pagos registrados</td></tr>';
  modal(`<div class="r78-ods r78-nota">
  <div class="r78-cab"><h2>Nota de venta ${esc(n.code)}</h2><span class="r78-en"></span><button type="button" onclick="r78VerOriginal('${id}')">🖨 Imprimir o PDF</button><button type="button" onclick="closeModal()">Salir</button></div>
  <section class="r78-comprobante"><h3>Datos del comprobante</h3><div class="r78-rejilla">
    ${ro('Tipo de documento','Nota de venta')}${ro('Serie',n.series)}${ro('Número',String(n.number).padStart(6,'0'))}${ro('Fecha de emisión',n.date)}${ro('Fecha de vencimiento',n.due)}${ro('Condición',n.condition)}
    ${ro('Cliente',(n.client?.doc?n.client.doc+' ':'')+(n.client?.name||''),'r78-doble')}${ro('Placa',n.vehicle?.plate||'')}${ro('Orden de servicio',db.orders.find(o=>o.id===n.order)?.code||'')}
    <label class="r78-mitad">Observaciones<textarea rows="2" disabled>${esc(n.observation||'')}</textarea></label><label class="r78-mitad">Comentario<textarea rows="2" disabled>${esc(n.comment||'')}</textarea></label>
  </div></section>
  <div class="r78-fila"><h3>Detalle</h3></div>
  <div class="r78-items"><table><thead><tr><th>#</th><th>Tipo</th><th>Ítem</th><th>Referencia</th><th class="r78-der">Cant./H-H</th><th class="r78-der">Precio unit.</th><th class="r78-der">Desc. (%)</th><th>Tipo de IGV</th><th class="r78-der">Subtotal</th><th class="r78-der">Total</th></tr></thead><tbody>${filas}</tbody></table></div>
  <div class="r78-pie"><section class="r78-abonos"><div class="r78-fila"><h3>Historial de pagos</h3></div>
      ${saldo>0?`<div class="r78-fila izq r78-pagar"><select id="r78npm">${R78_METODOS.map(m=>`<option>${m}</option>`).join('')}</select><select id="r78npa">${r72Opt(r73AccOpts(),'')}</select><input id="r78npv" inputmode="decimal" placeholder="Monto" value="${saldo}"><button type="button" class="r78-verde" onclick="r78NotaPagar('${id}')">＋ Registrar pago</button></div>`:''}
      <table><thead><tr><th>Fecha</th><th>Forma de pago</th><th>Cuenta</th><th>Concepto</th><th class="r78-der">Monto</th></tr></thead><tbody>${hist}</tbody></table>
      ${n.detraction?`<p class="sub">Detracción: ${esc(n.detraction.tipo||'Mantenimiento y reparación de bienes muebles')} (${n.detraction.rate} %) · ${n.detraction.deposited?'depositada':'por depositar'}</p>`:''}</section>
    <section class="r78-abonos r78-totales">${fila('Exonerada',money(T.exonerada))}${fila('Inafecta',money(T.inafecta))}${fila('Gravada',money(T.gravada))}${fila('IGV ('+r77Tax().igv+' %)',money(T.igv))}
      <div class="r78-total"><span>TOTAL</span><b>${money(n.total??T.total)}</b></div>${fila('Detracción a depositar',money(det))}${fila('Total formas de pago',money(pagado),'r78-verdetxt')}${fila('Saldo',money(saldo),'r78-rojo')}</section></div>
  <div class="r78-fila fin"><button type="button" onclick="closeModal()">Salir</button></div></div>`);$('modal').classList.remove('r78-chico');$('modal').classList.add('r78-ancho')}
function r78NotaPagar(id){const n=db.notes.find(x=>x.id===id),m=$('r78npm')?.value||'Efectivo',a=$('r78npa')?.value,v=+String($('r78npv')?.value||'').replace(',','.');if(!n)return;if(!(v>0))return toast('Escribe el monto del pago.');
  db.payments.push({id:uid(),order:n.order||null,note:n.id,amount:r2(v),account:a,method:m,ref:'Pago nota de venta '+n.code,date:new Date().toISOString(),actor,seq:r73Seq()});const c=r73Acc(a);if(c)c.balance=r2((c.balance||0)+v);
  if(n.order)r7Log(n.order,'Pago registrado',n.code+' · '+m+' · '+money(v));R73.lastText='Pago de '+n.code+' registrado';save('Pago registrado',n.code);r78NotaVer(id)}
r73ViewNote=r78NotaVer;
/* ---------- Cotización en una sola pantalla, sin pestañas ---------- */
r77QuoteShell=function(id){const q=r73Quote(id),mb=$('modalbody');if(!q||!mb||mb.querySelector('.r78-qunica'))return;const m=r73QModule(q),kids=[...mb.children],header=kids[0],footer=mb.querySelector(':scope>footer'),fields=mb.querySelector(':scope>.r72-fields'),mid=kids.filter(k=>k!==header&&k!==footer&&k!==fields);
  const dates=`<label>Fecha de creación<input disabled value="${esc(q.createdDate||r73Date(q.createdAt))}"></label><label>Fecha de vencimiento<input type="date" value="${esc(q.dueDate||q.createdDate||today())}" onchange="r77QuoteDue('${id}',this.value)"></label>`;
  const sec=document.createElement('section');sec.className='r78-comprobante r78-qunica';sec.innerHTML='<h3>Datos de la cotización</h3>';
  if(fields){sec.appendChild(fields);fields.insertAdjacentHTML('beforeend',dates)}else sec.insertAdjacentHTML('beforeend',`<div class="r72-fields"><label>Cliente<input disabled value="${esc(client(r73QClient(q)).name||'Sin cliente')}"></label><label>Vehículo<input disabled value="${esc(vehicle(r73QVehicle(q)).plate||'Sin vehículo')}"></label><label>Sede<input disabled value="${esc(r73Sede(q.branch))}"></label>${dates}</div>`);
  header.insertAdjacentElement('afterend',sec);let ant=sec;mid.forEach(k=>{ant.insertAdjacentElement('afterend',k);ant=k});
  const f=document.createElement('footer');f.className='r77-foot';f.innerHTML=button('SALIR','closeModal()')+button('GUARDAR CAMBIOS',"r77QuoteSave('"+id+"')",true)+button('AVANZAR SIN ENVIAR PRESUPUESTO',"r77QuoteAdvance('"+id+"')",true)+button('FINALIZAR Y ENVIAR',"r77QuoteEmit('"+id+"',true)",true);
  if(footer)footer.replaceWith(f);else mb.appendChild(f);
  const h2=header.querySelector('h2');if(h2&&q.state==='Emitida'&&!header.querySelector('.pill'))h2.insertAdjacentHTML('beforebegin','<span class="pill green">Emitida</span> ');
  $('modal').classList.remove('r78-chico');$('modal').classList.add('r78-ancho')};
/* Nueva cotización: se abre directo en esa misma pantalla; si se cierra sin ítems, no queda guardada. */
r73NewQuote=function(prefill={}){R77.qd={client:prefill.client||'',vehicle:prefill.vehicle||'',branch:prefill.branch||r73UserSede(),created:today(),due:today(),lines:prefill.lines||[]};const antes=new Set((db.r72quotes||[]).map(q=>q.id));r77QuoteNewGo('cot');
  const q=(db.r72quotes||[]).find(x=>!antes.has(x.id));if(q)R78.qVacia=q.id};
$('modal').addEventListener('close',()=>{const id=R78.qVacia;if(!id)return;R78.qVacia=null;const q=r73Quote(id);if(q&&!r73QLines(q).some(l=>l.name)&&q.state!=='Emitida'){db.r72quotes=db.r72quotes.filter(x=>x.id!==id);try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}render()}});
/* Las series de comprobantes las asigna el sistema por local: el maestro pasa a Beta. */
(function(){const m=R75_NAV.find(n=>n.sec==='Maestros'),b=R75_NAV.find(n=>n.sec==='Beta');if(m)m.items=m.items.filter(i=>i!=='series');if(b&&!b.items.includes('series'))b.items.push('series');R77_BETA.add('series');r75Rebuild();r75Nav()})();
/* La serie sale del local elegido en la nota (N001 Unión, N002 Prohogar), no del local del usuario. */
r73NoteSeries=function(branch){const s=(db.r74series||[]).find(x=>x.active!==false&&x.docType==='Nota de venta'&&x.branch===branch);return s?.series||(db.branches||[]).find(b=>b.id===branch)?.series||(branch==='prohogar'?'N002':'N001')};
