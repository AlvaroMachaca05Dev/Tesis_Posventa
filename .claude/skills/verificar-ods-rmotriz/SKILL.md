---
name: verificar-ods-rmotriz
description: Verificar las reglas de órdenes de servicio de INC-01 contra los criterios de la spec, distinguiendo pruebas automáticas, de servidor y recorrido visual. Funciona sobre la implementación real o, mientras no exista, sobre el prototipo.
---

**Entrada:** `specs/INC-01-base-operativa.md` (criterios `CA-01-xx`), `AGENTS.md` y la implementación en `src/` si existe. **Si `src/` no tiene código** (hoy: ADR-001 sin aceptar), verifica solo contra el **prototipo** con la skill `probar-prototipo-playwright` y di claramente que eso es **referencia de comportamiento**, no verificación de la implementación.

**Qué verificar (con datos sintéticos y bases temporales)**
- Cliente y vehículo coherentes, códigos únicos, dos tipos de línea, subtotal y descuento correctos, y que las H-H **no** multiplican el precio de un servicio.
- Estados Recepción → En proceso → Entrega → Archivada; transiciones inválidas rechazadas; No aprobada puede archivarse sin nota.
- Decisión del cliente: **solo un ítem nuevo** revierte Aprobada → Pendiente; editar uno existente no. Retiro de ítem conserva antes/después.
- ODS archivada: bloquea el detalle; `corregirArchivada` solo administrador con motivo y **no reactiva**; `reabrir` con motivo y auditoría con hora de servidor; **editar una línea existente** (no solo agregar otra).
- Bitácora única y auditoría no editable.
- **Rutas HTTP sin sesión, CSRF y permisos por rol y sede.** Las pruebas directas del almacenamiento **no** acreditan estos controles.
- Vista técnica sin costos ni precios en **ninguna respuesta**; vista de cliente sin costos ni márgenes.
- Detección de DNI/placa duplicados antes del alta; alta de marca/modelo sin perder el formulario.
- PDF: el contenido y la paginación se verifican; **una cabecera `%PDF` no valida contenido ni diseño**.

**Salida:** tabla `CA-01-xx` → resultado → comando o pasos → evidencia → pendientes, más los riesgos observados con su escenario. **Terminado** con cobertura completa o con las limitaciones explícitas; no conviertas «cuatro pruebas aprobadas» en «siete aceptaciones completas». Guarda los resultados en `docs/evidencias/`.

**No registres** contraseñas generadas por la inicialización ni datos reales.
