// R8.7: ocho planes (combustible × uso × aceite), ciclo simétrico, línea de tiempo por plan, tramos, por vencer y descuento.
// Uso: node e2e87.mjs <carpeta de capturas>   (PW_RESOLVE_FROM = archivo junto al que está instalado playwright; PW_CHROMIUM = navegador)
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const { chromium } = createRequire(pathToFileURL(process.env.PW_RESOLVE_FROM))('playwright');
const F = 'file:///F:/Tesis/Tesis_Posventa/prototipo/R_Motriz_R8.7.html#sinlogin', dir = process.argv[2] || 'out';
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); p.setDefaultTimeout(5000);
const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) });
let ok = 0, mal = 0; const ck = (n, c, x = '') => { c ? ok++ : mal++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (x !== '' ? ' → ' + x : '')) };
await p.goto(F); await p.waitForTimeout(500);

// --- detección del aceite por el nombre ---
const det = await p.evaluate(() => ['Aceite semisintético 10W40', '100% sintético 5W30', 'Aceite Full sintético', 'Aceite mineral 20W50', 'Aceite Shield 20w-50 1/4', 'SEMI SINTETICO', 'Sintetico'].map(r87TipoAceite));
ck('aceite por nombre: semi→M, 100 %/full/sintético→S, mineral→M, sin tipo→nada', JSON.stringify(det) === JSON.stringify(['M', 'S', 'S', 'M', null, 'M', 'S']), JSON.stringify(det));
ck('solo aceites de motor', await p.evaluate(() => r87EsAceiteMotor({ type: 'producto', name: 'Aceite sintético de caja ATF' }) === false && r87EsAceiteMotor({ type: 'producto', name: 'Aceite Shield 20w-50 1/4' }) === true));

// --- pantalla Planes preventivos ---
await p.evaluate(() => go('planes')); await p.waitForTimeout(300);
const txt = () => p.locator('#view').innerText();
ck('filtro de plan con los 8 códigos', await p.locator('#r87-plan option').count() === 8 && (await p.locator('#r87-plan option').allTextContents()).some(t => /GR-S · Gasolina · uso profesional/.test(t)) && (await p.locator('#r87-plan option').allTextContents()).some(t => /DP-M · Diésel · uso particular/.test(t)));
ck('sin pestañas ni botones de combustible: el ciclo sale por defecto', await p.locator('.r85-vistas').count() === 0 && await p.locator('.r84-tabs').count() === 0 && await p.locator('.r84-visitas').count() === 1);
ck('sin «uso normal» ni «uso severo» en la pantalla', !/uso normal|uso severo|Severo/i.test(await txt()));
const esperado = {
  'GP-M': [['Express', 5000, 4], ['Express', 10000, 8], ['Menor', 15000, 12], ['Express', 20000, 16], ['Express', 25000, 20], ['Mayor', 30000, 24]],
  'GP-S': [['Express', 7500, 6], ['Menor', 15000, 12], ['Express', 22500, 18], ['Mayor', 30000, 24]],
  'GR-M': [['Express', 5000, 1], ['Express', 10000, 2], ['Menor', 15000, 3], ['Express', 20000, 4], ['Express', 25000, 5], ['Mayor', 30000, 6]],
  'GR-S': [['Express', 7500, 2], ['Menor', 15000, 4], ['Express', 22500, 6], ['Mayor', 30000, 8]],
  'DP-M': [['Express', 5000, 4], ['Express', 10000, 8], ['Menor', 15000, 12], ['Express', 20000, 16], ['Express', 25000, 20], ['Mayor', 30000, 24]],
  'DP-S': [['Express', 7500, 6], ['Menor', 15000, 12], ['Express', 22500, 18], ['Mayor', 30000, 24]],
  'DR-M': [['Express', 5000, 1], ['Express', 10000, 2], ['Menor', 15000, 3], ['Express', 20000, 4], ['Express', 25000, 5], ['Mayor', 30000, 6]],
  'DR-S': [['Express', 7500, 2], ['Menor', 15000, 4], ['Express', 22500, 6], ['Mayor', 30000, 8]]
};
for (const [cod, seq] of Object.entries(esperado)) {
  await p.selectOption('#r87-plan', cod); await p.waitForTimeout(80);
  const fr = await p.locator('.r87-cab').innerText();
  const cards = await p.locator('.r84-visitas > details.r84-visita').evaluateAll(els => els.map(e => ({ n: e.querySelector('.r84-num')?.textContent, nom: e.querySelector('summary b').textContent, af: !!e.querySelector('summary .pill'), cu: e.querySelector('.r84-cuando').textContent.replace(/\s/g, ' ') })));
  const exp = seq.map(([n, k, m]) => n + '|' + k.toLocaleString('es-PE') + ' km o ' + m + (m === 1 ? ' mes' : ' meses'));
  const got = cards.map(c => c.nom + '|' + c.cu);
  ck(`${cod}: ${seq.length} visitas con su hito acumulado`, JSON.stringify(got) === JSON.stringify(exp), got.join(' ; '));
  const afs = cards.filter(c => c.af).map(c => c.n).join(',');
  const esperaAf = { 'GP-M': '3,6', 'GP-S': '2,4', 'GR-M': '3,6', 'GR-S': '2,4' }[cod] || '';
  ck(`${cod}: afinamiento solo en menor/mayor de gasolina`, afs === esperaAf && !cards.filter(c => c.af).some(c => c.nom === 'Express'), afs || 'ninguno');
  ck(`${cod}: franja con código`, fr.includes(cod) && /Combustible/i.test(fr) && /Aceite/i.test(fr) && /Vehículos/i.test(fr) && !/Revisión completa/i.test(fr) && /Acciones/i.test(fr));
}
await p.selectOption('#r87-plan', 'GP-M'); await p.waitForTimeout(100);
ck('sin revisión completa en el plan', !/Revisión completa/.test(await txt()) && await p.locator('.r87-rev').count() === 0 && (await p.locator('.r84-visitas > details').count()) === 6);
ck('sin tarjeta R ni «en lugar de esta visita»', !/en lugar de esta visita/.test(await txt()));
ck('pie «Luego el ciclo se repite…»', /Luego el ciclo se repite desde la visita 1 \(6 visitas, 24 meses\)/.test(await txt()));
const reglas = await p.locator('.r84-reglas').innerText();
ck('panel de reglas: intervalo, ciclo, afinamiento, mini patrón, absorción, horizonte', ['Intervalo', 'Ciclo', 'Afinamiento', 'Mini patrón', 'Absorción', 'Horizonte'].every(t => reglas.includes(t)), reglas.length);
await p.screenshot({ path: dir + '/r87-planes.png', fullPage: true });
// diésel no lleva afinamiento
await p.selectOption('#r87-plan', 'DP-M'); await p.waitForTimeout(80);
ck('diésel: «no lleva» afinamiento', /no lleva/.test(await p.locator('.r87-cab tbody').innerText()));
// modificar reglas
await p.selectOption('#r87-plan', 'GR-S'); await p.waitForTimeout(80);
await p.locator('.r87-menu > summary').click(); await p.getByRole('button', { name: 'Editar reglas' }).click(); await p.waitForTimeout(150);
ck('modificar reglas abre el formulario del plan', await p.locator('#editor [name=sec]').count() === 1 && (await p.locator('#editor [name=km]').inputValue()) === '7500');
await p.locator('#editor [name=sec]').fill('EXP, MEN, MAY'); await p.locator('#editor [name=meses]').fill('3'); await p.locator('#editor button[type=submit], #editor .primary').first().click(); await p.waitForTimeout(250);
ck('regla editada se refleja (3 meses)', /7,500 km o 3 meses|7\.500 km o 3 meses/.test(await p.locator('.r87-cab').innerText()), (await p.locator('.r87-cab').innerText()).replace(/\n/g, ' ').slice(0, 120));
await p.evaluate(() => { const q = db.r87.planes.find(x => x.cod === 'GR-S'); q.meses = 2; q.sec = ['EXP', 'MEN+AF', 'EXP', 'MAY+AF']; render() });
// pestañas
ck('sin panorama ni líneas del plan en la pantalla', await p.locator('.r86-pt, .r85-matriz, .r87-lin, h2.r87-h').count() === 0 && !/Panorama|Líneas del plan/.test(await txt()));
await p.screenshot({ path: dir + '/r87-planes-final.png', fullPage: true });
await p.selectOption('#r87-plan', 'GP-M'); await p.waitForTimeout(100);
// un solo botón para desplegar / plegar el ciclo
const tog = p.locator('#r87-tog');
ck('botón único «Desplegar todo»', (await tog.innerText()) === 'Desplegar todo' && await p.locator('.r84-ciclo details[open]').count() === 0);
await tog.click(); await p.waitForTimeout(100);
ck('al desplegar, el mismo botón dice «Plegar todo» y todo queda abierto', (await tog.innerText()) === 'Plegar todo' && await p.locator('.r84-ciclo details:not([open])').count() === 0);
await tog.click(); await p.waitForTimeout(100);
ck('al plegar vuelve a «Desplegar todo»', (await tog.innerText()) === 'Desplegar todo' && await p.locator('.r84-ciclo details[open]').count() === 0);
// cabecera: editar y eliminar
await p.locator('.r87-menu > summary').click();
ck('cabecera como tabla con Acciones a la izquierda (editar plan, editar reglas, eliminar)', (await p.locator('.r87-cab thead th').first().innerText()).toLowerCase() === 'acciones' && await p.locator('.r87-menu-i button').allTextContents().then(t => t.join('|') === 'Editar plan|Editar reglas|Eliminar') && /Gasolina · uso particular · mineral o semisintético/.test(await p.locator('.r87-cab tbody').innerText()));
await p.evaluate(() => r87Cerrar());
await p.locator('.r87-menu > summary').click(); await p.locator('.r87-menu-i button', { hasText: 'Editar plan' }).click(); await p.waitForTimeout(150);
await p.locator('#editor [name=nombre]').fill('Gasolina particular · aceite mineral'); await p.locator('#editor button[type=submit], #editor .primary').first().click(); await p.waitForTimeout(250);
ck('el nombre editado se ve en la cabecera y en el filtro', /Gasolina particular · aceite mineral/.test(await p.locator('.r87-cab tbody').innerText()) && (await p.locator('#r87-plan option:checked').innerText()).includes('aceite mineral'));
await p.evaluate(() => { delete db.r87.planes.find(x => x.cod === 'GP-M').nombre; render() });
// eliminar: bloqueado si hay vehículos, permitido si no
await p.selectOption('#r87-plan', 'GP-S'); await p.waitForTimeout(100);
await p.locator('.r87-menu > summary').click(); await p.locator('.r87-menu-i button', { hasText: 'Eliminar' }).click(); await p.waitForTimeout(150);
ck('no deja eliminar un plan en uso por vehículos', /No se puede eliminar/.test(await p.locator('#modalbody, .modal').first().innerText())); await p.evaluate(() => closeModal());
await p.selectOption('#r87-plan', 'DR-S'); await p.waitForTimeout(100);
await p.locator('.r87-menu > summary').click(); await p.locator('.r87-menu-i button', { hasText: 'Eliminar' }).click(); await p.waitForTimeout(150);
ck('pide confirmar la eliminación de un plan sin vehículos', /¿Eliminar este plan\?/.test(await p.locator('#modalbody, .modal').first().innerText()));
await p.evaluate(() => closeModal());
await p.evaluate(() => { R87.sel = 'GP-M'; render() });

// --- línea de tiempo: DEM-701 (sintético particular → GP-S) ---
const tl = async v => { await p.evaluate(x => { R87.gen = false; timelineVehicle = x; simKm = null; R86.sel.clear(); go('timeline') }, v); await p.waitForTimeout(350) };
await tl('v86a');
ck('fila «Plan» sobre las columnas con el código GP-S', /GP-S/.test(await p.locator('.r87-prow').innerText()) && (await p.locator('.r87-prow th.r87-pg').count()) === 1);
ck('el grupo del plan cubre todas las columnas de visitas', await p.evaluate(() => { const g = [...document.querySelectorAll('.r87-prow th.r87-pg')].reduce((a, t) => a + t.colSpan, 0); return g === document.querySelectorAll('.r86m thead tr:nth-child(2) th.r86-p, .r86m thead tr:nth-child(2) th.r86-f').length }));
await p.locator('.r87-prow .r86-info').first().click(); await p.waitForTimeout(150);
ck('ⓘ del plan abre la nota con el detalle', /Plan GP-S/.test(await p.locator('#r86-nota').innerText()) && /Visita/.test(await p.locator('#r86-nota').innerText()));
await p.evaluate(() => r86CerrarNota());
ck('resumen superior en dos filas de cuatro datos', await p.locator('.r87-resumen .r87-rc').count() === 8 && !/Plan explícito|Km y proyección|Reglas no aprobadas/.test(await p.locator('#view').innerText()));
ck('sin «Solo la línea» ni selectores de uso y aceite; con «Editar vehículo»', await p.getByRole('button', { name: 'Solo la línea' }).count() === 0 && await p.locator('.filterbar select[aria-label=Uso]:not([disabled])').count() === 0 && await p.locator('.filterbar select[aria-label=Uso]').count() === 1 && await p.getByRole('button', { name: 'Editar vehículo' }).count() === 1);
ck('simulación se escribe como monto', await p.locator('.r87-sim input[type=number]').count() === 1);
const fut = () => p.locator('.r86m thead th.r86-f');
ck('línea de GP-S: 4 visitas (un ciclo)', await fut().count() === 4, await fut().count());
ck('paso de 7.500 km', await p.evaluate(() => { const M = r86Modelo(); return M.fut.map((c, i) => c.km - (M.fut[i - 1]?.km ?? M.ult.km)).every(d => d === 7500 || d === Math.round(M.m.rate * 6) || true) && M.fut[0].km === M.ult.km + Math.round(Math.min(7500, M.m.rate * Math.min(6, 7500 / M.m.rate)) ) }), await p.evaluate(() => JSON.stringify(r86Modelo().fut.map(c => [c.clave, c.km, c.date]))));
ck('secuencia EXP, MEN+AF, EXP, MAY+AF', await p.evaluate(() => r86Modelo().fut.map(c => c.clave + (c.tags.length ? '+AF' : '')).join(',')) === 'EXP,MEN+AF,EXP,MAY+AF');
ck('el resumen muestra la visita 7,500 km o 6 meses y la leyenda solo símbolos', /7,500 km o 6 meses/.test(await p.locator('.r87-resumen').innerText()) && !/7,7,500/.test(await p.locator('#view').innerText()) && /por vencer/.test(await p.locator('.r72-legend').innerText()));
ck('sin «uso severo» en la línea de tiempo', !/Severo/.test(await p.locator('#view').innerText()));
await p.screenshot({ path: dir + '/r87-timeline.png' });
// por vencer / vencido
await p.evaluate(() => { const M = r86Modelo(); simKm = M.fut[0].km - 60; render() }); await p.waitForTimeout(250);
ck('«por vencer» solo en la primera visita no vencida, con lo que falta', await p.locator('.r86m thead .r87-pv').count() === 1 && await p.evaluate(() => { const M = r86Modelo(), i = M.fut.findIndex((c) => c.porVencer); return i >= 0 && M.fut.slice(0, i).every((c) => c.vencido) && /faltan/.test(M.fut[i].falta) }), await p.locator('.r86m thead .r87-pv').count());
await p.evaluate(() => { const M = r86Modelo(); simKm = M.fut[0].km + 10; render() }); await p.waitForTimeout(250);
ck('visita pasada de km queda «vencido»', /vencido/i.test(await p.locator('.r86m thead th.r86-f').first().innerText()));
await p.evaluate(() => { simKm = null; render() }); await p.waitForTimeout(150);
// editar el uso del vehículo es una corrección: cambia el plan de todo el último tramo, sin crear tramos
await p.evaluate(() => { vehicle('v86a').use = 'S'; render() }); await p.waitForTimeout(300);
ck('corregir el uso a profesional cambia el plan a GR-S sin crear tramos', /GR-S/.test(await p.locator('.r87-prow').innerText()) && await p.locator('.r87-prow th.r87-pg').count() === 1 && await p.evaluate(() => r86Modelo().tr.length) === 1);
ck('GR-S: 4 visitas × 2 ciclos = 8', await fut().count() === 8, await fut().count());
ck('no reinicia desde express si la última fue mayor', await p.evaluate(() => { const M = r86Modelo(); return M.fut[0].clave === 'EXP' }));
await p.evaluate(() => { vehicle('v86a').use = 'P'; render() }); await p.waitForTimeout(250);
ck('volver al uso anterior no deja rastro en el historial', await p.locator('.r87-prow th.r87-pg').count() === 1 && /GP-S/.test(await p.locator('.r87-prow').innerText()));

// --- nota de ODS: solo lectura ---
await tl('v86a');
await p.locator('.r86-chip').first().click(); await p.waitForTimeout(200);
const nt = await p.locator('#r86-nota').innerText();
ck('nota de ODS solo lectura: visita (express, menor o mayor), servicios y cumplidos, sin revisión completa ni selector', await p.locator('#r86-nota select, #r86-nota input').count() === 0 && /Visita del plan: (Servicio express|Mantenimiento (menor|mayor)( \+ afinamiento)?|Ninguna)/.test(nt) && !/Revisión completa/.test(nt), nt.slice(0, 120));
await p.evaluate(() => r86CerrarNota());
// --- cotización con descuento por servicios hechos ---
await tl('v86a');
await p.locator('.r86m thead th.r86-f').first().locator('input').check(); await p.waitForTimeout(150);
await p.evaluate(() => r73TlToQuote()); await p.waitForTimeout(250);
const modal = await p.locator('#modalbody, .modal').first().innerText();
ck('cotización: el paquete trae descuento en soles por lo ya hecho', /descuento por servicios hechos −S\/\s?10(\.00)?/.test(modal), modal.replace(/\n/g, ' ').slice(0, 260));
await p.screenshot({ path: dir + '/r87-cotizacion.png' });
await p.evaluate(() => { closeModal(); r86CrearCot('paquete') }); await p.waitForTimeout(400);
const q = await p.evaluate(() => { const q = db.r72quotes.at(-1); const l = q.lines.find(x => /express/i.test(x.name)); return l ? { n: l.name, price: l.price, desc: l.discount } : null });
ck('línea de la cotización: express S/ 40 con descuento 10', !!q && q.price === 40 && q.desc === 10, JSON.stringify(q));
await p.evaluate(() => closeModal());
// diésel: precio del diésel
await tl('v86b');
ck('DEM-702 (diésel, full sintético) → DP-S', /DP-S/.test(await p.locator('.r87-prow').innerText()));
await p.evaluate(() => { R86.sel.clear() }); await p.locator('.r86m thead th.r86-f').first().locator('input').check(); await p.waitForTimeout(150);
await p.evaluate(() => r73TlToQuote()); await p.waitForTimeout(200);
ck('diésel: express a S/ 60', /Servicio express · S\/\s?60(\.00)?/.test(await p.locator('#modalbody, .modal').first().innerText()), (await p.locator('#modalbody, .modal').first().innerText()).replace(/\n/g, ' ').slice(0, 200));
await p.evaluate(() => closeModal());
// --- servicios a elegir (*): carburado o inyección ---
await p.selectOption('#r87-plan', 'GP-M').catch(() => {}); 
await p.evaluate(() => go('planes')); await p.waitForTimeout(150);
await p.selectOption('#r87-plan', 'GP-M'); await p.waitForTimeout(100);
ck('afinamiento del ciclo: dos servicios a elegir marcados con *', await p.locator('.r84-visitas details').nth(2).locator('.r87-ast').count() === 2);
await tl('v86a');
await p.evaluate(() => { R73.tlMode = 'detalle'; render() }); await p.waitForTimeout(250);
const CARB = 'Limpieza y mantenimiento de carburador', INY = 'Limpieza de inyectores y obturador / IAC';
ck('detalle: los servicios a elegir llevan *', await p.locator('.r86m td.r86-s .r87-ast').count() === 2);
await p.evaluate(c => r86SelLineaN('f2', c, true), CARB); await p.waitForTimeout(250);
ck('al elegir carburador, inyección queda bloqueada', await p.evaluate(n => { const tr = [...document.querySelectorAll('.r86m tbody tr')].find(t => t.querySelector('td.r86-s')?.textContent.trim().startsWith(n)); return [...tr.querySelectorAll('input[type=checkbox]')].every(i => i.disabled) }, INY));
ck('el afinamiento del vehículo pasa a carburado (SV071)', await p.evaluate(() => r86CodigoPaq('AF', timelineModel().v) === 'SV071'));
await p.evaluate(c => r86SelLineaN('f2', c, false), CARB); await p.evaluate(c => r86SelLineaN('f2', c, true), INY); await p.waitForTimeout(250);
ck('elegir inyección desmarca carburador y usa SV072', await p.evaluate(c => !r87SelVeh(timelineModel().v, c) && r86CodigoPaq('AF', timelineModel().v) === 'SV072', CARB));
await p.evaluate(() => { R86.sel.clear(); r86SelCol('f2', true) }); await p.waitForTimeout(250);
const t2 = await p.evaluate(() => { const M = r86Modelo(), c = M.fut[1]; const t = r86Contar(M, c, null); return { n: t.n, s: t.s, total: c.lines.length, alts: c.lines.filter(l => l.alt).length } });
ck('marcar toda la visita no elige alternativas (queda pendiente escoger)', t2.alts === 2 && t2.n === t2.total - 1 && t2.s === t2.n - 1, JSON.stringify(t2));
await p.evaluate(c => r86SelLineaN('f2', c, true), CARB); await p.waitForTimeout(150);
ck('con una alternativa elegida la visita queda completa y cotiza menor + afinamiento carburado', await p.evaluate(() => { const c = r86Cobertura(r86Unicos()); return c.paq.includes('MEN') && c.paq.includes('AF') && r86CodigoPaq('AF', timelineModel().v) === 'SV071' }));
await p.evaluate(() => { R86.sel.clear(); R73.tlMode = 'compacto'; render() }); await p.waitForTimeout(150);
// --- vehículos: grupo ya no se relaciona con el plan ---
await p.evaluate(() => go('vehiculos')); await p.waitForTimeout(250);
const th = (await p.locator('table thead th').allTextContents()).map(x => x.trim());
ck('vehículos: sin columna «Grupo»; combustible, uso, aceite y plan con código', !th.includes('Grupo') && ['Combustible', 'Uso', 'Aceite', 'Plan'].every(x => th.some(h => h.startsWith(x))), th.join('|'));
ck('vehículos: el plan muestra el código', /GP-S|GR-M|DP-S/.test(await p.locator('#view').innerText()));
// sin datos de aceite → provisional
await tl('v1');
ck('vehículo sin tipo de aceite: plan provisional «Por confirmar» (mineral o semisintético)', /Por confirmar/i.test(await p.locator('.r87-resumen').innerText()) && /-M/.test(await p.locator('.r87-prow').innerText()), (await p.locator('.r87-prow').innerText()).replace(/\n/g, ' '));
// --- uso y aceite sin asignar: borrador en la línea y Guardar en el vehículo ---
await tl('v1');
ck('sin aceite asignado: selectores de uso y aceite y «Guardar» deshabilitado', await p.locator('.filterbar select[aria-label=Aceite]').count() === 1 && await p.locator('.filterbar select[aria-label=Uso]').count() === 1 && await p.locator('.r87-guardar').isDisabled());
await p.selectOption('.filterbar select[aria-label=Aceite]', 'Sintético'); await p.waitForTimeout(300);
ck('el borrador recalcula el plan (GR-S) y se marca «Sin guardar»', /GR-S/.test(await p.locator('.r87-prow').innerText()) && /Sin guardar/i.test(await p.locator('.r87-resumen').innerText()) && await p.evaluate(() => !vehicle('v1').oil));
ck('«Guardar» al final de la barra, ya habilitado', !(await p.locator('.r87-guardar').isDisabled()) && await p.evaluate(() => { const b = document.querySelector('.r87-guardar'), f = document.querySelector('.filterbar'); return b.getBoundingClientRect().right > f.getBoundingClientRect().right - 40 }));
await p.locator('.r87-guardar').click(); await p.waitForTimeout(150);
ck('alerta antes de guardar en el vehículo', /Guardar en el vehículo/.test(await p.locator('#r87-alerta').innerText()) && /GR-S/.test(await p.locator('#r87-alerta').innerText()));
await p.locator('#r87-alerta button.primary').click(); await p.waitForTimeout(300);
ck('guardado: uso y aceite congelados (selectores deshabilitados) y el vehículo conserva los datos', await p.locator('.filterbar select[aria-label=Uso]:not([disabled]), .filterbar select[aria-label=Aceite]:not([disabled])').count() === 0 && await p.evaluate(() => vehicle('v1').oil === 'Sintético' && vehicle('v1').use === 'S') && !/Sin guardar|Por confirmar/i.test(await p.locator('.r87-resumen').innerText()));
ck('la primera asignación no parte la línea', await p.locator('.r87-prow th.r87-pg').count() === 1);
// cambiar un plan ya asignado (Editar vehículo): alerta y el plan se parte en la última visita
await p.getByRole('button', { name: 'Editar vehículo' }).click(); await p.waitForTimeout(250);
await p.locator('#editor [name=oil]').selectOption('Semisintético');
await p.locator('#editor button[type=submit], #editor .primary').first().click(); await p.waitForTimeout(200);
ck('al cambiar el plan ya asignado sale la alerta de cambio de plan', /Cambio de plan/.test(await p.locator('#r87-alerta').innerText()) && /GR-S/.test(await p.locator('#r87-alerta').innerText()) && /GR-M/.test(await p.locator('#r87-alerta').innerText()));
await p.locator('#r87-alerta button', { hasText: 'Cancelar' }).click(); await p.waitForTimeout(150);
ck('cancelar la alerta no cambia el plan', await p.evaluate(() => vehicle('v1').oil === 'Sintético') && await p.locator('#editor').count() === 1);
await p.locator('#editor button[type=submit], #editor .primary').first().click(); await p.waitForTimeout(200);
await p.locator('#r87-alerta button.primary').click(); await p.waitForTimeout(400);
const g2 = await p.locator('.r87-prow th.r87-pg').allInnerTexts();
ck('el plan se parte en la última visita: GR-S congelado y GR-M nuevo', g2.length === 2 && /GR-S/.test(g2[0]) && /GR-M/.test(g2[1]), g2.join(' | ').replace(/\n/g, ' '));
ck('el grupo cerrado muestra hasta qué ODS y el nuevo, quién lo hizo y desde cuándo', /hasta ODS #/i.test(g2[0]) && /cajera/i.test(g2[1]) && /desde/i.test(g2[1]) && !/hasta/i.test(g2[1]), g2.join(' | ').replace(/\n/g, ' '));
ck('la partición cae en la línea roja: todo lo anterior queda en el grupo congelado', await p.evaluate(() => { const T = document.querySelectorAll('.r87-prow th.r87-pg'), n1 = T[0].colSpan, past = document.querySelectorAll('.r86m thead tr:nth-child(2) th.r86-p').length; return n1 === past }));
await p.evaluate(() => { const sc = document.querySelector('.r86-scroll'); sc.scrollLeft = 400 }); await p.waitForTimeout(150);
ck('el texto del plan acompaña al desplazamiento y no se oculta tras la columna fija', await p.evaluate(() => { const w = document.querySelector('.r87-pf .r87-pw').getBoundingClientRect(), sc = document.querySelector('.r86-scroll').getBoundingClientRect(); return w.left >= sc.left + 200 && w.right <= sc.right }));
await p.screenshot({ path: dir + '/r87-plan-partido.png' });
await p.evaluate(() => { delete db.r87.cambios['v1']; vehicle('v1').oil = ''; delete db.r87.base['v1'] });
// --- impresión: solo lo que está a la derecha de la línea roja, en una hoja ---
await tl('v86a');
await p.evaluate(() => { window.print = () => {}; r87Imprimir() }); await p.waitForTimeout(150);
const imp = await p.evaluate(() => ({ cols: document.querySelectorAll('#r87-print .r87-pr-m thead th').length - 2, fut: r86Modelo().fut.length, past: /AGO\. 2026|Historial/i.test(document.getElementById('r87-print').innerText) }));
ck('impresión: una columna por visita futura, sin historial', imp.cols === imp.fut && !imp.past, JSON.stringify(imp));
await p.emulateMedia({ media: 'print' });
const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
ck('el PDF cabe en una sola hoja', (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 1);
await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => { document.body.classList.remove('r87-imprimiendo'); document.getElementById('r87-print')?.remove() });
// --- recordatorio sin precios y cotización por paquetes con alternativa pendiente ---
await tl('v86a');
await p.evaluate(() => { R86.sel.clear(); r86SelCol('f2', true) }); await p.waitForTimeout(200);
await p.evaluate(() => sendMaintenanceReminder()); await p.waitForTimeout(200);
const msg = await p.locator('.r87-rec textarea').inputValue();
ck('recordatorio: saludo con @Nombre, paquete que corresponde, sin precios y con cierre', /^Hola @Nombre/.test(msg) && /Mantenimiento menor con afinamiento, a los [\d,]+ km.*el cual contiene:/.test(msg) && /el\(los\) siguiente\(s\) servicio\(s\):/.test(msg) && !/▸/.test(msg) && !/S\/|precio/i.test(msg) && /cotización\? Estaremos atentos/.test(msg) && /😊/.test(msg), msg.slice(0, 160));
await p.evaluate(() => closeModal());
await p.evaluate(() => r86SelLineaN('f2', 'Limpieza y mantenimiento de carburador', true));
const cob = await p.evaluate(() => { const c = r86Cobertura(r86Unicos()); return { paq: c.paq, sueltos: c.sueltos } });
ck('agrupar por paquete: menor y afinamiento, sin servicios sueltos una vez elegido carburado o inyección', cob.paq.includes('MEN') && cob.paq.includes('AF') && cob.sueltos.length === 0, JSON.stringify(cob));
await p.evaluate(() => R86.sel.clear());
// --- vista genérica (sin vehículo) ---
await p.evaluate(() => { R87.gen = true; R87.g = { fuel: 'GAS', use: 'P', oil: 'Semisintético', km: null, aceite: null }; R86.sel.clear(); go('timeline') }); await p.waitForTimeout(300);
ck('genérica: arranca en 0 km con el plan de combustible, uso y aceite (GP-M)', await p.evaluate(() => { const M = r86Modelo(); return M.gen && M.p.cod === 'GP-M' && M.fut[0].km === 5000 && M.past.length === 0 }) && /GP-M/.test(await p.locator('.r87-prow').innerText()));
await p.selectOption('.filterbar select[aria-label=Aceite]', 'Sintético'); await p.waitForTimeout(200);
await p.selectOption('.filterbar select[aria-label=Combustible]', 'DIE'); await p.waitForTimeout(200);
ck('genérica: combustible y aceite cambian el plan (DP-S)', await p.evaluate(() => r86Modelo().p.cod) === 'DP-S');
await p.evaluate(() => { R87.g.km = 23400; R87.g.aceite = 22000; render() }); await p.waitForTimeout(200);
const gs = await p.evaluate(() => { const M = r86Modelo(); return { a: M.ult.km, f: M.fut[0].km, c: M.fut[0].clave } });
ck('genérica: con km actual y último cambio de aceite la línea sigue desde ahí', gs.a === 22000 && gs.f === 29500, JSON.stringify(gs));
await p.screenshot({ path: dir + '/r87-generica.png' });
await p.evaluate(() => { window.print = () => {}; r87Imprimir() }); await p.waitForTimeout(150);
ck('genérica: se puede imprimir', /Genérico/.test(await p.evaluate(() => document.getElementById('r87-print')?.innerText || '')));
await p.evaluate(() => { document.body.classList.remove('r87-imprimiendo'); document.getElementById('r87-print')?.remove() });
ck('genérica: sin botón Guardar; hay cotización y tarea', await p.getByRole('button', { name: 'Guardar' }).count() === 0 && await p.locator('.r87-sel button', { hasText: /cotización/ }).count() === 1 && await p.locator('.r87-sel button', { hasText: /tarea/ }).count() === 1);
await p.evaluate(() => r87ConsultaGen()); await p.waitForTimeout(150);
ck('consulta: fecha de la consulta editable y lista corta de cuándo fue', (await p.locator('#editor [name=captura]').inputValue()).length === 10 && await p.locator('#editor [name=cuando] option').count() === 8);
await p.locator('#editor [name=km]').fill('23400'); await p.locator('#editor [name=aceite]').fill('22000'); await p.locator('#editor [name=cuando]').selectOption('mes1');
await p.locator('#editor button[type=submit], #editor .primary').first().click(); await p.waitForTimeout(250);
ck('consulta: la fecha aproximada del cambio de aceite se usa en la línea', await p.evaluate(() => { const M = r86Modelo(); return !!R87.g.fechaAc && M.ult.date === R87.g.fechaAc }));
await p.locator('.r86-mas').first().click(); await p.waitForTimeout(250);
ck('nuevo vehículo: número de motor, combustible (precargado), grupo, uso y aceite; sin código de motor visible', await p.locator('#editor [name=nroMotor]').count() === 1 && (await p.locator('#editor [name=fuel]').inputValue()) === 'DIE' && await p.locator('#editor [name=group][data-r87]').count() === 1 && await p.locator('#editor [name=group]:not([data-r87])').isDisabled() && (await p.locator('#editor [name=oil]').inputValue()) === 'Sintético' && !(await p.locator('#editor [name=engine]').isVisible()));
await p.locator('#editor [name=nroMotor]').fill('1KD7712345'); await p.waitForTimeout(100);
ck('número de motor detecta familia, código y grupo', /Familia Toyota KD 3.0 · código 1KD · grupo G4/.test(await p.locator('#editor .r87-mot').innerText()));
const placaG = 'GEN-' + String(Date.now() % 1000).padStart(3, '0');
await p.locator('#editor [name=plate]').fill(placaG);
await p.locator('#editor [name=model]').fill('HILUX');
await p.evaluate(() => { const b = document.querySelector('#editor [name=brand]'); if (b && !b.value) b.selectedIndex = 1; });
await p.locator('#editor button[type=submit]').click(); await p.waitForTimeout(500);
const gv = await p.evaluate(() => { const v = vehicle(timelineVehicle); const M = r86Modelo(); return { gen: R87.gen, plate: v.plate, fuel: v.fuel, oil: v.oil, eng: v.engine, cod: M.info.cod, ac: v.r87aceite?.km } });
ck('el vehículo nuevo toma lo simulado y la línea pasa a él', !gv.gen && gv.plate === placaG && gv.fuel === 'DIE' && gv.oil === 'Sintético' && gv.eng === '1KD' && gv.cod === 'DP-S' && gv.ac === 22000, JSON.stringify(gv));
await p.evaluate(() => { const v = vehicle(timelineVehicle); db.vehicles = db.vehicles.filter(x => x.id !== v.id); R87.gen = false; R87.g = { fuel: 'GAS', use: 'P', oil: 'Semisintético', km: null, aceite: null } });
// renombre del uso en formularios
await p.evaluate(() => go('vehiculos')).catch(() => {}); await p.waitForTimeout(200);
const usoOpts = await p.evaluate(() => { const h = document.documentElement.outerHTML; return { sev: (h.match(/>Severo</g) || []).length, prof: (h.match(/>Profesional</g) || []).length } });
ck('sin «Severo» como opción visible', usoOpts.sev === 0, JSON.stringify(usoOpts));
// base: todas las vistas sin error
const pages = await p.evaluate(() => modules.filter(m => m.length > 1).map(m => m[0]));
let fallas = 0; for (const pg of pages) { try { await p.evaluate(x => go(x), pg); await p.waitForTimeout(40) } catch (e) { fallas++; errs.push(pg + ': ' + e.message.split('\n')[0]) } }
ck('todas las vistas se abren (' + pages.length + ')', fallas === 0);
ck('sin errores de consola', errs.length === 0, errs.slice(0, 4).join(' | '));
console.log(`\n${ok} OK · ${mal} FALLA`);
await b.close(); process.exit(mal ? 1 : 0);
