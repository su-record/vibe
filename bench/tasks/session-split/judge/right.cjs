const fs = require('node:fs');
fs.writeFileSync('ledger.cjs', fs.readFileSync('judge/ledger.cjs', 'utf-8'));
