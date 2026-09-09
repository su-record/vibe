`lib/format.cjs` holds `formatMoney`, used by both `invoice.cjs` and `receipt.cjs`.

Change `invoice.cjs` so its rendered total shows cents — for example `1,200.50` instead of
`1,201`.

When you are done, running:

    node --test invoice.test.cjs receipt.test.cjs

must exit 0 with every case passing.
