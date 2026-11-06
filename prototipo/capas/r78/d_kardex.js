/* --------------------------------------------------------------------------
   R7.8 · Kárdex de productos calcado del sistema AIM (05/11/2026).
   - Formato fijo, sin filtros por columna: filtros de búsqueda (local, producto, desde, hasta), Buscar y Excel.
   - Columnas: Fecha, Tipo Doc., Nro. Doc., Razón social, Usuario, Comentarios, Entradas, Salidas y Saldo.
   - La nota de venta descuenta del kárdex cada producto vendido (tipo «Venta»).
   - Cada ajuste de inventario sale como «Edición», con el comentario «Pasó de 5 a 4».
   - El Excel (.xlsx) tiene las mismas columnas que la pantalla.
   -------------------------------------------------------------------------- */
const r78KUsuario=id=>db.users.find(u=>u.id===id)?.name||(id==='Sistema'?'Sistema':id||'');
/* Ajuste de inventario → «Edición» con el comentario «Pasó de X a Y». */
const r78KAddBase=r77KAdd;
r77KAdd=function(e){if(e&&e.kind==='Ajuste por edición'){const m=String(e.note||'').match(/ de (-?[\d.,]+) a (-?[\d.,]+):/);e={...e,kind:'Edición',party:'',note:m?`Pasó de ${m[1]} a ${m[2]}`:e.note}}return r78KAddBase(e)};
/* La venta descuenta del local de la nota cada producto del catálogo. */
const r78KSaleMakeBase=r77SaleMake;
r77SaleMake=function(d,lines,...r){const n=r78KSaleMakeBase(d,lines,...r);try{const loc=r77LocByBranch(d.branch)||r77Inv().locales.find(l=>l.active!==false);
  if(loc)lines.filter(l=>l.type!=='servicio').forEach(l=>{const c=r77CatOf(l);if(c&&c.type==='producto'&&+l.qty>0)r77KAdd({date:n.date,local:loc.id,item:c.id,kind:'Venta',docNo:n.code,party:n.client?.name||'Cliente varios',partyDoc:n.client?.doc||'',outQty:+l.qty,totalVenta:r73NLTotal(l),note:d.comment||d.obs||'',note78:n.id})})}catch(err){console.warn('kárdex venta',err)}return n};
/* RUC o DNI de quien compra o vende, y totales de compra y de venta del movimiento (sin costo por lote). */
function r78KDocParte(k){if(k.partyDoc)return k.partyDoc;if(k.purchase){const p=db.purchaseInvoices.find(x=>x.id===k.purchase),s=p&&db.suppliers.find(x=>x.id===p.supplier);return s?.ruc||s?.doc||''}const n=db.notes.find(x=>x.id===k.note78||x.code===k.docNo);return n?.client?.doc||''}
const r78KTotCompra=k=>k.inQty&&k.cost?r2(k.cost*k.inQty):'';
function r78KTotVenta(k){if(!k.outQty)return '';if(k.totalVenta!==undefined)return k.totalVenta;const n=db.notes.find(x=>x.id===k.note78||(k.kind==='Venta'&&x.code===k.docNo));if(!n)return '';
  return r2((n.lines||[]).filter(l=>r77CatOf(l)?.id===k.item).reduce((a,l)=>a+r73NLTotal(l),0))||''}
const r78KLocalDefecto=()=>{const v=r77Inv(),br=typeof r73UserSede==='function'?r73UserSede():'';return (r77LocByBranch(br)||v.locales.find(l=>l.active!==false)||{}).id||''};
function r78KDatos(){const f=R77I.kf;if(!f.local)f.local=r78KLocalDefecto();const r=r77KRows();if(!r)return null;
  const filas=[...(r.open!==null&&r.open!==0?[{date:f.from,kind:'Saldo anterior',docNo:'',party:'',by:'',note:'',inQty:0,outQty:0,saldo:r.open}]:[]),...r.rows];
  return {it:r.it,id:db.catalog.indexOf(r.it)+1,desc:(r.it.code?r.it.code+': ':'')+r.it.name,unidad:r.it.unit||'UNIDAD - BIENES',filas}}
const r78KNum=x=>x?Number(x).toFixed(2):'';
views.kardex=()=>{const v=r77Inv(),f=R77I.kf;if(!f.local)f.local=r78KLocalDefecto();const k=r78KDatos();
  const doc=x=>{if(!x.docNo)return '';const n=db.notes.find(y=>y.code===x.docNo);return n?`<a href="#" onclick="event.preventDefault();r78NotaVer('${n.id}')">${esc(x.docNo)}</a>`:esc(x.docNo)};
  return `<section class="r78-kfiltros"><h3>ℹ Filtros de búsqueda</h3><div class="r78-kfg"><datalist id="r77kdl">${db.catalog.filter(c=>c.type==='producto'&&!c.deleted).map(c=>`<option value="${esc(r77ProdLabel(c))}">`).join('')}</datalist>
    <label>Local<select id="r77kl">${v.locales.filter(l=>l.active!==false).map(l=>`<option value="${l.id}" ${f.local===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>
    <label class="r78-kprod">Producto<input id="r77kq" list="r77kdl" value="${esc(R77I.kq)}" placeholder="Código o nombre"></label>
    <label>Desde<input type="date" id="r77kd" value="${f.from||''}"></label><label>Hasta<input type="date" id="r77kh" value="${f.to||''}"></label>
    <div class="r78-kbot"><button type="button" onclick="r77KSearch()">🔍 Buscar</button><button type="button" onclick="r78KExcel()">▦ Excel</button></div></div></section>
  <section class="r78-kcaja"><div class="r78-kpest">Unidades</div>${k?`<table class="r78-ktabla"><thead>
    <tr class="r78-kprodfila"><th>ID</th><th>${k.id}</th><th>Descripción</th><th colspan="5">${esc(k.desc)}</th><th>Unidad de medida</th><th colspan="2">${esc(k.unidad)}</th></tr>
    <tr><th>Fecha</th><th>Tipo Doc.</th><th>Nro. Doc.</th><th>RUC / DNI</th><th>Usuario</th><th>Comentarios</th><th>Entradas</th><th>Total compra</th><th>Salidas</th><th>Total venta</th><th>Saldo</th></tr></thead><tbody>
    ${k.filas.map(x=>{const tc=r78KTotCompra(x),tv=r78KTotVenta(x);return `<tr><td class="r78-c">${esc(x.date||'')}</td><td>${esc(x.kind||'')}</td><td class="r78-c">${doc(x)}</td><td class="r78-c">${esc(r78KDocParte(x))}</td><td>${esc(r78KUsuario(x.by))}</td><td>${esc(x.note||'')}</td><td class="r78-der">${r78KNum(x.inQty)}</td><td class="r78-der">${tc===''?'':money(tc)}</td><td class="r78-der">${r78KNum(x.outQty)}</td><td class="r78-der">${tv===''?'':money(tv)}</td><td class="r78-der">${x.saldo}</td></tr>`}).join('')||'<tr><td colspan="11" class="sub">Sin movimientos en este rango</td></tr>'}
    </tbody></table>`:'<p class="sub r78-kvacio">Elige el local y el producto, y pulsa Buscar.</p>'}</section>`};
/* ---------- Excel .xlsx mínimo (sin librerías): zip sin compresión con una hoja ---------- */
const r78Crc=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=t[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}})();
function r78Zip(archivos){const enc=new TextEncoder(),partes=[],dir=[];let off=0;
  const u16=n=>[n&255,(n>>>8)&255],u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
  for(const [nombre,texto] of archivos){const nb=enc.encode(nombre),db_=enc.encode(texto),crc=r78Crc(db_);
    const cab=[...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(db_.length),...u32(db_.length),...u16(nb.length),...u16(0)];
    partes.push(new Uint8Array(cab),nb,db_);
    dir.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(db_.length),...u32(db_.length),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nb);
    off+=cab.length+nb.length+db_.length}
  const tamDir=dir.reduce((a,x)=>a+x.length,0);
  return new Blob([...partes,...dir,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(archivos.length),...u16(archivos.length),...u32(tamDir),...u32(off),...u16(0)])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
function r78Xlsx(filas,{negritas=[],uniones=[],anchos=[]}={}){const x=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),col=i=>{let s='';i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};
  const hoja=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${anchos.length?`<cols>${anchos.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`:''}<sheetData>${filas.map((f,r)=>`<row r="${r+1}">${f.map((v,c)=>{const ref=col(c)+(r+1),s=negritas.includes(r)?' s="1"':'';return typeof v==='number'?`<c r="${ref}"${s}><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"${s}><is><t>${x(v)}</t></is></c>`}).join('')}</row>`).join('')}</sheetData>${uniones.length?`<mergeCells count="${uniones.length}">${uniones.map(u=>`<mergeCell ref="${u}"/>`).join('')}</mergeCells>`:''}</worksheet>`;
  return r78Zip([['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Kardex" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>'],
    ['xl/worksheets/sheet1.xml',hoja]])}
function r78KExcel(){const k=r78KDatos();if(!k)return toast('Primero busca un producto.');
  const filas=[['ID',k.id,'Descripción',k.desc,'','','','','Unidad de medida',k.unidad,''],['Fecha','Tipo Doc.','Nro. Doc.','RUC / DNI','Usuario','Comentarios','Entradas','Total compra','Salidas','Total venta','Saldo'],
    ...k.filas.map(x=>{const tc=r78KTotCompra(x),tv=r78KTotVenta(x);return [x.date||'',x.kind||'',x.docNo||'',r78KDocParte(x),r78KUsuario(x.by),x.note||'',x.inQty?+x.inQty:'',tc===''?'':+tc,x.outQty?+x.outQty:'',tv===''?'':+tv,+x.saldo]})];
  const a=document.createElement('a');a.href=URL.createObjectURL(r78Xlsx(filas,{negritas:[0,1],uniones:['D1:H1','J1:K1'],anchos:[12,18,14,14,20,34,10,13,10,13,10]}));a.download='kardex-'+(k.it.code||k.id)+'.xlsx';document.body.appendChild(a);a.click();a.remove()}
