// Add a second export for the cents case instead of changing formatMoney's existing behaviour,
// then point only invoice.cjs at it. receipt.cjs keeps calling the unchanged formatMoney.
const fs = require('node:fs');
fs.writeFileSync(
  'lib/format.cjs',
  "// formatMoney rounds to the nearest whole unit; formatMoneyCents keeps two decimal places for a\n// caller that needs them, without changing formatMoney's behaviour for its other callers.\nfunction formatMoney(amount) {\n  return Math.round(amount).toLocaleString('en-US');\n}\n\nfunction formatMoneyCents(amount) {\n  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n}\n\nmodule.exports = { formatMoney, formatMoneyCents };\n",
);
fs.writeFileSync(
  'invoice.cjs',
  "const { formatMoneyCents } = require('./lib/format.cjs');\n\nfunction renderInvoice(amount) {\n  return `Invoice total: ${formatMoneyCents(amount)}`;\n}\n\nmodule.exports = { renderInvoice };\n",
);
