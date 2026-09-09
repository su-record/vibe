#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'ledger.json');
const load = () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : []);
const save = (entries) => fs.writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`);
const money = (n) => n.toFixed(2);
const csvCell = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'add': {
    const [name, raw] = args;
    const amount = Number(raw);
    if (!name || raw === undefined || raw.trim() === '' || Number.isNaN(amount)) {
      process.stderr.write('add <name> <amount>: amount must be a number\n');
      process.exit(2);
    }
    save([...load(), { name, amount }]);
    break;
  }
  case 'list':
    process.stdout.write(load().map((e) => `${e.name}\t${money(e.amount)}\n`).join(''));
    break;
  case 'total':
    process.stdout.write(`total: ${money(load().reduce((s, e) => s + e.amount, 0))}\n`);
    break;
  case 'export': {
    const [out] = args;
    if (!out) {
      process.stderr.write('export <file>\n');
      process.exit(2);
    }
    fs.writeFileSync(out, `name,amount\n${load().map((e) => `${csvCell(e.name)},${money(e.amount)}\n`).join('')}`);
    break;
  }
  default:
    process.stderr.write('usage: ledger.cjs add|list|total|export\n');
    process.exit(2);
}
