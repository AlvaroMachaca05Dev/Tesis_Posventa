// Comprobaciones de la capa R7.8 (clientes y vehículos).
// Uso:  node prototipo/pruebas/e2e78.mjs <ruta al html>
// Necesita el paquete `playwright`: PW_RESOLVE_FROM = un archivo dentro de una carpeta con node_modules/playwright,
// y PW_CHROMIUM = ruta de chrome.exe (como en herramientas/exportar_precarga_prototipo.mjs).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const { chromium } = createRequire(process.env.PW_RESOLVE_FROM ? pathToFileURL(process.env.PW_RESOLVE_FROM) : import.meta.url)('playwright');
import assert from 'node:assert/strict';
const html = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto('file:///' + html.replace(/\\/g, '/') + '#sinlogin');
await p.waitForTimeout(1500);
let n = 0;
const ok = (nombre) => { n++; console.log('  ok -', nombre); };

assert.equal(errores.length, 0, 'errores al cargar: ' + errores.join(' | ')); ok('carga sin errores');
const base = await p.evaluate(() => ({ varios: db.clients.filter((c) => c.generic).map((c) => [c.name, c.doc]), total: db.clients.length, v: db.vehicles.map((v) => [v.plate, client(v.client).name]) }));
assert.deepEqual(base.varios, [['Clientes varios', '0000']]); assert.equal(base.total, 1); assert.deepEqual(base.v, [['DEM-679', 'Clientes varios']]); ok('«Clientes varios» (0000) con el vehículo DEM-679');

await p.evaluate(() => { go('clientes'); });
await p.waitForTimeout(300);
let t = await p.evaluate(() => (document.querySelector('main') || document.body).innerText);
assert.ok(/Clientes varios/.test(t) && /DNI 0000/.test(t) && /registro/i.test(t)); ok('lista de clientes con documento y registro');

// nuevo cliente: prefijo del país, móvil y creación
await p.evaluate(() => editClient());
await p.waitForSelector('#editor [name=country]');
assert.equal(await p.textContent('#r78pref'), '+51'); ok('prefijo +51 por defecto');
await p.selectOption('#editor [name=country]', 'CO');
assert.equal(await p.textContent('#r78pref'), '+57'); ok('el prefijo cambia con el país');
const tipos = await p.$$eval('#editor [name=docType] option', (o) => o.map((x) => x.textContent));
assert.deepEqual(tipos, ['DNI', 'Carné de extranjería', 'RUC']); ok('tipos de documento: DNI, Carné de extranjería y RUC');
await p.selectOption('#editor [name=country]', 'PE');
await p.fill('#editor [name=doc]', '45678912'); await p.fill('#editor [name=name]', 'ANA PRUEBA'); await p.fill('#editor [name=phone]', '98765432');
await p.click('#editor button.primary');
await p.waitForTimeout(300);
assert.equal(await p.evaluate(() => db.clients.some((c) => c.doc === '45678912')), false); ok('móvil de 8 dígitos en Perú: se rechaza');
await p.fill('#editor [name=phone]', '987 654 321'); await p.fill('#editor [name=ubigeo]', '150101');
await p.click('#editor button.primary');
await p.waitForTimeout(400);
const nuevo = await p.evaluate(() => db.clients.find((c) => c.doc === '45678912'));
assert.ok(nuevo && nuevo.phone === '987654321' && nuevo.country === 'PE' && nuevo.ubigeo === '150101' && nuevo.createdAt); ok('cliente creado con móvil sin espacios, país, ubigeo y fecha de registro');

// documento repetido
await p.evaluate(() => editClient());
await p.fill('#editor [name=doc]', '45678912'); await p.fill('#editor [name=name]', 'OTRO');
await p.click('#editor button.primary'); await p.waitForTimeout(300);
assert.equal(await p.evaluate(() => db.clients.filter((c) => c.doc === '45678912').length), 1); ok('el documento repetido se rechaza');
await p.evaluate(() => closeModal());

// «Clientes varios» no cambia de documento ni se elimina
await p.evaluate(() => { const c = db.clients.find((x) => x.generic); deleteClient(c.id); });
assert.equal(await p.evaluate(() => db.clients.find((x) => x.generic).deleted || null), null); ok('«Clientes varios» no se elimina');

// vehículo: placa con otro formato
await p.evaluate(() => editVehicle());
await p.waitForSelector('#editor [name=plate]');
assert.ok(await p.$('#editor .r78-find')); ok('buscador de cliente en el formulario del vehículo');
await p.fill('#editor [name=plate]', 'dem 679'); await p.selectOption('#editor [name=brand]', 'KIA'); await p.fill('#editor [name=model]', 'PICANTO');
await p.click('#editor button.primary'); await p.waitForTimeout(300);
assert.equal(await p.evaluate(() => db.vehicles.filter((v) => /dem/i.test(v.plate)).length), 1); ok('placa «dem 679» = DEM-679: se rechaza');
const aviso = await p.evaluate(() => document.body.innerText);
assert.ok(/ya existe y pertenece a Clientes varios/.test(aviso)); ok('el aviso nombra al titular');
await p.fill('#editor [name=plate]', 'zz9-999');
await p.evaluate(() => { const f = document.querySelector('#editor'); const i = f.querySelector('.r78-find input'); i.value = 'ana'; i.dispatchEvent(new Event('input')); });
const sel = await p.$eval('#editor [name=client]', (s) => s.selectedOptions[0].text);
assert.ok(/ANA PRUEBA/.test(sel)); ok('el filtro elige al cliente por nombre');
await p.click('#editor button.primary'); await p.waitForTimeout(400);
const veh = await p.evaluate(() => { const v = db.vehicles.find((x) => x.plate === 'zz9-999'); return v && { createdAt: v.createdAt, titular: client(v.client).name }; });
assert.ok(veh && veh.createdAt && veh.titular === 'ANA PRUEBA'); ok('vehículo creado con su titular y fecha de registro');

await p.evaluate(() => go('vehiculos')); await p.waitForTimeout(300);
t = await p.evaluate(() => (document.querySelector('main') || document.body).innerText);
assert.ok(/titular/i.test(t) && /ANA PRUEBA/.test(t) && /color/i.test(t)); ok('lista de vehículos con color, titular y registro');

// etiquetas de fecha de la ODS
await p.evaluate(() => { go('ods'); }); await p.waitForTimeout(400);
assert.equal(errores.length, 0, 'errores: ' + errores.join(' | ')); ok('sin errores durante el recorrido');
console.log(`\n${n} comprobaciones pasaron`);
await b.close();
