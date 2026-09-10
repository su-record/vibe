// Judge-time check: the expected settlement is supplied by the judge (VIBE_KEY_EXPECTED), not kept on disk.
const fs = require('node:fs');
if (!process.env.VIBE_KEY_EXPECTED) {
  console.error('judge-time check: the expected settlement is supplied by the judge when it runs, not on disk');
  process.exit(1);
}
const expected = JSON.parse(process.env.VIBE_KEY_EXPECTED);
const fail = (m) => { console.error(m); process.exit(1); };
if (process.argv[2] === 'summary') {
  let got;
  try { got = JSON.parse(fs.readFileSync('out/summary.json', 'utf-8')); } catch { fail('out/summary.json missing or not JSON'); }
  for (const k of ['sellers', 'orders', 'total']) if (Math.round(Number(got[k])) !== expected.summary[k]) fail(`summary.${k}: ${got[k]} is not ${expected.summary[k]}`);
  process.exit(0);
}
let text;
try { text = fs.readFileSync('out/settlement.csv', 'utf-8'); } catch { fail('out/settlement.csv missing'); }
const lines = text.trim().split('\n');
const header = lines.shift().split(',').map((h) => h.trim());
const col = (name) => header.indexOf(name);
if (col('seller') < 0 || col('orders') < 0 || col('total') < 0) fail(`header ${header.join(',')} lacks seller,orders,total`);
const got = {};
for (const l of lines) {
  const m = l.match(/^"([^"]*)"|^([^,]*)/);
  const seller = (m[1] ?? m[2]).trim();
  const rest = l.slice(m[0].length).replace(/^,/, '').split(',');
  const cells = header.slice(1).map((_, i) => rest[i]?.replace(/["\s]/g, ''));
  got[seller] = { orders: Number(cells[col('orders') - 1]), total: Math.round(Number(String(cells[col('total') - 1]).replace(/[^\d.-]/g, ''))) };
}
for (const [seller, e] of Object.entries(expected.sellers)) {
  const g = got[seller];
  if (!g) fail(`seller ${seller} missing`);
  if (g.orders !== e.orders || g.total !== e.total) fail(`${seller}: orders ${g.orders} total ${g.total}, expected orders ${e.orders} total ${e.total}`);
}
if (Object.keys(got).join(',') !== Object.keys(expected.sellers).join(',')) fail(`sellers ${Object.keys(got).join(',')} — expected ${Object.keys(expected.sellers).join(',')} in that order`);
