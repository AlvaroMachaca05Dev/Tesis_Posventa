/* --------------------------------------------------------------------------
   R7.8 · Espacio de trabajo y permisos del técnico (05/11/2026).
   - La agenda de técnicos pasa a Beta (no entra en la tesis); en el espacio de trabajo se usan vistas tipo tablero.
   - El técnico ve solo las ODS donde está asignado (en la cabecera o en un ítem) y solo las carpetas compartidas con él.
   - Configuración de la carpeta: icono y nombre, propietario, descripción, «Hacer privado» y «Compartir solo con».
   -------------------------------------------------------------------------- */
const r78Rol=()=>db.users.find(u=>u.id===actor)?.role||'';
const r78EsJefe=()=>['Administrador','Superadministrador'].includes(r78Rol())||/superusuario/i.test(db.users.find(u=>u.id===actor)?.name||'');
/* ---------- agenda en Beta ---------- */
(function(){R75_MODS.agenda=['▦','Agenda de técnicos'];R77_BETA.add('agenda');const b=R75_NAV.find(n=>n.sec==='Beta');if(b&&!b.items.includes('agenda'))b.items.push('agenda');r75Rebuild();r75Nav()})();
views.agenda=()=>{const lista=db.lists.find(l=>l.agenda)||db.lists.find(l=>l.id==='operativa');if(lista){lista.agenda=true;listFilter=lista.id}taskView='Agenda (técnicos)';R78.enAgenda=true;try{return views.tareas()}finally{R78.enAgenda=false}};
const r78TareasBase=views.tareas;
views.tareas=()=>{if(!R78.enAgenda&&taskView==='Agenda (técnicos)')taskView='Lista';r78ListaVisible();let h=r78TareasBase();if(!R78.enAgenda)h=h.replace(/<button[^>]*>Agenda \(técnicos\)<\/button>/g,'');return h};
const r78PopBase=r77TPop;
r77TPop=function(e,items,...r){return r78PopBase(e,(items||[]).filter(x=>!/Agenda \(técnicos\)/.test(x.t||'')),...r)};
/* ---------- el técnico ve solo sus ODS ---------- */
const r78VisibleBase=r78Visible;
r78Visible=function(o){if(!r78VisibleBase(o))return false;if(r78Rol()!=='Técnico')return true;return o.tech===actor||(o.lines||[]).some(l=>l.tech===actor)};
/* ---------- carpetas privadas y compartidas ---------- */
function r78VeCarpeta(f){if(!f)return true;if(r78EsJefe()||f.owner===actor)return true;const m=f.members||[];if(f.private||r78Rol()==='Técnico')return m.includes(actor);return true}
function r78CarpetaDe(l){let f=db.folders.find(x=>x.id===l.folderId);while(f){if(!r78VeCarpeta(f))return f;f=db.folders.find(x=>x.id===f.parentId)}return null}
const r78VeLista=l=>!l.folderId||!r78CarpetaDe(l);
function r78ListaVisible(){const l=db.lists.find(x=>x.id===listFilter);if(l&&!r78VeLista(l)){listFilter=db.lists.find(r78VeLista)?.id||''}}
const r78ArbolBase=workspaceTree;
workspaceTree=function(...a){const F=db.folders,L=db.lists;try{db.folders=F.filter(f=>r78VeCarpeta(f)&&!(f.parentId&&!r78VeCarpeta(F.find(x=>x.id===f.parentId))));db.lists=L.filter(r78VeLista);return r78ArbolBase(...a)}finally{db.folders=F;db.lists=L}};
const r78FolderMenuBase=r77FolderMenu;
r77FolderMenu=function(e,id){const pop=r77TPop;r77TPop=(ev,items,...r)=>pop(ev,[{t:'Configuración de la carpeta',i:'⚙',f:()=>r78CarpetaCfg(id)},{sep:1},...items],...r);try{return r78FolderMenuBase(e,id)}finally{r77TPop=pop}};
R78.cf=null;
function r78CarpetaCfg(id){const f=db.folders.find(x=>x.id===id);if(!f)return;R78.cf={id,name:f.name,color:f.color||'#0a84ff',owner:f.owner||actor,desc:f.desc||'',private:!!f.private,members:[...(f.members||[])]};r78CarpetaPintar()}
function r78CarpetaPintar(){const c=R78.cf,ini=n=>String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase(),us=db.users.filter(u=>u.active!==false);
  $('modal').classList.remove('r78-ancho');
  modal(`<div class="r78-cfgcarpeta"><h2>Configuración de la carpeta</h2>
  <div class="r78-cfg2"><label>Icono y nombre<span class="r78-en"><input type="color" class="r78-color" value="${c.color}" onchange="R78.cf.color=this.value;r78CarpetaPintar()"><span class="r78-ico" style="background:${c.color}">${esc(ini(c.name)[0]||'C')}</span><input value="${esc(c.name)}" oninput="R78.cf.name=this.value"></span></label>
  <label>Propietario<select onchange="R78.cf.owner=this.value">${r72Opt(us.map(u=>[u.id,u.name]),c.owner)}</select></label></div>
  <label>Descripción (opcional)<input value="${esc(c.desc)}" oninput="R78.cf.desc=this.value"></label>
  <div class="r78-fila r78-priv"><span><b>Hacer privado</b></span><label class="r78-switch"><input type="checkbox" ${c.private?'checked':''} onchange="R78.cf.private=this.checked;r78CarpetaPintar()"><span></span></label></div>
  <div class="r78-fila"><span>${c.private?'Compartir solo con:':'Compartida con:'}</span><span class="r78-avatares">${c.members.map(id=>{const u=db.users.find(x=>x.id===id);return `<button type="button" class="r78-av" title="Quitar a ${esc(u?.name||id)}" onclick="R78.cf.members=R78.cf.members.filter(x=>x!=='${id}');r78CarpetaPintar()">${esc(ini(u?.name))}</button>`}).join('')}<select class="r78-avadd" onchange="if(this.value){R78.cf.members.push(this.value);r78CarpetaPintar()}">${r72Opt(us.filter(u=>!c.members.includes(u.id)).map(u=>[u.id,u.name]),'','＋ Agregar')}</select></span></div>
  <footer>${button('Cancelar','closeModal()')}${button('Guardar','r78CarpetaGuardar()',true)}</footer></div>`);$('modal').classList.add('r78-chico')}
function r78CarpetaGuardar(){const c=R78.cf,f=db.folders.find(x=>x.id===c?.id);if(!f)return closeModal();if(!c.name.trim())return toast('Escribe el nombre de la carpeta.');
  Object.assign(f,{name:c.name.trim(),color:c.color,owner:c.owner,desc:c.desc.trim(),private:c.private,members:c.members});R78.cf=null;closeModal();R73.lastText='Carpeta «'+f.name+'» configurada';save('Carpeta configurada',f.name)}
/* El título de la tarea se ve completo (en varias líneas), como en ClickUp. */
const r78PanelBase=r6TaskPanel;
r6TaskPanel=function(...a){const h=r78PanelBase(...a);return h.replace(/<input([^>]*class="titleedit"[^>]*?)value="([^"]*)"([^>]*)>/,(m,a1,v,a2)=>`<textarea${a1}${a2.replace(/\s*\/?$/,'')} rows="1">${v}</textarea>`)};
