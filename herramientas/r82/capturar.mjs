// Convierte las páginas HTML de evidencia en PNG (una por caso de prueba ejecutado).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync, mkdirSync, statSync } from 'node:fs';
const { chromium } = createRequire(pathToFileURL(process.env.PW_RESOLVE_FROM))('playwright');
const EV = process.argv[2], DEST = process.argv[3];
mkdirSync(DEST, { recursive: true });
const ids = JSON.parse(readFileSync(`${EV}/ejec.json`, 'utf8'));
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const p = await b.newPage({ viewport: { width: 1210, height: 400 }, deviceScaleFactor: 1.5 });
for (const id of ids) {
  await p.goto(pathToFileURL(`${EV}/html/${id}.html`).href);
  const win = await p.$('.win');
  await win.screenshot({ path: `${DEST}/${id}.png` });
  console.log(id, statSync(`${DEST}/${id}.png`).size);
}
await b.close();
