#!/usr/bin/env bash
# Reconstruye R_Motriz_R7.7.html desde la base R7.1 aplicando las capas R7.2 a R7.8.
set -e; cd "$(dirname "$0")"; mkdir -p build
cp capas/base_R7.1.html build/r71.html
python3 capas/aplicar_r72.py build/r71.html build/r72.html
python3 capas/aplicar_r73.py build/r72.html build/r73.html
python3 capas/aplicar_r74.py build/r73.html build/r74.html
python3 capas/aplicar_r75.py build/r74.html build/r75.html
python3 capas/aplicar_r76.py build/r75.html build/r76.html
python3 capas/aplicar_r77.py build/r76.html build/r77.html
echo "Listo: build/r77.html"
