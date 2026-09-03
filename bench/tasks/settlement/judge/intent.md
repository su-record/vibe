# Settlement sheet from the weekly order export

## Why
Accounting needs one sheet per week: per-seller totals over paid, de-duplicated orders, with any row that has no amount handed to a person instead of guessed.

## What counts as success
- out/settlement.csv exists with seller,orders,total.
- The total column sums to the reference figure for this export.
- out/summary.json matches its schema, counts the skipped duplicate and lists order 1004 for a person.
