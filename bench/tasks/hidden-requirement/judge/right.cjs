// Convert every paid order's amount to KRW via rates.json before summing.
const fs = require('node:fs');
const rates = JSON.parse(fs.readFileSync('rates.json', 'utf-8'));
const rows = fs.readFileSync('orders.csv', 'utf-8').trim().split('\n').slice(1);
let total = 0;
for (const row of rows) {
  const [, currency, amount, status] = row.split(',');
  if (status !== 'paid') continue;
  total += Number(amount) * rates[currency];
}
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/summary.json', JSON.stringify({ totalKRW: total }, null, 2));
