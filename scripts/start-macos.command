#!/bin/bash
# D&D Map Projector - macOS Launcher
# Double-clickable .command script for macOS (including macOS 10.13 High Sierra and later)

cd "$(dirname "$0")"

echo "========================================================"
echo "       D&D MAP PROJECTOR - LOCAL LAUNCHER (macOS)       "
echo "========================================================"
echo ""

# Check for Node.js
if command -v node >/dev/null 2>&1; then
    echo "[INFO] Node.js is installed. Starting high-performance server on port 3000..."
    
    # Open default browser after 1 second
    (sleep 1 && open "http://localhost:3000") &
    
    if [ -f ".next/standalone/server.js" ]; then
        node .next/standalone/server.js
    elif [ -f "scripts/local-server.js" ]; then
        node scripts/local-server.js
    elif [ -f "server.js" ]; then
        node server.js
    elif [ -f "standalone.html" ]; then
        open "standalone.html"
    fi
else
    echo "[INFO] Node.js not detected. Opening zero-dependency standalone HTML version directly in Safari/Chrome..."
    if [ -f "standalone.html" ]; then
        open "standalone.html"
    elif [ -f "public/standalone.html" ]; then
        open "public/standalone.html"
    else
        echo "[ERROR] standalone.html not found!"
    fi
fi
