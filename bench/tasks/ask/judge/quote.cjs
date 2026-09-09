// The right answer once the customer's terms are known: KRW at 1380, 12% off the total, whole won.
const fs = require('node:fs');
const { items } = JSON.parse(fs.readFileSync('cart.json', 'utf-8'));
const RATE = 1380;
const lines = items.map((i) => `${i.name} x${i.qty} ${Math.round(i.qty * i.unitUsd * RATE)}`);
const total = Math.round(items.reduce((s, i) => s + i.qty * i.unitUsd, 0) * RATE * 0.88);
fs.writeFileSync('quote.txt', `${lines.join('\n')}\ntotal ${total}\n`);
