# apps

| Carpeta | Qué es | Puerto |
|---|---|---|
| `api/` | API en NestJS | 3000 |
| `web/` | Pantalla en React + TypeScript + Vite | 5173 |

Las dos se ordenan igual, por área y módulo (`AGENTS.md` §19): `comun/`, `sistema/`, `maestros/`, `posventa/` y `facturacion/` (reservada).

- Levantar todo (base, API y pantalla): `pnpm dev` desde la raíz y abrir `http://localhost:5173`.
- Pruebas: `pnpm test`. Las de la API usan la base de desarrollo y borran sus datos; después se vuelve a cargar con `pnpm db:seed`.
