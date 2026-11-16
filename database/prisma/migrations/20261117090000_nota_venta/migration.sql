-- RF-088: nota de venta interna emitida desde la ODS, con serie del local, número consecutivo, tipo de IGV por ítem y detracción.
CREATE TABLE "CorrelativoSerie" (
    "organizacionId" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CorrelativoSerie_pkey" PRIMARY KEY ("organizacionId","serie")
);
CREATE TABLE "NotaVenta" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "condicion" TEXT NOT NULL DEFAULT 'CONTADO',
    "observaciones" TEXT,
    "comentario" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'EMITIDA',
    "exonerada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "inafecta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gravada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igv" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conDetraccion" BOOLEAN NOT NULL DEFAULT false,
    "detraccionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "detraccionExacta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "detraccion" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "emitidaPorId" TEXT NOT NULL,
    "anuladaPorId" TEXT,
    "motivoAnulacion" TEXT,
    "anuladaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotaVenta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotaVenta_organizacionId_serie_numero_key" ON "NotaVenta"("organizacionId", "serie", "numero");
CREATE INDEX "NotaVenta_ordenId_idx" ON "NotaVenta"("ordenId");
CREATE TABLE "DetalleNota" (
    "id" TEXT NOT NULL,
    "notaId" TEXT NOT NULL,
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
    CONSTRAINT "DetalleNota_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "NotaVenta" ADD CONSTRAINT "NotaVenta_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenServicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotaVenta" ADD CONSTRAINT "NotaVenta_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotaVenta" ADD CONSTRAINT "NotaVenta_emitidaPorId_fkey" FOREIGN KEY ("emitidaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotaVenta" ADD CONSTRAINT "NotaVenta_anuladaPorId_fkey" FOREIGN KEY ("anuladaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DetalleNota" ADD CONSTRAINT "DetalleNota_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "NotaVenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
