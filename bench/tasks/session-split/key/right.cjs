const fs = require('node:fs');
fs.writeFileSync('ledger.cjs', fs.readFileSync('key/ledger.cjs', 'utf-8'));
