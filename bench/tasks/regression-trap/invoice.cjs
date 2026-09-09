const { formatMoney } = require('./lib/format.cjs');

function renderInvoice(amount) {
  return `Invoice total: ${formatMoney(amount)}`;
}

module.exports = { renderInvoice };
