-- Logo de la empresa para los PDF y tickets (JPEG en base64).
ALTER TABLE "Organizacion" ADD COLUMN "logoJpeg" TEXT, ADD COLUMN "logoAncho" INTEGER, ADD COLUMN "logoAlto" INTEGER;
