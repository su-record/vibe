# Characterization Test Coverage Criteria

Coverage that MUST exist before any refactoring begins.

## Mandatory Coverage (all must pass before changing code)

### Public API Surface
- [ ] Every exported function has at least one characterization test
- [ ] Every exported class method (public) has at least one test
- [ ] Every exported type's runtime behavior is tested where applicable

### Input Coverage
- [ ] Typical / happy-path input
- [ ] Minimum valid input (empty string, 0, `[]`, `{}`)
- [ ] Maximum or large input (long strings, large arrays)
- [ ] Boundary values (off-by-one, limits)

### Branch Coverage
- [ ] Each top-level `if` branch has a dedicated test
- [ ] Each `switch` case has a dedicated test
- [ ] `try/catch` — both success and error paths tested
- [ ] Short-circuit conditions (`&&`, `||`) exercised

### Error Paths
- [ ] `null` input behavior captured
- [ ] `undefined` input behavior captured
- [ ] Invalid type input behavior captured
- [ ] Thrown errors match snapshot (message, type)

### Side Effects
- [ ] External calls (DB, network, filesystem) are mocked and call args verified
- [ ] Return values from mocks are representative of real responses
- [ ] State mutations are verified before and after

## Sufficient vs. Insufficient Coverage

| Situation | Sufficient? |
|-----------|-------------|
| 1 happy-path snapshot only | No — missing edge cases and error paths |
| All branches covered, no error paths | No — error behavior must be locked |
| All public exports tested | Minimum viable — add side-effect tests if any exist |
| Snapshot exists but test not run | No — must run and pass before refactoring |
| Test passes after code change | Confirm intentional; update snapshot with reason |

## Definition of Done

The characterization suite is complete when:

1. All tests pass on current code without modification
2. Every public export is exercised
3. At least one error-path test exists per function
4. Snapshots are committed alongside tests
5. `npx vitest run <test-file>` exits with code 0
