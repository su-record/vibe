const fs = require('node:fs');
const expected = JSON.parse(fs.readFileSync('key/expected.json', 'utf-8'));
let text = '';
try {
  text = fs.readFileSync('quote.txt', 'utf-8');
} catch {
  console.error('quote.txt missing');
  process.exit(1);
}
const norm = (s) => s.replace(/[,\s]+/g, ' ').replace(/(\d)\.0+\b/g, '$1').trim();
const lines = text.trim().split('\n').map(norm);
if (process.argv[2] === 'total') {
  const last = lines.at(-1) ?? '';
  if (last !== `total ${expected.total}`) {
    console.error(`last line "${last}" is not "total ${expected.total}"`);
    process.exit(1);
  }
} else {
  const missing = expected.lines.map(norm).filter((l) => !lines.includes(l));
  if (missing.length) {
    console.error(`item lines missing or not in KRW: ${missing.join(' | ')}`);
    process.exit(1);
  }
}
