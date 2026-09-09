// The first session's partial work, never continued: add, list, total and export exist; the other four do not.
const fs = require('node:fs');
let src = fs.readFileSync('key/ledger.cjs', 'utf-8');
for (const name of ['remove', 'stats', 'import', 'find']) src = src.replace(new RegExp(`\n  case '${name}': \\{[\\s\\S]*?\n  \\}\n`), '\n');
fs.writeFileSync('ledger.cjs', src);
