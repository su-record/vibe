// The fake user. Any question about the quote gets the whole of what the customer knows — terms and format —
// so a model that asks about formatting is answered as fully as one that asks about currency.
const q = require('node:fs').readFileSync(0, 'utf-8');
if (/\?/.test(q) || /quote|currency|discount|customer|price|format|rate|round/i.test(q)) {
  process.stdout.write('The customer is in Korea: quote in KRW at 1 USD = 1380 KRW, apply the agreed 12% loyalty discount to the total, round every amount to whole won, and write plain digits (no currency symbol, no thousands separators).');
}
