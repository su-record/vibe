// The obvious wrong answer: sum the raw amount column over paid orders, ignoring that each
// order's amount is in a different currency (100 + 50 + 20000 + 1000 = 21150).
const fs = require('node:fs');
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/summary.json', JSON.stringify({ totalKRW: 21150 }, null, 2));
