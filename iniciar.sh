#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1

if command -v python3 >/dev/null 2>&1; then
    exec python3 servidor.py
elif command -v python >/dev/null 2>&1; then
    exec python servidor.py
else
    echo "Python não encontrado. Instale em https://python.org/downloads"
    read -r -p "Aperte Enter para fechar."
fi
