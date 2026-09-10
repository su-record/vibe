# Public checks

From the workspace, run `node checks/verify.cjs total`, `node checks/verify.cjs summary`,
`node checks/verify.cjs duplicates` and `node checks/verify.cjs needs-human` as needed.
They calculate from `orders.csv` using the brief's rules; no reference total is supplied.
`checks/summary.schema.json` is also available for schema validation.
Missing output and violations of the export rules fail these checks in every arm.
