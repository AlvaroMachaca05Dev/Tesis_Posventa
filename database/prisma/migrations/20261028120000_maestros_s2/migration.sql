-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('DNI', 'CARNET_EXTRANJERIA', 'RUC');

-- DropIndex
DROP INDEX "Vehiculo_organizacionId_placa_key";

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "comentario" TEXT,
ADD COLUMN     "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "direccionFiscal" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "esGenerico" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "movil" TEXT,
ADD COLUMN     "nombreComercial" TEXT,
ADD COLUMN     "pais" TEXT NOT NULL DEFAULT 'PE',
ADD COLUMN     "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'DNI',
ADD COLUMN     "ubigeo" TEXT;

-- AlterTable
ALTER TABLE "Organizacion" ADD COLUMN     "paisPredeterminado" TEXT NOT NULL DEFAULT 'PE';

-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN     "color" TEXT,
ADD COLUMN     "comentario" TEXT,
ADD COLUMN     "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nroMotor" TEXT,
ADD COLUMN     "nroSerie" TEXT,
ADD COLUMN     "nroVin" TEXT,
ADD COLUMN     "placaNorm" TEXT NOT NULL DEFAULT '';

-- Las placas que ya existen se normalizan antes de crear el índice único.
UPDATE "Vehiculo" SET "placaNorm" = upper(regexp_replace("placa", '[^A-Za-z0-9]', '', 'g'));
ALTER TABLE "Vehiculo" ALTER COLUMN "placaNorm" DROP DEFAULT;

-- CreateTable
CREATE TABLE "MarcaVehiculo" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "modelos" TEXT[],

    CONSTRAINT "MarcaVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarcaVehiculo_organizacionId_nombre_key" ON "MarcaVehiculo"("organizacionId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Vehiculo_organizacionId_placaNorm_key" ON "Vehiculo"("organizacionId", "placaNorm");

-- AddForeignKey
ALTER TABLE "MarcaVehiculo" ADD CONSTRAINT "MarcaVehiculo_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

