@echo off
setlocal

cd /d "%~dp0"
set "WEBDASH_PORT="
for /f %%I in ('powershell -NoProfile -Command "$p = 8765..8775 | Where-Object { -not (Get-NetTCPConnection -State Listen -LocalPort $_ -ErrorAction SilentlyContinue) } | Select-Object -First 1; if ($null -ne $p) { $p }"') do set "WEBDASH_PORT=%%I"
if not defined WEBDASH_PORT (
    echo.
    echo HIBA: A 8765-8775 portok mind foglaltak.
    echo Zard be a korabbi Web Dashers szerverablakokat, majd probald ujra.
    echo.
    pause
    exit /b 1
)
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMddHHmmss"') do set "WEBDASH_BUILD=%%I"
if not defined WEBDASH_BUILD set "WEBDASH_BUILD=20260918-visual-fixes"
set "WEBDASH_URL=http://127.0.0.1:%WEBDASH_PORT%/?build=%WEBDASH_BUILD%"

echo Web Dashers inditasa...

where py >nul 2>nul
if not errorlevel 1 (
    start "Web Dashers server" /D "%~dp0" cmd /k py -3 tools\webdash-server.py %WEBDASH_PORT%
    goto :open_game
)

where python >nul 2>nul
if not errorlevel 1 (
    start "Web Dashers server" /D "%~dp0" cmd /k python tools\webdash-server.py %WEBDASH_PORT%
    goto :open_game
)

where npx >nul 2>nul
if not errorlevel 1 (
    start "Web Dashers server" /D "%~dp0" cmd /k npx --yes serve . -l %WEBDASH_PORT%
    goto :open_game
)

echo.
echo HIBA: Python vagy Node.js nem talalhato a gepen.
echo Telepitsd a Python 3-at, majd inditsd el ujra ezt a fajlt.
echo.
pause
exit /b 1

:open_game
timeout /t 2 /nobreak >nul
start "" "%WEBDASH_URL%"
echo A jatek megnyilt: %WEBDASH_URL%
echo A szerver leallitasahoz zard be a "Web Dashers server" ablakot.
timeout /t 3 /nobreak >nul

endlocal
