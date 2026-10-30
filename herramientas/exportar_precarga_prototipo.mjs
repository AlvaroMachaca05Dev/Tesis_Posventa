// Exporta del prototipo HTML (R7.7) los datos que se precargan en el sistema real, sin datos reales.
// Uso:  node herramientas/exportar_precarga_prototipo.mjs
// Necesita el paquete `playwright` y un Chromium instalado:
//   PW_RESOLVE_FROM = un archivo dentro de una carpeta que tenga node_modules/playwright
//   PW_CHROMIUM     = ruta de chrome.exe (opcional si Playwright ya descargó su navegador)
// Salida: database/seeds/precarga/maestros.json (clientes, vehículos y marcas de vehículo).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(process.env.PW_RESOLVE_FROM ? pathToFileURL(process.env.PW_RESOLVE_FROM) : import.meta.url);
const { chromium } = require('playwright');

const html = path.join(raiz, 'prototipo', 'R_Motriz_R7.7.html');
const salida = path.join(raiz, 'database', 'seeds', 'precarga', 'maestros.json');

const navegador = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const pagina = await navegador.newPage();
await pagina.goto(pathToFileURL(html).href + '#sinlogin');
await pagina.waitForTimeout(1500);
const datos = await pagina.evaluate(() => ({
  clientes: db.clients.map((c) => ({ id: c.id, nombre: c.name, documento: c.doc, tipoDocumento: c.docType, movil: c.phone, correo: c.email })),
  vehiculos: db.vehicles.map((v) => ({ id: v.id, cliente: v.client, placa: v.plate, marca: v.brand, modelo: v.model, anio: v.year, vin: v.vin, motor: v.engine, serie: v.serial, km: v.km, grupo: v.group })),
  marcas: db.r74vbrands.map((m) => ({ nombre: m.name, modelos: m.models })),
}));
await navegador.close();

fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, JSON.stringify({ fuente: 'prototipo/R_Motriz_R7.7.html', ...datos }, null, 2) + '\n', 'utf8');
console.log(`Exportado a ${path.relative(raiz, salida)}: ${datos.clientes.length} cliente(s), ${datos.vehiculos.length} vehículo(s), ${datos.marcas.length} marca(s).`);
