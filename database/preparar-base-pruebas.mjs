// Prepara la base de pruebas «posventa_test» en el mismo servidor de desarrollo: la borra, la crea en UTF-8,
// aplica las migraciones y carga las semillas. Así `pnpm test` nunca toca los datos de la base de desarrollo.
// Uso (con la base de desarrollo encendida): pnpm db:test-prep
import { execSync } from 'node:child_process';

const dev = process.env.DATABASE_URL;
if (!dev) throw new Error('Falta DATABASE_URL en el .env.');
// Misma regla que apps/api/test/base-pruebas.ts: el nombre de la base de desarrollo cambia por «posventa_test».
const u = new URL(dev);
u.pathname = '/posventa_test';
const pruebas = u.toString();
const nombre = 'posventa_test';
const correr = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

// CREATE DATABASE no admite ir junto a otra sentencia: se manda una por una.
for (const s of [`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`, `CREATE DATABASE "${nombre}" ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`]) {
  execSync(`prisma db execute --stdin --url "${dev}"`, { input: s, stdio: ['pipe', 'inherit', 'inherit'] });
}
correr('prisma migrate deploy --schema prisma/schema.prisma', { DATABASE_URL: pruebas });
correr('tsx seeds/seed.ts', { DATABASE_URL: pruebas });
console.log(`Base de pruebas «${nombre}» lista en UTF-8.`);
