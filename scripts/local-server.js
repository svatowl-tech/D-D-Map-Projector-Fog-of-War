#!/usr/bin/env node
/**
 * Zero-dependency local static server for D&D Map Projector
 * Runs on Node.js 14+ across Windows, macOS, and Linux.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=UTF-8'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let safePath = decodeURIComponent(parsedUrl.pathname);

  if (safePath === '/' || safePath === '') {
    if (fs.existsSync(path.join(ROOT_DIR, 'public', 'standalone.html'))) {
      safePath = '/public/standalone.html';
    } else if (fs.existsSync(path.join(ROOT_DIR, 'standalone.html'))) {
      safePath = '/standalone.html';
    } else if (fs.existsSync(path.join(ROOT_DIR, 'index.html'))) {
      safePath = '/index.html';
    }
  }

  let filePath = path.join(ROOT_DIR, safePath);

  // Prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Try fallback to standalone.html or index.html
      const fallback = path.join(ROOT_DIR, 'standalone.html');
      if (fs.existsSync(fallback)) {
        filePath = fallback;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\x1b[32m%s\x1b[0m', '==================================================');
  console.log('\x1b[36m%s\x1b[0m', ' [D&D MAP PROJECTOR] Local Server Active');
  console.log('\x1b[33m%s\x1b[0m', ` -> DM Screen:      http://localhost:${PORT}`);
  console.log('\x1b[33m%s\x1b[0m', ` -> Player Screen:  http://localhost:${PORT}/?mode=player`);
  console.log('\x1b[32m%s\x1b[0m', '==================================================');
  console.log('Press Ctrl+C to stop server.\n');
});
