@echo off
chcp 65001 > nul
title D&D Map Projector ^& Fog of War

echo ========================================================
echo        D^&D MAP PROJECTOR ^& FOG OF WAR - LAUNCHER
echo ========================================================
echo.

cd /d "%~dp0"

:: Check if Node.js is available
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Node.js detected. Starting Next.js high-performance server...
    start http://localhost:3000
    if exist "server.js" (
        node server.js
    ) else if exist ".next\standalone\server.js" (
        node .next\standalone\server.js
    ) else if exist "scripts\local-server.js" (
        node scripts\local-server.js
    ) else (
        echo [ERROR] server.js not found! Please run npm run build first.
        pause
    )
) else (
    echo [ERROR] Node.js is required to run D^&D Map Projector.
    echo Please install Node.js from https://nodejs.org and try again.
    pause
)

echo.
pause
