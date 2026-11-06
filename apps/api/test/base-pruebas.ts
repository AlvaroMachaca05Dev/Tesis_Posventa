// Antes de cada archivo de pruebas: la API apunta a la base «posventa_test», nunca a la de desarrollo,
// porque las pruebas crean y borran datos. Se prepara con `pnpm db:test-prep`.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL en el .env.');
const u = new URL(url);
u.pathname = '/posventa_test';
process.env.DATABASE_URL = u.toString();
