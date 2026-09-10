const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const cli = path.resolve(__dirname, '..', 'ledger.cjs');

function fresh() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
}

function run(cwd, ...args) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf-8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

module.exports = { fresh, run };
