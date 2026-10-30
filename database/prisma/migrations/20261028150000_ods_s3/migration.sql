-- AlterTable
ALTER TABLE "DetalleODS" DROP COLUMN "cantidadHH",
DROP COLUMN "duracionMinutos",
ADD COLUMN     "cantidad" DECIMAL(12,3) NOT NULL DEFAULT 1,
ADD COLUMN     "costo" DECIMAL(12,3),
ADD COLUMN     "descuentoPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
ADD COLUMN     "impuesto" TEXT NOT NULL DEFAULT 'IGV',
ADD COLUMN     "posicion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "precio" DECIMAL(12,3) NOT NULL DEFAULT 0,
ADD COLUMN     "referencia" TEXT,
ADD COLUMN     "rentabilidadPct" DECIMAL(8,3),
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'servicio',
ADD COLUMN     "total" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrdenServicio" DROP COLUMN "fechaLlegada",
ADD COLUMN     "clienteId" TEXT NOT NULL,
ADD COLUMN     "correlativo" INTEGER,
ADD COLUMN     "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "creadoPorId" TEXT NOT NULL,
ADD COLUMN     "decision" TEXT NOT NULL DEFAULT 'Pendiente de aprobación',
ADD COLUMN     "eliminada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "externa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fechaCierre" TIMESTAMP(3),
ADD COLUMN     "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "jefeTallerId" TEXT,
ADD COLUMN     "motivoEliminacion" TEXT,
ADD COLUMN     "observaciones" TEXT,
ADD COLUMN     "recomendaciones" TEXT,
ADD COLUMN     "tecnicoId" TEXT,
ADD COLUMN     "tipoAtencion" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CorrelativoODS" (
    "organizacionId" TEXT NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CorrelativoODS_pkey" PRIMARY KEY ("organizacionId")
);

-- CreateTable
CREATE TABLE "Abono" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodo" TEXT NOT NULL,
    "concepto" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "registradoPorId" TEXT NOT NULL,

    CONSTRAINT "Abono_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrdenServicio" ADD CONSTRAINT "OrdenServicio_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenServicio" ADD CONSTRAINT "OrdenServicio_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenServicio" ADD CONSTRAINT "OrdenServicio_jefeTallerId_fkey" FOREIGN KEY ("jefeTallerId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenServicio" ADD CONSTRAINT "OrdenServicio_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abono" ADD CONSTRAINT "Abono_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenServicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abono" ADD CONSTRAINT "Abono_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
