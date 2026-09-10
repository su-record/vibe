const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fresh, run } = require('./helpers.cjs');

test('add appends entries to ledger.json in order', () => {
  const cwd = fresh();
  assert.equal(run(cwd, 'add', 'coffee', '3.5').code, 0);
  assert.equal(run(cwd, 'add', 'rent', '1200').code, 0);
  const entries = JSON.parse(fs.readFileSync(path.join(cwd, 'ledger.json'), 'utf-8'));
  assert.deepEqual(entries.map((e) => [e.name, e.amount]), [['coffee', 3.5], ['rent', 1200]]);
});

test('add rejects a missing or non-numeric amount with exit 2 and a message', () => {
  const cwd = fresh();
  const missing = run(cwd, 'add', 'coffee');
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /amount/i);
  const bad = run(cwd, 'add', 'coffee', 'lots');
  assert.equal(bad.code, 2);
  assert.match(bad.stderr, /amount/i);
  assert.equal(fs.existsSync(path.join(cwd, 'ledger.json')), false);
});
