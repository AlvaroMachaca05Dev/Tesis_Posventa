# Datos precargados del sistema

El sistema debe **arrancar con sus datos** para poder usarse y probarse: catálogos, grupos, planes, locales, series, cuentas y las órdenes de ejemplo. Hoy esos datos viven en el prototipo HTML y en las plantillas de `prototipo/carga_masiva/`. Cada slice que crea una tabla **la entrega ya cargada y con pruebas**.

Regla de privacidad: solo datos sanitizados. En esta copia los nombres reales de técnicos ya están sustituidos por «Técnico demo N». Antes de cargar cualquier dato nuevo, correr `herramientas/buscar_datos_reales.ps1`.

## Inventario del prototipo (R7.7)
| Datos | Cantidad en el prototipo | Fuente | Slice que los carga |
|---|---|---|---|
| Locales (sedes) | 2 | `db.branches` | S1 (ya cargados) |
| Roles, permisos y módulos habilitados | 7 roles, matriz de 48 módulos | `ac_permisos_data.js` | S1 (ya cargados) |
| Usuarios de demostración | 8 | semillas | S1 (ya cargados) |
| Clientes | 1 | `db.clients` | S2 |
| Vehículos | 1 (DEM-679) | `db.vehicles` | S2 |
| Marcas de vehículo | 6 | `db.r74vbrands` | S2 |
| Grupos de vehículos | 5 (G1 a G5) | `db.r74groups` y `01_RSA_precarga_grupos_y_servicios_G1_G5.xlsx` | S5 |
| Órdenes de servicio históricas | 42 | `db.orders` | S3 |
| Catálogo de productos y servicios | 26 | `db.catalog` | S3 (servicios) y S3b (productos) |
| Categorías y marcas de producto | 15 y 3 | `db.r74cats`, `db.r74pbrands` | S3b |
| Planes preventivos | 3 | `db.plans` | S5 |
| Reglas de línea temporal | 1 | `db.r73tlRules` | S6 |
| Tareas de ejemplo | 7 (y 9 listas) | `db.tasks`, `db.lists` | S7 |
| Proveedores | 2 | `db.suppliers` | segunda ola (comercial) |
| Cuentas bancarias y series | 6 y 4 | `db.bankAccounts`, `db.r74series` | segunda ola (comercial) |

## Cómo se carga
- Un script por slice en `database/seeds/` (por ejemplo `precarga-clientes-vehiculos.ts`) que lee un archivo JSON generado del prototipo (`database/seeds/precarga/*.json`) y es idempotente (se puede correr varias veces).
- Los archivos JSON se generan con `herramientas/exportar_precarga_prototipo.mjs` desde `prototipo/R_Motriz_R7.7.html` (sin datos reales).
- Las plantillas Excel de `prototipo/carga_masiva/` sirven además como prueba de la carga masiva (slice S4).

## Pruebas obligatorias de cada precarga
1. Después de `pnpm db:seed`, la base tiene **exactamente** las cantidades de la tabla (por ejemplo, 42 ODS).
2. Correr la precarga dos veces no duplica nada.
3. Los datos cargados cumplen las reglas del slice (placa única por empresa, documento único, estados válidos, etc.).
4. Nada de la precarga contiene datos reales (`buscar_datos_reales.ps1` sin hallazgos).
5. La pantalla muestra los datos cargados (se comprueba en localhost).
