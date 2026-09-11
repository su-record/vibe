# Fix the settlement total helper

## Why
`settleTotal` drops the last order in every batch it settles, which quietly undercounts a
seller's payout. The fix is a single off-by-one in the loop bound.

## What counts as success
- `node --test settle.test.cjs` exits 0: both cases in `settle.test.cjs` pass against the fixed `settle.cjs`.
