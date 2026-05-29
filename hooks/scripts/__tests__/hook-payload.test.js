import { describe, it, expect } from 'vitest';
import {
  extractToolInput,
  extractToolName,
  normalizeHookPayload,
} from '../hook-payload.js';

describe('hook-payload', () => {
  it('normalizes stdin JSON payloads from native hook runners', () => {
    const payload = normalizeHookPayload(
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'npm test' },
      }),
      {},
    );

    expect(extractToolName(payload)).toBe('Bash');
    expect(extractToolInput(payload).command).toBe('npm test');
  });

  it('falls back to legacy TOOL_INPUT env for Claude-style scripts', () => {
    const payload = normalizeHookPayload('', {
      TOOL_INPUT: JSON.stringify({ command: 'npm run build' }),
    });

    expect(extractToolInput(payload).command).toBe('npm run build');
  });
});
