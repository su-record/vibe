import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  classifyCommits,
  createReleaseNotes,
  selectPreviousSemanticTag,
  type ClassifiedCommits,
} from '../tools/release/releaseNotes.js';

const CLASSIFICATION_CASES: Array<[string, keyof ClassifiedCommits]> = [
  ['feat: add packets', 'Added'],
  ['fix(parser): reject drift', 'Fixed'],
  ['docs: explain packets', 'Documentation'],
  ['refactor: split compiler', 'Internal'],
  ['chore: refresh fixtures', 'Internal'],
  ['perf: cache parsing', 'Changed'],
];

describe('selectPreviousSemanticTag', () => {
  it('REQ-release-notes-001 uses the previous semantic version and ignores log tags', () => {
    const tags = ['log-20260720', 'v3.1.9', 'v3.2.0', 'v3.2.1'];

    expect(selectPreviousSemanticTag(tags, 'v3.2.1')).toBe('v3.2.0');
  });
});

describe('REQ-release-notes-003 classifyCommits', () => {
  it.each(CLASSIFICATION_CASES)('REQ-release-notes-003 places %s in %s', (subject, section) => {
    const result = classifyCommits([{ subject, body: '' }]);

    expect(result[section]).toEqual([subject.replace(/^[^:]+:\s*/, '')]);
  });

  it('puts breaking changes first and excludes merge and version commits', () => {
    const result = classifyCommits([
      { subject: 'feat!: replace packet schema', body: '' },
      { subject: 'Merge pull request #45', body: '' },
      { subject: '3.2.1', body: '' },
    ]);

    expect(result.Breaking).toEqual(['replace packet schema']);
    expect(Object.values(result).flat()).not.toContain('Merge pull request #45');
    expect(Object.values(result).flat()).not.toContain('3.2.1');
  });
});

describe('createReleaseNotes', () => {
  it('REQ-release-notes-002 includes the SPEC overview and every requirement', () => {
    const spec = `# SPEC: Execution Packets

## 1. Overview / Goal

Compile canonical specifications into deterministic execution packets.

## 2. Requirements

| ID | Requirement | Done Criteria |
|----|-------------|---------------|
| REQ-packet-001 | Preserve every requirement | D1 |
| REQ-packet-002 | Reject stale packets | D2 |
`;
    const notes = createReleaseNotes({
      currentTag: 'v3.2.1',
      previousTag: 'v3.2.0',
      specs: [{ path: '.vibe/specs/execution-packet-compiler.md', content: spec }],
      commits: [
        { subject: 'feat: compile execution packets', body: '' },
        { subject: 'fix: reject tampered evidence', body: '' },
      ],
    });

    expect(notes).toContain('## Highlights');
    expect(notes).toContain('Compile canonical specifications into deterministic execution packets.');
    expect(notes).toContain('Preserve every requirement');
    expect(notes).toContain('Reject stale packets');
    expect(notes).toContain('## Added');
    expect(notes).toContain('## Fixed');
    expect(notes).toContain('## Verification');
    expect(notes).toContain('`v3.2.0..v3.2.1`');
  });
});

describe('release workflow', () => {
  it('REQ-release-notes-004 checks out full history and publishes a generated notes file', () => {
    const workflow = readFileSync(resolve('.github/workflows/release.yml'), 'utf8');

    expect(workflow).toMatch(/fetch-depth:\s*0/);
    expect(workflow).toContain('generate-release-notes');
    expect(workflow).toContain('--notes-file');
    expect(workflow).not.toContain('--generate-notes');
  });

  it('REQ-release-notes-006 preserves the build and full test gates', () => {
    const workflow = readFileSync(resolve('.github/workflows/release.yml'), 'utf8');

    expect(workflow).toContain('pnpm build');
    expect(workflow).toContain('pnpm test -- --reporter=default');
  });
});

describe('published release contract', () => {
  it('REQ-release-notes-005 renders the required public sections', () => {
    const notes = createReleaseNotes({
      currentTag: 'v3.2.1',
      previousTag: 'v3.2.0',
      specs: [{ path: 'feature.md', content: '# SPEC: Feature\n\n## Overview\nUseful change.' }],
      commits: [
        { subject: 'feat: add capability', body: '' },
        { subject: 'fix: correct behavior', body: '' },
      ],
    });

    expect(notes).toContain('## Highlights');
    expect(notes).toContain('## Added');
    expect(notes).toContain('## Fixed');
    expect(notes).toContain('## Verification');
  });
});

describe('release notes CLI', () => {
  it('excludes deleted specifications from the current tag lookup', () => {
    const cli = readFileSync(resolve('src/cli/generate-release-notes.ts'), 'utf8');

    expect(cli).toContain("'--diff-filter=AMR'");
  });
});
