-- Migración inicial (S4, RN-11): clave de origen de cada fila cargada desde otro sistema.
CREATE TABLE "ClaveOrigen" (
    "id" TEXT NOT NULL,
    "sistema" TEXT NOT NULL,
    "tabla" TEXT NOT NULL,
    "idOrigen" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "cargadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClaveOrigen_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClaveOrigen_sistema_tabla_idOrigen_key" ON "ClaveOrigen"("sistema", "tabla", "idOrigen");
CREATE INDEX "ClaveOrigen_tabla_registroId_idx" ON "ClaveOrigen"("tabla", "registroId");
