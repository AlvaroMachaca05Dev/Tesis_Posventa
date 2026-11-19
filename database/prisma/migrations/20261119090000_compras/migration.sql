-- Compras a proveedores, su detalle y sus pagos (Cuentas por pagar).
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL DEFAULT 'FACTURA',
    "serie" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "condicion" TEXT NOT NULL DEFAULT 'CONTADO',
    "fechaVencimiento" TIMESTAMP(3),
    "observaciones" TEXT,
    "total" DECIMAL(12,2) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'REGISTRADA',
    "registradaPorId" TEXT NOT NULL,
    "anuladaPorId" TEXT,
    "motivoAnulacion" TEXT,
    "anuladaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DetalleCompra" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL DEFAULT 0,
    "productoId" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "costo" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "DetalleCompra_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PagoCompra" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodo" TEXT NOT NULL,
    "concepto" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "registradoPorId" TEXT NOT NULL,
    CONSTRAINT "PagoCompra_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Compra_organizacionId_proveedorId_tipoDocumento_serie_numero_key" ON "Compra"("organizacionId", "proveedorId", "tipoDocumento", "serie", "numero");
CREATE INDEX "Compra_proveedorId_idx" ON "Compra"("proveedorId");
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_anuladaPorId_fkey" FOREIGN KEY ("anuladaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PagoCompra" ADD CONSTRAINT "PagoCompra_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PagoCompra" ADD CONSTRAINT "PagoCompra_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
