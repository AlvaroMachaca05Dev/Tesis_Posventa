-- Configuración de la empresa: razón social, parámetros de impresión y series de comprobantes por local.
ALTER TABLE "Organizacion" ADD COLUMN "razonSocial" TEXT;
ALTER TABLE "Organizacion" ADD COLUMN "pieTicket" TEXT;
ALTER TABLE "Organizacion" ADD COLUMN "anchoTicketMm" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "Local" ADD COLUMN "telefono" TEXT;
ALTER TABLE "Local" ADD COLUMN "serieNotaVenta" TEXT;
ALTER TABLE "Local" ADD COLUMN "serieBoleta" TEXT;
ALTER TABLE "Local" ADD COLUMN "serieFactura" TEXT;
