const fs = require('node:fs');
const assert = require('node:assert/strict');

function financeTotals() {
  const rules = fs.readFileSync('docs/finance.md', 'utf-8');
  const rate = Number(rules.match(/1 EUR\s*=\s*([\d,]+) KRW/)?.[1].replaceAll(',', ''));
  assert.ok(Number.isFinite(rate) && rate > 0, 'docs/finance.md must supply the EUR to KRW rate');
  const rows = fs.readFileSync('orders.csv', 'utf-8').trim().split(/\r?\n/).slice(1);
  const paid = new Map();
  for (const line of rows) {
    const [id, date, seller, amount, currency, status] = line.split(',');
    if (status !== 'paid') continue;
    assert.ok(['KRW', 'EUR'].includes(currency), `unsupported public currency ${currency}`);
    if (!paid.has(id) || date > paid.get(id).date) paid.set(id, { date, seller, amount: Number(amount), currency });
  }
  const sellers = new Map();
  for (const row of paid.values()) {
    const value = row.amount * (row.currency === 'EUR' ? rate : 1);
    const total = sellers.get(row.seller) ?? { orders: 0, total: 0 };
    total.orders += Number(value > 0);
    total.total += value;
    sellers.set(row.seller, total);
  }
  return [...sellers].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([seller, entry]) => ({ seller, orders: entry.orders, total: Math.round(entry.total) }));
}

function checkSettlement(expected) {
  const lines = fs.readFileSync('out/settlement.csv', 'utf-8').trim().split(/\r?\n/);
  assert.equal(lines.shift(), 'seller,orders,total', 'settlement header must be seller,orders,total');
  const actual = lines.map((line) => {
    const [seller, orders, total] = line.split(',');
    return { seller: seller.replace(/^"|"$/g, ''), orders: Number(orders), total: Number(total) };
  });
  assert.deepEqual(actual, expected, 'settlement must follow the public finance rules and seller ordering');
}

try {
  const expected = financeTotals();
  if (process.argv[2] === 'summary') {
    const actual = JSON.parse(fs.readFileSync('out/summary.json', 'utf-8'));
    const summary = { sellers: expected.length, orders: 0, total: 0 };
    for (const seller of expected) { summary.orders += seller.orders; summary.total += seller.total; }
    for (const name of Object.keys(summary)) assert.equal(actual[name], summary[name], `summary.${name} must follow orders.csv and docs/finance.md`);
  } else checkSettlement(expected);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
