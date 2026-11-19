// Comprobaciones de la capa R8.4 (planes preventivos y línea temporal con el modelo del sistema).
// Uso: node pruebas/e2e84.mjs <ruta absoluta de R_Motriz_R8.4.html> [carpeta de capturas]
import { chromium } from 'playwright';
const F = 'file://' + process.argv[2] + '#sinlogin', dir = process.argv[3] || '.';
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); p.setDefaultTimeout(5000);
const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) });
let ok = 0, mal = 0; const ck = (n, c, x = '') => { c ? ok++ : mal++; console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (x !== '' ? ' → ' + x : '')) };
await p.goto(F); await p.waitForTimeout(400);
await p.evaluate(() => go('planes')); await p.waitForTimeout(200);
ck('título', (await p.textContent('#view h1')) === 'Planes preventivos');
ck('cuatro planes', await p.locator('.r84-tabs button').count() === 4, await p.locator('.r84-tabs button').count());
const tabs = await p.locator('.r84-tabs button').allTextContents();
ck('combustible por uso', ['Diésel · uso normal', 'Diésel · uso severo', 'Gasolina · uso normal', 'Gasolina · uso severo'].every(t => tabs.includes(t)), tabs.join(' | '));
await p.locator('.r84-tabs button', { hasText: 'Gasolina · uso normal' }).click(); await p.waitForTimeout(100);
ck('gasolina normal: 6 visitas en el ciclo', await p.locator('.r84-visitas > .r84-visita:not(.r84-extra)').count() === 6, await p.locator('.r84-visitas > .r84-visita:not(.r84-extra)').count());
const noms = await p.locator('.r84-visitas > .r84-visita:not(.r84-extra) > summary b').allTextContents();
ck('secuencia express, menor, mayor × 2', noms.join(',') === 'Servicio express,Mantenimiento menor,Mantenimiento mayor,Servicio express,Mantenimiento menor,Mantenimiento mayor', noms.join(','));
ck('la visita 5 lleva el afinamiento', (await p.locator('.r84-visitas > .r84-visita').nth(4).textContent()).includes('+ Afinamiento'));
ck('la visita 6 lleva la revisión completa', (await p.locator('.r84-visitas > .r84-visita').nth(5).textContent()).includes('Revisión completa en lugar de esta visita'));
ck('afinamiento y revisión completa se despliegan', await p.locator('.r84-extra').count() === 2);
await p.locator('.r84-extra summary').first().click(); await p.waitForTimeout(80);
ck('el afinamiento lista sus servicios', (await p.locator('.r84-extra').first().textContent()).includes('cambio de bujías'));
await p.locator('.r84-visitas > .r84-visita summary').nth(1).click(); await p.waitForTimeout(80);
ck('el menor lista 15 servicios', await p.locator('.r84-visitas > .r84-visita').nth(1).locator('li').count() === 15, await p.locator('.r84-visitas > .r84-visita').nth(1).locator('li').count());
await p.locator('.r84-tabs button', { hasText: 'Diésel · uso normal' }).click(); await p.waitForTimeout(100);
ck('diésel no lleva afinamiento', (await p.textContent('.r84-cab')).includes('no lleva') && await p.locator('.r84-extra').count() === 1);
await p.locator('.r84-tabs button', { hasText: 'Gasolina · uso severo' }).click(); await p.waitForTimeout(100);
const sev = await p.locator('.r84-visitas > .r84-visita:not(.r84-extra) > summary b').allTextContents();
ck('severo: express, menor, express, menor, express, mayor', sev.join(',') === 'Servicio express,Mantenimiento menor,Servicio express,Mantenimiento menor,Servicio express,Mantenimiento mayor', sev.join(','));
// duplicar y eliminar
await p.evaluate(() => r84Duplicar(db.r84.planes[0].id)); await p.waitForTimeout(100);
ck('duplicar agrega un plan', await p.locator('.r84-tabs button').count() === 5);
await p.evaluate(() => r84Borrar(R84.sel)); await p.waitForTimeout(100);
ck('eliminar la copia', await p.locator('.r84-tabs button').count() === 4);
await p.evaluate(() => r84PedirBorrar(db.r84.planes.find(x => db.vehicles.some(v => r84PlanDe(v)?.id === x.id)).id)); await p.waitForTimeout(100);
ck('un plan en uso no se elimina', (await p.textContent('dialog')).includes('No se puede eliminar'));
await p.evaluate(() => closeModal());
// catálogo
ck('catálogo con los servicios nuevos', await p.evaluate(() => db.catalog.filter(c => /^SV\d{3}$/.test(c.code)).length) === 99);
// línea temporal
await p.evaluate(() => go('timeline')); await p.waitForTimeout(200);
ck('línea temporal: título', (await p.textContent('#view h1')) === 'Línea temporal');
ck('línea temporal: 12 próximas visitas', await p.locator('.r84-linea .r84-hito').filter({ has: p.locator('summary') }).count() === 12, await p.locator('.r84-linea .r84-hito').filter({ has: p.locator('summary') }).count());
ck('línea temporal: muestra el plan del vehículo', /uso (normal|severo)/.test(await p.textContent('#view .panel .sub')));
await p.evaluate(() => { vehicle(R84.veh).fuel = 'DIE'; save('x', 'x') }); await p.waitForTimeout(150);
ck('línea temporal sigue el combustible', (await p.textContent('#view .panel .sub')).includes('Diésel'));
await p.screenshot({ path: dir + '/r84-linea.png', fullPage: true });
await p.evaluate(() => go('planes')); await p.waitForTimeout(150);
await p.screenshot({ path: dir + '/r84-planes.png', fullPage: true });
ck('sin errores en consola', errs.length === 0, errs.join(' | '));
console.log(`\n${ok} comprobaciones correctas, ${mal} fallas`);
await b.close(); process.exit(mal ? 1 : 0);
