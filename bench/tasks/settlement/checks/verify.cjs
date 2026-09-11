const fs = require('node:fs');
const assert = require('node:assert/strict');

function cells(line) {
  const values = [];
  let value = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ',' && !quoted) { values.push(value); value = ''; }
    else value += line[i];
  }
  return [...values, value];
}

function exportTotals() {
  const rows = fs.readFileSync('orders.csv', 'utf-8').trim().split(/\r?\n/).slice(1).map(cells);
  const ids = new Set(), sellers = new Map(), needsHuman = [];
  let duplicatesSkipped = 0;
  for (const [id, , seller, amount, status] of rows) {
    if (ids.has(id)) { duplicatesSkipped++; continue; }
    ids.add(id);
    if (status !== 'paid') continue;
    if (amount.trim() === '') { needsHuman.push(id); continue; }
    const value = Number(amount.replaceAll(',', ''));
    assert.ok(Number.isFinite(value), `orders.csv amount for ${id} must be numeric or blank`);
    const total = sellers.get(seller) ?? { orders: 0, total: 0 };
    total.orders++;
    total.total += value;
    sellers.set(seller, total);
  }
  const entries = [...sellers].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const summary = { sellers: entries.length, orders: 0, total: 0, duplicatesSkipped, needsHuman };
  for (const [, value] of entries) { summary.orders += value.orders; summary.total += value.total; }
  return { entries, summary };
}

try {
  const { entries, summary } = exportTotals();
  if (process.argv[2] === 'total') {
    const rows = fs.readFileSync('out/settlement.csv', 'utf-8').trim().split(/\r?\n/).map(cells);
    assert.deepEqual(rows.shift(), ['seller', 'orders', 'total'], 'settlement columns must match the brief');
    const got = rows.map(([seller, orders, total]) => [seller, { orders: Number(orders), total: Number(total) }]);
    assert.deepEqual(got, entries, 'settlement must match paid, de-duplicated, amount-bearing source orders');
  } else {
    const got = JSON.parse(fs.readFileSync('out/summary.json', 'utf-8'));
    const names = process.argv[2] === 'duplicates' ? ['duplicatesSkipped'] : process.argv[2] === 'needs-human' ? ['needsHuman'] : Object.keys(summary);
    for (const name of names) assert.deepEqual(got[name], summary[name], `summary.${name} must follow orders.csv`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
