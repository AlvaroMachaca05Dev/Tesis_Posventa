/* --------------------------------------------------------------------------
   R7.8 · Responsables de los ítems de la ODS y sus tareas (05/11/2026).
   - Servicio: técnico, jefe de taller o «Servicios externos». Por defecto, el técnico de la ODS.
   - Producto: cajera o logístico. Por defecto, la cajera que registra (o la primera cajera).
   - Al crear la ODS, y con cada cambio de ítems, se crean sus tareas: el evento de la ODS con una
     subtarea por ítem (servicio → su técnico, producto → su responsable). Un servicio externo queda sin asignar.
   -------------------------------------------------------------------------- */
const r78EsExterno=u=>/extern/i.test(u?.name||'');
function r78RespServ(){return db.users.filter(u=>u.active!==false&&(['Técnico','Jefe de taller'].includes(u.role)||r78EsExterno(u))).map(u=>[u.id,u.name])}
function r78RespProd(){return db.users.filter(u=>u.active!==false&&['Cajera','Logístico'].includes(u.role)).map(u=>[u.id,u.name])}
function r78CajeraDefecto(){const yo=db.users.find(u=>u.id===actor);return yo?.role==='Cajera'?yo.id:(db.users.find(u=>u.role==='Cajera'&&u.active!==false)?.id||'')}
/* Mientras la persona no elija otro responsable, el servicio sigue al técnico de la ODS y el producto queda con la cajera. */
function r78Defecto(o,l){if(l.respTocado)return;if(l.type==='servicio')l.tech=o.tech||'';else if(!l.logistic)l.logistic=r78CajeraDefecto()}
const r78Sinc=id=>{const o=db.orders.find(x=>x.id===id);if(o&&!o.draft78&&o.code)r72SyncEvent('o:'+id)};
const r78EditorBase=r78Editor;
r78Editor=function(id,...r){const o=db.orders.find(x=>x.id===id);if(o)o.lines.forEach(l=>r78Defecto(o,l));return r78EditorBase(id,...r)};
const r78ItemBase=r78Item;
r78Item=function(id,i,f,val){const o=db.orders.find(x=>x.id===id),l=o?.lines[i];if(!l)return;
  if(f==='logistic'){l.logistic=val||'';l.respTocado=true;save('Responsable del producto',o.code)}
  else{const antes=l.type;if(f==='tech')l.respTocado=true;r78ItemBase(id,i,f,val);if(f==='type'&&l.type!==antes){l.respTocado=false;if(l.type==='servicio')l.logistic='';else l.tech=''}}
  r78Sinc(id);r78Editor(id)};
const r78SetBase=r78Set;
r78Set=function(id,f,val){r78SetBase(id,f,val);if(f==='tech'){r78Sinc(id);r78Editor(id)}};
const r78AgregarBase=r78Agregar;
r78Agregar=function(id){r78AgregarBase(id);r78Sinc(id);r78Editor(id)};
const r78CrearBase=r78Crear;
r78Crear=function(id){const o=db.orders.find(x=>x.id===id);if(o)o.lines.forEach(l=>r78Defecto(o,l));r78CrearBase(id);if(o&&!o.draft78){r72SyncEvent('o:'+id);save('Tareas de la ODS',o.code)}};
/* Un servicio externo no tiene responsable en el taller: su tarea queda sin asignar. */
const r78SyncEventBase=r72SyncEvent;
r72SyncEvent=function(k,...r){const t=r78SyncEventBase(k,...r);try{const box=r72Box(k);if(t&&box)db.tasks.filter(s=>s.parent===t.id&&s.r72line&&!s.deleted).forEach(s=>{const l=box.lines.find(x=>x.id===s.r72line);if(l?.type==='servicio'&&r78EsExterno(db.users.find(u=>u.id===l.tech)))s.owner=''})}catch(err){console.warn('tareas externas',err)}return t};
