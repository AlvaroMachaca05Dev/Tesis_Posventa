# Prototipo HTML R7.7

`R_Motriz_R7.7.html` es un solo archivo: se abre con el navegador, sin servidor. Guarda sus datos en el navegador (`localStorage`) y sirve como referencia del comportamiento del sistema.

## Cómo usarlo
1. Abrir el archivo. En la pantalla de ingreso elegir un rol: Superusuario, Jefe de taller, Cajera, Técnico, Logístico, Técnico externo o Asistente administrativo de finanzas.
2. Los módulos **beta** salen al final del menú con la etiqueta «beta». Para ocultarlos: **Configuración › Empresa › Mostrar módulos beta en el menú** (solo el superusuario).
3. La apertura y cierre de caja está apagada por defecto y se activa en el mismo lugar.
4. Los datos de ejemplo son inventados.

## Dónde está cada cosa
| Carpeta | Contenido |
|---|---|
| `capas/` | Código fuente del prototipo, por capas (`r72` a `r77`); `aplicar_r77.py` arma el HTML |
| `pruebas/` | Pruebas automáticas con Playwright |
| `carga_masiva/` | Plantillas Excel para clientes, vehículos, productos, proveedores, stock, solapamientos, paquetes y órdenes de servicio |

## Reconstruir y probar
```bash
python capas/aplicar_r77.py R_Motriz_R7.6.html R_Motriz_R7.7.html
```
Las pruebas se ejecutan con Node y Playwright (`pruebas/e2e77.mjs` y las demás). En la última ejecución pasaron 602 comprobaciones sin fallos.

## Qué incluye (primera versión)
Clientes, vehículos, grupos y planes preventivos; órdenes de servicio con carga masiva diaria; línea temporal, tareas, citas, agenda y bitácora; cotizaciones, notas de venta, cuentas por cobrar y por pagar; bancos por local; productos, almacenes, requerimientos y kárdex; reportes con filtro por local; automatizaciones, usuarios, empresa y carga masiva.

## R7.8 (28/10/2026)
`R_Motriz_R7.8.html` es la R7.7 más la capa `capas/r78`: clientes y vehículos según las decisiones DEC-69 y DEC-70 (documento único, «Clientes varios», país con prefijo, ubigeo, fecha de registro, placa comparada sin guiones con aviso del titular, comentarios y búsqueda del cliente por documento o nombre) y los nombres «fecha de inicio» y «fecha de cierre» de la ODS. No cambian los demás módulos: lo decidido para ODS, tareas, bitácora, inventario y detracciones (DEC-61 a DEC-80) se refleja en el prototipo a medida que se desarrolla cada slice.
```bash
python capas/aplicar_r78.py R_Motriz_R7.7.html R_Motriz_R7.8.html
node pruebas/e2e78.mjs R_Motriz_R7.8.html   # 17 comprobaciones; necesita el paquete playwright
```
