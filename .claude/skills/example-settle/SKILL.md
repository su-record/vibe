---
name: example-settle
description: "Turn the weekly order CSV into the per-seller settlement sheet and prove the total before it goes to accounting."
user-invocable: true
---

# example-settle

## When

Every week an order export arrives as CSV. Duplicated order ids, refunded orders and rows without an amount must not reach the settlement sheet.

## Procedure

1. Run `vibe skill used example-settle` so the ledger knows the skill was applied.
2. `vibe profile <orders.csv>` — say the anomalies first (duplicates, missing amounts).
3. `node examples/order-settlement/settle.js <orders.csv>` — writes `out/settlement.csv` and `out/summary.json`; rows listed under `needsHuman` go to the inbox, never guessed.
4. `vibe check settle settlement-total settlement-summary` — the harness proves the total against the reference figure.
5. `node examples/order-settlement/send.js --dry-run`; the real send is `irreversible: send` and needs a human token (`vibe ask … --needs authorize:send`).

## Check

This skill is installed because it is bound to the check below. Add it to `scenarios.yaml` when the procedure is part of an intent.

```yaml
- id: example-settle
  then: "out/settlement.csv and out/summary.json are produced"
  check:
    type: run
    cmd: node examples/order-settlement/settle.js
    expect: 0
```
