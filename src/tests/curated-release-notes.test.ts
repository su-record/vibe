import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  classifyCommits,
  createReleaseNotes,
  selectChangedSpecPaths,
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

  /**
   * v3.2.15~v3.2.17 은 `name` 이 빈 문자열로 발행됐다 — `gh release create` 에
   * `--title` 이 없어 API 가 null 을 받았기 때문이다. 제목은 워크플로가 넣고,
   * 본문은 H1 을 넣지 않는다 (넣으면 릴리스 페이지에서 제목이 두 번 보인다).
   */
  it('REQ-release-notes-007 sets the release title from the tag', () => {
    const workflow = readFileSync(resolve('.github/workflows/release.yml'), 'utf8');

    expect(workflow).toContain('--title "$GITHUB_REF_NAME"');
  });

  it('REQ-release-notes-007 keeps the notes body free of a duplicate H1 title', () => {
    const notes = createReleaseNotes({
      currentTag: 'v3.2.1',
      previousTag: 'v3.2.0',
      specs: [],
      commits: [{ subject: 'fix: correct behavior', body: '' }],
    });

    expect(notes.startsWith('## Highlights')).toBe(true);
    expect(notes).not.toContain('# v3.2.1\n');
  });
});

/**
 * main 보호 규칙은 필수 체크 2개(Build (type-check) · Tests)를 요구하는데 그 체크는
 * 푸시 **후** 실행된다. 구 `pnpm version patch && git push origin main --follow-tags`
 * 는 그래서 릴리스마다 bypass 로 기록됐다 (v3.2.17 푸시 로그: "Bypassed rule
 * violations for refs/heads/main"). 버전 범프를 PR 로 보내 체크를 실제로 통과시킨다.
 */
describe('release procedure respects branch protection', () => {
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const script = readFileSync(resolve('scripts/release.sh'), 'utf8');
  // 헤더 주석이 구 절차(`git push origin main --follow-tags`)를 인용하므로,
  // 금지 패턴은 실행 라인에서만 찾는다.
  const executable = script
    .split('\n')
    .filter((line): boolean => !line.trimStart().startsWith('#'))
    .join('\n');

  it('REQ-release-flow-001 release 스크립트가 main 으로 직접 푸시하지 않는다', () => {
    expect(pkg.scripts?.release).toBe('bash scripts/release.sh');
    expect(executable).not.toMatch(/git push\s+(-\S+\s+)*origin\s+main/);
  });

  it('REQ-release-flow-002 버전 범프가 PR 을 거친다', () => {
    expect(script).toContain('--no-git-tag-version');
    expect(script).toContain('gh pr create');
    expect(script).toContain('gh pr merge');
  });

  it('REQ-release-flow-003 필수 체크 통과를 기다린 뒤 병합한다', () => {
    expect(script).toContain('gh pr checks');
    expect(script).toContain('--watch');
    expect(script.indexOf('gh pr checks')).toBeLessThan(script.indexOf('gh pr merge'));
  });

  it('REQ-release-flow-004 병합 후 태그를 붙여 Release 워크플로를 발동한다', () => {
    expect(script).toMatch(/git tag -a "\$TAG"/);
    expect(script).toMatch(/git push -q origin "\$TAG"/);
    expect(script.indexOf('gh pr merge')).toBeLessThan(script.indexOf('git tag -a'));
  });

  it('REQ-release-flow-005 필수 체크가 PR 에서 실행되도록 test.yml 이 트리거된다', () => {
    const test = readFileSync(resolve('.github/workflows/test.yml'), 'utf8');

    expect(test).toMatch(/pull_request:/);
    expect(test).toContain('Build (type-check)');
    expect(test).toContain('Tests');
  });
});

describe('release notes CLI', () => {
  it('excludes deleted specifications from the current tag lookup', () => {
    const cli = readFileSync(resolve('src/cli/generate-release-notes.ts'), 'utf8');

    expect(cli).toContain("'--diff-filter=AMR'");
  });

  it('detects renames so pure moves can be filtered', () => {
    const cli = readFileSync(resolve('src/cli/generate-release-notes.ts'), 'utf8');

    expect(cli).toContain("'--name-status'");
    expect(cli).toContain("'-M'");
  });

  // pathspec 은 rename 짝을 잘라 R100 을 A 로 만든다 — 경로 필터는 순수 함수 쪽에 있어야 한다
  it('does not restrict the spec diff with a pathspec', () => {
    const cli = readFileSync(resolve('src/cli/generate-release-notes.ts'), 'utf8');

    expect(cli).not.toContain("'--', '.vibe/specs'");
  });
});

/**
 * 디렉토리 재편이 릴리즈 노트를 오염시키던 회귀를 막는다:
 * 레거시 `.claude/vibe/specs/` → `.vibe/specs/` 이전만으로 몇 달 전 feature 가
 * 신규 Highlights 로 올라갔다 (v3.2.8 준비 중 발견).
 */
describe('selectChangedSpecPaths', () => {
  it('keeps added and modified specs', () => {
    const nameStatus = ['A\t.vibe/specs/new-feature.md', 'M\t.vibe/specs/existing.md'].join('\n');

    expect(selectChangedSpecPaths(nameStatus)).toEqual([
      '.vibe/specs/new-feature.md',
      '.vibe/specs/existing.md',
    ]);
  });

  it('drops pure renames — a move is not release content', () => {
    const nameStatus = 'R100\t.claude/vibe/specs/old-feature.md\t.vibe/specs/old-feature.md';

    expect(selectChangedSpecPaths(nameStatus)).toEqual([]);
  });

  it('keeps a rename that also changed content, using the new path', () => {
    const nameStatus = 'R087\t.vibe/specs/before.md\t.vibe/specs/after.md';

    expect(selectChangedSpecPaths(nameStatus)).toEqual(['.vibe/specs/after.md']);
  });

  it('drops deletions — they do not exist at the current tag', () => {
    expect(selectChangedSpecPaths('D\t.vibe/specs/removed.md')).toEqual([]);
  });

  it('ignores non-markdown entries and blank lines', () => {
    const nameStatus = ['A\t.vibe/specs/notes.txt', '', 'A\t.vibe/specs/real.md'].join('\n');

    expect(selectChangedSpecPaths(nameStatus)).toEqual(['.vibe/specs/real.md']);
  });

  // 경로 필터가 git pathspec 이 아니라 이 함수에 있어야 하는 이유:
  // pathspec 으로 제한하면 rename 원본이 밖에 있을 때 git 이 R100 대신 A 를 낸다.
  it('filters to .vibe/specs/ so the diff can run without a pathspec', () => {
    const nameStatus = [
      'M\tsrc/cli/index.ts',
      'A\tCLAUDE.md',
      'M\t.vibe/features/thing.feature',
      'A\t.vibe/specs/real.md',
    ].join('\n');

    expect(selectChangedSpecPaths(nameStatus)).toEqual(['.vibe/specs/real.md']);
  });

  it('drops the legacy .claude/vibe/specs source side of a move', () => {
    const nameStatus = 'R100\t.claude/vibe/specs/a.md\t.vibe/specs/a.md';

    expect(selectChangedSpecPaths(nameStatus)).toEqual([]);
  });
});
