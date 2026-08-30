#!/bin/bash
# D&D Map Projector - Linux Launcher

cd "$(dirname "$0")"

echo "========================================================"
echo "       D&D MAP PROJECTOR & FOG OF WAR - LAUNCHER (LINUX) "
echo "========================================================"
echo ""

open_browser() {
    local url="$1"
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 &
    elif command -v gnome-open >/dev/null 2>&1; then
        gnome-open "$url" >/dev/null 2>&1 &
    elif command -v x-www-browser >/dev/null 2>&1; then
        x-www-browser "$url" >/dev/null 2>&1 &
    fi
}

if command -v node >/dev/null 2>&1; then
    echo "[INFO] Node.js is installed. Starting server on http://localhost:3000..."
    (sleep 1 && open_browser "http://localhost:3000") &
    
    if [ -f "server.js" ]; then
        node server.js
    elif [ -f ".next/standalone/server.js" ]; then
        node .next/standalone/server.js
    elif [ -f "scripts/local-server.js" ]; then
        node scripts/local-server.js
    else
        echo "[ERROR] server.js not found! Please run npm run build first."
    fi
else
    echo "[ERROR] Node.js is required to run D&D Map Projector."
    echo "Please install Node.js from https://nodejs.org and try again."
fi
