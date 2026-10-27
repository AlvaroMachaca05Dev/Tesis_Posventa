// Semillas de desarrollo. Todo es sintético: ningún dato real.
// Los permisos salen de la matriz del prototipo, ajustada a siete roles (database/seeds/permisos_matriz.json).
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';

if (process.env.NODE_ENV === 'production') {
  console.error('Las semillas de demostración no se ejecutan en producción.');
  process.exit(1);
}

const prisma = new PrismaClient();
const matriz = JSON.parse(readFileSync(new URL('./permisos_matriz.json', import.meta.url), 'utf8')) as {
  roles: string[];
  rows: { id: string; lv: string }[];
};

const PLATAFORMA = 'Desarrollador';
// Nivel jerárquico y si la persona puede recibir servicios en la agenda.
const NIVELES: Record<string, { nivel: number; agenda: boolean }> = {
  Desarrollador: { nivel: 5, agenda: false },
  Superadministrador: { nivel: 4, agenda: false },
  Administrador: { nivel: 3, agenda: false },
  'Jefe de taller': { nivel: 2, agenda: true },
  Cajera: { nivel: 1, agenda: false },
  Técnico: { nivel: 1, agenda: true },
  Logístico: { nivel: 1, agenda: false },
};
// Contraseña de las cuentas de demostración: solo desarrollo. Se define en .env (SEED_PASSWORD), no en el código.
const CLAVE_DEMO = process.env.SEED_PASSWORD;
if (!CLAVE_DEMO) {
  console.error('Define SEED_PASSWORD en tu archivo .env (ver .env.example).');
  process.exit(1);
}

type Demo = { nombre: string; correo: string; roles: string[]; plataforma?: boolean };
const USUARIOS_DEMO: Demo[] = [
  { nombre: 'Desarrollador Demo', correo: 'superusuario@rmotriz.com', roles: [PLATAFORMA], plataforma: true },
  { nombre: 'Superadministrador Demo (TI)', correo: 'ti@demo.local', roles: ['Superadministrador'] },
  { nombre: 'Administrador Demo', correo: 'admin@demo.local', roles: ['Administrador'] },
  { nombre: 'Jefe de Taller Demo', correo: 'jefe@demo.local', roles: ['Jefe de taller'] },
  { nombre: 'Cajera Demo', correo: 'cajera@demo.local', roles: ['Cajera'] },
  { nombre: 'Técnico Demo 1', correo: 'tecnico@demo.local', roles: ['Técnico'] },
  { nombre: 'Logístico Demo', correo: 'logistico@demo.local', roles: ['Logístico'] },
  // Ejemplo de reemplazo: una persona con dos roles
  { nombre: 'Reemplazo Demo (Cajera y Logístico)', correo: 'reemplazo@demo.local', roles: ['Cajera', 'Logístico'] },
];

async function main() {
  const ORG_ID = '00000000-0000-0000-0000-000000000001';
  const org = await prisma.organizacion.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, nombre: 'Taller Demo' },
  });

  const locales = [] as { id: string; nombre: string }[];
  for (const nombre of ['Local Prohogar', 'Local Unión']) {
    const existente = await prisma.local.findFirst({ where: { nombre, organizacionId: org.id } });
    locales.push(existente ?? (await prisma.local.create({ data: { nombre, organizacionId: org.id } })));
  }

  // Módulos habilitados para la empresa: todos los de la matriz.
  for (const fila of matriz.rows) {
    await prisma.moduloHabilitado.upsert({
      where: { organizacionId_modulo: { organizacionId: org.id, modulo: fila.id } },
      update: {},
      create: { organizacionId: org.id, modulo: fila.id },
    });
  }

  // Roles: el de plataforma no tiene empresa; los demás son roles base de la empresa.
  // Nota: la unicidad (organizacionId, nombre) no distingue vacíos en PostgreSQL; por eso se busca antes de crear.
  // Si quedó un rol con un nombre anterior («Propietario de la plataforma»), se renombra.
  const anterior = await prisma.rol.findFirst({ where: { nombre: 'Propietario de la plataforma', organizacionId: null } });
  if (anterior) await prisma.rol.update({ where: { id: anterior.id }, data: { nombre: PLATAFORMA } });
  const roles: Record<string, string> = {};
  for (const nombre of matriz.roles) {
    const esPlataforma = nombre === PLATAFORMA;
    const organizacionId = esPlataforma ? null : org.id;
    const { nivel, agenda } = NIVELES[nombre];
    const datos = { ambito: esPlataforma ? 'plataforma' : 'empresa', esBase: true, nivel, asignableAServicios: agenda };
    const existente = await prisma.rol.findFirst({ where: { nombre, organizacionId } });
    const rol = existente
      ? await prisma.rol.update({ where: { id: existente.id }, data: datos })
      : await prisma.rol.create({ data: { nombre, organizacionId, ...datos } });
    roles[nombre] = rol.id;
    // Los permisos de los roles base se recalculan desde la matriz.
    await prisma.rolPermiso.deleteMany({ where: { rolId: rol.id } });
  }

  // Permisos: uno por módulo y nivel (A, E o V). El nivel «-» significa sin acceso y no se guarda.
  const permisos: Record<string, string> = {};
  const permiso = async (modulo: string, accion: string) => {
    const clave = `${modulo}:${accion}`;
    if (!permisos[clave]) {
      const p = await prisma.permiso.upsert({
        where: { modulo_accion: { modulo, accion } },
        update: {},
        create: { modulo, accion },
      });
      permisos[clave] = p.id;
    }
    return permisos[clave];
  };
  let enlaces = 0;
  for (const fila of matriz.rows) {
    for (let i = 0; i < matriz.roles.length; i++) {
      const nivel = fila.lv[i];
      if (!nivel || nivel === '-') continue;
      const permisoId = await permiso(fila.id, nivel);
      await prisma.rolPermiso.upsert({
        where: { rolId_permisoId: { rolId: roles[matriz.roles[i]], permisoId } },
        update: {},
        create: { rolId: roles[matriz.roles[i]], permisoId },
      });
      enlaces++;
    }
  }

  // Usuarios de demostración
  const hash = await bcrypt.hash(CLAVE_DEMO!, 10);
  for (const u of USUARIOS_DEMO) {
    const usuario = await prisma.usuario.upsert({
      where: { correo: u.correo },
      update: { nombre: u.nombre },
      create: {
        nombre: u.nombre,
        correo: u.correo,
        passwordHash: hash,
        activo: true,
        organizacionId: u.plataforma ? null : org.id,
        localId: u.plataforma ? null : locales[0].id,
      },
    });
    for (const r of u.roles) {
      await prisma.usuarioRol.upsert({
        where: { usuarioId_rolId: { usuarioId: usuario.id, rolId: roles[r] } },
        update: {},
        create: { usuarioId: usuario.id, rolId: roles[r] },
      });
    }
  }

  console.log(
    `Semillas listas: ${matriz.roles.length} roles, ${Object.keys(permisos).length} permisos, ${enlaces} asignaciones, ${locales.length} locales, ${USUARIOS_DEMO.length} usuarios de demostración.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
