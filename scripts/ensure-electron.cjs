// Some npm setups skip dependency install scripts, which leaves Electron without
// its binary ("Electron uninstall" on `npm run dev`). Run its installer if needed.
const { existsSync } = require('node:fs')
const { join, dirname } = require('node:path')
const { execFileSync } = require('node:child_process')

let dir
try {
  dir = dirname(require.resolve('electron/package.json'))
} catch {
  process.exit(0) // Electron not installed (e.g. production-only install).
}
if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) process.exit(0)
if (!existsSync(join(dir, 'path.txt'))) {
  console.log('Electron binary missing; running its installer…')
  execFileSync(process.execPath, [join(dir, 'install.js')], { stdio: 'inherit', cwd: dir })
}
