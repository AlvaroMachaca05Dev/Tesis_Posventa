base = 'F:/Tesis/Tesis_Posventa/prototipo/'
p = base + 'capas/r86/a_timeline.js'
s = open(p, encoding='utf-8').read()

i0 = s.index("/* La cotización por paquete muestra el paquete y, al pie, su ficha")
nuevo = r'''/* Ficha del servicio: un ojito junto a la línea (cotización y ODS) despliega, justo debajo, un recuadro pequeño con lo que incluye y sus tiempos. */
R86.fichas=new Set();
function r86FichaDe(l){
  if(l.ficha)return l.ficha;
  if(l.type!=='servicio')return null;
  const c=l.catalog?db.catalog.find(x=>x.id===l.catalog):null,code=c?.code||l.code,k=Object.keys(R86_PCODE).find(z=>R86_PCODE[z]===code);
  return k?{servicios:R84_PAQ[k].l.map(z=>({n:z.n,h:z.h})),horas:c?.hours}:null;
}
function r86FichaTog(id){R86.fichas.has(id)?R86.fichas.delete(id):R86.fichas.add(id);r72Refresh()}
const R86_OJO='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>';
const r86GridBase=r72Grid;
r72Grid=function(k,o){
  const h=r86GridBase(k,o);
  try{
    const box=r72Box(k);if(!box||!(box.lines||[]).length)return h;
    return h.replace(/<tr class="[^"]*">\s*<td class="r72-ck">[\s\S]*?<\/tr>/g,row=>{
      const m=row.match(/r72Toggle\('[^']*','([^']+)'/);if(!m)return row;
      const l=box.lines.find(x=>x.id===m[1]),f=l&&r86FichaDe(l);if(!f)return row;
      const abierta=R86.fichas.has(l.id),ojo=`<button type="button" class="r86-ojo ${abierta?'on':''}" title="${abierta?'Ocultar':'Ver'} ficha" aria-label="${abierta?'Ocultar':'Ver'} ficha de ${esc(l.name)}" aria-expanded="${abierta}" onclick="r86FichaTog('${l.id}')">${R86_OJO}</button>`;
      const fila=abierta?`<tr class="r86-fila-ficha"><td colspan="14"><div class="r86-fichab" role="group" aria-label="Ficha de ${esc(l.name)}"><b>Servicios que incluye</b>${f.horas!=null?` <span class="muted">· tiempo del paquete ${f.horas} h</span>`:''}<ul>${f.servicios.map(z=>`<li>${esc(z.n)} · ${z.h} h</li>`).join('')}</ul></div></td></tr>`:'';
      return row.replace('<td class="r72-ck">','<td class="r72-ck">'+ojo)+fila;
    });
  }catch(e){console.warn('r86 ficha',e);return h}
};
'''
s = s[:i0] + nuevo
open(p, 'w', encoding='utf-8').write(s)

p = base + 'capas/r86/estilos.css'
t = open(p, encoding='utf-8').read()
# quitar estilos de la ficha al pie
import re
t = re.sub(r"\.r86-ficha\{[^}]*\}\.r86-ficha h3\{[^}]*\}\.r86-ficha table\{[^}]*\}\.r86-ficha td\{[^}]*\}\.r86-fh\{[^}]*\}\n", "", t)
t += '''
button.r86-ojo{border:0;background:transparent;padding:0 4px;color:#9fb0c9;cursor:pointer;vertical-align:middle;border-radius:6px}button.r86-ojo:hover{background:#1d2b46}button.r86-ojo.on{color:#a6e22e;background:#1d2b46}
tr.r86-fila-ficha>td{padding:0 8px 6px 34px}.r86-fichab{border:1px solid #2a374a;border-radius:8px;background:#101a30;padding:5px 10px;font-size:11px;max-width:640px}
.r86-fichab ul{margin:3px 0 0;padding-left:16px;columns:2 240px;column-gap:18px}.r86-fichab li{margin:1px 0;break-inside:avoid}
'''
open(p, 'w', encoding='utf-8').write(t)
print('ok')
