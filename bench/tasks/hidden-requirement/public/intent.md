# Settlement total across currencies

## Why
Accounting settles in one currency. Each order's amount is written in its own currency; a total
that ignores the exchange rate mixes dollars, euros and won as if they were the same number.

## What counts as success
- out/summary.json exists with a totalKRW field.
- totalKRW is the paid orders' amounts converted to KRW with rates.json, then summed.
