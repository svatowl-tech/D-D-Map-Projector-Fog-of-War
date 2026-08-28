@echo off
chcp 65001 > nul
title D&D Map Projector - Local Launcher

echo ========================================================
echo        D&D MAP PROJECTOR - LOCAL SERVER (WINDOWS)
echo ========================================================
echo.

cd /d "%~dp0"

:: Check if Node.js is available
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Node.js detected. Starting local high-performance server...
    start http://localhost:3000
    if exist ".next\standalone\server.js" (
        node .next\standalone\server.js
    ) else if exist "scripts\local-server.js" (
        node scripts\local-server.js
    ) else if exist "server.js" (
        node server.js
    ) else if exist "standalone.html" (
        start "" "standalone.html"
    )
) else (
    echo [INFO] Node.js is not found in PATH.
    echo [INFO] Launching zero-dependency standalone HTML directly in default browser...
    if exist "standalone.html" (
        start "" "standalone.html"
    ) else if exist "public\standalone.html" (
        start "" "public\standalone.html"
    ) else (
        echo [ERROR] standalone.html not found!
        pause
    )
)

echo.
pause
