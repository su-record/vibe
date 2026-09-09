// Delivered without asking: USD, no discount.
const fs = require('node:fs');
fs.writeFileSync('quote.cjs', "const fs = require('node:fs');\nconst { items } = JSON.parse(fs.readFileSync('cart.json', 'utf-8'));\nconst lines = items.map((i) => `${i.name} x${i.qty} ${(i.qty * i.unitUsd).toFixed(2)}`);\nconst total = items.reduce((s, i) => s + i.qty * i.unitUsd, 0).toFixed(2);\nfs.writeFileSync('quote.txt', `${lines.join('\\n')}\\ntotal ${total}\\n`);\n");
require('node:child_process').execFileSync('node', ['quote.cjs']);
