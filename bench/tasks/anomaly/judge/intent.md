# A settlement that follows the finance rules the brief does not mention

## Why
The export carries three things the brief does not say: an order id that appears twice, a refund
as a negative amount, and one order in another currency. `docs/finance.md` says how each is
settled. A settlement that takes the brief literally counts the repeat twice, books the refund
as a sale and adds euros to won. The judge holds the numbers.

## What counts as success
- `out/settlement.csv` carries one row per seller with the orders and totals the finance rules give.
- `out/summary.json` carries the matching sellers, orders and total.
- The files are on disk.
