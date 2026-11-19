-- Cambios de plan de un vehículo (tramos de la línea de tiempo).
CREATE TABLE "CambioPlanVehiculo" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "antes" TEXT NOT NULL,
    "despues" TEXT NOT NULL,
    "corte" TEXT NOT NULL,
    "km" INTEGER,
    "usuarioId" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CambioPlanVehiculo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CambioPlanVehiculo_vehiculoId_idx" ON "CambioPlanVehiculo"("vehiculoId");
ALTER TABLE "CambioPlanVehiculo" ADD CONSTRAINT "CambioPlanVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
