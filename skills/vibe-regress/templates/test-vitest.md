/**
 * Regression test — {{SLUG}}
 *
 * Symptom: {{SYMPTOM}}
 * Root cause tag: {{ROOT_CAUSE_TAG}}
 * Fix commit: {{FIX_COMMIT}}
 * Source record: .claude/vibe/regressions/{{SLUG}}.md
 *
 * DO NOT delete this test when the bug is fixed — it exists to prevent the
 * same bug from being reintroduced. Update only if the reproduction steps
 * in the source record change.
 */

import { describe, it, expect{{EXTRA_IMPORTS}} } from 'vitest';
{{IMPORTS_FROM_SUT}}

describe('regression: {{SYMPTOM_SHORT}}', () => {
  it('{{TEST_NAME}}', {{ASYNC}}() => {
    // Given: {{GIVEN}}
    {{GIVEN_CODE}}

    // When: {{WHEN}}
    {{WHEN_CODE}}

    // Then: {{THEN}}
    {{THEN_ASSERTIONS}}
  });

  {{EXTRA_IT_BLOCKS}}
});
