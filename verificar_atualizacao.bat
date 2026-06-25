@echo off
title API-Whatapp - Verificar Atualizacao
cd /d "%~dp0"

echo ==========================================
echo  Verificar versoes das bibliotecas
echo ==========================================
echo.

echo Lendo versoes atuais...
for /f "tokens=2 delims=:" %%a in ('findstr "baileys" wapi\package.json') do set BAILEYS=%%a
set BAILEYS=%BAILEYS:"=%
set BAILEYS=%BAILEYS: =%
set BAILEYS=%BAILEYS:,=%

for /f "tokens=2 delims=:" %%a in ('findstr "whatsapp-web" wapi_wwebjs\package.json') do set WWEBJS=%%a
set WWEBJS=%WWEBJS:"=%
set WWEBJS=%WWEBJS: =%
set WWEBJS=%WWEBJS:,=%

echo.
echo  Versoes no repositorio:
echo    Baileys: %BAILEYS%
echo    wwebjs:  %WWEBJS%
echo.

echo  Verifique no npm:
echo    https://www.npmjs.com/package/@whiskeysockets/baileys
echo    https://www.npmjs.com/package/whatsapp-web.js
echo.
echo  Release notes:
echo    https://github.com/WhiskeySockets/Baileys/releases
echo    https://github.com/pedroslopez/whatsapp-web.js/releases
echo.

set /p DUVIDA="Tem duvida se precisa atualizar? (s/N): "
if /i "%DUVIDA%"=="s" (
    echo.
    echo  Abrindo paginas no navegador...
    start https://github.com/WhiskeySockets/Baileys/releases
    start https://github.com/pedroslopez/whatsapp-web.js/releases
    start https://www.npmjs.com/package/@whiskeysockets/baileys
    start https://www.npmjs.com/package/whatsapp-web.js
    echo.
    echo  Veja as release notes e volte ao terminal opencode
    echo  com as informacoes para solicitar as alteracoes.
)

echo.
pause
