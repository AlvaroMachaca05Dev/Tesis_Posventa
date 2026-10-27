# Propuesta tecnológica R7.8 — pendiente de decisión

**Fecha:** 19 de octubre de 2026  
**Estado:** Propuesta técnica. No constituye una decisión aceptada ni una implementación.  
**Revisión requerida:** investigador, equipo de tesis, asesor y Claude.

## Propósito

La propuesta convierte las vistas HTML y diagramas de la tesis en una ruta implementable. El núcleo académico sigue siendo clientes, vehículos, ODS, historial/bitácora, planes preventivos, agenda técnica y seguimiento. Conforme a la delimitación R7.7, la primera versión interna también incluye compras, bancos simples, inventario/requerimientos e impuesto por ítem; eso no obliga a que todos sean parte de la entrega funcional de tesis. Facturación electrónica, flujo de caja, integraciones, Gemini, API pública, RR. HH., SaaS y OBD2 permanecen beta o evolución.

## Alternativas

| Alternativa | Ventaja | Riesgo |
|---|---|---|
| React + TypeScript + NestJS + PostgreSQL | Un lenguaje en interfaz, API y dominio; reutiliza motor JavaScript; módulos y contrato API claros. | Curva de NestJS y migraciones. |
| React + TypeScript + FastAPI + PostgreSQL | Muy útil para XLSX/PDF y ecosistema Python. | Dos lenguajes y portabilidad/puente del motor JavaScript. |
| HTML + LocalStorage | Útil para maqueta visual. | No resuelve operación multiusuario, permisos, auditoría ni persistencia operativa. |

## Recomendación para validar

Un **monolito modular TypeScript**, no microservicios:

| Capa | Propuesta | Responsabilidad |
|---|---|---|
| Interfaz | React + TypeScript + Vite | Vistas, agenda y bitácora. |
| API | Node.js LTS + NestJS | API REST, permisos y casos de uso. |
| Contrato | OpenAPI | Contrato visible y cliente tipado. |
| Dominio | Paquete TypeScript compartido | ODS, estados, cronómetros y validaciones. |
| Datos | PostgreSQL + Prisma estable fijado por lockfile | Transacciones, migraciones, auditoría y reportes. |`r`n| Importación diaria | ExcelJS o SheetJS: decisión pendiente | XLSX/CSV con vista previa e idempotencia. |`r`n| Documentos | PDFKit o Puppeteer: decisión pendiente | ODS, nota, ticket y comprobantes internos. |
| Archivos | Adaptador local y, después, compatible con S3 | Evidencias y adjuntos. |
| Diferidos | Worker + tabla/outbox PostgreSQL | Recordatorios, notificaciones e importaciones. |
| Calidad | Vitest/Jest, integración y Playwright | Reglas, API y recorridos críticos. |
| Entrega | Docker Compose y GitHub Actions | Entorno reproducible y CI. |

## Estructura propuesta

```text
apps/{web,api,worker}
packages/{domain,contracts,ui}
database/{migrations,seeds}
docs/
infra/
```

## Límites

1. No reemplaza el ERP ni adopta nube, Redis, Kafka o microservicios en la primera entrega.
2. Costos, permisos, bitácora y evidencias pertenecen al dominio; las maquetas HTML no son la fuente de verdad.
3. Migraciones versionadas y datos sintéticos para desarrollo/pruebas.
4. Antes de escribir aplicación se debe aceptar o modificar ADR-001: tecnología, versiones LTS, responsable, ambiente y seguridad. Se evaluarán explícitamente ExcelJS/SheetJS y PDFKit/Puppeteer frente a las alternativas Python `openpyxl` y `reportlab`.
5. La API aplica permisos por módulo y nivel según los roles de cada usuario (siete roles base en tres niveles; ver DEC-59).

Si el equipo domina Python de manera superior, FastAPI sigue siendo válida. Se recomienda TypeScript por reutilizar el motor JavaScript y reducir lenguajes, no como obligación académica.