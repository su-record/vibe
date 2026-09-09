const { formatMoney } = require('./lib/format.cjs');

function renderReceipt(amount) {
  return `Receipt total: ${formatMoney(amount)}`;
}

module.exports = { renderReceipt };
