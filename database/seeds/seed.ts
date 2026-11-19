// Semillas de desarrollo. Todo es sintético: ningún dato real.
// Los permisos salen de la matriz del prototipo, ajustada a siete roles (database/seeds/permisos_matriz.json).
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { precargaMaestros } from './precarga-maestros';
import { precargaS5 } from './precarga-s5';
import { precargaS6 } from './precarga-s6';

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

// Términos y condiciones del taller que se imprimen en la hoja de recepción (uno por línea).
const TERMINOS_RECEPCION = [
  '1. Por la presente, EL CLIENTE autoriza a LA EMPRESA a realizar las reparaciones descritas y a emplear todo el material y/o repuestos que sean necesarios usar en ellas, pudiendo utilizar los servicios de terceros autorizados por LA EMPRESA, incluso en las instalaciones de estos, siempre bajo la garantía y respaldo de esta. También autoriza a LA EMPRESA y a sus empleados para que operen, y/o trasladen, y/o prueben este vehículo por calles, carreteras y otros lugares a fin de realizar las pruebas, trabajos e inspecciones pertinentes.',
  '2. EL CLIENTE tiene conocimiento que LA EMPRESA se responsabiliza únicamente por el vehículo y los accesorios integrantes del mismo (autopartes), así como por los bienes dejados en el interior del vehículo, siempre que los mismos se encuentren declarados e inventariados al momento de ingresar a unidad al taller.',
  '3. En caso hayan transcurrido tres (03) días útiles desde que LA EMPRESA le comunicó a EL CLIENTE que el vehículo se encuentra listo para su recojo, y este no lo recogiera y/o no pagase la totalidad del servicio brindado, y/o en caso EL CLIENTE no hubiera comunicado expresa y oportunamente su revocatoria a trabajos ya aprobados, EL CLIENTE, a partir del término de los tres (03) días útiles mencionados, autoriza a LA EMPRESA a (i) cobrarle S/. 20.00 (veinte y 00/100 soles) más IGV diarios por concepto de almacenaje; (ii) retirar los repuestos y/o accesorios colocados en el vehículo, en caso estos no hayan sido debidamente cancelados en su totalidad; (iii) retener el vehículo a fin de dar inicio a las acciones legales pertinentes, las cuales serían a cuenta y costo de EL CLIENTE, con el objeto de hacerse cobro del monto adeudado más los gastos y costos que genere dicho procedimiento; (iv) trasladar el vehículo por sus propios medios (rodando) a alguno de los almacenes de LA EMPRESA hasta que EL CLIENTE cancele la totalidad del servicio y/o recoja el vehículo. Las facultades otorgadas por EL CLIENTE a LA EMPRESA no son excluyentes entre sí, por lo que LA EMPRESA podrá ejecutarlas de manera conjunta. EL CLIENTE declara su consentimiento expreso respecto de los términos de la presente es libre y voluntario, sin que medio dolo, error ni vicio alguno que la pudiera invalidar total o parcialmente y acepta dichas condiciones según lo prescrito por el artículo 1373 del Código Civil.',
  '4. Si durante las pruebas de carretera el vehículo es intervenido por la autoridad policial por cualquier motivo, LA EMPRESA no se hace responsable por el internamiento del mismo en el depósito o comisaría, si este tiene deuda pendiente con el SAT, orden de captura por papeletas, entre otros motivos, siendo de exclusiva responsabilidad de EL CLIENTE realizar las gestiones y gastos necesarios a fin de recuperar su vehículo.',
  '5. En caso se le haya otorgado una línea de crédito a EL CLIENTE y la misma se encuentra pendiente de pago, EL CLIENTE no podrá cancelar al contado los nuevos servicios que solicitase al Taller sin antes cancelar íntegramente la deuda pendiente.',
  '6. Los datos personales que nos facilite serán incorporados a la base de datos «Clientes y Contactos» de LA EMPRESA, debidamente registrada de acuerdo a la Ley N° 29733, Ley de Protección de Datos Personales, con la finalidad de realizar el servicio técnico contratado para su vehículo y la encuesta de satisfacción de servicio. Para dicho efecto los datos se almacenarán, recopilarán, registrarán, organizarán, conservarán, usarán y transferirán a nivel nacional e internacional, todo lo cual es necesario para la finalidad descrita en este párrafo.',
  'Usted tiene los derechos de información, acceso, rectificación, cancelación, oposición y tratamiento objetivo de Datos Personales. Para hacer uso de estos derechos, deberá comunicarse al correo electrónico de la empresa que figura en este documento.',
].join('\n');

async function main() {
  const ORG_ID = '00000000-0000-0000-0000-000000000001';
  const org = await prisma.organizacion.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, nombre: 'Taller Demo' },
  });
  // Cabecera y pie de los PDF de la orden: solo se completan si están vacíos (cuentas y responsable de datos son de ejemplo).
  await prisma.organizacion.updateMany({
    where: { id: ORG_ID, direccion: null },
    data: {
      ruc: '20600179200',
      direccion: 'Av. Prohogar 506 - Miraflores',
      telefono: '959684848',
      correo: 'administracion@rmotriz.com',
      lema: 'BIENVENIDO A RMOTRIZ',
      cuentasBancarias: 'BANCO DEMO CUENTA CORRIENTE SOLES: 0000000000000 CCI.: 00000000000000000000',
      terminosRecepcion: TERMINOS_RECEPCION,
    },
  });

  const locales = [] as { id: string; nombre: string }[];
  for (const nombre of ['Local Prohogar', 'Local Unión']) {
    const existente = await prisma.local.findFirst({ where: { nombre, organizacionId: org.id } });
    locales.push(existente ?? (await prisma.local.create({ data: { nombre, organizacionId: org.id } })));
  }
  // Parámetros de impresión y series de comprobantes por local: solo se completan si están vacíos.
  await prisma.organizacion.updateMany({ where: { id: ORG_ID, pieTicket: null }, data: { pieTicket: '¡GRACIAS POR SU COMPRA. NO SE ACEPTAN DEVOLUCIONES DESPUES DE LAS 24 HORAS !!' } });
  for (const [i, l] of locales.entries()) {
    const n = String(i + 1).padStart(2, '0');
    await prisma.local.updateMany({ where: { id: l.id, serieNotaVenta: null }, data: { serieNotaVenta: `NV${n}`, serieBoleta: `B0${n}`, serieFactura: `F0${n}` } });
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
        // El superadministrador (TI) ve ambos locales y no pertenece a ninguno: sin local no puede facturar.
        localId: u.plataforma || u.roles.includes('Superadministrador') ? null : locales[0].id,
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

  const maestros = await precargaMaestros(prisma, org.id);
  console.log(`Precarga de maestros: ${maestros.clientes} cliente, ${maestros.vehiculos} vehículo y ${maestros.marcas} marcas del prototipo.`);
  const s5 = await precargaS5(prisma, org.id);
  console.log(`Precarga S5: ${s5.grupos} grupos, ${s5.familias} familias de motor, ${s5.servicios} servicios, ${s5.reglas} reglas de precio, ${s5.solapamientos} solapamientos, ${s5.productos} productos y ${s5.proveedores} proveedores.`);
  const s6 = await precargaS6(prisma, org.id);
  console.log(`Precarga S6: ${s6.servicios} servicios, ${s6.solapamientos} solapamientos, ${s6.planes} planes preventivos (${s6.conPasos} servicios con acciones a realizar).`);

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
