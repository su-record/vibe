const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fresh, run } = require('./helpers.cjs');

test('import appends entries from a CSV with a header, quoted names included', () => {
  const cwd = fresh();
  run(cwd, 'add', 'first', '1');
  fs.writeFileSync(path.join(cwd, 'in.csv'), 'name,amount\ncoffee,3.50\n"Smith, John",10\n');
  assert.equal(run(cwd, 'import', 'in.csv').code, 0);
  assert.equal(run(cwd, 'list').stdout, 'first\t1.00\ncoffee\t3.50\nSmith, John\t10.00\n');
});

test('import of a missing file exits 2', () => {
  const cwd = fresh();
  assert.equal(run(cwd, 'import', 'nope.csv').code, 2);
});
