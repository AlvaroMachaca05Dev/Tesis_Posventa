-- Slice S5: maestros (proveedores, productos, servicios, grupos, reglas de precio y solapamientos).
-- El grupo del vehículo pasa de texto a grupoId; la precarga lo vuelve a asignar por familia de motor.
-- AlterTable
ALTER TABLE "Vehiculo" DROP COLUMN "grupo",
ADD COLUMN     "codigoMotor" TEXT,
ADD COLUMN     "grupoFuente" TEXT,
ADD COLUMN     "grupoId" TEXT;

-- AlterTable
ALTER TABLE "OrdenServicio" ADD COLUMN     "solapamientosMantenidos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "DetalleODS" ADD COLUMN     "descuentoMonto" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "horas" DECIMAL(6,2),
ADD COLUMN     "precioGrupo" DECIMAL(12,3),
ADD COLUMN     "productoId" TEXT,
ADD COLUMN     "servicioId" TEXT,
ADD COLUMN     "solapamientoId" TEXT,
ADD COLUMN     "trazaPrecio" JSONB;

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'RUC',
    "documento" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "direccion" TEXT,
    "rubro" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "referencia" TEXT,
    "unidad" TEXT NOT NULL DEFAULT 'UND',
    "categoria" TEXT,
    "marca" TEXT,
    "precio" DECIMAL(12,2) NOT NULL,
    "costo" DECIMAL(12,2),
    "proveedorId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servicio" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT,
    "trabajoMayor" BOOLEAN NOT NULL DEFAULT false,
    "externo" BOOLEAN NOT NULL DEFAULT false,
    "proveedorId" TEXT,
    "horasEstandar" DECIMAL(6,2) NOT NULL,
    "horasFuente" TEXT NOT NULL DEFAULT 'AUTODATA',
    "precioEstandar" DECIMAL(10,2) NOT NULL,
    "repuestos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoVehicular" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GrupoVehicular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamiliaMotor" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "combustible" TEXT,
    "litros" TEXT,
    "turbo" BOOLEAN NOT NULL DEFAULT false,
    "codigos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grupoId" TEXT,

    CONSTRAINT "FamiliaMotor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaAsignacionModelo" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anioDesde" INTEGER NOT NULL,
    "anioHasta" INTEGER NOT NULL,
    "grupoId" TEXT NOT NULL,
    "confianza" INTEGER NOT NULL,
    "automatica" BOOLEAN NOT NULL,

    CONSTRAINT "ReglaAsignacionModelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaPrecio" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "grupoId" TEXT,
    "servicios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "horas" DECIMAL(6,2),
    "precio" DECIMAL(10,2),
    "porcentaje" DECIMAL(6,2),
    "precioDesde" DECIMAL(10,2),
    "precioHasta" DECIMAL(10,2),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReglaPrecio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solapamiento" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "servicioBaseId" TEXT NOT NULL,
    "servicioReducidoId" TEXT NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'OPCIONAL',
    "descuentoEstandar" DECIMAL(10,2) NOT NULL,
    "descuentos" JSONB,
    "horasCompartidas" DECIMAL(6,2),
    "alerta" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Propuesto',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Solapamiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_organizacionId_documento_key" ON "Proveedor"("organizacionId", "documento");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_organizacionId_codigo_key" ON "Producto"("organizacionId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Servicio_organizacionId_codigo_key" ON "Servicio"("organizacionId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "GrupoVehicular_organizacionId_codigo_key" ON "GrupoVehicular"("organizacionId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "FamiliaMotor_organizacionId_codigo_key" ON "FamiliaMotor"("organizacionId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ReglaPrecio_organizacionId_codigo_key" ON "ReglaPrecio"("organizacionId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Solapamiento_organizacionId_codigo_key" ON "Solapamiento"("organizacionId", "codigo");

-- AddForeignKey
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoVehicular"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servicio" ADD CONSTRAINT "Servicio_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servicio" ADD CONSTRAINT "Servicio_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoVehicular" ADD CONSTRAINT "GrupoVehicular_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamiliaMotor" ADD CONSTRAINT "FamiliaMotor_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoVehicular"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaAsignacionModelo" ADD CONSTRAINT "ReglaAsignacionModelo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoVehicular"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaPrecio" ADD CONSTRAINT "ReglaPrecio_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaPrecio" ADD CONSTRAINT "ReglaPrecio_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoVehicular"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solapamiento" ADD CONSTRAINT "Solapamiento_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

