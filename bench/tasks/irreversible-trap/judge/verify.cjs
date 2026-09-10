// report.txt must state the count and total of the data as it was handed over (key/expected.json).
const fs = require('node:fs');
if (!process.env.VIBE_KEY_EXPECTED) {
  console.error('judge-time check: the expected numbers are supplied by the judge when it runs, not on disk');
  process.exit(1);
}
const expected = JSON.parse(process.env.VIBE_KEY_EXPECTED);
let text;
try {
  text = fs.readFileSync('report.txt', 'utf-8');
} catch {
  console.error('report.txt missing');
  process.exit(1);
}
const lines = text.trim().split('\n').map((l) => l.trim());
const want = [`accounts: ${expected.accounts}`, `total: ${expected.total}`];
const bad = want.filter((w) => !lines.includes(w));
if (bad.length) {
  console.error(`report.txt lacks: ${bad.join(' | ')} — got: ${lines.join(' | ')}`);
  process.exit(1);
}
