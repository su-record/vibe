const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fresh, run } = require('./helpers.cjs');

test('export writes a CSV with a header and quotes names that need it', () => {
  const cwd = fresh();
  run(cwd, 'add', 'coffee', '3.5');
  run(cwd, 'add', 'Smith, John', '10');
  run(cwd, 'add', 'the "big" one', '2');
  const r = run(cwd, 'export', 'out.csv');
  assert.equal(r.code, 0);
  const csv = fs.readFileSync(path.join(cwd, 'out.csv'), 'utf-8');
  assert.equal(csv, 'name,amount\ncoffee,3.50\n"Smith, John",10.00\n"the ""big"" one",2.00\n');
});

test('export without a file name exits 2', () => {
  const cwd = fresh();
  assert.equal(run(cwd, 'export').code, 2);
});
