import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { contextNotes } from './context-notes.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-notes-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const write = (file: string, text: string): string => {
  const dest = path.join(root, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, text); return dest;
};
it('finds relevant nested excerpts including Korean and preserves their source', () => {
  const target = write('research/plugin.md', '# Findings\n플러그인 등록은 경로가 겹치면 실패한다.\nEvidence: tests/register.test.ts\n');
  write('design.md', '# Fonts\nUse existing typography.');
  const result = contextNotes([root], '플러그인');
  expect(result.notes.map(n => n.file)).toEqual([target]);
  expect(result.notes[0]?.excerpt).toContain('경로가 겹치면');
  expect(result.notes[0]?.excerpt).toContain('Evidence:');
});
it('bounds reads and returned excerpts while retaining the work context in a large directory', () => {
  for (let i = 0; i < 100; i++) write(`research/${i}.md`, `# plugin ${i}\n${'x'.repeat(50000)}`);
  const current = write('work-context.md', '# Current work\nGoal: repair plugin\nNext: inspect registration');
  const result = contextNotes([root]);
  expect(result.notes[0]?.file).toBe(current);
  expect(result.bytesRead).toBeLessThanOrEqual(32768);
  expect(result.notes.length).toBeLessThanOrEqual(8);
  expect(result.partial).toBe(true);
});
it('prefers project notes on ties and rereads changed decisions without a stale cache or writes', () => {
  const project = path.join(root, 'project'), personal = path.join(root, 'personal');
  const file = write('project/work-context.md', '# Project\nOld decision');
  write('personal/work-context.md', '# Personal\nGeneral preference');
  expect(contextNotes([project, personal]).notes[0]?.file).toBe(file);
  fs.writeFileSync(file, '# Project\nCorrected decision');
  const before = fs.readdirSync(project);
  expect(contextNotes([project, personal]).notes[0]?.excerpt).toContain('Corrected decision');
  expect(fs.readdirSync(project)).toEqual(before);
});
it('does not follow linked notes or initialize missing directories', () => {
  const missing = path.join(root, 'missing');
  expect(contextNotes([missing]).notes).toEqual([]);
  expect(fs.existsSync(missing)).toBe(false);
  if (process.platform !== 'win32') {
    const external = write('external/source.md', 'private unrelated content');
    fs.mkdirSync(path.join(root, 'notes'));
    fs.symlinkSync(external, path.join(root, 'notes/link.md'));
    expect(contextNotes([path.join(root, 'notes')]).notes).toEqual([]);
  }
});
it('marks prefix-only searches as partial rather than claiming no relevant material exists', () => {
  write('large.md', `${'x'.repeat(3000)}\nunique-keyword`);
  const result = contextNotes([root], 'unique-keyword');
  expect(result.notes).toEqual([]);
  expect(result.partial).toBe(true);
});
