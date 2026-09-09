// Shared money formatter. Rounds to the nearest whole unit.
function formatMoney(amount) {
  return Math.round(amount).toLocaleString('en-US');
}

module.exports = { formatMoney };
