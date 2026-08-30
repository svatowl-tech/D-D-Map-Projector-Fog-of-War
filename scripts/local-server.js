#!/usr/bin/env node
/**
 * Local server entry wrapper for D&D Map Projector & Fog of War
 * Automatically delegates to Next.js standalone server (server.js)
 */
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');

if (fs.existsSync(path.join(ROOT_DIR, 'server.js'))) {
  require(path.join(ROOT_DIR, 'server.js'));
} else if (fs.existsSync(path.join(__dirname, 'server.js'))) {
  require(path.join(__dirname, 'server.js'));
} else if (fs.existsSync(path.join(ROOT_DIR, '.next', 'standalone', 'server.js'))) {
  require(path.join(ROOT_DIR, '.next', 'standalone', 'server.js'));
} else {
  console.error('[ERROR] Could not locate server.js. Make sure `npm run build` has been executed.');
  process.exit(1);
}
