#!/bin/bash
# D&D Map Projector - Linux Launcher

cd "$(dirname "$0")"

echo "========================================================"
echo "       D&D MAP PROJECTOR - LOCAL LAUNCHER (LINUX)       "
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
    echo "[INFO] Node.js is installed. Starting server..."
    (sleep 1 && open_browser "http://localhost:3000") &
    
    if [ -f ".next/standalone/server.js" ]; then
        node .next/standalone/server.js
    elif [ -f "scripts/local-server.js" ]; then
        node scripts/local-server.js
    elif [ -f "server.js" ]; then
        node server.js
    elif [ -f "standalone.html" ]; then
        open_browser "standalone.html"
    fi
else
    echo "[INFO] Node.js not detected. Opening zero-dependency standalone HTML in browser..."
    if [ -f "standalone.html" ]; then
        open_browser "standalone.html"
    elif [ -f "public/standalone.html" ]; then
        open_browser "public/standalone.html"
    else
        echo "[ERROR] standalone.html not found!"
    fi
fi
