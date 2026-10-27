// Levanta todo el sistema en tu computadora con un solo comando: base de datos, API y pantalla.
//   pnpm dev      (o doble clic en herramientas/iniciar-local.bat)
// Después abre http://localhost:5173
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const procesos = [];

function lanzar(nombre, cmd, args, cwd = raiz, env = {}) {
  const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, shell: process.platform === 'win32' && cmd.endsWith('.cmd') });
  const pref = `[${nombre}] `;
  const salida = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => console.log(pref + l));
  p.stdout.on('data', salida);
  p.stderr.on('data', salida);
  p.on('exit', (c) => console.log(`${pref}terminó (${c})`));
  procesos.push(p);
  return p;
}

const puertoAbierto = (puerto) => new Promise((ok) => {
  const s = net.connect(puerto, '127.0.0.1');
  s.on('connect', () => { s.destroy(); ok(true); });
  s.on('error', () => ok(false));
});
async function esperar(puerto, nombre, intentos = 60) {
  for (let i = 0; i < intentos; i++) {
    if (await puertoAbierto(puerto)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${nombre} no respondió en el puerto ${puerto}`);
}

if (!fs.existsSync(path.join(raiz, '.env'))) {
  console.log('Falta el archivo .env: copia .env.example a .env y vuelve a ejecutar.');
  process.exit(1);
}

console.log('Iniciando base de datos, API y pantalla…');
if (!(await puertoAbierto(54329))) lanzar('base', process.execPath, ['dev-db.mjs'], path.join(raiz, 'database'));
await esperar(54329, 'La base de datos');
lanzar('api-compilador', pnpm, ['--filter', '@posventa/api', 'exec', 'tsc', '-w', '--preserveWatchOutput', '-p', 'tsconfig.json']);
const dist = path.join(raiz, 'apps/api/dist/src/main.js');
for (let i = 0; i < 90 && !fs.existsSync(dist); i++) await new Promise((r) => setTimeout(r, 1000));
lanzar('api', process.execPath, ['--watch', '--env-file=' + path.join(raiz, '.env'), dist]);
lanzar('web', pnpm, ['--filter', '@posventa/web', 'exec', 'vite', '--host', '127.0.0.1']);
await esperar(5173, 'La pantalla');
console.log('\n=====================================================');
console.log(' Listo. Abre en el navegador:  http://localhost:5173');
console.log(' API:                          http://localhost:3000');
console.log(' Para detener todo: Ctrl+C');
console.log('=====================================================\n');

const cerrar = () => { procesos.forEach((p) => { try { p.kill(); } catch {} }); process.exit(0); };
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
