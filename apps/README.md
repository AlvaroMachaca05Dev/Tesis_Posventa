# apps

| Carpeta | Qué es | Puerto |
|---|---|---|
| `api/` | API en NestJS | 3000 |
| `web/` | Pantalla en React + TypeScript + Vite | 5173 |

Las dos se ordenan igual, por área y módulo (`AGENTS.md` §19): una carpeta por módulo (`sesion/`, `usuario/`, `cliente/`, `vehiculo/`, `ordenServicio/`…), más `comun/` y `facturacion/` (reservada).

- Levantar todo (base, API y pantalla): `pnpm dev` desde la raíz y abrir `http://localhost:5173`.
- Pruebas: `pnpm test`. Las de la API usan la base aparte `posventa_test` (nunca la de desarrollo); se prepara con la base encendida mediante `pnpm db:test-prep`. Este comando borra y recrea únicamente `posventa_test`, aplica las migraciones y carga las semillas; vuelve a ser necesario si esa base quedó con un esquema anterior. No ejecutarlo mientras corran pruebas.
