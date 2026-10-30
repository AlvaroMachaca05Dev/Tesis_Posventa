# Cambios por slice tras revisar el sistema de referencia (28/10/2026)

Qué decisión (DEC-61 a DEC-80, en `docs/decisiones/DECISIONES_CERRADAS.md` §11) se aplica en cada slice, y qué falta confirmar. Fuente: `reverse-lab/REFERENCIA-SISTEMAS` (solo como referencia) y las respuestas del investigador. Manda el prototipo HTML R7.7 y lo que se decide al desarrollar.

## Mapa
| Slice | Se aplica | Estado |
|---|---|---|
| S1 (ajuste) | DEC-79 (el Superadministrador asigna hasta su mismo nivel) | Hecho con S2 |
| **S2** Clientes y vehículos | DEC-69, DEC-70, DEC-78 (auditoría de maestros) | Hecho (28/10) |
| S3 ODS | DEC-61, 67, 71, 72, 73, 80 | Hecho (28/10), salvo Facturar, cotización enlazada y estado de tarea por ítem |
| S4 Carga masiva | DEC-67 (letra E), DEC-68 | Pendiente |
| S7 Tareas | DEC-62, 63, 64 | Pendiente |
| S9 Bitácora | DEC-65, 78 | Pendiente |
| S10 Automatizaciones | DEC-66 | Pendiente |
| S11 Configuración | País predeterminado, tiempo de edición de comentarios, porcentaje de detracción, contraseña de inventario, términos y condiciones (DEC-65, 69, 75, 76, 79, 80) | Pendiente |
| Segunda ola (comercial e inventario) | DEC-74, 75, 76, 77 | Pendiente |

## Lo que se hizo en S2 y lo que se dejó para después
- Hecho: cliente y vehículo con los campos de DEC-69 y DEC-70, enlace por ID interno, documento único, placa comparada sin guiones, «Clientes varios», baja recuperable, auditoría y lecturas de km.
- Para S4: actualizar por documento y por placa en la carga masiva, con reasignación de titular.
- Para S11: pantalla para cambiar el país predeterminado (hoy el campo existe en la empresa con valor «PE»).
- Hoja de ruta: consulta externa de DNI/RUC y de vehículos por API.

## Pendiente de confirmar (no bloquea S2)
1. **Carga de Tuulapp:** «Finalizado» va a Cerrado; falta decir a qué estado va «En proceso» (la ODS no tiene «Pendiente»; se propone Recepción).
2. **Correlativo de ODS:** se asumió uno por empresa (no por local) y que no se reinicia cada día ni cada año.
3. **ODS externas con el mismo número entre dos sistemas:** la letra E no distingue de qué sistema vienen; se propone una letra o sufijo por origen.
4. **DEC-02:** el 27/10 se dijo «se mantiene»; el resumen del 28/10 lo modifica (revierte solo con servicio o producto nuevo o cambio de precio de producto). Se aplicó el resumen, que es más reciente.
5. **Contraseña de ajuste de inventario:** solo el Superadministrador la define; si la comparte, quien la conozca puede ajustar. Confirmar si el Administrador y el Logístico pueden recibirla.
6. **Ubigeo:** hoy es un texto libre; falta decidir si se usa el catálogo del INEI.
7. **Placa vacía** (vehículo en trámite): hoy la placa es obligatoria.
8. **Detracción:** confirmar si los 700 soles se miden sobre el total del comprobante con IGV.
