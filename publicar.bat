@echo off
title API-Whatapp - Publicar Atualizacao
cd /d "%~dp0"

echo ==========================================
echo  Publicar alteracoes no GitHub
echo  Repositorio: Handersonrs/API-Whatapp
echo ==========================================
echo.

set /p MSG="Descricao da alteracao: "

if "%MSG%"=="" (
    echo ERRO: Digite uma descricao
    pause
    exit /b 1
)

git add -A
git commit -m "%MSG%"
git push

if %errorlevel% equ 0 (
    echo.
    echo ==========================================
    echo  Publicado com sucesso!
    echo  Usuarios ja podem clicar em "npm update"
    echo  para receber a atualizacao.
    echo ==========================================
) else (
    echo.
    echo ERRO: Falha ao publicar
)

pause
