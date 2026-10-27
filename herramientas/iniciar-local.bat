@echo off
REM Inicia el sistema en esta computadora (Windows). Usa Node y pnpm del PATH; si no están, prueba las rutas de F:.
cd /d "%~dp0.."
where node >nul 2>nul || set "PATH=F:\Tesis\reverse-lab\node;%PATH%"
where pnpm >nul 2>nul || set "PATH=F:\Tesis\dev-tools\node_modules\.bin;%PATH%"
set npm_config_store_dir=F:\Tesis\dev-tools\pnpm-store
node herramientas\dev.mjs
pause
