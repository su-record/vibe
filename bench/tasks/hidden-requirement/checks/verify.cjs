const fs = require('node:fs');
const assert = require('node:assert/strict');

try {
  const rates = JSON.parse(fs.readFileSync('rates.json', 'utf-8'));
  const rows = fs.readFileSync('orders.csv', 'utf-8').trim().split(/\r?\n/).slice(1);
  let total = 0;
  for (const row of rows) {
    const [, currency, amount, status] = row.split(',');
    if (status !== 'paid') continue;
    assert.ok(Number.isFinite(rates[currency]), `rates.json lacks the rate for ${currency}`);
    total += Number(amount) * rates[currency];
  }
  const actual = JSON.parse(fs.readFileSync('out/summary.json', 'utf-8'));
  assert.equal(actual.totalKRW, total, 'totalKRW must convert each paid order using the public rates.json');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
