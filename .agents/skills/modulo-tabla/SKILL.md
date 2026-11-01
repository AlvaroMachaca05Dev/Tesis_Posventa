---
name: modulo-tabla
description: Regla obligatoria para todo módulo de tipo tabla del sistema (localhost y prototipo): crear y editar en un modal centrado de dos columnas, filtros por columna en vez de buscador y sin textos explicativos. Usar SIEMPRE al crear o cambiar una pantalla con tabla (maestros, usuarios, roles, inventario, compras, etc.).
---

**Es de ley (investigador, 28/10/2026).** Toda pantalla cuyo contenido principal sea una tabla sigue el patrón de **Clientes** (`apps/web/src/maestros/cliente/Clientes.tsx`) y **Vehículos** (`apps/web/src/maestros/vehiculo/Vehiculos.tsx`). No se entrega un módulo de tabla que no lo cumpla.

**1. Crear y editar en un modal**
- El botón «+ Nombre» (arriba a la derecha) y «Editar» de cada fila abren un modal centrado: `<div className="fondo-modal"><form className="modal-form" role="dialog" aria-modal="true" aria-label="…">`.
- Dentro: `<div className="dos-col">` con cada campo en `<div className="campo">` (etiqueta + control). Los campos largos (comentarios, listas de casillas) llevan `campo ancha`.
- Casi cuadrado: ancho de 620 px, dos columnas, una sola en pantallas de menos de 560 px.
- Botones al pie a la derecha: «Cancelar» y luego el primario «Guardar …».
- Los errores del servidor se muestran **dentro** del modal (prop `error`); al cancelar se limpian.
- Nunca un formulario incrustado sobre la tabla que la empuje hacia abajo.

**2. Filtros por columna (sin buscador general)**
- No hay caja «Buscar». Bajo el encabezado va `<FilaFiltros>` de `apps/web/src/comun/FiltrosColumna.tsx` y la lista se filtra con `useFiltros` (una función que devuelve el texto de cada columna).
- Cada columna tiene su filtro, salvo **Acciones** (`conAcciones`).
- Es el mismo filtro del prototipo: un campo y un embudo con dos condiciones unidas por Y u O (contiene, no contiene, igual, diferente, empieza, termina, mayor, menor).

**3. Sin textos explicativos**
- Nada de subtítulos de ayuda, avisos ni notas del tipo «(no se puede editar)».
- Solo títulos, etiquetas, datos, botones y mensajes del servidor.

**4. Prototipo HTML a la par**
- En R7.x la tabla usa `table()` (ya trae los filtros de columna `r74`).
- El formulario abre en el modal de dos columnas: clase `r78-maestro` (ver `prototipo/capas/r78/a_maestros.js`, `r78Maestro()`).

**Comprobar antes de entregar**
- Una prueba web que abra el modal (`getByRole('dialog', { name })`).
- Una prueba web que filtre por una columna (`getByLabelText('Filtrar <Columna>')`).
- Una revisión en localhost.
