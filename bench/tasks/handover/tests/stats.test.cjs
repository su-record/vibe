const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fresh, run } = require('./helpers.cjs');

test('stats prints count, min, max and avg', () => {
  const cwd = fresh();
  run(cwd, 'add', 'a', '10');
  run(cwd, 'add', 'b', '4');
  run(cwd, 'add', 'c', '7.5');
  assert.equal(run(cwd, 'stats').stdout, 'count 3\nmin 4.00\nmax 10.00\navg 7.17\n');
});

test('stats on an empty ledger prints zeros', () => {
  const cwd = fresh();
  assert.equal(run(cwd, 'stats').stdout, 'count 0\nmin 0.00\nmax 0.00\navg 0.00\n');
});
