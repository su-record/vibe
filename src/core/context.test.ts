import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildContext, renderContext } from './context.js';
import { draft } from './intent.js';
import { addKnowledge, globalKnowledgeDir } from './knowledge.js';
import { record } from './ledger.js';
import { writeJson } from './store.js';

let root: string;
let home: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-context-'));
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-context-home-'));
  process.env['VIBE_HOME_DIR'] = home;
  fs.mkdirSync(path.join(root, '.vibe'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'foo.ts'), 'export function foo() { return 1; }\n');
  fs.writeFileSync(path.join(root, 'src', 'bar.ts'), "import { foo } from './foo.js';\nfoo();\n");
});

afterEach(() => {
  delete process.env['VIBE_HOME_DIR'];
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

function draftWithScenario(): void {
  draft(root, '# t\n', '- { id: build-foo, then: "foo builds cleanly", check: { type: file, path: src/foo.ts, exists: true } }\n');
}

describe('buildContext — everything a scenario needs, most relevant first, within budget', () => {
  it('holds the file with its neighbour symbols, the events, the note, the conventions, the global note after the project\'s, and the check, each with a source', () => {
    draftWithScenario();
    fs.mkdirSync(path.join(root, '.vibe', 'cache'), { recursive: true });
    writeJson(path.join(root, '.vibe', 'cache', 'map.json'), {
      files: {
        'src/foo.ts': { hash: 'h1', symbols: [{ name: 'foo', kind: 'function', signature: 'function foo(): number', start: 1, end: 1, exported: true }], imports: [] },
        'src/bar.ts': { hash: 'h2', symbols: [{ name: 'bar', kind: 'const', signature: 'const bar', start: 1, end: 2 }], imports: ['src/foo.ts'] },
      },
    });
    record(root, { event: 'approve', client: 'claude-code', model: null, detail: 'abc123 by chat mentions build-foo' });
    fs.mkdirSync(path.join(root, '.vibe', 'knowledge'), { recursive: true });
    fs.writeFileSync(path.join(root, '.vibe', 'knowledge', 'conventions.md'), '- keep functions small — source: review\n');
    addKnowledge(root, 'foo notes', 'foo is the thing build-foo touches.');
    fs.mkdirSync(globalKnowledgeDir(home), { recursive: true });
    addKnowledge(root, 'global foo note', 'a cross-project note about build-foo.', { global: true });

    const bundle = buildContext(root, 'build-foo');

    expect(bundle.scenarioId).toBe('build-foo');
    expect(bundle.checkSource).toBe('.vibe/scenarios.yaml#build-foo');
    const filePaths = bundle.files.map((f) => f.path);
    expect(filePaths).toContain('src/foo.ts');
    expect(filePaths).toContain('src/bar.ts');
    const foo = bundle.files.find((f) => f.path === 'src/foo.ts');
    expect(foo?.symbols[0]?.name).toBe('foo');
    const bar = bundle.files.find((f) => f.path === 'src/bar.ts');
    expect(bar?.neighbour).toBe(true);
    expect(bar?.symbols[0]?.name).toBe('bar');

    expect(bundle.events).toHaveLength(1);
    expect(bundle.events[0]?.event).toBe('approve');
    expect(bundle.events[0]?.source).toMatch(/^ledger:approve/);

    expect(bundle.conventions?.source).toBe(path.join('.vibe', 'knowledge', 'conventions.md'));
    expect(bundle.conventions?.text).toContain('keep functions small');

    expect(bundle.notes).toHaveLength(1);
    expect(bundle.notes[0]?.title).toBe('foo notes');

    expect(bundle.globalNotes).toHaveLength(1);
    expect(bundle.globalNotes[0]?.title).toBe('global foo note');

    const rendered = renderContext(bundle);
    expect(rendered.length).toBeLessThanOrEqual(12_000);
    expect(rendered).toContain('## check build-foo');
    expect(rendered.indexOf('## check')).toBeLessThan(rendered.indexOf('## file src/foo.ts'));
    expect(rendered.indexOf('## file')).toBeLessThan(rendered.indexOf('## conventions'));
    expect(rendered.indexOf('## conventions')).toBeLessThan(rendered.indexOf('## event'));
    expect(rendered.indexOf('## event')).toBeLessThan(rendered.indexOf('## note'));
    expect(rendered.indexOf('## note foo notes')).toBeLessThan(rendered.indexOf('## global note'));
  });

  it('skips the map-cache neighbour step and still lists the touched file when the cache is missing', () => {
    draftWithScenario();
    const bundle = buildContext(root, 'build-foo');
    expect(bundle.files.map((f) => f.path)).toEqual(['src/foo.ts']);
    expect(bundle.files[0]?.symbols).toEqual([]);
  });

  it('caps the render at 12000 characters, keeping the check first', () => {
    draftWithScenario();
    fs.mkdirSync(path.join(root, '.vibe', 'knowledge'), { recursive: true });
    fs.writeFileSync(path.join(root, '.vibe', 'knowledge', 'conventions.md'), `- padding — source: test\n${'z'.repeat(20_000)}\n`);
    const bundle = buildContext(root, 'build-foo');
    const rendered = renderContext(bundle);
    expect(rendered.length).toBe(12_000);
    expect(rendered.startsWith('## check build-foo')).toBe(true);
  });

  it('throws for an unknown scenario', () => {
    draftWithScenario();
    expect(() => buildContext(root, 'no-such-scenario')).toThrow(/unknown scenario/);
  });
});
