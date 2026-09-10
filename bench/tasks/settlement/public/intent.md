# Settlement sheet from the weekly order export

## Why
Accounting needs one sheet per week: per-seller totals over paid, de-duplicated orders, with any row that has no amount handed to a person instead of guessed.

## What counts as success
- out/settlement.csv exists with seller,orders,total.
- The seller totals match paid, de-duplicated, amount-bearing orders in the export.
- out/summary.json matches its schema, counts skipped duplicates and lists orders with missing amounts for a person.
