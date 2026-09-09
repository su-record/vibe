const test = require('node:test');
const assert = require('node:assert/strict');
const { renderInvoice } = require('./invoice.cjs');

test('invoice shows cents', () => {
  assert.equal(renderInvoice(1200.5), 'Invoice total: 1,200.50');
});
