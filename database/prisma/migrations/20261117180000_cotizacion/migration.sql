CREATE TABLE "Cotizacion" (
  "id" TEXT NOT NULL,
  "organizacionId" TEXT NOT NULL,
  "localId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "vehiculoId" TEXT,
  "serie" TEXT NOT NULL DEFAULT 'COT',
  "numero" INTEGER NOT NULL,
  "codigo" TEXT NOT NULL,
  "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validaHasta" TIMESTAMP(3) NOT NULL,
  "condicion" TEXT NOT NULL DEFAULT 'CONTADO',
  "formaPago" TEXT,
  "conIgv" BOOLEAN NOT NULL DEFAULT true,
  "conDetraccion" BOOLEAN NOT NULL DEFAULT false,
  "observaciones" TEXT,
  "comentario" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'EMITIDA',
  "exonerada" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "inafecta" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "gravada" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "igv" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "creadaPorId" TEXT NOT NULL,
  "anuladaPorId" TEXT,
  "motivoAnulacion" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DetalleCotizacion" (
  "id" TEXT NOT NULL,
  "cotizacionId" TEXT NOT NULL,
  "posicion" INTEGER NOT NULL DEFAULT 0,
  "tipo" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL,
  "referencia" TEXT,
  "cantidad" DECIMAL(12,3) NOT NULL DEFAULT 1,
  "precio" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "descuentoPct" DECIMAL(9,6) NOT NULL DEFAULT 0,
  "tipoIgv" TEXT NOT NULL DEFAULT 'GRAVADO',
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "servicioId" TEXT,
  "productoId" TEXT,
  CONSTRAINT "DetalleCotizacion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Cotizacion_organizacionId_serie_numero_key" ON "Cotizacion"("organizacionId", "serie", "numero");
CREATE INDEX "Cotizacion_clienteId_idx" ON "Cotizacion"("clienteId");
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_anuladaPorId_fkey" FOREIGN KEY ("anuladaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DetalleCotizacion" ADD CONSTRAINT "DetalleCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
