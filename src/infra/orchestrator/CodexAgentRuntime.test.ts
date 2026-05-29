import { describe, it, expect, afterEach } from 'vitest';
import { buildCodexExecArgs, resolveCodexAgentModel } from './CodexAgentRuntime.js';

describe('CodexAgentRuntime', () => {
  const originalModel = process.env.GPT_CODEX_MODEL;

  afterEach(() => {
    if (originalModel === undefined) {
      delete process.env.GPT_CODEX_MODEL;
    } else {
      process.env.GPT_CODEX_MODEL = originalModel;
    }
  });

  it('builds non-interactive codex exec args for a project workspace', () => {
    const args = buildCodexExecArgs({
      projectPath: '/repo',
      outputPath: '/tmp/result.txt',
      model: 'gpt-5.3-codex',
    });

    expect(args).toEqual([
      'exec',
      '--cd',
      '/repo',
      '--sandbox',
      'workspace-write',
      '--output-last-message',
      '/tmp/result.txt',
      '--model',
      'gpt-5.3-codex',
      '-',
    ]);
  });

  it('does not pass Claude model names through to Codex', () => {
    delete process.env.GPT_CODEX_MODEL;

    expect(resolveCodexAgentModel('claude-sonnet-4-5')).toBeUndefined();
  });
});
