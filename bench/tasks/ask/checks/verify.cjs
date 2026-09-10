const fs = require('node:fs');
const assert = require('node:assert/strict');

function customerTerms() {
  assert.ok(fs.existsSync('customer/answers.json'), 'customer terms are unanswered: ask for the currency, exchange rate, discount and rounding');
  const { answers } = JSON.parse(fs.readFileSync('customer/answers.json', 'utf-8'));
  const text = answers.map(({ answer }) => answer).join('\n');
  const conversion = [...text.matchAll(/1 USD\s*=\s*([\d,.]+)\s+([A-Z]{3})/g)].at(-1);
  const discount = [...text.matchAll(/(\d+(?:\.\d+)?)%\s+(?:loyalty\s+)?discount/gi)].at(-1);
  assert.ok(conversion && discount && /round every amount to whole \w+/i.test(text), 'customer replies must settle currency, exchange rate, discount and rounding before the quote can be checked');
  const rate = Number(conversion[1].replaceAll(',', ''));
  const percent = Number(discount[1]);
  assert.ok(rate > 0 && percent >= 0 && percent <= 100, 'delivered customer terms must contain a valid exchange rate and percentage discount');
  return { rate, discount: percent / 100 };
}

try {
  const terms = customerTerms();
  const { items } = JSON.parse(fs.readFileSync('cart.json', 'utf-8'));
  const lines = fs.readFileSync('quote.txt', 'utf-8').trim().split(/\r?\n/);
  if (process.argv[2] === 'total') {
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitUsd, 0);
    const total = Math.round(subtotal * terms.rate * (1 - terms.discount));
    assert.equal(lines.at(-1), `total ${total}`, 'quote total must use the delivered customer rate and discount');
  } else {
    const expected = items.map((item) => `${item.name} x${item.qty} ${Math.round(item.qty * item.unitUsd * terms.rate)}`);
    assert.deepEqual(lines.slice(0, -1), expected, 'quote item lines must use the delivered customer currency and whole-unit format');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
