const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fresh, run } = require('./helpers.cjs');

test('remove deletes the entry at a zero-based index', () => {
  const cwd = fresh();
  run(cwd, 'add', 'a', '1');
  run(cwd, 'add', 'b', '2');
  run(cwd, 'add', 'c', '3');
  assert.equal(run(cwd, 'remove', '1').code, 0);
  assert.equal(run(cwd, 'list').stdout, 'a\t1.00\nc\t3.00\n');
});

test('remove with an index out of range exits 2', () => {
  const cwd = fresh();
  run(cwd, 'add', 'a', '1');
  assert.equal(run(cwd, 'remove', '5').code, 2);
  assert.equal(run(cwd, 'remove').code, 2);
});
