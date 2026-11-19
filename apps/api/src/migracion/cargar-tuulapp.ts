// Migración inicial (S4, RN-11), paso 2: carga el archivo intermedio en una base.
// Uso (desde apps/api, con la base de desarrollo encendida):
//   MIGRACION_CLAVE=<contraseña inicial de los usuarios> npx dotenv -e ../../.env -- ../../database/node_modules/.bin/tsx src/migracion/cargar-tuulapp.ts --base posventa_migracion [--staging ruta]
// --base cambia solo el nombre de la base de DATABASE_URL (mismo servidor y usuario). Sin --base se niega a correr, para no tocar
// la base de desarrollo por descuido; para desarrollo hay que escribir --base posventa_utf8 a propósito.
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { cargarStaging } from './tuulapp.carga';

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const raiz = path.resolve(__dirname, '../../../..');
const base = arg('--base');
const archivo = arg('--staging') ?? path.join(raiz, '.local/migracion/staging.json');
const clave = process.env.MIGRACION_CLAVE;

async function main() {
  if (!base || !/^[a-z0-9_]+$/.test(base)) throw new Error('Indica la base con --base <nombre> (p. ej. posventa_migracion).');
  if (!clave) throw new Error('Falta la variable MIGRACION_CLAVE (contraseña inicial de los usuarios migrados).');
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
  const u = new URL(process.env.DATABASE_URL);
  u.pathname = '/' + base;
  const prisma = new PrismaClient({ datasources: { db: { url: u.toString() } } });
  const inicio = Date.now();
  try {
    const s = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    const rep = await cargarStaging(prisma, s, { claveUsuarios: clave, log: (m) => process.stdout.write(`\r${m}                    `) });
    const salida = path.join(path.dirname(archivo), `reporte_${base}.json`);
    fs.writeFileSync(salida, JSON.stringify({ base, segundos: Math.round((Date.now() - inicio) / 1000), ...rep }, null, 1));
    console.log(`\nBase «${base}»: carga terminada en ${Math.round((Date.now() - inicio) / 1000)} s.`);
    console.table(rep.tablas);
    for (const a of rep.avisos) console.log('Aviso:', a);
    console.log(`Rechazos: ${rep.rechazos.length} (detalle en ${salida}).`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error('\n' + (e?.message ?? e)); process.exit(1); });
