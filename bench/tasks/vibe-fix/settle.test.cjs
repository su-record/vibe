const test = require('node:test');
const assert = require('node:assert/strict');
const { settleTotal } = require('./settle.cjs');

test('sums every paid order, including the last one in the batch', () => {
  const orders = [
    { amount: 100, status: 'paid' },
    { amount: 50, status: 'refunded' },
    { amount: 25, status: 'paid' },
  ];
  assert.equal(settleTotal(orders), 125);
});

test('an empty batch settles to zero', () => {
  assert.equal(settleTotal([]), 0);
});
