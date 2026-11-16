-- Venta directa por mostrador: la nota ya no exige una orden de servicio y sus pagos pueden colgar de la nota.
ALTER TABLE "NotaVenta" ALTER COLUMN "ordenId" DROP NOT NULL;
ALTER TABLE "NotaVenta" ADD COLUMN "vehiculoId" TEXT;
UPDATE "NotaVenta" n SET "vehiculoId" = o."vehiculoId" FROM "OrdenServicio" o WHERE o."id" = n."ordenId";
ALTER TABLE "NotaVenta" ADD CONSTRAINT "NotaVenta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotaVenta" ADD CONSTRAINT "NotaVenta_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Abono" ALTER COLUMN "ordenId" DROP NOT NULL;
ALTER TABLE "Abono" ADD COLUMN "notaId" TEXT;
ALTER TABLE "Abono" ADD CONSTRAINT "Abono_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "NotaVenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "NotaVenta_clienteId_idx" ON "NotaVenta"("clienteId");
