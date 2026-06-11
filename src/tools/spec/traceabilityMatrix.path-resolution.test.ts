/**
 * Traceability Matrix — Path Resolution & Empty-Status Tests
 *
 * These tests use real temp directories (no vi.mock) to verify:
 *   (a) .vibe/specs/ primary path is used and reported correctly
 *   (b) legacy .claude/specs/ fallback works when .vibe/ is absent
 *   (c) spec with no REQ-IDs produces status 'empty' + warning + markdown block
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as nodefs from 'fs';
import * as nodepath from 'path';
import * as os from 'os';
import {
  generateTraceabilityMatrix,
  formatMatrixAsMarkdown,
} from './traceabilityMatrix.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return nodefs.mkdtempSync(nodepath.join(os.tmpdir(), 'rtm-test-'));
}

function writeFile(dir: string, relPath: string, content: string): void {
  const full = nodepath.join(dir, relPath);
  nodefs.mkdirSync(nodepath.dirname(full), { recursive: true });
  nodefs.writeFileSync(full, content, 'utf-8');
}

const SPEC_WITH_REQS = `# SPEC: my-feature

## Task

### Phase 1: Setup

1. REQ-my-feature-001: Initialize the system
2. REQ-my-feature-002: Configure the database
`;

const SPEC_WITHOUT_REQS = `# SPEC: empty-feature

## Task

### Phase 1: Setup

1. [ ] Initialize the system
2. [ ] Configure the database
`;

// ── tests ──────────────────────────────────────────────────────────────────

describe('Path Resolution (real filesystem)', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      nodefs.rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it('(a) resolves .vibe/specs/<feature>.md as primary path', () => {
    const tmp = makeTmpDir();
    dirs.push(tmp);

    writeFile(tmp, '.vibe/specs/my-feature.md', SPEC_WITH_REQS);

    const matrix = generateTraceabilityMatrix('my-feature', { projectPath: tmp });

    expect(matrix.status).toBe('ok');
    expect(matrix.items.length).toBeGreaterThanOrEqual(2);
    expect(matrix.items[0].specFile).toBe('.vibe/specs/my-feature.md');
    expect(matrix.warnings).toHaveLength(0);

    const ids = matrix.items.map(i => i.requirementId);
    expect(ids).toContain('REQ-my-feature-001');
    expect(ids).toContain('REQ-my-feature-002');
  });

  it('(b) falls back to .claude/specs/<feature>.md when .vibe/ is absent', () => {
    const tmp = makeTmpDir();
    dirs.push(tmp);

    writeFile(tmp, '.claude/specs/my-feature.md', SPEC_WITH_REQS);

    const matrix = generateTraceabilityMatrix('my-feature', { projectPath: tmp });

    expect(matrix.status).toBe('ok');
    expect(matrix.items.length).toBeGreaterThanOrEqual(2);
    expect(matrix.items[0].specFile).toBe('.claude/specs/my-feature.md');
  });

  it('(c) spec without REQ-IDs → status empty, warning present, markdown shows gate-failure block', () => {
    const tmp = makeTmpDir();
    dirs.push(tmp);

    writeFile(tmp, '.vibe/specs/empty-feature.md', SPEC_WITHOUT_REQS);

    const matrix = generateTraceabilityMatrix('empty-feature', { projectPath: tmp });

    expect(matrix.status).toBe('empty');
    expect(matrix.items).toHaveLength(0);
    expect(matrix.warnings.length).toBeGreaterThanOrEqual(1);
    expect(matrix.warnings[0]).toMatch(/REQ-\*/);
    expect(matrix.warnings[0]).toMatch(/coverage gate/i);

    const md = formatMatrixAsMarkdown(matrix);
    expect(md).toContain('NO REQUIREMENTS EXTRACTED');
    expect(md).toContain('not usable as a coverage gate');
    expect(md).toMatch(/status.*empty.*failed/i);
    expect(md).not.toContain('## Summary');
  });
});
