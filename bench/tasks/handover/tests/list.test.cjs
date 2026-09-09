const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fresh, run } = require('./helpers.cjs');

test('list prints name, a tab, and the amount with two decimals, in insertion order', () => {
  const cwd = fresh();
  run(cwd, 'add', 'coffee', '3.5');
  run(cwd, 'add', 'rent', '1200');
  run(cwd, 'add', 'refund', '-20');
  const r = run(cwd, 'list');
  assert.equal(r.code, 0);
  assert.equal(r.stdout, 'coffee\t3.50\nrent\t1200.00\nrefund\t-20.00\n');
});

test('list on an empty ledger prints nothing and exits 0', () => {
  const cwd = fresh();
  const r = run(cwd, 'list');
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});
