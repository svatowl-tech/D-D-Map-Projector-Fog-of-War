#!/usr/bin/env node
/**
 * Automated Release Packaging Script for D&D Map Projector & Fog of War
 * Packages the Next.js standalone application into GitHub Release artifacts.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'release-artifacts');

console.log('📦 Starting release packaging...');

// 1. Ensure output directory exists
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Helper to create zip archives
function createZip(sourceDir, zipName) {
  const zipPath = path.join(DIST_DIR, zipName);
  try {
    execSync(`cd "${sourceDir}" && zip -r -q "${zipPath}" .`, { stdio: 'inherit' });
    console.log(`✅ Created package: ${zipName}`);
  } catch (err) {
    console.warn(`⚠️ System zip failed, attempting Python zip fallback: ${err.message}`);
    try {
      execSync(`python3 -c "import shutil; shutil.make_archive('${zipPath.replace('.zip', '')}', 'zip', '${sourceDir}')"`, { stdio: 'inherit' });
      console.log(`✅ Created package via Python: ${zipName}`);
    } catch (pyErr) {
      console.error(`❌ Failed to zip ${zipName}:`, pyErr);
    }
  }
}

// 3. Prepare Next.js standalone server directory
const standaloneSourceDir = path.join(ROOT_DIR, '.next', 'standalone');
if (!fs.existsSync(standaloneSourceDir)) {
  console.log('⚡ .next/standalone not found. Running production build...');
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
}

const buildTempDir = path.join(ROOT_DIR, '.release_build_temp');
if (fs.existsSync(buildTempDir)) fs.rmSync(buildTempDir, { recursive: true, force: true });
fs.mkdirSync(buildTempDir, { recursive: true });

// Copy standalone server code
execSync(`cp -R "${standaloneSourceDir}/." "${buildTempDir}/"`);

// Copy static assets into .next/static
const staticSrc = path.join(ROOT_DIR, '.next', 'static');
const staticDst = path.join(buildTempDir, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  fs.mkdirSync(path.join(buildTempDir, '.next'), { recursive: true });
  execSync(`cp -R "${staticSrc}" "${staticDst}"`);
}

// Copy public directory
const publicSrc = path.join(ROOT_DIR, 'public');
const publicDst = path.join(buildTempDir, 'public');
if (fs.existsSync(publicSrc)) {
  execSync(`cp -R "${publicSrc}" "${publicDst}"`);
}

// Copy OS Launchers to root of standalone bundle
const scriptFiles = ['start-windows.bat', 'start-macos.command', 'start-linux.sh', 'local-server.js'];
scriptFiles.forEach((file) => {
  const src = path.join(ROOT_DIR, 'scripts', file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(buildTempDir, file));
  }
});

// Create README.txt for the release bundle
const readmeContent = `# D&D Map Projector & Fog of War - Production Release

## How to Run:
- **Windows**: Double-click \`start-windows.bat\`
- **macOS**: Double-click \`start-macos.command\`
- **Linux**: Execute \`bash start-linux.sh\`

The launcher starts the application server and opens http://localhost:3000 in your browser.
Requires Node.js (https://nodejs.org).
`;
fs.writeFileSync(path.join(buildTempDir, 'README.txt'), readmeContent);

// 4. Create release archives:
// - dnd-projector-offline-all-os.zip
// - dnd-projector-nextjs-server.zip
createZip(buildTempDir, 'dnd-projector-offline-all-os.zip');
createZip(buildTempDir, 'dnd-projector-nextjs-server.zip');

// 5. Generate dnd-projector-standalone.html launcher page for browser direct launch
const standaloneHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>D&D Map Projector & Fog of War Launcher</title>
  <style>
    body {
      background-color: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 32px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    h1 { font-size: 20px; margin-bottom: 12px; color: #f59e0b; }
    p { font-size: 13px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      background: #d97706;
      color: #0f172a;
      font-weight: bold;
      font-size: 14px;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn:hover { background: #f59e0b; }
    .note { margin-top: 16px; font-size: 11px; color: #64748b; }
  </style>
  <script>
    fetch('http://localhost:3000', { mode: 'no-cors' })
      .then(() => { window.location.href = 'http://localhost:3000'; })
      .catch(() => {});
  </script>
</head>
<body>
  <div class="card">
    <h1>D&D Map Projector & Fog of War</h1>
    <p>Для запуска полных функций проектора, генераторов карт Watabou и синхронизации с проектором запустите локальный сервер через скрипт <strong>start-windows.bat</strong>, <strong>start-macos.command</strong> или <strong>start-linux.sh</strong> в папке релиза.</p>
    <a href="http://localhost:3000" class="btn">Открыть http://localhost:3000</a>
    <div class="note">Если сервер уже запущен, вы перенаправитесь автоматически.</div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(DIST_DIR, 'dnd-projector-standalone.html'), standaloneHtml);

// Cleanup temp folder
fs.rmSync(buildTempDir, { recursive: true, force: true });

console.log('\n✨ Release packaging complete. Artifacts in release-artifacts/:');
fs.readdirSync(DIST_DIR).forEach((file) => {
  const stats = fs.statSync(path.join(DIST_DIR, file));
  console.log(` - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
});
