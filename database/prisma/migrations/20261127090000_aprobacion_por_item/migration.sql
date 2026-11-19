-- Aprobación por ítem en la ODS (opcional por empresa, desactivada por defecto).
ALTER TABLE "DetalleODS" ADD COLUMN "aprobado" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organizacion" ADD COLUMN "aprobacionPorItem" BOOLEAN NOT NULL DEFAULT false;
