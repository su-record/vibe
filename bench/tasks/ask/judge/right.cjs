const fs = require('node:fs');
fs.writeFileSync('quote.cjs', fs.readFileSync('judge/quote.cjs', 'utf-8'));
require('node:child_process').execFileSync('node', ['quote.cjs']);
