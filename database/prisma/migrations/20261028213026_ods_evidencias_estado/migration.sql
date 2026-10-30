-- AlterTable
ALTER TABLE "OrdenServicio" ADD COLUMN     "estadoVehiculo" JSONB;

-- CreateTable
CREATE TABLE "EvidenciaIngreso" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,
    "subidoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenciaIngreso_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EvidenciaIngreso" ADD CONSTRAINT "EvidenciaIngreso_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenServicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenciaIngreso" ADD CONSTRAINT "EvidenciaIngreso_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
