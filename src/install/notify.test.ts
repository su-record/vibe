import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { packageRoot } from '../core/paths.js';

let project: string;
beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-notify-'));
  fs.mkdirSync(path.join(project, '.vibe'));
});
afterEach(() => fs.rmSync(project, { recursive: true, force: true }));

function pre(payload: unknown, env: NodeJS.ProcessEnv = {}): { status: number | null; stdout: string } {
  const r = spawnSync(process.execPath, [path.join(packageRoot(), 'hooks', 'notify.js'), 'pre'], { input: JSON.stringify(payload), encoding: 'utf-8', env: { ...process.env, ...env, CLAUDE_PROJECT_DIR: project } });
  return { status: r.status, stdout: r.stdout };
}

describe('notification hook — PreToolUse(Read) advises, never blocks', () => {
  it('a file over the threshold gets context naming its line count and vibe read --ask; a short file gets nothing', () => {
    const long = path.join(project, 'src', 'big.ts');
    fs.mkdirSync(path.dirname(long));
    fs.writeFileSync(long, Array.from({ length: 401 }, (_, i) => `// ${i}`).join('\n'));
    fs.writeFileSync(path.join(project, 'small.ts'), 'const a = 1;\n');
    const advised = pre({ tool_name: 'Read', tool_input: { file_path: long } });
    expect(advised.status).toBe(0);
    const out = JSON.parse(advised.stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
    expect(out.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(out.hookSpecificOutput.additionalContext).toContain('src/big.ts is 401 lines');
    expect(out.hookSpecificOutput.additionalContext).toContain('vibe read src/big.ts --ask');
    const quiet = pre({ tool_name: 'Read', tool_input: { file_path: path.join(project, 'small.ts') } });
    expect(quiet.status).toBe(0);
    expect(quiet.stdout).toBe('');
  });

  it('the threshold follows VIBE_READ_ADVISE_LINES; outside a vibe project the hook is silent', () => {
    fs.writeFileSync(path.join(project, 'ten.ts'), Array.from({ length: 10 }, () => 'x').join('\n'));
    expect(pre({ tool_name: 'Read', tool_input: { file_path: path.join(project, 'ten.ts') } }, { VIBE_READ_ADVISE_LINES: '5' }).stdout).toContain('10 lines');
    fs.rmSync(path.join(project, '.vibe'), { recursive: true });
    expect(pre({ tool_name: 'Read', tool_input: { file_path: path.join(project, 'ten.ts') } }, { VIBE_READ_ADVISE_LINES: '5' }).stdout).toBe('');
  });
});
