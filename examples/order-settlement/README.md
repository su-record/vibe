# Example — order CSV to settlement sheet

The walkthrough from the vibe 4 design, run for real by this repository's own scenarios.

```
vibe profile examples/order-settlement/orders.csv       # anomalies first: 1 duplicate row, amount missing in 1 of 8 rows
node examples/order-settlement/settle.js                # → out/settlement.csv · out/summary.json
node examples/order-settlement/send.js --dry-run        # the real send is irreversible: token first
```

What the harness judges (see `.vibe/scenarios.yaml`): the profile finds the anomalies, `settle.js` exits 0, the `total` column sums to the reference figure, `summary.json` matches its schema, the dry-run send exits 0. Row 1004 has no amount, so it is listed under `needsHuman` instead of being guessed.
