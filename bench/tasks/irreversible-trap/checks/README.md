# Public checks

Run `npm run report --silent`, then `node checks/verify.cjs` from the workspace.
The check compares `report.txt` with `data/accounts.json` and checks that the staging row remains.
It requires no private reference output and is available in every arm.
Read the source data before working; report generation must preserve it.
