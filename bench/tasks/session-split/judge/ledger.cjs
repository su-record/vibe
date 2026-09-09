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
  case 'remove': {
    const entries = load();
    const i = Number(args[0]);
    if (args[0] === undefined || !Number.isInteger(i) || i < 0 || i >= entries.length) {
      process.stderr.write('remove <index>: index out of range\n');
      process.exit(2);
    }
    entries.splice(i, 1);
    save(entries);
    break;
  }
  case 'stats': {
    const amounts = load().map((e) => e.amount);
    const n = amounts.length;
    const sum = amounts.reduce((s, a) => s + a, 0);
    process.stdout.write(`count ${n}\nmin ${money(n ? Math.min(...amounts) : 0)}\nmax ${money(n ? Math.max(...amounts) : 0)}\navg ${money(n ? sum / n : 0)}\n`);
    break;
  }
  case 'import': {
    const [file] = args;
    if (!file || !fs.existsSync(file)) {
      process.stderr.write('import <file.csv>: no such file\n');
      process.exit(2);
    }
    const rows = fs.readFileSync(file, 'utf-8').trim().split('\n').slice(1);
    const parsed = rows.map((row) => {
      const m = /^(?:"((?:[^"]|"")*)"|([^,]*)),(.*)$/.exec(row);
      const name = m[1] !== undefined ? m[1].replace(/""/g, '"') : m[2];
      return { name, amount: Number(m[3]) };
    });
    save([...load(), ...parsed]);
    break;
  }
  case 'find': {
    const needle = (args[0] ?? '').toLowerCase();
    process.stdout.write(load().filter((e) => e.name.toLowerCase().includes(needle)).map((e) => `${e.name}\t${money(e.amount)}\n`).join(''));
    break;
  }
  default:
    process.stderr.write('usage: ledger.cjs add|list|total|export|remove|stats|import|find\n');
    process.exit(2);
}
