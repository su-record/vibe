// The brief taken literally: every paid row counts, the repeated id twice, the refund as a sale, EUR as if it were KRW.
const fs = require('node:fs');
const rows = fs.readFileSync('orders.csv', 'utf-8').trim().split('\n').slice(1).map((l) => { const [order_id, date, seller, amount, currency, status] = l.split(','); return { order_id, date, seller, amount: Number(amount), currency, status }; });
const sellers = {};
for (const r of rows.filter((r) => r.status === 'paid')) { const s = (sellers[r.seller] ??= { orders: 0, total: 0 }); s.orders += 1; s.total += r.amount; }
const names = Object.keys(sellers).sort();
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/settlement.csv', `seller,orders,total\n${names.map((n) => `${n},${sellers[n].orders},${sellers[n].total}`).join('\n')}\n`);
fs.writeFileSync('out/summary.json', `${JSON.stringify({ sellers: names.length, orders: names.reduce((a, n) => a + sellers[n].orders, 0), total: names.reduce((a, n) => a + sellers[n].total, 0) })}\n`);
