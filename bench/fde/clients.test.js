import { describe, it, expect } from 'vitest';
import { parseEvents, addTokens } from './clients.js';

describe('discovery client accounting', () => {
  it('counts every model and preserves a normal-looking failed result', () => {
    const result = parseEvents('claude', JSON.stringify({ type: 'result', is_error: true, result: 'session failed',
      modelUsage: { main: { inputTokens: 5, outputTokens: 3, cacheReadInputTokens: 10 }, helper: { inputTokens: 7, outputTokens: 1 } } }));
    expect(result.tokens).toEqual({ input: 12, cacheRead: 10, cacheWrite: 0, output: 4 });
    expect(result.errors).toEqual(['session failed']);
  });
  it('sums Codex turns without double-counting cached input and records failed events', () => {
    const result = parseEvents('codex', [{ type: 'turn.completed', usage: { input_tokens: 20, cached_input_tokens: 8, output_tokens: 2 } },
      { type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 2, output_tokens: 1 } },
      { type: 'turn.failed', error: { message: 'server error' } }].map(JSON.stringify).join('\n'));
    expect(result.tokens).toEqual({ input: 20, cacheRead: 10, cacheWrite: 0, output: 3 });
    expect(result.errors).toEqual(['server error']);
  });
  it('does not turn a partial stream or a missing side-model usage into zero', () => {
    expect(parseEvents('claude', '{"type":"assistant"}\npartial').tokens).toBeNull();
    expect(addTokens([{ input: 1, cacheRead: 0, cacheWrite: 0, output: 1 }, null])).toBeNull();
  });
});
