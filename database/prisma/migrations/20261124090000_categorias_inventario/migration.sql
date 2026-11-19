-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_organizacionId_tipo_nombre_key" ON "Categoria"("organizacionId", "tipo", "nombre");

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
