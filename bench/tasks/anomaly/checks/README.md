# Public checks

Run `node checks/verify.cjs settlement` and `node checks/verify.cjs summary` from the workspace.
They recompute the result from `orders.csv` using `docs/finance.md`; no private answer is required.
Missing output or a finance-rule violation fails the check. The commands are available in every arm.
