# database

Una sola base de datos PostgreSQL para todos los módulos, administrada con Prisma.

| Ruta | Qué es |
|---|---|
| `prisma/schema.prisma` | Esquema único |
| `prisma/migrations/` | Migraciones (cada cambio del esquema es una migración) |
| `seeds/seed.ts` | Roles, permisos, locales y usuarios de demostración |
| `seeds/precarga-maestros.ts`, `seeds/precarga/` | Datos precargados del prototipo (`docs/plan/PRECARGA_DE_DATOS.md`) |
| `dev-db.mjs` | PostgreSQL embebido para desarrollo (datos en `F:\Tesis\datos-pg`, fuera del repositorio) |

| Comando (desde la raíz) | Para qué |
|---|---|
| `pnpm db:dev` | Levantar la base de desarrollo |
| `pnpm db:migrate` | Crear o aplicar migraciones en desarrollo |
| `pnpm db:deploy` | Aplicar migraciones en otro entorno |
| `pnpm db:seed` | Cargar semillas y precarga |
| `pnpm db:studio` | Ver y editar los datos en el navegador |

La conexión se toma de `DATABASE_URL` en el `.env`. La lógica de negocio va en la API, no en triggers ni procedimientos almacenados.
