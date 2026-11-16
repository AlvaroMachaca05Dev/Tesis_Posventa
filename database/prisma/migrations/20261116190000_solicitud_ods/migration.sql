-- RF-018: solicitudes de corrección o reapertura de una ODS cerrada, con quién la pidió y quién la resolvió.
CREATE TABLE "SolicitudOds" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "estadoDestino" TEXT,
    "cambios" JSONB,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "solicitadaPorId" TEXT NOT NULL,
    "resueltaPorId" TEXT,
    "respuesta" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoEn" TIMESTAMP(3),
    CONSTRAINT "SolicitudOds_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SolicitudOds_ordenId_idx" ON "SolicitudOds"("ordenId");
ALTER TABLE "SolicitudOds" ADD CONSTRAINT "SolicitudOds_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenServicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitudOds" ADD CONSTRAINT "SolicitudOds_solicitadaPorId_fkey" FOREIGN KEY ("solicitadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitudOds" ADD CONSTRAINT "SolicitudOds_resueltaPorId_fkey" FOREIGN KEY ("resueltaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
