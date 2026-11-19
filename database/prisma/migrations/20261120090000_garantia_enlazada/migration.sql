-- Garantía enlazada: ODS de origen y servicios que originaron la garantía.
ALTER TABLE "OrdenServicio" ADD COLUMN "garantiaDeId" TEXT, ADD COLUMN "garantiaDetalleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "OrdenServicio" ADD CONSTRAINT "OrdenServicio_garantiaDeId_fkey" FOREIGN KEY ("garantiaDeId") REFERENCES "OrdenServicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
