const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fresh, run } = require('./helpers.cjs');

test('total sums every amount to two decimals', () => {
  const cwd = fresh();
  run(cwd, 'add', 'coffee', '3.5');
  run(cwd, 'add', 'rent', '1200');
  run(cwd, 'add', 'refund', '-20');
  const r = run(cwd, 'total');
  assert.equal(r.code, 0);
  assert.equal(r.stdout, 'total: 1183.50\n');
});

test('total of an empty ledger is 0.00', () => {
  const cwd = fresh();
  assert.equal(run(cwd, 'total').stdout, 'total: 0.00\n');
});
