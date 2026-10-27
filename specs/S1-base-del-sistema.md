# S1 · Base del sistema (especificación SDD del Sprint 1)

Estado: borrador para aprobar por el investigador. RF cubiertos: RF-001, RF-002, RF-003, RF-004, RF-005, RF-006, RF-007, RF-060.
Diagramas: DAS-R81-0001, DCL-R81-0001, DMD-R81-0001, DCU-R81-0001, DSE-R81-0001 (solo identidad).

## Criterios de aceptación

| ID | RF | Dado / Cuando / Entonces |
|---|---|---|
| CA-S1-01 | RF-001 | **Dado** un usuario sin sesión, **cuando** pide una ruta protegida, **entonces** recibe 401. |
| CA-S1-02 | RF-001 | **Dado** un usuario activo con credenciales válidas, **cuando** inicia sesión, **entonces** recibe una sesión con su rol y su local. |
| CA-S1-03 | RF-002 | **Dado** un usuario de rol Técnico, **cuando** pide una ruta de costos o bancos, **entonces** recibe 403 aunque la pantalla la oculte. |
| CA-S1-04 | RF-002 | **Dado** un usuario de un local, **cuando** lista registros, **entonces** ve solo los de su local, salvo Administrador y Finanzas. |
| CA-S1-05 | RF-003 | **Dado** el Administrador, **cuando** crea, desactiva o cambia el rol de un usuario, **entonces** el cambio queda auditado. |
| CA-S1-06 | RF-004 | **Dado** datos válidos, **cuando** se crea un cliente, **entonces** se guarda con su documento único y aparece en la búsqueda. |
| CA-S1-07 | RF-005 | **Dado** un cliente, **cuando** se registra un vehículo, **entonces** queda vinculado al cliente y la placa no se repite. |
| CA-S1-08 | RF-006 | **Dado** un texto, **cuando** se busca por placa, documento, VIN o nombre, **entonces** aparecen las coincidencias. |
| CA-S1-09 | RF-007 | **Dado** un vehículo, **cuando** se registra una lectura de km, **entonces** se guardan km, fecha y fuente y la última lectura es la más reciente. |
| CA-S1-10 | RF-060 | **Dado** un cambio en un maestro, **cuando** se guarda, **entonces** hay un registro de auditoría con actor, fecha, antes, después y motivo. |
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
