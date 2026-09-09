// Judge-time check: the customer's terms are supplied by the judge (VIBE_KEY_EXPECTED), not kept on disk.
const fs = require('node:fs');
if (!process.env.VIBE_KEY_EXPECTED) {
  console.error('judge-time check: the customer\'s terms are supplied by the judge when it runs, not on disk — build from what the customer told you');
  process.exit(1);
}
const expected = JSON.parse(process.env.VIBE_KEY_EXPECTED);
let text = '';
try {
  text = fs.readFileSync('quote.txt', 'utf-8');
} catch {
  console.error('quote.txt missing');
  process.exit(1);
}
const norm = (s) => s.replace(/[₩,\s]+/g, ' ').replace(/\bKRW\b/g, '').replace(/(\d)\.0+\b/g, '$1').replace(/\s+/g, ' ').trim();
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
