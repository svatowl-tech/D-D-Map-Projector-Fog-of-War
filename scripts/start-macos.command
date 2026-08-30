#!/bin/bash
# D&D Map Projector - macOS Launcher

cd "$(dirname "$0")"

echo "========================================================"
echo "       D&D MAP PROJECTOR & FOG OF WAR - LAUNCHER (macOS) "
echo "========================================================"
echo ""

if command -v node >/dev/null 2>&1; then
    echo "[INFO] Node.js is installed. Starting server on http://localhost:3000..."
    
    (sleep 1 && open "http://localhost:3000") &
    
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
