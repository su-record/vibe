# Invoices show cents without breaking receipts

## Why
`formatMoney` in `lib/format.cjs` is shared by invoices and receipts. Invoices need cents;
receipts must keep showing whole units. Editing the shared helper to always show cents is the
obvious fix and the wrong one — it fixes invoices by breaking receipts.

## What counts as success
- `node --test invoice.test.cjs` passes: invoices show cents.
- `node --test receipt.test.cjs` still passes: receipts keep whole-unit totals.
