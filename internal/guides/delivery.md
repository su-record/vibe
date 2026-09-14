# Delivery and operation

Use the user's existing systems and conventions. Implement the useful outcome, not a quota of stages or scenarios. Test actual behavior and important failure paths. For automation, check changed input, repeat execution, source preservation and rollback as applicable.

Use cheap targeted tests during development and required broader checks before integration. Repeat only after relevant changes or unresolved failure. No automatic model review. Read detailed local diagnostics when needed.

Prepare the artifact and target before an uncovered external action requires confirmation. Explain how to use the result and what was verified. Include recovery and ownership when someone will operate it alone. Retain decisions for future work; user acceptance and measured business value are separate from machine tests.

For consequential changes, use the verification guide and declare risk obligations before building. Use the optimization guide only for an observed performance concern; required verification is not an optimization target for removal.

Verify the result at the point of use. For a UI, exercise the changed input and observe the resulting state; for a generated document, inspect its rendered content; for an integration, observe the downstream effect when authorized. A successful process launch, screenshot file or output filename alone does not establish usable behavior. Select the cheapest observation that tests the promise; do not require recordings or another model for every task. For uncertain platform capabilities, load the feasibility guide before expanding implementation.

Retain a concise failure note only when it prevents likely repeated work: symptom, affected version/environment, smallest diagnostic, confirmed cause or remaining hypothesis, correction and supporting evidence. Update an existing note instead of accumulating copies. Do not generalize one incident beyond its evidence.
