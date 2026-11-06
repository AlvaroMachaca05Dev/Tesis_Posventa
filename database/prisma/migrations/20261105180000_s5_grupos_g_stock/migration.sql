-- Slice S5 (2.ª parte): grupos G1 a G4 con precio por grupo en el servicio, solapamiento por par o por conjunto,
-- descuento con más decimales (montos fijos exactos) y stock por local con sus movimientos (ajuste de inventario).
-- AlterTable
ALTER TABLE "DetalleODS" ALTER COLUMN "descuentoPct" SET DATA TYPE DECIMAL(9,6);

-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "horasGrupo" JSONB,
ADD COLUMN     "preciosGrupo" JSONB;

-- AlterTable
ALTER TABLE "Solapamiento" ADD COLUMN     "minimo" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "nota" TEXT,
ADD COLUMN     "serviciosBase" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "serviciosReducidos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'PAR';

-- Las reglas de un par pasan a listas (se conservan los datos) y luego se quitan las columnas viejas.
UPDATE "Solapamiento" SET "serviciosBase" = ARRAY["servicioBaseId"], "serviciosReducidos" = ARRAY["servicioReducidoId"];
ALTER TABLE "Solapamiento" DROP COLUMN "servicioBaseId", DROP COLUMN "servicioReducidoId";

-- CreateTable
CREATE TABLE "StockProducto" (
    "productoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL DEFAULT 0,

    CONSTRAINT "StockProducto_pkey" PRIMARY KEY ("productoId","localId")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "entrada" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "salida" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(12,3) NOT NULL,
    "motivo" TEXT,
    "usuarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StockProducto" ADD CONSTRAINT "StockProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockProducto" ADD CONSTRAINT "StockProducto_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

