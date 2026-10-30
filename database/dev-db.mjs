// Base de datos de desarrollo: un PostgreSQL real que corre sin instalar nada (paquete embedded-postgres).
// Los datos viven fuera del repositorio. Se detiene con Ctrl+C.
// La base de la aplicación se crea siempre en UTF-8: en Windows, el valor por omisión (WIN1252)
// rechaza caracteres como «→» o los emojis que se escriben en la bitácora.
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';

const dir = process.env.PG_DATA_DIR || 'F:/Tesis/datos-pg';
const port = Number(process.env.PG_PORT || 54329);
const base = process.env.PG_DB || 'posventa_utf8';
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'posventa',
  password: 'posventa_dev',
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

const nuevo = !fs.existsSync(dir + '/PG_VERSION');
if (nuevo) await pg.initialise();
await pg.start();
const cliente = pg.getPgClient();
await cliente.connect();
if (!(await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [base])).rowCount) {
  await cliente.query(`CREATE DATABASE "${base}" ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
}
await cliente.end();
console.log(`PostgreSQL de desarrollo listo en el puerto ${port}, base «${base}» en UTF-8 (datos en ${dir}). Ctrl+C para detener.`);

const parar = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', parar);
process.on('SIGTERM', parar);
setInterval(() => {}, 1 << 30);
