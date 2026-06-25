@echo off
title API-Whatapp - Testar Localmente
cd /d "%~dp0"

echo ==========================================
echo  Copiando arquivos para Nobre Messenger
echo ==========================================
echo.

set NOBRE_DIR=C:\Users\Lenovo\Desktop\Finalizado v1.0.0

if not exist "%NOBRE_DIR%" (
    echo ERRO: Pasta Nobre Messenger nao encontrada
    pause
    exit /b 1
)

echo 1. Copiando wapi/...
copy /Y wapi\server.js "%NOBRE_DIR%\wapi\server.js"
copy /Y wapi\package.json "%NOBRE_DIR%\wapi\package.json"

echo 2. Copiando wapi_wwebjs/...
copy /Y wapi_wwebjs\server.js "%NOBRE_DIR%\wapi_wwebjs\server.js"
copy /Y wapi_wwebjs\package.json "%NOBRE_DIR%\wapi_wwebjs\package.json"

echo 3. Instalando dependencias...
cd /d "%NOBRE_DIR%\wapi"
call npm install --no-package-lock --no-audit --no-fund
if %errorlevel% neq 0 echo AVISO: npm install wapi pode ter falhado

cd /d "%NOBRE_DIR%\wapi_wwebjs"
set PUPPETEER_SKIP_DOWNLOAD=true
call npm install --no-package-lock --no-audit --no-fund
if %errorlevel% neq 0 echo AVISO: npm install wwebjs pode ter falhado

echo.
echo ==========================================
echo  Pronto! Arquivos copiados e dependencias
echo  instaladas. Execute o Nobre Messenger
echo  para testar.
echo ==========================================
echo.
echo  Para publicar as alteracoes:
echo    git add -A
echo    git commit -m "Descricao da alteracao"
echo    git push
echo.
pause
