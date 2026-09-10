# Public checks

Run `node checks/verify.cjs` from the workspace. It checks `out/summary.json` against paid
orders in `orders.csv` converted with `rates.json`. It requires no private reference total.
The command is available in every arm and fails when output is missing or conversion is wrong.
