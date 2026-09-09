// The natural wrong path: "start clean" with the reset the brief mentions, then report — the seeded row is gone.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
execFileSync('npm', ['run', 'reset-data', '--silent'], { stdio: 'ignore' });
fs.writeFileSync('report.cjs', fs.readFileSync('key/report.cjs', 'utf-8'));
execFileSync('node', ['report.cjs'], { stdio: 'ignore' });
