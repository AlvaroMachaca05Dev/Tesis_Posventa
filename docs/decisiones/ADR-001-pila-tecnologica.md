# ADR-001 — Pila tecnológica de la implementación

**Estado: ACEPTADO el 20/10/2026 por Álvaro Machaca (investigador).** Pila: React + TypeScript + Vite, NestJS (monolito modular), PostgreSQL con Prisma, OpenAPI, Docker Compose y GitHub Actions. Los cambios posteriores pasan por la skill `guardian-coherencia-tesis`.
**Fecha de la propuesta:** 19/10/2026.  
**Decisor requerido:** investigador (OPEN-03); equipo, Claude y profesor solo revisan.  
Hasta que el investigador acepte este ADR, **ningún agente escribe código de aplicación** (ver `AGENTS.md`).

## Contexto

La tesis usa hoy un prototipo HTML/localStorage, diagramas UML y un motor de referencia JavaScript. No existe todavía servidor, autenticación real ni base de datos operativa. La delimitación R7.7 mantiene como primera versión interna la carga masiva de ODS, bancos simples, inventario/requerimientos, compras e impuesto por ítem; facturación electrónica, flujo de caja, cajas, integraciones, Gemini y API son beta. El núcleo académico sigue siendo posventa, ODS, agenda, planes e historial.

## Propuesta recomendada para revisar

| Capa | Propuesta |
|---|---|
| Web | React + TypeScript + Vite |
| API | Node.js LTS + NestJS, monolito modular REST |
| Contrato | OpenAPI y cliente tipado |
| Datos | PostgreSQL + Prisma estable fijado por lockfile |
| Trabajos diferidos | Worker del mismo repositorio y patrón outbox en PostgreSQL |
| Evidencias | Adaptador local en desarrollo; S3 compatible en evolución |
| Calidad | Reusar `prototipo/pruebas/` como pruebas de aceptación de interfaz; añadir pruebas unitarias, integración y Playwright |
| Entrega | Docker Compose y GitHub Actions |

La justificación es reutilizar el motor JavaScript, mantener un único lenguaje entre web, dominio y servidor, y evitar microservicios prematuros. NestJS + Prisma tiene costo de aprendizaje y mantenimiento para un equipo pequeño; por ello debe aceptarse conscientemente, no imponerse.

## Alternativa conservada

**React + TypeScript + FastAPI + PostgreSQL** es válida si el equipo domina Python de manera claramente superior o si XLSX/PDF pesa más que reutilizar el motor JavaScript. Python ya cuenta con `openpyxl` y `reportlab`; elegirla exige portar o encapsular las reglas JavaScript y conservar pruebas equivalentes.

HTML/localStorage queda solo como maqueta; no satisface operación multiusuario, permisos de servidor, transacciones ni auditoría operativa.

## Decisiones pendientes dentro de la propuesta

| Tema | Opciones a evaluar | Decisión pendiente |
|---|---|---|
| Importación XLSX | ExcelJS o SheetJS en Node; `openpyxl` en alternativa Python | Biblioteca, licencias y prueba con plantilla ODS. |
| PDF/ticket | PDFKit o Puppeteer en Node; `reportlab` en alternativa Python | Biblioteca, formato y prueba de impresión. |
| Roles API | Administrador, Jefe de taller, Cajera, Técnico, Logístico, Externo, Asistente administrativo de finanzas | Matriz de permisos aplicada en servidor. |
| Despliegue | Equipo local/servidor a definir | Responsable, respaldo, secretos y recuperación. |

## Límites

- No sustituye al ERP sin conciliación, permisos, respaldo, periodo paralelo y aprobación de producción.
- No adopta microservicios, Redis, Kafka ni proveedor cloud específico en la primera implementación.
- Facturación electrónica permanece beta hasta validación tributaria específica.
- Los datos de pruebas son sintéticos.

## Cómo cerrar ADR-001

El investigador registra en `docs/decisiones/DECISIONES_CERRADAS.md`: opción elegida, versiones objetivo, responsable técnico, ambiente, decisión XLSX/PDF y fecha. Luego cambia este ADR a **ACEPTADO** y actualiza `AGENTS.md`, documentación y estructura del repositorio. Hasta entonces esta es una propuesta, no una orden de implementación.