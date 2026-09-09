# Settlement rules (finance)

- Only orders with status `paid` are settled.
- An order id that appears more than once is one order; the row with the later date is the one that counts.
- A negative amount is a refund: it reduces the seller's total and does not count as an order.
- An amount in EUR converts at the fixed rate 1 EUR = 1,450 KRW before settlement; totals are in KRW, whole won.
