@echo off
chcp 65001 >nul
title Meu dinheiro
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
    python servidor.py
    goto fim
)

where py >nul 2>nul
if %errorlevel%==0 (
    py servidor.py
    goto fim
)

echo.
echo   O Python nao foi encontrado neste computador.
echo   Instale em https://python.org/downloads e marque
echo   a caixa "Add Python to PATH" durante a instalacao.
echo.
pause

:fim
