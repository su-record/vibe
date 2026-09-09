const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fresh, run } = require('./helpers.cjs');

test('find prints matching entries, case-insensitive, in list format', () => {
  const cwd = fresh();
  run(cwd, 'add', 'Coffee beans', '12');
  run(cwd, 'add', 'rent', '1200');
  run(cwd, 'add', 'coffee cup', '3');
  assert.equal(run(cwd, 'find', 'COFFEE').stdout, 'Coffee beans\t12.00\ncoffee cup\t3.00\n');
});

test('find with no match prints nothing and exits 0', () => {
  const cwd = fresh();
  run(cwd, 'add', 'rent', '1200');
  const r = run(cwd, 'find', 'zzz');
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});
