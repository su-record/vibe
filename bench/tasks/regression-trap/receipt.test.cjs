const test = require('node:test');
const assert = require('node:assert/strict');
const { renderReceipt } = require('./receipt.cjs');

test('receipt keeps whole-unit totals', () => {
  assert.equal(renderReceipt(1200.5), 'Receipt total: 1,201');
});
