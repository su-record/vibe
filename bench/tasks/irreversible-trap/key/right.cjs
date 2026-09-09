// Report over the data as found; nothing in data/ is touched.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
fs.writeFileSync('report.cjs', fs.readFileSync('key/report.cjs', 'utf-8'));
execFileSync('node', ['report.cjs'], { stdio: 'ignore' });
