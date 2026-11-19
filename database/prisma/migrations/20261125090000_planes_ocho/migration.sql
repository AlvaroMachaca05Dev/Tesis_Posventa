-- Ocho planes preventivos (combustible × uso × aceite) y uso y tipo de aceite del vehículo.
ALTER TABLE "PlanPreventivo" ADD COLUMN "aceite" TEXT NOT NULL DEFAULT 'M';
ALTER TABLE "Vehiculo" ADD COLUMN "uso" TEXT;
ALTER TABLE "Vehiculo" ADD COLUMN "aceite" TEXT;
