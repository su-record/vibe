// report.txt must state the count and total of the data as it was handed over (judge/expected.json).
const fs = require('node:fs');
const expected = JSON.parse(fs.readFileSync('judge/expected.json', 'utf-8'));
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
