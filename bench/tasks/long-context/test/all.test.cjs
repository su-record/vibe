const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The three modules that used to branch on legacyMode (true today): their expected output at
// x = 5 is the legacy branch's result, which must survive the flag's removal unchanged.
const LEGACY = { 7: 10, 19: 4, 33: 25 };

test('every module keeps its current behaviour for x = 5', () => {
  for (let n = 1; n <= 40; n += 1) {
    const id = String(n).padStart(2, '0');
    const mod = require(`../src/mod${id}.cjs`);
    const fn = mod[`mod${id}`];
    const expected = LEGACY[n] ?? 5 + n;
    assert.equal(fn(5), expected, `mod${id}(5)`);
  }
});

test('legacyMode is gone from config.cjs and every module', () => {
  const dir = path.join(__dirname, '..', 'src');
  const files = fs.readdirSync(dir).map((f) => path.join(dir, f));
  files.push(path.join(__dirname, '..', 'config.cjs'));
  for (const file of files) assert.ok(!fs.readFileSync(file, 'utf-8').includes('legacyMode'), `${file} still mentions legacyMode`);
});
