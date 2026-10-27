// Base de datos de desarrollo: un PostgreSQL real que corre sin instalar nada (paquete embedded-postgres).
// Los datos viven fuera del repositorio. Se detiene con Ctrl+C.
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';

const dir = process.env.PG_DATA_DIR || 'F:/Tesis/datos-pg';
const port = Number(process.env.PG_PORT || 54329);
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'posventa',
  password: 'posventa_dev',
  port,
  persistent: true,
});

const nuevo = !fs.existsSync(dir + '/PG_VERSION');
if (nuevo) await pg.initialise();
await pg.start();
if (nuevo) await pg.createDatabase('posventa');
console.log(`PostgreSQL de desarrollo listo en el puerto ${port} (datos en ${dir}). Ctrl+C para detener.`);

const parar = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', parar);
process.on('SIGTERM', parar);
setInterval(() => {}, 1 << 30);
