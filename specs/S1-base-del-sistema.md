# S1 · Base del sistema (especificación SDD del Sprint 1)

Estado: borrador para aprobar por el investigador. RF cubiertos: RF-001, RF-002, RF-003, RF-004, RF-005, RF-006, RF-007, RF-060.
Diagramas: DAS-R81-0001, DCL-R81-0001, DMD-R81-0001, DCU-R81-0001, DSE-R81-0001 (solo identidad).

## Criterios de aceptación

| ID | RF | Dado / Cuando / Entonces |
|---|---|---|
| CA-S1-01 | RF-001 | **Dado** un usuario sin sesión, **cuando** pide una ruta protegida, **entonces** recibe 401. |
| CA-S1-02 | RF-001 | **Dado** un usuario activo con credenciales válidas, **cuando** inicia sesión, **entonces** recibe su sesión con sus roles y su empresa. |
| CA-S1-03 | RF-002 | **Dado** un Técnico, **cuando** pide una ruta de bancos o costos, **entonces** recibe 403 aunque la pantalla la oculte. |
| CA-S1-04 | RF-002 | **Dado** un usuario con dos roles (por ejemplo Cajera y Logístico), **cuando** pide un módulo que permite alguno de los dos, **entonces** accede con el nivel más alto de los dos. |
| CA-S1-05 | RF-003 | **Dado** un Superadministrador o Administrador, **cuando** crea, desactiva o cambia los roles de un usuario de su empresa, **entonces** el cambio queda auditado; un Administrador no puede crear ni cambiar a un Superadministrador. |
| CA-S1-06 | RF-004 | **Dado** datos válidos, **cuando** se crea un cliente, **entonces** se guarda con su documento único y aparece en la búsqueda. |
| CA-S1-07 | RF-005 | **Dado** un cliente, **cuando** se registra un vehículo, **entonces** queda vinculado al cliente y la placa no se repite. |
| CA-S1-08 | RF-006 | **Dado** un texto, **cuando** se busca por placa, documento, VIN o nombre, **entonces** aparecen las coincidencias. |
| CA-S1-09 | RF-007 | **Dado** un vehículo, **cuando** se registra una lectura de km, **entonces** se guardan km, fecha y fuente y la última lectura es la más reciente. |
| CA-S1-10 | RF-060 | **Dado** un cambio en un maestro, **cuando** se guarda, **entonces** hay un registro de auditoría con actor, fecha, antes, después y motivo. |
| CA-S1-12 | RF-002 | **Dado** el Desarrollador, **cuando** usa «Ver como…» con otro usuario, **entonces** ve el sistema con los permisos de esa persona y cada acción queda auditada como «Desarrollador (actuando como …)»; ningún otro rol puede hacerlo, ni forzando la petición. |
| CA-S1-13 | RF-002 | **Dado** un usuario de una empresa, **cuando** consulta datos, **entonces** solo ve los de su empresa y los de sus módulos habilitados. |
| CA-S1-14 | RF-003 | **Dado** el Superadministrador, **cuando** crea un rol propio y elige módulos y niveles, **entonces** solo puede elegir módulos habilitados para su empresa y no puede dar permisos que él no tiene. *(la pantalla es segunda ola; en el Sprint 1 solo se comprueba en la API)* |
| CA-S1-15 | RF-002 | **Dado** un Jefe de taller, **cuando** accede a cualquier módulo que permite el Técnico, **entonces** lo hace con el mismo nivel o mayor; y **cuando** pide un módulo de Cajera o de Logística, **entonces** recibe 403. |
| CA-S1-16 | RF-003 | **Dado** un usuario, **cuando** crea o asigna un rol, **entonces** solo puede hacerlo con roles de nivel inferior al suyo. |
| CA-S1-17 | RF-055 | **Dado** la agenda, **cuando** se listan personas asignables a servicios, **entonces** aparecen solo técnicos y jefes de taller; el Administrador nunca. *(se comprueba al construir la agenda; en el Sprint 1 solo queda el dato `asignableAServicios`)* |
| CA-S1-18 | RF-003 | **Dado** un Superadministrador o cualquier usuario de una empresa, **cuando** lista roles o usuarios o intenta asignar un rol, **entonces** el rol Desarrollador y los usuarios que lo tienen no aparecen ni se pueden asignar, ni forzando la petición: es exclusivo del dueño de la plataforma. |
| CA-S1-11 | Plataforma | **Dado** un equipo limpio, **cuando** se ejecuta el arranque documentado, **entonces** la base, la API y la web levantan y la CI compila. |

## Casos negativos obligatorios
- Cliente con documento repetido → rechazo con mensaje claro.
- Vehículo con placa repetida → rechazo.
- Lectura de km menor que la última → advertencia y confirmación (como el prototipo).
- Usuario desactivado → no inicia sesión.
- Ruta de otro local → 403.

## Fuera de alcance
ODS, carga masiva, planes, tareas, citas, comercial e inventario.

## Referencia de comportamiento
`prototipo/R_Motriz_R7.7.html` y sus pruebas (`prototipo/pruebas/`).
