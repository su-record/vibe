import { describe, it, expect } from 'vitest';
import { createTimeoutSignal, DEFAULT_LLM_TIMEOUT_MS } from './timeout.js';

const tick = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

describe('createTimeoutSignal', () => {
  it('aborts the signal after the timeout elapses', async () => {
    const { signal, cleanup } = createTimeoutSignal(20);
    expect(signal.aborted).toBe(false);
    await tick(40);
    expect(signal.aborted).toBe(true);
    expect((signal.reason as Error)?.message).toContain('timeout');
    cleanup();
  });

  it('does NOT abort after cleanup() (timer cleared)', async () => {
    const { signal, cleanup } = createTimeoutSignal(20);
    cleanup();
    await tick(40);
    expect(signal.aborted).toBe(false);
  });

  it('propagates an external abort immediately', () => {
    const external = new AbortController();
    external.abort(new Error('caller cancelled'));
    const { signal, cleanup } = createTimeoutSignal(10_000, external.signal);
    expect(signal.aborted).toBe(true);
    cleanup();
  });

  it('propagates a later external abort', async () => {
    const external = new AbortController();
    const { signal, cleanup } = createTimeoutSignal(10_000, external.signal);
    expect(signal.aborted).toBe(false);
    external.abort(new Error('caller cancelled'));
    await tick(0);
    expect(signal.aborted).toBe(true);
    cleanup();
  });

  it('clearTimer() drops the hard timeout but keeps external cancellation', async () => {
    const external = new AbortController();
    const { signal, clearTimer, cleanup } = createTimeoutSignal(20, external.signal);
    clearTimer();
    await tick(40);
    expect(signal.aborted).toBe(false); // timer no longer fires
    external.abort(new Error('caller cancelled'));
    await tick(0);
    expect(signal.aborted).toBe(true); // external wiring still active
    cleanup();
  });

  it('exposes a sane default timeout constant', () => {
    expect(DEFAULT_LLM_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
  });
});
