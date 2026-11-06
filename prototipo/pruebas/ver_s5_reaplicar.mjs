// Comprueba: después de «Mantener montos» en el solapamiento opcional, aparece «Aplicar» y reactiva el descuento.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const { chromium } = createRequire(pathToFileURL(process.env.PW_RESOLVE_FROM))('playwright');
import assert from 'node:assert/strict';
const html = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto('file:///' + html.replace(/\\/g, '/') + '#sinlogin');
await p.waitForTimeout(1200);

const res = await p.evaluate(() => {
  const S = r77SolDb();
  const r = S.rules.find((x) => x.modo === 'OPCIONAL') || S.rules[0];
  r.modo = 'OPCIONAL';
  r.monto = 10;
  const ca = r77SolCat(r.a), cb = r77SolCat(r.b);
  const o = { id: 'prueba-reaplicar', code: 'PRUEBA2', vehicle: db.vehicles[0]?.id, state: 'Recepción',
    lines: [{ id: 'la', type: 'servicio', code: ca.code, name: ca.name, price: 40, qty: 1, hours: 1, discount: 0 },
            { id: 'lb', type: 'servicio', code: cb.code, name: cb.name, price: 20, qty: 1, hours: 1, discount: 0 }] };
  db.orders.push(o);
  r77SolScan();
  const e = o.solapes.find((x) => x.rule === r.id);
  if (!e) { db.orders = db.orders.filter((x) => x.id !== 'prueba-reaplicar'); return { error: 'no se detectó el solapamiento' }; }
  r77SolKeep(o.id, e.id);
  const estadoTrasMantener = e.state;
  r77SolAmt(o.id, e.id, e.suggest);
  r77SolApply(o.id, e.id);
  const estadoTrasReaplicar = e.state;
  const descuentoFinal = o.lines[1].discount;
  db.orders = db.orders.filter((x) => x.id !== 'prueba-reaplicar');
  return { estadoTrasMantener, estadoTrasReaplicar, descuentoFinal, suggest: e.suggest };
});
assert.equal(res.estadoTrasMantener, 'mantenido');
console.log('  ok - tras «Mantener montos» el estado es «mantenido»');
assert.equal(res.estadoTrasReaplicar, 'aplicado');
console.log('  ok - «Aplicar» reactiva y pasa el estado a «aplicado»');
assert.equal(res.descuentoFinal, res.suggest);
console.log('  ok - el descuento aplicado es el sugerido (' + res.suggest + ')');
assert.deepEqual(errores, []);
console.log('  ok - sin errores de página');
console.log('\n4 comprobaciones pasaron');
await b.close();
