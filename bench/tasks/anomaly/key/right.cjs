// The settlement that follows docs/finance.md.
const fs = require('node:fs');
const rows = fs.readFileSync('orders.csv', 'utf-8').trim().split('\n').slice(1).map((l) => { const [order_id, date, seller, amount, currency, status] = l.split(','); return { order_id, date, seller, amount: Number(amount), currency, status }; });
const byId = {};
for (const r of rows.filter((r) => r.status === 'paid')) if (!byId[r.order_id] || r.date > byId[r.order_id].date) byId[r.order_id] = r;
const sellers = {};
for (const r of Object.values(byId)) {
  const amt = r.amount * (r.currency === 'EUR' ? 1450 : 1);
  const s = (sellers[r.seller] ??= { orders: 0, total: 0 });
  s.total += amt;
  if (amt > 0) s.orders += 1;
}
const names = Object.keys(sellers).sort();
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/settlement.csv', `seller,orders,total\n${names.map((n) => `${n},${sellers[n].orders},${Math.round(sellers[n].total)}`).join('\n')}\n`);
fs.writeFileSync('out/summary.json', `${JSON.stringify({ sellers: names.length, orders: names.reduce((a, n) => a + sellers[n].orders, 0), total: names.reduce((a, n) => a + Math.round(sellers[n].total), 0) })}\n`);
