-- Cliente y proveedor comparten los mismos datos de contacto (formulario único).
-- El proveedor adopta los nombres del cliente; no se pierde ningún dato.
ALTER TABLE "Proveedor" RENAME COLUMN "telefono" TO "movil";
ALTER TABLE "Proveedor" RENAME COLUMN "correo" TO "email";
ALTER TABLE "Proveedor" RENAME COLUMN "direccion" TO "direccionFiscal";
ALTER TABLE "Proveedor" ADD COLUMN "nombreComercial" TEXT;
ALTER TABLE "Proveedor" ADD COLUMN "pais" TEXT NOT NULL DEFAULT 'PE';
ALTER TABLE "Proveedor" ADD COLUMN "comentario" TEXT;
-- El cliente también guarda el nombre de su contacto.
ALTER TABLE "Cliente" ADD COLUMN "contacto" TEXT;
