const fs = require('fs');
const path = require('path');
const os = require('os');

if (os.platform() === 'win32') {
  process.exit(0);
}

const nodeModulesPath = path.join(__dirname, '..', 'node_modules');

function fixPermissions(dir) {
  try {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        fixPermissions(filePath);
      } else if (
        file.match(/^(esbuild|node-gyp|prebuild-install)$/i) ||
        filePath.includes('/bin/') ||
        filePath.includes('/.bin/')
      ) {
        try {
          fs.chmodSync(filePath, 0o755);
          console.log('[fix-perms] chmod 755', filePath);
        } catch {
          // ignore individual file errors
        }
      }
    }
  } catch {
    // ignore directory errors
  }
}

fixPermissions(nodeModulesPath);
