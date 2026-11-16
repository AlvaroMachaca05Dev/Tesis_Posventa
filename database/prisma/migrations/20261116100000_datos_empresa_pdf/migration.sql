-- Datos de la empresa que se imprimen en los PDF de la orden de servicio.
ALTER TABLE "Organizacion" ADD COLUMN "direccion" TEXT;
ALTER TABLE "Organizacion" ADD COLUMN "telefono" TEXT;
ALTER TABLE "Organizacion" ADD COLUMN "correo" TEXT;
ALTER TABLE "Organizacion" ADD COLUMN "lema" TEXT;
ALTER TABLE "Organizacion" ADD COLUMN "cuentasBancarias" TEXT;
ALTER TABLE "Organizacion" ADD COLUMN "terminosRecepcion" TEXT;
