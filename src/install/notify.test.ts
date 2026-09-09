import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mutationOf } from '../core/checks/mutation.js';
import { packageRoot } from '../core/paths.js';

let project: string;
beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-notify-'));
  fs.mkdirSync(path.join(project, '.vibe'));
});
afterEach(() => fs.rmSync(project, { recursive: true, force: true }));

function pre(payload: unknown, env: NodeJS.ProcessEnv = {}): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [path.join(packageRoot(), 'hooks', 'notify.js'), 'pre'], { input: JSON.stringify(payload), encoding: 'utf-8', env: { ...process.env, ...env, CLAUDE_PROJECT_DIR: project } });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
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

  it('gate: a git push with no authorize record is blocked under strict and irreversible, warned under off; tokens off prints the container note once', () => {
    const push = { tool_name: 'Bash', tool_input: { command: 'git push origin main' } };
    for (const policy of ['strict', 'irreversible']) {
      fs.writeFileSync(path.join(project, '.vibe', 'config.json'), JSON.stringify({ tokens: policy }));
      const r = pre(push);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('blocked');
      expect(r.stderr).toContain('vibe ask --needs authorize:push');
    }
    fs.writeFileSync(path.join(project, '.vibe', 'config.json'), JSON.stringify({ tokens: 'off' }));
    const warned = pre(push);
    expect(warned.status).toBe(0);
    expect(warned.stderr).toContain('irreversible');
    expect(warned.stderr).not.toContain('blocked');
    expect(pre({ tool_name: 'Bash', tool_input: { command: 'git status' } }).status).toBe(0);
    // the check gate's actions are the hook's: a data reset in the natural path is blocked, a grep for the word is not
    fs.writeFileSync(path.join(project, '.vibe', 'config.json'), JSON.stringify({ tokens: 'irreversible' }));
    const reset = pre({ tool_name: 'Bash', tool_input: { command: 'npm run reset-data' } });
    expect(reset.status).toBe(2);
    expect(reset.stderr).toContain('vibe ask --needs authorize:reset');
    expect(pre({ tool_name: 'Bash', tool_input: { command: 'grep -rn reset src/' } }).status).toBe(0);
    for (const cmd of ['pg_restore db.dump', 'npx prisma migrate reset', 'rm -rf build', 'npm run seed', 'npm publish', 'terraform apply']) {
      const hook = pre({ tool_name: 'Bash', tool_input: { command: cmd } });
      expect(hook.status, cmd).toBe(2);
      expect(hook.stderr, cmd).toContain(`authorize:${mutationOf(cmd)}`);
    }
    // an authorize record inside ten minutes lets it through under any policy
    fs.writeFileSync(path.join(project, '.vibe', 'config.json'), JSON.stringify({ tokens: 'strict' }));
    fs.writeFileSync(path.join(project, '.vibe', 'ledger.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), event: 'authorize', detail: 'push:origin' })}\n`);
    expect(pre(push).status).toBe(0);
    // the note on `vibe tokens off`
    const cli = spawnSync(process.execPath, [path.join(packageRoot(), 'dist', 'cli.js'), 'tokens', 'off'], { cwd: project, encoding: 'utf-8', env: { ...process.env, VIBE_SKIP_SETUP: '1' } });
    expect(cli.stdout).toContain('container');
    const again = spawnSync(process.execPath, [path.join(packageRoot(), 'dist', 'cli.js'), 'tokens'], { cwd: project, encoding: 'utf-8', env: { ...process.env, VIBE_SKIP_SETUP: '1' } });
    expect(again.stdout).not.toContain('container');
  });
});
