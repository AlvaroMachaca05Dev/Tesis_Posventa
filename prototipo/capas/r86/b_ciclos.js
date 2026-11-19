/* --------------------------------------------------------------------------
   R8.6 · Panorama de ciclos: cuánto dura cada ciclo de cada plan con aceite de 5.000 km y con aceite de 7.500 km,
   y dónde caen el afinamiento y la revisión completa. Sirve para decidir cómo pasar a 7.500 km sin descuadrar el plan.
   Tres columnas por visita:
     5.000 km                  el plan tal como está
     7.500 km · meses ×1,5     la visita cada 7.500 km y los meses escalados en proporción (lo que hace hoy la línea del tiempo)
     7.500 km · meses iguales  la visita cada 7.500 km pero con los mismos meses del plan
   -------------------------------------------------------------------------- */
R86.pv=null;
const r86Escenarios=[['A','5.000 km',5000,1],['B','7.500 km · meses ×1,5',7500,1.5],['C','7.500 km · meses iguales',7500,1]];
function r86Ciclo(p,paso,escala,n){
  const c=p.ciclo,q={...p,ciclo:{...c,km:paso,meses:c.meses*escala}};
  return r84Proyeccion(q,n).map(x=>({...x,km:paso*x.n}));
}
const r86Mes=m=>{const t=Math.round(m*10)/10;return (Number.isInteger(t)?t:String(t).replace('.',','))+' m'};
const r86Anios=m=>{const a=m/12;return (Math.round(a*100)/100).toString().replace('.',',')+(a===1?' año':' años')};
function r86PaqNombre(x){return R86_NOM[x.clave]+(x.etiquetas.some(e=>/Revisión/.test(e))?' → Rev. completa':'')+(x.etiquetas.some(e=>/Afin/.test(e))?' + Afinamiento':'')}
function r86PanoramaPlan(p){
  const L=p.ciclo.sec.length,n=L*2,cols=r86Escenarios.map(([k,t,paso,esc])=>({k,t,paso,esc,v:r86Ciclo(p,paso,esc,n)}));
  const resumen=cols.map(c=>`<div class="r86-pr"><b>${c.t}</b><span>Visita cada ${r84Km(c.paso)} km o ${r86Mes(p.ciclo.meses*c.esc)}</span><span>Ciclo de ${L} visitas: <b>${r84Km(c.paso*L)} km</b> o <b>${r86Mes(p.ciclo.meses*c.esc*L)}</b> (${r86Anios(p.ciclo.meses*c.esc*L)}) como máximo</span></div>`).join('');
  const filas=Array.from({length:n},(_,i)=>`<tr class="${i===L?'r86-sep':''}"><td>${i+1}</td>${cols.map(c=>{const x=c.v[i];return `<td class="r86-izq">${esc(r86PaqNombre(x))}</td><td>${r84Km(x.km)}</td><td>${r86Mes(x.mes)}</td>`}).join('')}</tr>`).join('');
  const rev=p.ciclo.rev,af=p.ciclo.afin;
  const reglas=`<p class="muted">Revisión completa cada ${r84Meses(rev.meses)} (reemplaza al ${R84_PAQ[rev.reemplaza].n.toLowerCase()}) · ${af?`Afinamiento cada ${r84Km(af.km)} km o ${r84Meses(af.meses)}, junto al ${af.con.map(k=>R84_PAQ[k].n.toLowerCase()).join(' o ')}`:'sin afinamiento'}.</p>`;
  return `<div class="panel r86-pan"><h3>${esc(p.nombre)}</h3>${reglas}<div class="r86-prs">${resumen}</div>
  <table class="r86-pt"><thead><tr><th rowspan="2">#</th>${cols.map(c=>`<th colspan="3">${c.t}</th>`).join('')}</tr><tr>${cols.map(()=>'<th>Paquete</th><th>km</th><th>Meses</th>').join('')}</tr></thead><tbody>${filas}</tbody></table></div>`;
}
const r86PlanesPrevio=views.planes;
views.planes=()=>{
  if(R86.pv!=='panorama'){
    const h=r86PlanesPrevio();
    return h.replace('Líneas del plan · propuestas</button></div>','Líneas del plan · propuestas</button><button type="button" onclick="R86.pv=\'panorama\';render()">Panorama de ciclos</button></div>');
  }
  r84Sembrar();
  return heading('Planes preventivos','','')+
  `<div class="tabs r85-vistas"><button type="button" onclick="R86.pv=null;R85.vista='ciclo';render()">Ciclo del plan</button><button type="button" onclick="R86.pv=null;R85.vista='lineas';render()">Líneas del plan · propuestas</button><button type="button" class="selected">Panorama de ciclos</button></div>`+
  db.r84.planes.filter(p=>p.activo).map(r86PanoramaPlan).join('');
};
