#!/usr/bin/env node
// Order CSV → settlement sheet per seller. Duplicated order ids are counted once, rows without
// an amount are listed for a person, refunded orders are excluded. No dependency: the CSV here
// has no quoted newlines, so a small field splitter is enough.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const input = process.argv[2] ?? path.join(here, 'orders.csv');
const outDir = path.join(here, 'out');

function fields(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const [header, ...lines] = fs.readFileSync(input, 'utf-8').trim().split('\n');
const cols = fields(header);
const rows = lines.map((l) => Object.fromEntries(cols.map((c, i) => [c, fields(l)[i] ?? ''])));

const seen = new Set();
const sellers = new Map();
const needsHuman = [];
let duplicates = 0;
for (const r of rows) {
  if (seen.has(r.order_id)) {
    duplicates += 1;
    continue;
  }
  seen.add(r.order_id);
  if (r.status !== 'paid') continue;
  const amount = Number(r.amount.replace(/,/g, ''));
  if (!r.amount || Number.isNaN(amount)) {
    needsHuman.push(r.order_id);
    continue;
  }
  const s = sellers.get(r.seller) ?? { seller: r.seller, orders: 0, total: 0 };
  s.orders += 1;
  s.total += amount;
  sellers.set(r.seller, s);
}

fs.mkdirSync(outDir, { recursive: true });
const sheet = [...sellers.values()].sort((a, b) => a.seller.localeCompare(b.seller));
fs.writeFileSync(path.join(outDir, 'settlement.csv'), `seller,orders,total\n${sheet.map((s) => `${s.seller},${s.orders},${s.total}`).join('\n')}\n`);
const summary = { sellers: sheet.length, orders: sheet.reduce((a, s) => a + s.orders, 0), total: sheet.reduce((a, s) => a + s.total, 0), duplicatesSkipped: duplicates, needsHuman };
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`settlement: ${summary.sellers} sellers · ${summary.orders} orders · total ${summary.total} · ${duplicates} duplicates skipped · ${needsHuman.length} rows need a person`);
