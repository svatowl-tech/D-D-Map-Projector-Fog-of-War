#!/usr/bin/env node
/**
 * Automated Release Packaging Script for D&D Map Projector
 * Prepares artifacts for GitHub Releases (Win, Mac, Linux, Standalone HTML)
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

// Ensure output directory exists
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 1. Copy raw standalone HTML file
const standaloneSrc = path.join(ROOT_DIR, 'public', 'standalone.html');
const standaloneDst = path.join(DIST_DIR, 'dnd-projector-standalone.html');

if (fs.existsSync(standaloneSrc)) {
  fs.copyFileSync(standaloneSrc, standaloneDst);
  console.log('✅ Created standalone file: dnd-projector-standalone.html');
} else {
  console.error('❌ public/standalone.html not found!');
}

// Helper to create zip using system zip or node archiver
function createZip(sourceDir, zipName) {
  const zipPath = path.join(DIST_DIR, zipName);
  try {
    // Try zip command (available on Linux / macOS / GitHub Actions)
    execSync(`cd "${sourceDir}" && zip -r -q "${zipPath}" .`, { stdio: 'inherit' });
    console.log(`✅ Created package: ${zipName}`);
  } catch (err) {
    console.warn(`⚠️ zip command failed, falling back to tar.gz or python zip: ${err.message}`);
    try {
      execSync(`python3 -c "import shutil; shutil.make_archive('${zipPath.replace('.zip', '')}', 'zip', '${sourceDir}')"`, { stdio: 'inherit' });
      console.log(`✅ Created package via Python: ${zipName}`);
    } catch (pyErr) {
      console.error(`❌ Failed to zip ${zipName}:`, pyErr);
    }
  }
}

// 2. Package: Offline Single-File Bundle with Launchers (Zero-Dependency)
const offlineDir = path.join(ROOT_DIR, '.release_temp_offline');
if (fs.existsSync(offlineDir)) fs.rmSync(offlineDir, { recursive: true, force: true });
fs.mkdirSync(offlineDir, { recursive: true });

fs.copyFileSync(standaloneSrc, path.join(offlineDir, 'standalone.html'));
fs.copyFileSync(path.join(ROOT_DIR, 'scripts', 'start-windows.bat'), path.join(offlineDir, 'start-windows.bat'));
fs.copyFileSync(path.join(ROOT_DIR, 'scripts', 'start-macos.command'), path.join(offlineDir, 'start-macos.command'));
fs.copyFileSync(path.join(ROOT_DIR, 'scripts', 'start-linux.sh'), path.join(offlineDir, 'start-linux.sh'));
fs.copyFileSync(path.join(ROOT_DIR, 'scripts', 'local-server.js'), path.join(offlineDir, 'local-server.js'));

// Add README for the offline bundle
const offlineReadme = `# D&D Map Projector - Offline Standalone Release

## How to Run:
- **Windows**: Double-click \`start-windows.bat\` or simply double-click \`standalone.html\`
- **macOS**: Double-click \`start-macos.command\` or double-click \`standalone.html\`
- **Linux**: Run \`bash start-linux.sh\` or open \`standalone.html\` in your browser

No internet connection and no Node.js installation is required for standalone.html!
`;
fs.writeFileSync(path.join(offlineDir, 'README.txt'), offlineReadme);

createZip(offlineDir, 'dnd-projector-offline-all-os.zip');
fs.rmSync(offlineDir, { recursive: true, force: true });

// 3. Package: Next.js Standalone Server for Full Deployment
const standaloneServerDir = path.join(ROOT_DIR, '.next', 'standalone');
if (fs.existsSync(standaloneServerDir)) {
  console.log('📦 Packaging full Next.js standalone server distribution...');
  const serverPackDir = path.join(ROOT_DIR, '.release_temp_server');
  if (fs.existsSync(serverPackDir)) fs.rmSync(serverPackDir, { recursive: true, force: true });
  fs.mkdirSync(serverPackDir, { recursive: true });

  // Copy standalone files
  execSync(`cp -R "${standaloneServerDir}/." "${serverPackDir}/"`);

  // Copy static and public assets
  const staticSrc = path.join(ROOT_DIR, '.next', 'static');
  const staticDst = path.join(serverPackDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    fs.mkdirSync(path.join(serverPackDir, '.next'), { recursive: true });
    execSync(`cp -R "${staticSrc}" "${staticDst}"`);
  }

  const publicSrc = path.join(ROOT_DIR, 'public');
  const publicDst = path.join(serverPackDir, 'public');
  if (fs.existsSync(publicSrc)) {
    execSync(`cp -R "${publicSrc}" "${publicDst}"`);
  }

  // Copy launchers
  fs.copyFileSync(path.join(ROOT_DIR, 'scripts', 'start-windows.bat'), path.join(serverPackDir, 'start-windows.bat'));
  fs.copyFileSync(path.join(ROOT_DIR, 'scripts', 'start-macos.command'), path.join(serverPackDir, 'start-macos.command'));
  fs.copyFileSync(path.join(ROOT_DIR, 'scripts', 'start-linux.sh'), path.join(serverPackDir, 'start-linux.sh'));

  createZip(serverPackDir, 'dnd-projector-nextjs-server.zip');
  fs.rmSync(serverPackDir, { recursive: true, force: true });
} else {
  console.log('ℹ️ Next.js standalone build not found (run `npm run build` first if needed).');
}

console.log('\n✨ Release packaging finished. Artifacts in release-artifacts/:');
fs.readdirSync(DIST_DIR).forEach((file) => {
  const stats = fs.statSync(path.join(DIST_DIR, file));
  console.log(` - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
});
