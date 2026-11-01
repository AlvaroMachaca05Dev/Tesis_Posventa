# Subir a GitHub

Este repositorio se trabaja directamente en `F:\Tesis\Tesis_Posventa` y se sube con `git push` a `https://github.com/AlvaroMachaca05Dev/Tesis_Posventa.git`. Ya no se genera una copia desde Drive.

## Qué no se sube
- El `.env` y cualquier clave, contraseña o token.
- Datos reales del taller (van fuera de las carpetas sincronizadas).
- La tesis en LaTeX y el registro de cambios: viven en Google Drive.

## Antes de subir
1. Ejecuta la skill `sanear-datos-reales` (`herramientas/buscar_datos_reales.ps1`).
2. Corre `pnpm test` y revisa `git status` (sin `desktop.ini` ni archivos de `.local/`).
