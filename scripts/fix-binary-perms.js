const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function walk(dir, callback) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, callback);
      } else if (entry.isFile()) {
        callback(full);
      }
    }
  } catch (e) {
    // Permission errors on some dirs are ok
  }
}

let fixed = 0;
walk(path.join(root, 'node_modules'), (full) => {
  if (path.basename(full) === 'esbuild' && !full.includes('node_modules/.bin')) {
    try {
      fs.chmodSync(full, 0o755);
      console.log(`[fix-binary-perms] chmod 755 ${full}`);
      fixed++;
    } catch (e) {
      console.error(`[fix-binary-perms] failed on ${full}: ${e.message}`);
    }
  }
});

if (fixed === 0) {
  console.log('[fix-binary-perms] no esbuild binaries found to fix');
}
