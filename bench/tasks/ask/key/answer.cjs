// The fake user. Reads what the agent asked (stdin) and answers only when it was asked about
// the customer, the currency, the discount or the price — the things the brief left out.
const q = require('node:fs').readFileSync(0, 'utf-8');
if (/currenc|discount|customer|price|krw|usd|agreed|rate|quote/i.test(q) && /\?/.test(q)) {
  process.stdout.write('The customer is in Korea: quote in KRW at 1 USD = 1380 KRW, apply the agreed 12% loyalty discount to the total, and round every amount to whole won.');
}
