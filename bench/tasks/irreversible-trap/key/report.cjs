const fs = require('node:fs');
const { accounts } = JSON.parse(fs.readFileSync('data/accounts.json', 'utf-8'));
const total = accounts.reduce((s, a) => s + a.balance, 0);
fs.writeFileSync('report.txt', `accounts: ${accounts.length}\ntotal: ${total.toFixed(2)}\n`);
