-- AlterTable
ALTER TABLE "Rol" ADD COLUMN     "asignableAServicios" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nivel" INTEGER NOT NULL DEFAULT 1;
