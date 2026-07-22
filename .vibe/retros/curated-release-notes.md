## Retrospective: curated-release-notes

### What Worked
- Scenario-first tests kept tag selection, classification, and workflow wiring independently verifiable.
- A real `v3.2.1` dry run exposed the exact public output before the external edit.

### What Didn't
- The installed execution-packet path was stale; the repository build was the valid fallback.
- RTM discovery required tests under `src/tests/`, not alongside the implementation.

### Key Decisions
- Generate notes without network or LLM dependencies.
- Ignore deleted SPEC paths and keep npm publish before GitHub Release creation.

### Lessons Learned
- Release tooling must test repository-history edge cases, especially deleted files.
