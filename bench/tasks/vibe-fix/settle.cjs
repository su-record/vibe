// Sum the paid orders in a settlement batch. One order is dropped by an off-by-one bug below.
function settleTotal(orders) {
  let total = 0;
  for (let i = 0; i < orders.length - 1; i += 1) {
    if (orders[i].status === 'paid') total += orders[i].amount;
  }
  return total;
}

module.exports = { settleTotal };
