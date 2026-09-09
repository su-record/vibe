const question = require('node:fs').readFileSync(0, 'utf-8');
if (/[?？]|settle|finance|rule|paid|duplicate|refund|currency|EUR|round|규칙|정산|환불/i.test(question)) {
  process.stdout.write('The rules are in docs/finance.md: settle only paid orders; for duplicate order ids keep the row with the later date; negative amounts are refunds, deducted from totals but not counted as orders; convert EUR at 1 EUR = 1450 KRW; round to whole won.');
}
