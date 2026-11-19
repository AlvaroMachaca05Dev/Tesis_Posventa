-- DropForeignKey
ALTER TABLE "Abono" DROP CONSTRAINT "Abono_ordenId_fkey";

-- DropForeignKey
ALTER TABLE "NotaVenta" DROP CONSTRAINT "NotaVenta_ordenId_fkey";

-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "eligeSistema" TEXT,
ADD COLUMN     "etiqueta" TEXT,
ADD COLUMN     "lineaPlan" TEXT,
ADD COLUMN     "pasos" JSONB,
ADD COLUMN     "subservicios" JSONB,
ADD COLUMN     "visita" TEXT;

-- AlterTable
ALTER TABLE "Solapamiento" ADD COLUMN     "porcentaje" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN     "planId" TEXT;

-- CreateTable
CREATE TABLE "PlanPreventivo" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "combustible" TEXT NOT NULL,
    "uso" TEXT NOT NULL,
    "ciclo" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlanPreventivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanPreventivo_organizacionId_codigo_key" ON "PlanPreventivo"("organizacionId", "codigo");

-- AddForeignKey
ALTER TABLE "PlanPreventivo" ADD CONSTRAINT "PlanPreventivo_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanPreventivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abono" ADD CONSTRAINT "Abono_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenServicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaVenta" ADD CONSTRAINT "NotaVenta_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenServicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Compra_organizacionId_proveedorId_tipoDocumento_serie_numero_ke" RENAME TO "Compra_organizacionId_proveedorId_tipoDocumento_serie_numer_key";
