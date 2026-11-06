// Precarga del slice S2: lo que trae el prototipo R7.7 ya está en la base (docs/plan/PRECARGA_DE_DATOS.md).
// Se comprueba después de `pnpm db:seed`; correr la semilla otra vez no debe duplicar nada.
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();
let app: INestApplication;
let token: string;
let organizacionId: string;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  token = (await request(app.getHttpServer()).post('/auth/login').send({ correo: 'cajera@demo.local', password: process.env.SEED_PASSWORD })).body.token;
  organizacionId = (await prisma.organizacion.findFirstOrThrow({ where: { nombre: 'Taller Demo' } })).id;
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
const pedir = (ruta: string) => request(app.getHttpServer()).get(ruta).set('Authorization', `Bearer ${token}`);

describe('precarga de maestros del prototipo (S2)', () => {
  it('hay exactamente 6 marcas de vehículo, con sus modelos', async () => {
    expect(await prisma.marcaVehiculo.count({ where: { organizacionId } })).toBe(6);
    const r = await pedir('/marcas-vehiculo');
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(6);
    const kia = r.body.find((m: { nombre: string }) => m.nombre === 'KIA');
    expect(kia.modelos).toEqual(['PICANTO', 'RIO', 'SOLUTO', 'SPORTAGE']);
  });
  it('«Clientes varios» (documento 0000) existe una sola vez y es genérico', async () => {
    const c = await prisma.cliente.findMany({ where: { organizacionId, documento: '0000' } });
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ nombre: 'Clientes varios', esGenerico: true, activo: true });
  });
  it('el vehículo DEM-679 está una sola vez, con su titular y su kilometraje, y se encuentra por placa', async () => {
    const v = await prisma.vehiculo.findMany({ where: { organizacionId, placaNorm: 'DEM679' }, include: { cliente: true, lecturas: true, grupo: true } });
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ placa: 'DEM-679', marca: 'KIA', modelo: 'PICANTO', anio: 2017, nroMotor: 'G3LA', codigoMotor: 'G3LA', grupoFuente: 'FAMILIA_MOTOR' });
    // S5: el grupo sale de la familia de su motor (G3LA → FM0001 → N2)
    expect(v[0].grupo?.codigo).toBe('G1');
    expect(v[0].cliente.documento).toBe('0000');
    expect(v[0].lecturas.filter((l) => l.fuente === 'precarga').map((l) => l.km)).toEqual([290200]);
    const r = await pedir('/vehiculos?q=dem679');
    // El kilometraje actual puede subir con las ODS o lecturas que se registren después de la precarga.
    expect(r.body[0]).toMatchObject({ placa: 'DEM-679', cliente: { nombre: 'Clientes varios', documento: '0000' } });
    expect(r.body[0].kmActual).toBeGreaterThanOrEqual(290200);
  });
});
