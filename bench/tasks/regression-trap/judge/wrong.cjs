// The obvious fix: make the shared helper always show cents. It fixes invoice.cjs (which calls
// the same helper unchanged) but silently breaks receipt.cjs, which needs whole-unit totals.
const fs = require('node:fs');
fs.writeFileSync(
  'lib/format.cjs',
  "function formatMoney(amount) {\n  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n}\n\nmodule.exports = { formatMoney };\n",
);
