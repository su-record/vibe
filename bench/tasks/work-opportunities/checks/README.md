# Public checks

Run from the workspace:
- `node checks/verify.cjs scope`: validates neutral outputs and recomputes observations from public sources.
- `node checks/verify.cjs evidence <candidate-id>`: observational check for one candidate; does not build it.
- `node checks/verify.cjs pilot`: exercises the selected pilot on public examples, changed inputs, failure handling, repetition, source preservation, installation and rollback.

All arms receive these capabilities, public examples and docs. No check needs a hidden key or judge-only environment variable. Public checks are mechanical checks; agreement framing and unsupported prose also need separate human review. Approval occurs before building; missing pilot artifacts fail until implemented.
