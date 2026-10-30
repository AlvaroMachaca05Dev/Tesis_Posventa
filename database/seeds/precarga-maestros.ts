// Precarga del slice S2: el cliente, el vehículo y las marcas del prototipo R7.7 (sin datos reales).
// Los datos salen de precarga/maestros.json, generado con herramientas/exportar_precarga_prototipo.mjs.
// Es idempotente: se puede correr varias veces y no duplica ni pisa lo que se editó después.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

interface Maestros {
  clientes: { id: string; nombre: string; documento: string; tipoDocumento: string; movil: string; correo: string }[];
  vehiculos: { id: string; cliente: string; placa: string; marca: string; modelo: string; anio: number; vin: string; motor: string; serie: string; km: number; grupo: string }[];
  marcas: { nombre: string; modelos: string[] }[];
}

const normalizarPlaca = (p: string) => p.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export async function precargaMaestros(prisma: PrismaClient, organizacionId: string) {
  const datos = JSON.parse(readFileSync(new URL('./precarga/maestros.json', import.meta.url), 'utf8')) as Maestros;

  // Un cliente del prototipo sin documento es «Clientes varios»: documento 0000, admite vehículos sin titular conocido.
  const clientes: Record<string, string> = {};
  for (const c of datos.clientes) {
    const generico = !c.documento;
    const documento = c.documento || '0000';
    const fila = await prisma.cliente.upsert({
      where: { organizacionId_documento: { organizacionId, documento } },
      update: {},
      create: {
        organizacionId,
        documento,
        tipoDocumento: c.tipoDocumento === 'RUC' ? 'RUC' : 'DNI',
        nombre: generico ? 'Clientes varios' : c.nombre,
        movil: c.movil || null,
        email: c.correo || null,
        esGenerico: generico,
        comentario: generico ? 'Titular de DEM-679: el prototipo no informa el nombre.' : null,
      },
    });
    clientes[c.id] = fila.id;
  }

  for (const v of datos.vehiculos) {
    const placaNorm = normalizarPlaca(v.placa);
    const fila = await prisma.vehiculo.upsert({
      where: { organizacionId_placaNorm: { organizacionId, placaNorm } },
      update: {},
      create: {
        organizacionId,
        clienteId: clientes[v.cliente],
        placa: v.placa,
        placaNorm,
        marca: v.marca.toUpperCase(),
        modelo: v.modelo.toUpperCase(),
        anio: v.anio,
        nroMotor: v.motor || null,
        nroSerie: v.serie || null,
        nroVin: v.vin || null,
        grupo: v.grupo || null,
      },
    });
    if (v.km && !(await prisma.lecturaKm.findFirst({ where: { vehiculoId: fila.id, fuente: 'precarga' } }))) {
      await prisma.lecturaKm.create({ data: { vehiculoId: fila.id, km: v.km, fecha: new Date(), fuente: 'precarga' } });
    }
  }

  for (const m of datos.marcas) {
    await prisma.marcaVehiculo.upsert({
      where: { organizacionId_nombre: { organizacionId, nombre: m.nombre } },
      update: { modelos: m.modelos },
      create: { organizacionId, nombre: m.nombre, modelos: m.modelos },
    });
  }
  return { clientes: datos.clientes.length, vehiculos: datos.vehiculos.length, marcas: datos.marcas.length };
}
